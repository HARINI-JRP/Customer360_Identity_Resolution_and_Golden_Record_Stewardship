
package com.example.demo;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class StewardshipAuditController {

    private final JdbcTemplate jdbcTemplate;

    public StewardshipAuditController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/audit")
    public List<Map<String, Object>> getAuditHistory() {
        return jdbcTemplate.queryForList("""
            SELECT AUDIT_ID, MATCH_CANDIDATE_ID, ACTION_TYPE,
                   DECISION, STEWARD_NAME, DECISION_REASON,
                   ACTION_TIMESTAMP
            FROM STEWARDSHIP_AUDIT
            ORDER BY ACTION_TIMESTAMP DESC, AUDIT_ID DESC
            LIMIT 200
            """);
    }
}
