import React from "react";
import {
  DatabaseIcon,
  ReviewIcon,
  CheckCircleIcon,
  XCircleIcon,
  ConflictIcon,
  GoldenIcon,
  ArrowRightIcon,
  ShieldIcon,
  InfoIcon,
} from "../common/Icons";
import { ConfidenceBadge, SystemBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function OverviewDashboard({
  metrics,
  onNavigate,
  onSelectCandidateForReview,
}) {
  const {
    snowflake = {},
    sourceRecordCount = 0,
    totalCandidates = 0,
    pendingCount = 0,
    approvedCount = 0,
    rejectedCount = 0,
    totalBlockedConflicts = 0,
    blockedDobCount = 0,
    blockedNameCount = 0,
    unmergedCount = 0,
    pendingSample = [],
  } = metrics || {};

  const reviewedTotal = approvedCount + rejectedCount;
  const approvalRate =
    reviewedTotal > 0 ? Math.round((approvedCount / reviewedTotal) * 100) : 0;

  const isConnected = snowflake?.status === "SUCCESS";

  return (
    <div className="dashboard-view">
      {/* Offline Alert if Spring Boot / Snowflake not connected */}
      {!isConnected && (
        <div className="alert-card alert-danger-card">
          <div className="alert-card-icon">
            <ConflictIcon size={24} />
          </div>
          <div className="alert-card-content">
            <h4>Backend Connection Notice</h4>
            <p>
              {snowflake?.message ||
                "Cannot reach Spring Boot API at http://localhost:8080. Start the backend with ./mvnw spring-boot:run to query live Snowflake data."}
            </p>
          </div>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="kpi-grid">
        {/* Total Source Records */}
        <div className="kpi-card kpi-source-records">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL SOURCE RECORDS</span>
            <div className="kpi-icon-wrap icon-blue">
              <DatabaseIcon size={20} />
            </div>
          </div>
          <div className="kpi-value">
            {sourceRecordCount ? sourceRecordCount.toLocaleString() : "0"}
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">
              Snowflake table: <code>SOURCE_RECORD</code>
            </span>
            <span className="kpi-pill pill-blue">Ingested</span>
          </div>
        </div>

        {/* Total Matching Candidates */}
        <div className="kpi-card kpi-candidates">
          <div className="kpi-header">
            <span className="kpi-label">MATCHING CANDIDATES</span>
            <div className="kpi-icon-wrap icon-indigo">
              <ShieldIcon size={20} />
            </div>
          </div>
          <div className="kpi-value">{totalCandidates.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Identified across cross-system rules</span>
            <span className="kpi-pill pill-indigo">Evaluated</span>
          </div>
        </div>

        {/* Pending Reviews */}
        <div
          className="kpi-card kpi-pending clickable-card"
          onClick={() => onNavigate("MATCH_REVIEW")}
          title="Click to review pending matches"
        >
          <div className="kpi-header">
            <span className="kpi-label">PENDING REVIEWS</span>
            <div className="kpi-icon-wrap icon-amber">
              <ReviewIcon size={20} />
            </div>
          </div>
          <div className="kpi-value text-amber">{pendingCount}</div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Awaiting data steward decision</span>
            <span className="kpi-action-link">
              Review Queue <ArrowRightIcon size={14} />
            </span>
          </div>
        </div>

        {/* Approved Matches */}
        <div
          className="kpi-card kpi-approved clickable-card"
          onClick={() => onNavigate("GOLDEN_RECORDS")}
          title="Click to view Golden Records"
        >
          <div className="kpi-header">
            <span className="kpi-label">APPROVED MATCHES</span>
            <div className="kpi-icon-wrap icon-emerald">
              <CheckCircleIcon size={20} />
            </div>
          </div>
          <div className="kpi-value text-emerald">{approvedCount}</div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Unified into surviving Golden Records</span>
            <span className="kpi-pill pill-emerald">Merged</span>
          </div>
        </div>

        {/* Rejected Matches */}
        <div
          className="kpi-card kpi-rejected clickable-card"
          onClick={() => onNavigate("AUDIT_HISTORY")}
          title="Click to view audit history"
        >
          <div className="kpi-header">
            <span className="kpi-label">REJECTED MATCHES</span>
            <div className="kpi-icon-wrap icon-rose">
              <XCircleIcon size={20} />
            </div>
          </div>
          <div className="kpi-value text-rose">{rejectedCount}</div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Confirmed distinct customer identities</span>
            <span className="kpi-pill pill-rose">Rejected</span>
          </div>
        </div>

        {/* Blocked Conflicts */}
        <div
          className="kpi-card kpi-conflicts clickable-card"
          onClick={() => onNavigate("CONFLICTS")}
          title="Click to view blocked conflicts"
        >
          <div className="kpi-header">
            <span className="kpi-label">BLOCKED CONFLICTS</span>
            <div className="kpi-icon-wrap icon-crimson">
              <ConflictIcon size={20} />
            </div>
          </div>
          <div className="kpi-value text-crimson">{totalBlockedConflicts}</div>
          <div className="kpi-footer">
            <span className="kpi-subtext">
              DOB: {blockedDobCount} • Name: {blockedNameCount}
            </span>
            <span className="kpi-action-link">
              View Safety Blocks <ArrowRightIcon size={14} />
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Golden Record Stewardship & Snowflake Architecture */}
      <div className="dashboard-columns">
        {/* Left: Golden Record & Stewardship Statistics */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <GoldenIcon size={20} className="text-indigo-600" />
              <h3>Golden Record & Survivorship Metrics</h3>
            </div>
            <button
              className="btn-link"
              onClick={() => onNavigate("GOLDEN_RECORDS")}
            >
              Manage Golden Records
            </button>
          </div>

          <div className="golden-stats-row">
            <div className="golden-stat-item">
              <span className="stat-label">Steward Approval Rate</span>
              <strong className="stat-value">{approvalRate}%</strong>
              <span className="stat-desc">
                {approvedCount} approved out of {reviewedTotal} reviews
              </span>
            </div>
            <div className="golden-stat-item">
              <span className="stat-label">Merged Golden Records</span>
              <strong className="stat-value">{approvedCount}</strong>
              <span className="stat-desc">Target records updated with lineage</span>
            </div>
            <div className="golden-stat-item">
              <span className="stat-label">Reversed (Unmerged)</span>
              <strong className="stat-value">{unmergedCount}</strong>
              <span className="stat-desc">Full lineage rollback applied</span>
            </div>
          </div>

          {/* Resolution Progress Bar */}
          <div className="resolution-progress-wrap">
            <div className="progress-label-bar">
              <span>Resolution Distribution</span>
              <span>{totalCandidates} Total Candidates</span>
            </div>
            <div className="segmented-progress-bar">
              {totalCandidates > 0 && (
                <>
                  <div
                    className="segment segment-approved"
                    style={{
                      width: `${(approvedCount / totalCandidates) * 100}%`,
                    }}
                    title={`Approved: ${approvedCount}`}
                  />
                  <div
                    className="segment segment-pending"
                    style={{
                      width: `${(pendingCount / totalCandidates) * 100}%`,
                    }}
                    title={`Pending: ${pendingCount}`}
                  />
                  <div
                    className="segment segment-rejected"
                    style={{
                      width: `${(rejectedCount / totalCandidates) * 100}%`,
                    }}
                    title={`Rejected: ${rejectedCount}`}
                  />
                  <div
                    className="segment segment-conflict"
                    style={{
                      width: `${(totalBlockedConflicts / totalCandidates) * 100}%`,
                    }}
                    title={`Blocked Conflicts: ${totalBlockedConflicts}`}
                  />
                </>
              )}
            </div>
            <div className="progress-legend">
              <span className="legend-item">
                <span className="legend-color legend-approved" /> Approved ({approvedCount})
              </span>
              <span className="legend-item">
                <span className="legend-color legend-pending" /> Pending ({pendingCount})
              </span>
              <span className="legend-item">
                <span className="legend-color legend-rejected" /> Rejected ({rejectedCount})
              </span>
              <span className="legend-item">
                <span className="legend-color legend-conflict" /> Conflicts ({totalBlockedConflicts})
              </span>
            </div>
          </div>

          <div className="info-callout">
            <InfoIcon size={16} />
            <span>
              <strong>Survivorship Strategy:</strong> Customer 360 uses the <code>PREFER_EXISTING_NON_NULL</code> rule when merging. Absorbed records update target Golden Records without overwriting valid non-null target attributes.
            </span>
          </div>
        </div>

        {/* Right: Snowflake Connection & MDM Cluster Info */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <DatabaseIcon size={20} className="text-blue-600" />
              <h3>Snowflake MDM Connection</h3>
            </div>
            <span
              className={`connection-indicator ${
                isConnected ? "indicator-online" : "indicator-offline"
              }`}
            >
              {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>

          <div className="spec-table-wrap">
            <table className="spec-table">
              <tbody>
                <tr>
                  <td>Database Catalog</td>
                  <td>
                    <strong>{snowflake?.database || "CUSTOMER_360_MDM"}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Schema</td>
                  <td>
                    <strong>{snowflake?.schema || "MDM"}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Source Record Pool</td>
                  <td>
                    <strong>{sourceRecordCount ? sourceRecordCount.toLocaleString() : "0"} records</strong>
                  </td>
                </tr>
                <tr>
                  <td>Warehouse</td>
                  <td>
                    <code>COMPUTE_WH</code>
                  </td>
                </tr>
                <tr>
                  <td>Role</td>
                  <td>
                    <code>ACCOUNTADMIN</code>
                  </td>
                </tr>
                <tr>
                  <td>Backend Host</td>
                  <td>
                    <code>http://localhost:8080</code> (Spring Boot REST)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="quick-nav-grid">
            <button
              className="quick-nav-btn"
              onClick={() => onNavigate("MATCH_REVIEW")}
            >
              <ReviewIcon size={16} />
              <span>Review Matches ({pendingCount})</span>
            </button>
            <button
              className="quick-nav-btn"
              onClick={() => onNavigate("CONFLICTS")}
            >
              <ConflictIcon size={16} />
              <span>Inspect Conflicts ({totalBlockedConflicts})</span>
            </button>
            <button
              className="quick-nav-btn"
              onClick={() => onNavigate("GOLDEN_RECORDS")}
            >
              <GoldenIcon size={16} />
              <span>Golden Records</span>
            </button>
            <button
              className="quick-nav-btn"
              onClick={() => onNavigate("AUDIT_HISTORY")}
            >
              <ShieldIcon size={16} />
              <span>Audit History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Priority Pending Candidate Review Queue Preview */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title-wrap">
            <ReviewIcon size={20} className="text-amber-600" />
            <h3>High Priority Pending Candidates Awaiting Review</h3>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate("MATCH_REVIEW")}
          >
            Open All {pendingCount} Pending Matches <ArrowRightIcon size={14} />
          </button>
        </div>

        {pendingSample.length === 0 ? (
          <div className="empty-state-box">
            <CheckCircleIcon size={36} className="text-emerald-500" />
            <h4>No Pending Reviews</h4>
            <p>All matching candidates have been reviewed or no pending candidates found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Record 1</th>
                  <th>Customer Record 2</th>
                  <th>Confidence Score</th>
                  <th>Match Method</th>
                  <th>Identified Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingSample.slice(0, 5).map((raw) => {
                  const c = raw.candidateId ? raw : raw;
                  const id = c.candidateId ?? c.MATCH_CANDIDATE_ID;
                  const name1 = c.customerName1 ?? c.CUSTOMER_NAME_1 ?? "—";
                  const sys1 = c.sourceSystem1 ?? c.SOURCE_SYSTEM_1 ?? "—";
                  const name2 = c.customerName2 ?? c.CUSTOMER_NAME_2 ?? "—";
                  const sys2 = c.sourceSystem2 ?? c.SOURCE_SYSTEM_2 ?? "—";
                  const score = c.confidenceScore ?? c.CONFIDENCE_SCORE ?? 0;
                  const band = c.confidenceBand ?? c.CONFIDENCE_BAND ?? "MEDIUM";
                  const method = c.matchMethod ?? c.MATCH_METHOD ?? "—";
                  const date = c.createdAt ?? c.CREATED_AT;

                  return (
                    <tr key={id}>
                      <td className="font-mono font-medium">#{id}</td>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-name">{name1}</span>
                          <SystemBadge system={sys1} />
                        </div>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-name">{name2}</span>
                          <SystemBadge system={sys2} />
                        </div>
                      </td>
                      <td>
                        <ConfidenceBadge score={score} band={band} />
                      </td>
                      <td>
                        <span className="method-tag">{method}</span>
                      </td>
                      <td className="text-muted text-sm">{formatDateTime(date)}</td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => onSelectCandidateForReview(raw)}
                        >
                          Review & Compare
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
