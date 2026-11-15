import React from "react";
import { RefreshIcon, DatabaseIcon, UserIcon } from "../common/Icons";

export function Header({
  activeTab,
  onRefresh,
  isLoading,
  lastUpdated,
  stewardName,
  onChangeSteward,
  snowflakeStatus,
}) {
  const titles = {
    OVERVIEW: {
      title: "Identity Resolution Dashboard",
      subtitle: "Enterprise MDM overview, source record volume, and match candidate metrics",
    },
    MATCH_REVIEW: {
      title: "Match Review Workspace",
      subtitle: "Side-by-side comparison of candidate profiles requiring steward approval or rejection",
    },
    GOLDEN_RECORDS: {
      title: "Golden Record Stewardship",
      subtitle: "Surviving Golden Records, absorbed merge history, and crosswalk lineage management",
    },
    CONFLICTS: {
      title: "Conflict Management",
      subtitle: "Blocked match candidates with date of birth or name discrepancies protecting identity integrity",
    },
    AUDIT_HISTORY: {
      title: "Stewardship Audit & Lineage",
      subtitle: "Immutable action log tracking approvals, rejections, merges, and unmerge reversals",
    },
  };

  const current = titles[activeTab] || titles.OVERVIEW;
  const isConnected = snowflakeStatus?.status === "SUCCESS";

  return (
    <header className="enterprise-header">
      <div className="header-left">
        <h1 className="header-title">{current.title}</h1>
        <p className="header-subtitle">{current.subtitle}</p>
      </div>

      <div className="header-right">
        {/* Connection status tag */}
        <div
          className={`header-badge ${isConnected ? "header-badge-success" : "header-badge-danger"}`}
          title={snowflakeStatus?.message || "Snowflake connection status"}
        >
          <DatabaseIcon size={14} />
          <span>
            {isConnected
              ? `${snowflakeStatus.database || "CUSTOMER_360_MDM"}.${snowflakeStatus.schema || "MDM"}`
              : "Backend Offline"}
          </span>
        </div>

        {/* Steward selector tag */}
        <button
          className="header-steward-btn"
          onClick={onChangeSteward}
          title="Click to change active Data Steward name"
        >
          <UserIcon size={14} />
          <span>{stewardName || "Set Steward"}</span>
        </button>

        {/* Refresh button */}
        <button
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh data from Snowflake database"
        >
          <span className={`refresh-icon-wrap ${isLoading ? "spinning" : ""}`}>
            <RefreshIcon size={16} />
          </span>
          <span>{isLoading ? "Syncing..." : "Refresh"}</span>
        </button>

        {lastUpdated && (
          <span className="last-sync-text">
            Synced: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </div>
    </header>
  );
}
