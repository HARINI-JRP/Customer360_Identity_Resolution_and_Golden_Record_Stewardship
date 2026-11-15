
package com.example.demo;

import javax.sql.DataSource;
import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

@Configuration
public class SnowflakeConfig {

    @Value("${snowflake.url}")
    private String url;

    @Value("${snowflake.username}")
    private String username;

    @Value("${snowflake.password}")
    private String password;

    @Value("${snowflake.warehouse}")
    private String warehouse;

    @Value("${snowflake.database}")
    private String database;

    @Value("${snowflake.schema}")
    private String schema;

    @Value("${snowflake.role}")
    private String role;

    @Bean
    public DataSource dataSource() {

        DriverManagerDataSource dataSource =
                new DriverManagerDataSource();

        dataSource.setDriverClassName(
                "net.snowflake.client.jdbc.SnowflakeDriver");

        dataSource.setUrl(url);
        dataSource.setUsername(username);
        dataSource.setPassword(password);

        Properties connectionProperties = new Properties();

        connectionProperties.setProperty("warehouse", warehouse);
        connectionProperties.setProperty("db", database);
        connectionProperties.setProperty("schema", schema);
        connectionProperties.setProperty("role", role);
        connectionProperties.setProperty("JDBC_QUERY_RESULT_FORMAT", "JSON");
        dataSource.setConnectionProperties(connectionProperties);

        return dataSource;
    }
}
