
package com.example.demo;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SnowflakeTestController {

    private final DataSource dataSource;

    public SnowflakeTestController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/api/snowflake/test")
    public Map<String, Object> testConnection() {

        Map<String, Object> response = new HashMap<>();

        try (
            Connection connection = dataSource.getConnection();
            Statement statement = connection.createStatement();
            ResultSet resultSet = statement.executeQuery(
                "SELECT COUNT(*) AS TOTAL_RECORDS FROM SOURCE_RECORD"
            )
        ) {

            resultSet.next();

            response.put("status", "SUCCESS");
            response.put("message", "Connected to Snowflake successfully");
            response.put("database", connection.getCatalog());
            response.put("schema", connection.getSchema());
            response.put("sourceRecordCount",
                         resultSet.getInt("TOTAL_RECORDS"));

        } catch (Exception e) {

            response.put("status", "FAILED");
            response.put("message", e.getMessage());
        }

        return response;
    }
}
