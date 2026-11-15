
package com.example.demo;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MatchCandidateController {

    private final JdbcTemplate jdbcTemplate;

    public MatchCandidateController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/api/matches")
    public List<Map<String, Object>> getMatches(
            @RequestParam(defaultValue = "PENDING_REVIEW")
            String status) {

        String sql = """
            SELECT
                MC.MATCH_CANDIDATE_ID,
                MC.SOURCE_RECORD_ID_1,
                SR1.CUSTOMER_NAME AS CUSTOMER_NAME_1,
                SR1.SOURCE_CUSTOMER_ID AS SOURCE_CUSTOMER_ID_1,
                SS1.SOURCE_SYSTEM_NAME AS SOURCE_SYSTEM_1,

                MC.SOURCE_RECORD_ID_2,
                SR2.CUSTOMER_NAME AS CUSTOMER_NAME_2,
                SR2.SOURCE_CUSTOMER_ID AS SOURCE_CUSTOMER_ID_2,
                SS2.SOURCE_SYSTEM_NAME AS SOURCE_SYSTEM_2,
                SR1.EMAIL AS EMAIL_1,
                SR2.EMAIL AS EMAIL_2,
                SR1.PHONE AS PHONE_1,
                SR2.PHONE AS PHONE_2,
                SR1.DATE_OF_BIRTH AS DATE_OF_BIRTH_1,
                SR2.DATE_OF_BIRTH AS DATE_OF_BIRTH_2,
                MC.CONFIDENCE_SCORE,
                MC.CONFIDENCE_BAND,
                MC.MATCH_METHOD,
                MC.MATCH_EVIDENCE,
                MC.MATCH_STATUS,
                MC.CREATED_AT

            FROM MATCH_CANDIDATE MC

            JOIN SOURCE_RECORD SR1
                ON MC.SOURCE_RECORD_ID_1 = SR1.SOURCE_RECORD_ID

            JOIN SOURCE_RECORD SR2
                ON MC.SOURCE_RECORD_ID_2 = SR2.SOURCE_RECORD_ID

            JOIN SOURCE_SYSTEM SS1
                ON SR1.SOURCE_SYSTEM_ID = SS1.SOURCE_SYSTEM_ID

            JOIN SOURCE_SYSTEM SS2
                ON SR2.SOURCE_SYSTEM_ID = SS2.SOURCE_SYSTEM_ID

            WHERE MC.MATCH_STATUS = ?

            ORDER BY MC.CONFIDENCE_SCORE DESC

            LIMIT 100
            """;

        return jdbcTemplate.queryForList(sql, status);
    }
}
