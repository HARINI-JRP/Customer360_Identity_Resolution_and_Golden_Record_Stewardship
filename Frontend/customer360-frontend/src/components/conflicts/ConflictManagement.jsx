import React, { useState, useMemo } from "react";
import {
  ConflictIcon,
  SearchIcon,
  ShieldIcon,
  InfoIcon,
} from "../common/Icons";
import { SystemBadge, StatusBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function ConflictManagement({
  dobConflicts = [],
  nameConflicts = [],
  isLoading,
  error,
  onRefresh,
  onInspectCandidate,
}) {
  const [activeSubTab, setActiveSubTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const combinedConflicts = useMemo(() => {
    if (activeSubTab === "DOB") return dobConflicts;
    if (activeSubTab === "NAME") return nameConflicts;
    return [...dobConflicts, ...nameConflicts];
  }, [activeSubTab, dobConflicts, nameConflicts]);

  const filteredConflicts = useMemo(() => {
    let list = [...combinedConflicts];
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
    return list;
  }, [combinedConflicts, searchQuery]);

  return (
    <div className="workspace-view">
      {/* Workspace Banner */}
      <div className="workspace-banner conflict-banner">
        <div className="banner-left">
          <ConflictIcon size={24} className="text-rose-500" />
          <div>
            <h3>Conflict Management & Identity Safety Rules</h3>
            <p>
              Candidates blocked by automated safety boundaries. These pairs share contact attributes but exhibit contradictory identity signals (such as different dates of birth or non-matching names).
            </p>
          </div>
        </div>
        <div className="banner-stats-pills">
          <span className="banner-pill pill-danger">
            {dobConflicts.length} DOB Conflicts
          </span>
          <span className="banner-pill pill-purple">
            {nameConflicts.length} Name Conflicts
          </span>
        </div>
      </div>

      {/* Safety Rule Explanation Box */}
      <div className="safety-rules-grid">
        <div className="safety-card safety-card-dob">
          <div className="safety-card-header">
            <span className="safety-badge badge-dob">Safety Rule 1</span>
            <h4>Conflicting Date of Birth (DOB)</h4>
          </div>
          <p className="safety-text">
            <strong>Condition:</strong> Shared contact information (same email or phone), but conflicting dates of birth.
          </p>
          <p className="safety-explanation">
            <strong>Why it is blocked:</strong> Indicates separate individuals (e.g. family members, siblings, or shared landlines). Merging would corrupt credit history, KYC compliance, and personalized customer data.
          </p>
        </div>

        <div className="safety-card safety-card-name">
          <div className="safety-card-header">
            <span className="safety-badge badge-name">Safety Rule 2</span>
            <h4>Shared Contact with Incompatible Names</h4>
          </div>
          <p className="safety-text">
            <strong>Condition:</strong> Shared phone or email, but name token similarity score is below the safe threshold (&lt; 70%).
          </p>
          <p className="safety-explanation">
            <strong>Why it is blocked:</strong> Represents household accounts or administrative contact sharing. Merging disparate identities under one Golden Record violates data governance integrity.
          </p>
        </div>
      </div>

      {/* Sub-tabs Row */}
      <div className="tab-pills-row">
        <button
          className={`tab-pill-btn ${activeSubTab === "ALL" ? "active" : ""}`}
          onClick={() => {
            setActiveSubTab("ALL");
            setSearchQuery("");
          }}
        >
          <ConflictIcon size={16} />
          <span>All Blocked Candidates ({dobConflicts.length + nameConflicts.length})</span>
        </button>

        <button
          className={`tab-pill-btn ${activeSubTab === "DOB" ? "active" : ""}`}
          onClick={() => {
            setActiveSubTab("DOB");
            setSearchQuery("");
          }}
        >
          <span className="dot dot-danger" />
          <span>DOB Conflicts ({dobConflicts.length})</span>
        </button>

        <button
          className={`tab-pill-btn ${activeSubTab === "NAME" ? "active" : ""}`}
          onClick={() => {
            setActiveSubTab("NAME");
            setSearchQuery("");
          }}
        >
          <span className="dot dot-purple" />
          <span>Name Conflicts ({nameConflicts.length})</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="filter-toolbar">
        <div className="search-input-wrap">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search conflicts by customer name, candidate ID, or source system..."
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

      {/* Main Conflicts Table */}
      <div className="panel-card table-panel">
        <div className="table-header-meta">
          <span className="results-count">
            Displaying <strong>{filteredConflicts.length}</strong> blocked candidate pairs
          </span>
          <span className="api-note">
            API Source: <code>GET /api/matches?status=BLOCKED_*_CONFLICT</code>
          </span>
        </div>

        {isLoading ? (
          <div className="table-loading-state">
            <div className="spinner" />
            <p>Loading conflict candidates from Snowflake...</p>
          </div>
        ) : filteredConflicts.length === 0 ? (
          <div className="empty-state-box">
            <ShieldIcon size={40} className="text-emerald-500" />
            <h4>No Blocked Conflicts Found</h4>
            <p>No candidate pairs matching the selected conflict category exist in the database.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>ID</th>
                  <th>Customer Record 1</th>
                  <th>Customer Record 2</th>
                  <th>Conflict Type</th>
                  <th>Safety Rationale & Evidence</th>
                  <th>Identified Date</th>
                  <th style={{ width: "130px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredConflicts.map((c) => {
                  const ev = c.evidence || {};
                  const isDobConflict =
                    c.status === "BLOCKED_DOB_CONFLICT" ||
                    ev.dob_conflict === true ||
                    c.matchMethod?.includes("DOB");

                  return (
                    <tr key={c.candidateId} className="table-row-hover">
                      <td className="font-mono font-medium">#{c.candidateId}</td>

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

                      {/* Conflict Type */}
                      <td>
                        <StatusBadge status={c.status} />
                      </td>

                      {/* Safety Rationale */}
                      <td className="evidence-cell">
                        <div className="conflict-reason-box">
                          <span className="conflict-reason-text">
                            {ev.reason ||
                              (isDobConflict
                                ? "Shared contact information with conflicting dates of birth."
                                : "Shared contact information with significantly different customer names.")}
                          </span>
                          {ev.name_similarity !== undefined && !isDobConflict && (
                            <span className="conflict-tag tag-similarity">
                              Name Similarity: {Math.round(ev.name_similarity)}% (Below Threshold)
                            </span>
                          )}
                          {isDobConflict && (
                            <span className="conflict-tag tag-dob">
                              DOB Discrepancy Flagged
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="text-muted text-sm">{formatDateTime(c.createdAt)}</td>

                      <td>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => onInspectCandidate(c)}
                          title="Inspect side-by-side attributes and conflict evidence"
                        >
                          Inspect Rationale
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
