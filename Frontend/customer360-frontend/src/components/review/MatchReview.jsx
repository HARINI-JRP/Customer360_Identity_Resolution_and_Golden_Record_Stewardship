import React, { useState, useMemo } from "react";
import {
  SearchIcon,
  FilterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ReviewIcon,
  ShieldIcon,
  InfoIcon,
} from "../common/Icons";
import { ConfidenceBadge, SystemBadge, StatusBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function MatchReview({
  candidates = [],
  isLoading,
  error,
  onRefresh,
  onSelectCandidate,
  onApproveCandidate,
  onRejectCandidate,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBand, setSelectedBand] = useState("ALL");
  const [sortBy, setSortBy] = useState("SCORE_DESC");

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let list = [...candidates];

    // Filter by confidence band
    if (selectedBand !== "ALL") {
      list = list.filter((c) => c.confidenceBand === selectedBand);
    }

    // Filter by search query
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
          c.sourceSystem2?.toLowerCase().includes(q) ||
          c.matchMethod?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === "SCORE_DESC") return (b.confidenceScore || 0) - (a.confidenceScore || 0);
      if (sortBy === "SCORE_ASC") return (a.confidenceScore || 0) - (b.confidenceScore || 0);
      if (sortBy === "ID_ASC") return a.candidateId - b.candidateId;
      if (sortBy === "ID_DESC") return b.candidateId - a.candidateId;
      return 0;
    });

    return list;
  }, [candidates, searchQuery, selectedBand, sortBy]);

  return (
    <div className="workspace-view">
      {/* Workspace Banner */}
      <div className="workspace-banner">
        <div className="banner-left">
          <ReviewIcon size={24} className="text-amber-500" />
          <div>
            <h3>Pending Match Candidates Queue</h3>
            <p>
              Candidates identified by deterministic rules and RapidFuzz scoring awaiting Data Steward validation before Golden Record merging.
            </p>
          </div>
        </div>
        <div className="banner-badge">
          <span>{candidates.length} Pending Records</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        {/* Search input */}
        <div className="search-input-wrap">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by customer name, candidate ID, source ID, or system..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Confidence Band Filter Buttons */}
        <div className="filter-group">
          <span className="filter-label">
            <FilterIcon size={15} /> Band:
          </span>
          {["ALL", "HIGH", "MEDIUM", "LOW"].map((band) => (
            <button
              key={band}
              className={`filter-chip ${selectedBand === band ? "active" : ""}`}
              onClick={() => setSelectedBand(band)}
            >
              {band === "ALL" ? "All Bands" : band}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="sort-group">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="SCORE_DESC">Confidence: High to Low</option>
            <option value="SCORE_ASC">Confidence: Low to High</option>
            <option value="ID_DESC">Candidate ID: Newest First</option>
            <option value="ID_ASC">Candidate ID: Oldest First</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-card alert-danger-card">
          <InfoIcon size={20} />
          <div className="alert-card-content">
            <h4>Failed to load match candidates</h4>
            <p>{error}</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Main Candidate Table */}
      <div className="panel-card table-panel">
        <div className="table-header-meta">
          <span className="results-count">
            Showing <strong>{filteredCandidates.length}</strong> of{" "}
            <strong>{candidates.length}</strong> pending candidates
          </span>
          <span className="api-note">
            API Source: <code>GET /api/matches?status=PENDING_REVIEW</code> (Snowflake limit 100)
          </span>
        </div>

        {isLoading ? (
          <div className="table-loading-state">
            <div className="spinner" />
            <p>Querying Snowflake MDM candidate pool...</p>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="empty-state-box">
            <ShieldIcon size={40} className="text-muted" />
            <h4>No Candidates Match Your Filters</h4>
            <p>Try clearing your search query or switching confidence band filters.</p>
            {(searchQuery || selectedBand !== "ALL") && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedBand("ALL");
                }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>ID</th>
                  <th>Customer Record 1</th>
                  <th>Customer Record 2</th>
                  <th>Confidence Score</th>
                  <th>Matching Method</th>
                  <th>Evidence Rationale</th>
                  <th style={{ width: "230px" }}>Stewardship Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCandidates.map((c) => {
                  const ev = c.evidence || {};
                  return (
                    <tr key={c.candidateId} className="table-row-hover">
                      {/* Candidate ID */}
                      <td className="font-mono font-medium">
                        <span className="id-badge">#{c.candidateId}</span>
                      </td>

                      {/* Customer Record 1 */}
                      <td>
                        <div className="customer-cell">
                          <span className="customer-name">{c.customerName1}</span>
                          <div className="customer-meta">
                            <SystemBadge system={c.sourceSystem1} />
                            <span className="source-id font-mono">
                              ID: {c.sourceCustomerId1}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Customer Record 2 */}
                      <td>
                        <div className="customer-cell">
                          <span className="customer-name">{c.customerName2}</span>
                          <div className="customer-meta">
                            <SystemBadge system={c.sourceSystem2} />
                            <span className="source-id font-mono">
                              ID: {c.sourceCustomerId2}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Confidence Score & Band */}
                      <td>
                        <ConfidenceBadge
                          score={c.confidenceScore}
                          band={c.confidenceBand}
                        />
                      </td>

                      {/* Matching Method */}
                      <td>
                        <span className="method-tag" title={c.matchMethod}>
                          {c.matchMethod}
                        </span>
                      </td>

                      {/* Evidence Rationale */}
                      <td className="evidence-cell">
                        <span className="evidence-reason-text" title={ev.reason}>
                          {ev.reason || "Rule-based match criteria satisfied"}
                        </span>
                        {ev.name_similarity && (
                          <span className="evidence-similarity-sub">
                            Name Similarity: {Math.round(ev.name_similarity)}%
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="action-button-group">
                          <button
                            className="btn btn-outline btn-xs"
                            onClick={() => onSelectCandidate(c)}
                            title="Open side-by-side comparison modal"
                          >
                            Review
                          </button>
                          <button
                            className="btn btn-approve btn-xs"
                            onClick={() => onApproveCandidate(c)}
                            title="Approve candidate and merge Golden Records"
                          >
                            <CheckCircleIcon size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn btn-reject btn-xs"
                            onClick={() => onRejectCandidate(c)}
                            title="Reject candidate as separate individuals"
                          >
                            <XCircleIcon size={14} />
                            <span>Reject</span>
                          </button>
                        </div>
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
