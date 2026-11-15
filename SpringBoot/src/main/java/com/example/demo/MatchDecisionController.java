
package com.example.demo;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/matches")
public class MatchDecisionController {

    private final JdbcTemplate jdbcTemplate;

    public MatchDecisionController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record RejectionRequest(
        String stewardName,
        String reason
    ) {}

    @PostMapping("/{id}/reject")
    @Transactional
    public Map<String, Object> rejectMatch(
            @PathVariable int id,
            @RequestBody RejectionRequest request) {

        if (request.stewardName() == null ||
            request.stewardName().isBlank() ||
            request.reason() == null ||
            request.reason().isBlank()) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Steward name and rejection reason are required"
            );
        }

        Map<String, Object> candidate;

        try {
            candidate = jdbcTemplate.queryForMap(
                "SELECT MATCH_STATUS FROM MATCH_CANDIDATE " +
                "WHERE MATCH_CANDIDATE_ID = ?", id
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND, "Match candidate not found"
            );
        }

        String currentStatus =
            candidate.get("MATCH_STATUS").toString();

        if (!"PENDING_REVIEW".equals(currentStatus)) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Only pending candidates can be rejected"
            );
        }

        int updated = jdbcTemplate.update(
            "UPDATE MATCH_CANDIDATE " +
            "SET MATCH_STATUS = 'REJECTED' " +
            "WHERE MATCH_CANDIDATE_ID = ? " +
            "AND MATCH_STATUS = 'PENDING_REVIEW'",
            id
        );

        if (updated != 1) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Candidate was already processed"
            );
        }

        String beforeState =
            "{\"match_candidate_id\":" + id +
            ",\"match_status\":\"PENDING_REVIEW\"}";

        String afterState =
            "{\"match_candidate_id\":" + id +
            ",\"match_status\":\"REJECTED\"}";

        jdbcTemplate.update(
            """
            INSERT INTO STEWARDSHIP_AUDIT (
                MATCH_CANDIDATE_ID,
                STEWARD_NAME,
                ACTION_TYPE,
                DECISION,
                DECISION_REASON,
                BEFORE_STATE,
                AFTER_STATE,
                ACTION_TIMESTAMP
            )
            SELECT ?, ?, 'MATCH_REVIEW', 'REJECTED', ?,
                   PARSE_JSON(?), PARSE_JSON(?), CURRENT_TIMESTAMP()
            """,
            id,
            request.stewardName(),
            request.reason(),
            beforeState,
            afterState
        );

        return Map.of(
            "status", "SUCCESS",
            "message", "Match rejected successfully",
            "matchCandidateId", id
        );
    }
}
