
package com.example.demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/matches")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:8080"})
public class MatchUnmergeController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public MatchUnmergeController(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public record UnmergeRequest(String stewardName, String reason) {}

    @PostMapping("/{id}/unmerge")
    @Transactional
    public ResponseEntity<?> unmerge(
            @PathVariable long id,
            @RequestBody UnmergeRequest request) {

        if (request == null ||
            request.stewardName() == null ||
            request.stewardName().isBlank() ||
            request.reason() == null ||
            request.reason().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Steward name and reason are required"));
        }

        try {
            List<Map<String, Object>> audits = jdbc.queryForList("""
                SELECT AUDIT_ID,
                       BEFORE_STATE,
                       PREVIOUS_GOLDEN_RECORD_ID,
                       RESULTING_GOLDEN_RECORD_ID
                FROM STEWARDSHIP_AUDIT
                WHERE MATCH_CANDIDATE_ID = ?
                  AND ACTION_TYPE = 'MERGE'
                  AND DECISION = 'APPROVED'
                ORDER BY ACTION_TIMESTAMP DESC
                LIMIT 1
                """, id);

            if (audits.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "No approved merge audit found"));
            }

            Map<String, Object> audit = audits.get(0);

            String absorbedId =
                    audit.get("PREVIOUS_GOLDEN_RECORD_ID").toString();

            String survivingId =
                    audit.get("RESULTING_GOLDEN_RECORD_ID").toString();

            String status = jdbc.queryForObject("""
                SELECT MATCH_STATUS
                FROM MATCH_CANDIDATE
                WHERE MATCH_CANDIDATE_ID = ?
                """, String.class, id);

            if (!"APPROVED".equals(status)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Match is not currently approved"));
            }

            String survivingStatus = jdbc.queryForObject("""
                SELECT RECORD_STATUS
                FROM GOLDEN_RECORD
                WHERE GOLDEN_RECORD_ID = ?
                """, String.class, survivingId);

            String absorbedStatus = jdbc.queryForObject("""
                SELECT RECORD_STATUS
                FROM GOLDEN_RECORD
                WHERE GOLDEN_RECORD_ID = ?
                """, String.class, absorbedId);

            if (!"ACTIVE".equals(survivingStatus)
                    || !"MERGED".equals(absorbedStatus)) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error",
                                "Golden Record states are not safe for reversal"));
            }

            JsonNode before = mapper.readTree(
                    audit.get("BEFORE_STATE").toString());

            JsonNode originalSurviving =
                    before.path("survivingGoldenRecord");

            JsonNode originalAbsorbed =
                    before.path("absorbedGoldenRecord");

            JsonNode originalMappings =
                    before.path("absorbedCrosswalkMappings");

            if (!originalSurviving.isObject()
                    || !originalAbsorbed.isObject()
                    || !originalMappings.isArray()
                    || originalMappings.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Incomplete original merge snapshot"));
            }

            List<Map<String, Object>> currentMappings = jdbc.queryForList("""
                SELECT CROSSWALK_ID, SOURCE_RECORD_ID,
                       GOLDEN_RECORD_ID, MAPPING_STATUS
                FROM CUSTOMER_CROSSWALK
                WHERE GOLDEN_RECORD_ID = ?
                  AND MAPPING_STATUS = 'ACTIVE'
                """, survivingId);

            Set<Long> originalSourceIds = new HashSet<>();

            for (JsonNode mapping : originalMappings) {
                originalSourceIds.add(
                        mapping.path("SOURCE_RECORD_ID").asLong());
            }

            for (Long sourceId : originalSourceIds) {
                Long activeCount = jdbc.queryForObject("""
                    SELECT COUNT(*)
                    FROM CUSTOMER_CROSSWALK
                    WHERE SOURCE_RECORD_ID = ?
                      AND GOLDEN_RECORD_ID = ?
                      AND MAPPING_STATUS = 'ACTIVE'
                    """, Long.class, sourceId, survivingId);

                if (activeCount == null || activeCount != 1) {
                    return ResponseEntity.badRequest().body(
                            Map.of("error",
                                    "Crosswalk mappings have changed; reversal blocked"));
                }
            }

            // Only reverse a merge if no subsequent changes were made
            // to the surviving Golden Record.
            long originalVersion =
                    originalSurviving.path("RECORD_VERSION").asLong();

            Long currentVersion = jdbc.queryForObject("""
                SELECT RECORD_VERSION
                FROM GOLDEN_RECORD
                WHERE GOLDEN_RECORD_ID = ?
                """, Long.class, survivingId);

            if (currentVersion == null ||
                    currentVersion != originalVersion + 1) {
                return ResponseEntity.badRequest().body(
                        Map.of("error",
                                "Golden Record changed after merge; reversal blocked"));
            }

            // Close the mappings created by the merge.
            for (Long sourceId : originalSourceIds) {
                jdbc.update("""
                    UPDATE CUSTOMER_CROSSWALK
                    SET MAPPING_STATUS = 'INACTIVE',
                        EFFECTIVE_TO = CURRENT_TIMESTAMP()
                    WHERE SOURCE_RECORD_ID = ?
                      AND GOLDEN_RECORD_ID = ?
                      AND MAPPING_STATUS = 'ACTIVE'
                    """, sourceId, survivingId);
            }

            // Restore the historical mappings.
            for (JsonNode mapping : originalMappings) {
                jdbc.update("""
                    UPDATE CUSTOMER_CROSSWALK
                    SET MAPPING_STATUS = 'ACTIVE',
                        EFFECTIVE_TO = NULL
                    WHERE CROSSWALK_ID = ?
                      AND GOLDEN_RECORD_ID = ?
                      AND MAPPING_STATUS = 'INACTIVE'
                    """,
                    mapping.path("CROSSWALK_ID").asLong(),
                    absorbedId);
            }

            // Restore the original attributes and lineage of both records.
            restoreGoldenRecord(survivingId, originalSurviving);
            restoreGoldenRecord(absorbedId, originalAbsorbed);

            jdbc.update("""
                UPDATE MATCH_CANDIDATE
                SET MATCH_STATUS = 'UNMERGED'
                WHERE MATCH_CANDIDATE_ID = ?
                  AND MATCH_STATUS = 'APPROVED'
                """, id);

            Map<String, Object> afterState = new LinkedHashMap<>();
            afterState.put("restoredSurvivingGoldenRecordId", survivingId);
            afterState.put("restoredAbsorbedGoldenRecordId", absorbedId);
            afterState.put("restoredSourceRecordIds", originalSourceIds);

            jdbc.update("""
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
                SELECT ?, ?, 'UNMERGE', 'REVERSED', ?, ?, ?,
                       PARSE_JSON(?), PARSE_JSON(?),
                       CURRENT_TIMESTAMP()
                """,
                id,
                request.stewardName(),
                request.reason(),
                survivingId,
                absorbedId,
                mapper.writeValueAsString(currentMappings),
                mapper.writeValueAsString(afterState));

            return ResponseEntity.ok(Map.of(
                    "status", "SUCCESS",
                    "matchCandidateId", id,
                    "restoredGoldenRecordId", absorbedId,
                    "survivingGoldenRecordId", survivingId,
                    "message", "Merge reversed successfully"
            ));

        } catch (Exception e) {
            throw new RuntimeException("Unmerge failed: " + e.getMessage(), e);
        }
    }

    private void restoreGoldenRecord(String goldenId, JsonNode snapshot) {

        jdbc.update("""
            UPDATE GOLDEN_RECORD
            SET CUSTOMER_NAME = ?,
                EMAIL = ?,
                PHONE = ?,
                DATE_OF_BIRTH = TRY_TO_DATE(?),
                ADDRESS = ?,
                POSTAL_CODE = ?,
                ATTRIBUTE_LINEAGE = PARSE_JSON(?),
                SURVIVORSHIP_DETAILS = PARSE_JSON(?),
                RECORD_STATUS = 'ACTIVE',
                RECORD_VERSION = RECORD_VERSION + 1,
                UPDATED_AT = CURRENT_TIMESTAMP()
            WHERE GOLDEN_RECORD_ID = ?
            """,
            value(snapshot, "CUSTOMER_NAME"),
            value(snapshot, "EMAIL"),
            value(snapshot, "PHONE"),
            value(snapshot, "DATE_OF_BIRTH"),
            value(snapshot, "ADDRESS"),
            value(snapshot, "POSTAL_CODE"),
            jsonValue(snapshot, "ATTRIBUTE_LINEAGE"),
            jsonValue(snapshot, "SURVIVORSHIP_DETAILS"),
            goldenId);
    }

    private String value(JsonNode node, String key) {
        JsonNode field = node.path(key);
        return field.isMissingNode() || field.isNull()
                ? null : field.asText();
    }

    private String jsonValue(JsonNode node, String key) {
        JsonNode field = node.path(key);
        if (field.isMissingNode() || field.isNull()) {
            return "null";
        }
        if (field.isTextual()) {
            return field.asText();
        }
        return field.toString();
    }
}
