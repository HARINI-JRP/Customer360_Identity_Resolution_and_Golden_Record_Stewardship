import React, { useState, useMemo } from "react";
import {
  GoldenIcon,
  UnmergeIcon,
  SearchIcon,
  DatabaseIcon,
  ShieldIcon,
  InfoIcon,
  ArrowRightIcon,
} from "../common/Icons";
import { ConfidenceBadge, SystemBadge, StatusBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function GoldenRecords({
  approvedCandidates = [],
  unmergedCandidates = [],
  isLoading,
  error,
  onRefresh,
  onUnmergeCandidate,
  onInspectCandidate,
}) {
  const [activeSubTab, setActiveSubTab] = useState("APPROVED");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecordForLineage, setSelectedRecordForLineage] = useState(null);

  const currentList = activeSubTab === "APPROVED" ? approvedCandidates : unmergedCandidates;

  const filteredRecords = useMemo(() => {
    let list = [...currentList];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          String(c.candidateId).includes(q) ||
          c.customerName1?.toLowerCase().includes(q) ||
          c.customerName2?.toLowerCase().includes(q) ||
          c.sourceCustomerId1?.toLowerCase().includes(q) ||
          c.sourceCustomerId2?.toLowerCase().includes(q) ||
          c.sourceSystem1?.toLowerCase().includes(q) ||
          c.sourceSystem2?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentList, searchQuery]);

  return (
    <div className="workspace-view">
      {/* Workspace Banner */}
      <div className="workspace-banner golden-banner">
        <div className="banner-left">
          <GoldenIcon size={24} className="text-amber-500" />
          <div>
            <h3>Golden Record Stewardship & Survivorship</h3>
            <p>
              Manage unified single-customer views resulting from steward-approved identity merges. Execute unmerge reversals with automated crosswalk and attribute lineage rollback.
            </p>
          </div>
        </div>
        <div className="banner-stats-pills">
          <span className="banner-pill pill-success">
            {approvedCandidates.length} Approved Merges
          </span>
          <span className="banner-pill pill-neutral">
            {unmergedCandidates.length} Unmerged
          </span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="tab-pills-row">
        <button
          className={`tab-pill-btn ${activeSubTab === "APPROVED" ? "active" : ""}`}
          onClick={() => {
            setActiveSubTab("APPROVED");
            setSearchQuery("");
          }}
        >
          <GoldenIcon size={16} />
          <span>Approved Merges & Surviving Records ({approvedCandidates.length})</span>
        </button>

        <button
          className={`tab-pill-btn ${activeSubTab === "UNMERGED" ? "active" : ""}`}
          onClick={() => {
            setActiveSubTab("UNMERGED");
            setSearchQuery("");
          }}
        >
          <UnmergeIcon size={16} />
          <span>Unmerged / Reverted Records ({unmergedCandidates.length})</span>
        </button>

        <button
          className={`tab-pill-btn ${activeSubTab === "LINEAGE_DOC" ? "active" : ""}`}
          onClick={() => setActiveSubTab("LINEAGE_DOC")}
        >
          <DatabaseIcon size={16} />
          <span>Crosswalk & Lineage Architecture</span>
        </button>
      </div>

      {/* Crosswalk Architecture Tab */}
      {activeSubTab === "LINEAGE_DOC" ? (
        <div className="panel-card lineage-architecture-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <DatabaseIcon size={20} className="text-indigo-600" />
              <h3>Snowflake Golden Record & Crosswalk Mapping Architecture</h3>
            </div>
          </div>

          <div className="architecture-grid">
            {/* Box 1: Survivorship Strategy */}
            <div className="arch-card">
              <h4>1. Survivorship Strategy (PREFER_EXISTING_NON_NULL)</h4>
              <p>
                When a match is approved, the surviving Golden Record absorbs new attributes from the merged record using SQL <code>COALESCE(T.attr, S.attr)</code>.
              </p>
              <ul className="arch-points">
                <li>Existing target attributes are never overwritten by secondary source nulls.</li>
                <li><code>ATTRIBUTE_LINEAGE</code> JSON VARIANT stores the previous target and absorbed lineage snapshots.</li>
                <li><code>RECORD_VERSION</code> is incremented atomically.</li>
              </ul>
            </div>

            {/* Box 2: Customer Crosswalk */}
            <div className="arch-card">
              <h4>2. Source-to-Golden Crosswalk (CUSTOMER_CROSSWALK)</h4>
              <p>
                Maps multiple heterogeneous source customer records across Salesforce, Stripe, Shopify to a single Golden Record identifier.
              </p>
              <ul className="arch-points">
                <li>Each source record maintains an active row where <code>MAPPING_STATUS = 'ACTIVE'</code> and <code>EFFECTIVE_TO IS NULL</code>.</li>
                <li>Upon merge approval, absorbed source record mappings are redirected to the surviving Golden Record ID.</li>
                <li>Historical mappings are closed with <code>EFFECTIVE_TO = CURRENT_TIMESTAMP()</code>.</li>
              </ul>
            </div>

            {/* Box 3: Safe Unmerge Reversal */}
            <div className="arch-card">
              <h4>3. Guaranteed Reversibility (UNMERGE Engine)</h4>
              <p>
                The unmerge engine reconstructs exact pre-merge state directly from the immutable <code>STEWARDSHIP_AUDIT</code> before-snapshot.
              </p>
              <ul className="arch-points">
                <li>Verifies no intervening updates were made to the surviving record (<code>RECORD_VERSION</code> check).</li>
                <li>Deactivates merge crosswalk rows and re-activates original crosswalk mappings.</li>
                <li>Restores original absorbed Golden Record to ACTIVE status.</li>
              </ul>
            </div>
          </div>

          <div className="backend-endpoint-recommendation">
            <InfoIcon size={20} />
            <div>
              <strong>Production API Recommendation:</strong>
              <p>
                To explore all unmerged and merged Golden Records independently of match candidates, the backend can expose <code>GET /api/golden-records</code> and <code>GET /api/crosswalk?goldenRecordId=...</code>.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Approved or Unmerged Candidate List */
        <>
          {/* Search Toolbar */}
          <div className="filter-toolbar">
            <div className="search-input-wrap">
              <SearchIcon size={18} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search approved records by name, ID, or source system..."
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
          </div>

          {/* Table */}
          <div className="panel-card table-panel">
            <div className="table-header-meta">
              <span className="results-count">
                Displaying <strong>{filteredRecords.length}</strong> {activeSubTab.toLowerCase()} records
              </span>
              <span className="api-note">
                API Source: <code>GET /api/matches?status={activeSubTab}</code>
              </span>
            </div>

            {isLoading ? (
              <div className="table-loading-state">
                <div className="spinner" />
                <p>Loading records from Snowflake...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="empty-state-box">
                <GoldenIcon size={40} className="text-muted" />
                <h4>No {activeSubTab === "APPROVED" ? "Approved Merges" : "Unmerged Records"} Found</h4>
                <p>
                  {activeSubTab === "APPROVED"
                    ? "No match candidates have been approved yet. Review pending candidates in the Match Review workspace to create Golden Records."
                    : "No unmerge actions have been executed yet."}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="enterprise-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>ID</th>
                      <th>Surviving Customer Entity (Record 1)</th>
                      <th>Absorbed Source Entity (Record 2)</th>
                      <th>Confidence Score</th>
                      <th>Matching Method</th>
                      <th>Stewardship Status</th>
                      <th style={{ width: "200px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((c) => (
                      <tr key={c.candidateId} className="table-row-hover">
                        <td className="font-mono font-medium">#{c.candidateId}</td>

                        {/* Surviving Record */}
                        <td>
                          <div className="customer-cell">
                            <span className="customer-name font-bold">
                              {c.customerName1}
                            </span>
                            <div className="customer-meta">
                              <span className="surviving-pill">Surviving Target</span>
                              <SystemBadge system={c.sourceSystem1} />
                              <span className="source-id font-mono">
                                ID: {c.sourceCustomerId1}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Absorbed Record */}
                        <td>
                          <div className="customer-cell">
                            <span className="customer-name text-muted">
                              {c.customerName2}
                            </span>
                            <div className="customer-meta">
                              <span className="absorbed-pill">
                                {activeSubTab === "APPROVED" ? "Absorbed / Merged" : "Restored Separate"}
                              </span>
                              <SystemBadge system={c.sourceSystem2} />
                              <span className="source-id font-mono">
                                ID: {c.sourceCustomerId2}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <ConfidenceBadge
                            score={c.confidenceScore}
                            band={c.confidenceBand}
                          />
                        </td>

                        <td>
                          <span className="method-tag">{c.matchMethod}</span>
                        </td>

                        <td>
                          <StatusBadge status={c.status} />
                        </td>

                        <td>
                          <div className="action-button-group">
                            <button
                              className="btn btn-outline btn-xs"
                              onClick={() => onInspectCandidate(c)}
                              title="Inspect comparison and matching evidence"
                            >
                              Details
                            </button>

                            {activeSubTab === "APPROVED" && (
                              <button
                                className="btn btn-unmerge btn-xs"
                                onClick={() => onUnmergeCandidate(c)}
                                title="Reverse merge and restore separate Golden Records"
                              >
                                <UnmergeIcon size={14} />
                                <span>Unmerge</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
