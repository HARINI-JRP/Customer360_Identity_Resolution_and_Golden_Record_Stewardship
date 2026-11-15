import React, { useState, useMemo } from "react";
import {
  AuditIcon,
  SearchIcon,
  FilterIcon,
  ShieldIcon,
  CheckCircleIcon,
  XCircleIcon,
  UnmergeIcon,
  DatabaseIcon,
  InfoIcon,
} from "../common/Icons";
import { StatusBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function AuditHistory({ sessionAuditLogs = [], dbCandidates = [] }) {
  const [filterAction, setFilterAction] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Combine session actions with database records
  const allLogs = useMemo(() => {
    const list = [...sessionAuditLogs];

    // Add candidates from db that might have been processed previously if not already in session log
    const sessionCandidateIds = new Set(list.map((l) => l.candidateId));

    dbCandidates.forEach((c) => {
      if (!sessionCandidateIds.has(c.candidateId)) {
        let action = "MERGE";
        let decision = "APPROVED";
        if (c.status === "REJECTED") {
          action = "MATCH_REVIEW";
          decision = "REJECTED";
        } else if (c.status === "UNMERGED") {
          action = "UNMERGE";
          decision = "REVERSED";
        }

        list.push({
          id: `db-${c.candidateId}`,
          candidateId: c.candidateId,
          stewardName: "Data Steward (Database)",
          actionType: action,
          decision: decision,
          reason: c.evidence?.reason || "Database historical stewardship record",
          timestamp: c.createdAt || new Date().toISOString(),
          customer1: c.customerName1,
          customer2: c.customerName2,
          survivingGoldenId: c.sourceRecordId1 ? `GR-${c.sourceRecordId1}` : null,
          absorbedGoldenId: c.sourceRecordId2 ? `GR-${c.sourceRecordId2}` : null,
          source: "DATABASE",
        });
      }
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return list;
  }, [sessionAuditLogs, dbCandidates]);

  // Filter
  const filteredLogs = useMemo(() => {
    let list = [...allLogs];

    if (filterAction !== "ALL") {
      list = list.filter((l) => l.decision === filterAction || l.actionType === filterAction);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          String(l.candidateId).includes(q) ||
          l.stewardName?.toLowerCase().includes(q) ||
          l.reason?.toLowerCase().includes(q) ||
          l.customer1?.toLowerCase().includes(q) ||
          l.customer2?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allLogs, filterAction, searchQuery]);

  // CSV Export
  const exportToCsv = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      "Timestamp",
      "Candidate ID",
      "Action Type",
      "Decision",
      "Steward Name",
      "Decision Reason",
      "Customer 1",
      "Customer 2",
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.candidateId}"`,
      `"${l.actionType}"`,
      `"${l.decision}"`,
      `"${l.stewardName}"`,
      `"${(l.reason || "").replace(/"/g, '""')}"`,
      `"${(l.customer1 || "").replace(/"/g, '""')}"`,
      `"${(l.customer2 || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `customer360_stewardship_audit_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="workspace-view">
      {/* Workspace Banner */}
      <div className="workspace-banner audit-banner">
        <div className="banner-left">
          <AuditIcon size={24} className="text-blue-500" />
          <div>
            <h3>Stewardship Audit Trail & Governance History</h3>
            <p>
              Immutable compliance ledger tracking every human data steward action. Logs approval, rejection, merge, and unmerge operations written directly to Snowflake <code>STEWARDSHIP_AUDIT</code>.
            </p>
          </div>
        </div>
        <div className="banner-stats-pills">
          <button className="btn btn-outline btn-sm" onClick={exportToCsv}>
            Export Audit Log (CSV)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <div className="search-input-wrap">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search audit trail by steward name, candidate ID, reason, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
            >
              ×
            </button>
          )}
        </div>

        {/* Action Filter */}
        <div className="filter-group">
          <span className="filter-label">
            <FilterIcon size={15} /> Action:
          </span>
          {[
            { id: "ALL", label: "All Decisions" },
            { id: "APPROVED", label: "Approved Merges" },
            { id: "REJECTED", label: "Rejections" },
            { id: "REVERSED", label: "Unmerges (Reversals)" },
          ].map((item) => (
            <button
              key={item.id}
              className={`filter-chip ${filterAction === item.id ? "active" : ""}`}
              onClick={() => setFilterAction(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Table */}
      <div className="panel-card table-panel">
        <div className="table-header-meta">
          <span className="results-count">
            Displaying <strong>{filteredLogs.length}</strong> governance audit events
          </span>
          <span className="api-note">
            Target Table: <code>CUSTOMER_360_MDM.MDM.STEWARDSHIP_AUDIT</code>
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state-box">
            <ShieldIcon size={40} className="text-muted" />
            <h4>No Stewardship Audit Records Match</h4>
            <p>
              Actions performed during this session (Approve, Reject, Unmerge) will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>Action Timestamp</th>
                  <th style={{ width: "110px" }}>Candidate ID</th>
                  <th style={{ width: "130px" }}>Decision</th>
                  <th>Data Steward</th>
                  <th>Customer Entities Involved</th>
                  <th>Stewardship Decision Rationale</th>
                  <th>Resulting Golden Records</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  let decisionBadge = (
                    <span className="badge badge-pending">PENDING</span>
                  );

                  if (log.decision === "APPROVED") {
                    decisionBadge = (
                      <span className="badge badge-approved">
                        <CheckCircleIcon size={13} /> APPROVED
                      </span>
                    );
                  } else if (log.decision === "REJECTED") {
                    decisionBadge = (
                      <span className="badge badge-rejected">
                        <XCircleIcon size={13} /> REJECTED
                      </span>
                    );
                  } else if (log.decision === "REVERSED") {
                    decisionBadge = (
                      <span className="badge badge-unmerged">
                        <UnmergeIcon size={13} /> UNMERGED
                      </span>
                    );
                  }

                  return (
                    <tr key={log.id} className="table-row-hover">
                      <td className="text-sm font-mono text-muted">
                        {formatDateTime(log.timestamp)}
                      </td>

                      <td className="font-mono font-medium">
                        <span className="id-badge">#{log.candidateId}</span>
                      </td>

                      <td>{decisionBadge}</td>

                      <td>
                        <div className="steward-cell">
                          <span className="steward-name-text">
                            {log.stewardName}
                          </span>
                          {log.source === "SESSION" && (
                            <span className="session-tag">Live Session</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="entities-involved-cell">
                          <span>{log.customer1 || "Customer 1"}</span>
                          <span className="entity-arrow">⇄</span>
                          <span>{log.customer2 || "Customer 2"}</span>
                        </div>
                      </td>

                      <td className="audit-reason-cell">
                        <span className="audit-reason-text" title={log.reason}>
                          {log.reason}
                        </span>
                      </td>

                      <td>
                        {log.decision === "APPROVED" && (
                          <div className="golden-id-chips">
                            {log.survivingGoldenId && (
                              <span className="chip-golden surviving">
                                Surviving: {log.survivingGoldenId}
                              </span>
                            )}
                            {log.absorbedGoldenId && (
                              <span className="chip-golden absorbed">
                                Absorbed: {log.absorbedGoldenId}
                              </span>
                            )}
                          </div>
                        )}
                        {log.decision === "REVERSED" && (
                          <div className="golden-id-chips">
                            <span className="chip-golden restored">
                              Restored: {log.restoredGoldenId || "Golden Record"}
                            </span>
                          </div>
                        )}
                        {log.decision === "REJECTED" && (
                          <span className="text-muted text-xs">Profiles Kept Separate</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snowflake Schema Reference Box */}
      <div className="panel-card schema-reference-card">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <DatabaseIcon size={18} className="text-indigo-600" />
            <h4>Snowflake STEWARDSHIP_AUDIT Schema Reference</h4>
          </div>
        </div>

        <div className="schema-columns-grid">
          <div className="schema-col">
            <code>AUDIT_ID</code>: Identity primary key
          </div>
          <div className="schema-col">
            <code>MATCH_CANDIDATE_ID</code>: Foreign key to candidate
          </div>
          <div className="schema-col">
            <code>STEWARD_NAME</code>: Governance user name
          </div>
          <div className="schema-col">
            <code>ACTION_TYPE</code>: MERGE | MATCH_REVIEW | UNMERGE
          </div>
          <div className="schema-col">
            <code>DECISION</code>: APPROVED | REJECTED | REVERSED
          </div>
          <div className="schema-col">
            <code>DECISION_REASON</code>: Audit explanation
          </div>
          <div className="schema-col">
            <code>BEFORE_STATE</code>: Complete JSON snapshot before action
          </div>
          <div className="schema-col">
            <code>AFTER_STATE</code>: Complete JSON snapshot after action
          </div>
        </div>

        <div className="backend-endpoint-recommendation">
          <InfoIcon size={18} />
          <span>
            <strong>Recommended Backend Endpoint:</strong> Adding <code>GET /api/audit</code> to Spring Boot will allow paginated, queryable historical audits directly from the <code>STEWARDSHIP_AUDIT</code> table in Snowflake.
          </span>
        </div>
      </div>
    </div>
  );
}
