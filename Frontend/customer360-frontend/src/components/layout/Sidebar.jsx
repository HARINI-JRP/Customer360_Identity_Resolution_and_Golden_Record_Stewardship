import React from "react";
import {
  DashboardIcon,
  ReviewIcon,
  GoldenIcon,
  ConflictIcon,
  AuditIcon,
  DatabaseIcon,
  UserIcon,
} from "../common/Icons";

export function Sidebar({
  activeTab,
  onSelectTab,
  counts = {},
  snowflakeStatus = "CONNECTED",
  stewardName = "Harini Ravi",
}) {
  const navItems = [
    {
      id: "OVERVIEW",
      label: "Overview Dashboard",
      icon: <DashboardIcon size={19} />,
      badge: null,
    },
    {
      id: "MATCH_REVIEW",
      label: "Match Review",
      icon: <ReviewIcon size={19} />,
      badge: counts.pendingCount > 0 ? counts.pendingCount : null,
      badgeClass: "badge-count-warning",
    },
    {
      id: "GOLDEN_RECORDS",
      label: "Golden Record Management",
      icon: <GoldenIcon size={19} />,
      badge: counts.approvedCount > 0 ? counts.approvedCount : null,
      badgeClass: "badge-count-success",
    },
    {
      id: "CONFLICTS",
      label: "Conflict Management",
      icon: <ConflictIcon size={19} />,
      badge: counts.totalBlockedConflicts > 0 ? counts.totalBlockedConflicts : null,
      badgeClass: "badge-count-danger",
    },
    {
      id: "AUDIT_HISTORY",
      label: "Audit History",
      icon: <AuditIcon size={19} />,
      badge: null,
    },
  ];

  const isConnected = snowflakeStatus === "SUCCESS";

  return (
    <aside className="enterprise-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-mark">
          <span>360</span>
        </div>
        <div className="brand-text">
          <span className="brand-title">Customer 360</span>
          <span className="brand-subtitle">Identity Resolution & MDM</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        <span className="nav-section-title">STEWARDSHIP WORKSPACES</span>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-button ${isActive ? "active" : ""}`}
              onClick={() => onSelectTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge !== null && (
                <span className={`nav-badge ${item.badgeClass || ""}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Connection & Steward Card */}
      <div className="sidebar-footer">
        {/* Active Steward Info */}
        <div className="steward-profile-card">
          <div className="steward-avatar">
            <UserIcon size={16} />
          </div>
          <div className="steward-details">
            <span className="steward-role">Active Steward</span>
            <span className="steward-name">{stewardName || "Data Steward"}</span>
          </div>
        </div>

        {/* Snowflake Connection Status */}
        <div className={`db-status-pill ${isConnected ? "status-connected" : "status-disconnected"}`}>
          <DatabaseIcon size={14} />
          <span className="db-status-dot" />
          <span className="db-status-text">
            {isConnected ? "Snowflake MDM Connected" : "Snowflake Offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}
