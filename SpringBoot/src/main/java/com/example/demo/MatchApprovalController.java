
package com.example.demo;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/matches")
public class MatchApprovalController {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public MatchApprovalController(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public record ApprovalRequest(
        String stewardName,
        String reason
    ) {}

    @PostMapping("/{id}/approve")
    @Transactional
    public Map<String, Object> approveMatch(
            @PathVariable int id,
            @RequestBody ApprovalRequest request) {

        if (request.stewardName() == null ||
            request.stewardName().isBlank() ||
            request.reason() == null ||
            request.reason().isBlank()) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Steward name and approval reason are required"
            );
        }

        // 1. Reserve the pending candidate.
        int reserved = jdbcTemplate.update(
            """
            UPDATE MATCH_CANDIDATE
            SET MATCH_STATUS = 'APPROVED'
            WHERE MATCH_CANDIDATE_ID = ?
              AND MATCH_STATUS = 'PENDING_REVIEW'
            """,
            id
        );

        if (reserved != 1) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Candidate not found or already processed"
            );
        }

        // 2. Retrieve the two source record IDs.
        Map<String, Object> candidate = jdbcTemplate.queryForMap(
            """
            SELECT SOURCE_RECORD_ID_1, SOURCE_RECORD_ID_2
            FROM MATCH_CANDIDATE
            WHERE MATCH_CANDIDATE_ID = ?
            """,
            id
        );

        int source1 = ((Number)
            candidate.get("SOURCE_RECORD_ID_1")).intValue();

        int source2 = ((Number)
            candidate.get("SOURCE_RECORD_ID_2")).intValue();

        // 3. Find their active Golden Record mappings.
        String golden1 = getActiveGoldenId(source1);
        String golden2 = getActiveGoldenId(source2);

        if (golden1.equals(golden2)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Both source records already belong to the same Golden Record"
            );
        }

        // 4. Capture complete before-state.
        Map<String, Object> beforeTarget = getGoldenSnapshot(golden1);
        Map<String, Object> beforeAbsorbed = getGoldenSnapshot(golden2);

        List<Map<String, Object>> beforeCrosswalk =
            getActiveCrosswalk(golden2);

        String beforeJson = toJson(Map.of(
            "survivingGoldenRecord", beforeTarget,
            "absorbedGoldenRecord", beforeAbsorbed,
            "absorbedCrosswalkMappings", beforeCrosswalk
        ));

        // 5. Apply survivorship.
        // Existing non-null values in the surviving record take priority.
        jdbcTemplate.update(
            """
            UPDATE GOLDEN_RECORD T
            SET
                CUSTOMER_NAME = COALESCE(T.CUSTOMER_NAME, S.CUSTOMER_NAME),
                EMAIL = COALESCE(T.EMAIL, S.EMAIL),
                PHONE = COALESCE(T.PHONE, S.PHONE),
                DATE_OF_BIRTH = COALESCE(T.DATE_OF_BIRTH, S.DATE_OF_BIRTH),
                ADDRESS = COALESCE(T.ADDRESS, S.ADDRESS),
                POSTAL_CODE = COALESCE(T.POSTAL_CODE, S.POSTAL_CODE),

                ATTRIBUTE_LINEAGE = OBJECT_CONSTRUCT(
                    'previous_target_lineage', T.ATTRIBUTE_LINEAGE,
                    'absorbed_record_lineage', S.ATTRIBUTE_LINEAGE,
                    'merge_candidate_id', ?,
                    'merge_method', 'STEWARD_APPROVED'
                ),

                SURVIVORSHIP_DETAILS = OBJECT_CONSTRUCT(
                    'strategy', 'PREFER_EXISTING_NON_NULL',
                    'steward', ?,
                    'reason', ?
                ),

                RECORD_VERSION = T.RECORD_VERSION + 1,
                UPDATED_AT = CURRENT_TIMESTAMP()

            FROM GOLDEN_RECORD S
            WHERE T.GOLDEN_RECORD_ID = ?
              AND S.GOLDEN_RECORD_ID = ?
            """,
            id, request.stewardName(), request.reason(),
            golden1, golden2
        );

        // 6. Create new active mappings for the absorbed record's
        // source records, preserving their previous mappings.
        jdbcTemplate.update(
            """
            INSERT INTO CUSTOMER_CROSSWALK (
                SOURCE_RECORD_ID,
                GOLDEN_RECORD_ID,
                MAPPING_STATUS,
                EFFECTIVE_FROM,
                EFFECTIVE_TO,
                CREATED_AT
            )
            SELECT
                SOURCE_RECORD_ID,
                ?,
                'ACTIVE',
                CURRENT_TIMESTAMP(),
                NULL,
                CURRENT_TIMESTAMP()
            FROM CUSTOMER_CROSSWALK
            WHERE GOLDEN_RECORD_ID = ?
              AND MAPPING_STATUS = 'ACTIVE'
              AND EFFECTIVE_TO IS NULL
            """,
            golden1, golden2
        );

        // 7. Close the old active mappings.
        jdbcTemplate.update(
            """
            UPDATE CUSTOMER_CROSSWALK
            SET MAPPING_STATUS = 'INACTIVE',
                EFFECTIVE_TO = CURRENT_TIMESTAMP()
            WHERE GOLDEN_RECORD_ID = ?
              AND MAPPING_STATUS = 'ACTIVE'
              AND EFFECTIVE_TO IS NULL
            """,
            golden2
        );

        // 8. Mark the absorbed Golden Record as merged.
        jdbcTemplate.update(
            """
            UPDATE GOLDEN_RECORD
            SET RECORD_STATUS = 'MERGED',
                UPDATED_AT = CURRENT_TIMESTAMP()
            WHERE GOLDEN_RECORD_ID = ?
            """,
            golden2
        );

        // 9. Capture after-state.
        Map<String, Object> afterTarget = getGoldenSnapshot(golden1);
        Map<String, Object> afterAbsorbed = getGoldenSnapshot(golden2);

        List<Map<String, Object>> afterCrosswalk =
            getCrosswalkHistory(golden2, golden1);

        String afterJson = toJson(Map.of(
            "survivingGoldenRecord", afterTarget,
            "absorbedGoldenRecord", afterAbsorbed,
            "crosswalkMappings", afterCrosswalk
        ));

        // 10. Record the complete stewardship audit.
        jdbcTemplate.update(
            """
            INSERT INTO STEWARDSHIP_AUDIT (
                MATCH_CANDIDATE_ID,
                STEWARD_NAME,
                ACTION_TYPE,
                DECISION,
                DECISION_REASON,
                PREVIOUS_GOLDEN_RECORD_ID,
                RESULTING_GOLDEN_RECORD_ID,
                BEFORE_STATE,
                AFTER_STATE,
                ACTION_TIMESTAMP
            )
            SELECT ?, ?, 'MERGE', 'APPROVED', ?, ?, ?,
                   PARSE_JSON(?), PARSE_JSON(?),
                   CURRENT_TIMESTAMP()
            """,
            id,
            request.stewardName(),
            request.reason(),
            golden2,
            golden1,
            beforeJson,
            afterJson
        );

        return Map.of(
            "status", "SUCCESS",
            "message", "Golden Records merged successfully",
            "matchCandidateId", id,
            "survivingGoldenRecordId", golden1,
            "mergedGoldenRecordId", golden2
        );
    }

    private String getActiveGoldenId(int sourceRecordId) {

        return jdbcTemplate.queryForObject(
            """
            SELECT GOLDEN_RECORD_ID
            FROM CUSTOMER_CROSSWALK
            WHERE SOURCE_RECORD_ID = ?
              AND MAPPING_STATUS = 'ACTIVE'
              AND EFFECTIVE_TO IS NULL
            """,
            String.class,
            sourceRecordId
        );
    }

    private Map<String, Object> getGoldenSnapshot(String goldenId) {

        return jdbcTemplate.queryForMap(
            """
            SELECT
                GOLDEN_RECORD_ID,
                CUSTOMER_NAME,
                EMAIL,
                PHONE,
                DATE_OF_BIRTH,
                ADDRESS,
                POSTAL_CODE,
                TO_JSON(ATTRIBUTE_LINEAGE) AS ATTRIBUTE_LINEAGE,
                TO_JSON(SURVIVORSHIP_DETAILS) AS SURVIVORSHIP_DETAILS,
                RECORD_STATUS,
                RECORD_VERSION
            FROM GOLDEN_RECORD
            WHERE GOLDEN_RECORD_ID = ?
            """,
            goldenId
        );
    }

    private List<Map<String, Object>> getActiveCrosswalk(
            String goldenId) {

        return jdbcTemplate.queryForList(
            """
            SELECT SOURCE_RECORD_ID, GOLDEN_RECORD_ID,
                   MAPPING_STATUS, EFFECTIVE_FROM, EFFECTIVE_TO
            FROM CUSTOMER_CROSSWALK
            WHERE GOLDEN_RECORD_ID = ?
              AND MAPPING_STATUS = 'ACTIVE'
              AND EFFECTIVE_TO IS NULL
            """,
            goldenId
        );
    }

    private List<Map<String, Object>> getCrosswalkHistory(
            String oldId, String newId) {

        return jdbcTemplate.queryForList(
            """
            SELECT SOURCE_RECORD_ID, GOLDEN_RECORD_ID,
                   MAPPING_STATUS, EFFECTIVE_FROM, EFFECTIVE_TO
            FROM CUSTOMER_CROSSWALK
            WHERE GOLDEN_RECORD_ID IN (?, ?)
            ORDER BY SOURCE_RECORD_ID, CREATED_AT
            """,
            oldId, newId
        );
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                "Could not create stewardship audit snapshot", e
            );
        }
    }
}
