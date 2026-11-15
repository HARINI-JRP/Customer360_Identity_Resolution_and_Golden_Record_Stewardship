import React, { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  CloseIcon,
  ShieldIcon,
  InfoIcon,
} from "../common/Icons";
import { ConfidenceBadge, SystemBadge, StatusBadge } from "../common/StatusBadge";
import { formatDateTime } from "../../api/models";

export function MatchDetailModal({
  isOpen,
  candidate,
  onClose,
  onApprove,
  onReject,
  onUnmerge,
  currentStatus = "PENDING_REVIEW",
}) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen || !candidate) return null;

  const ev = candidate.evidence || {};
  const isPending = currentStatus === "PENDING_REVIEW" || candidate.status === "PENDING_REVIEW";
  const isApproved = currentStatus === "APPROVED" || candidate.status === "APPROVED";

  // Check matching evidence flags
  const emailMatched = ev.email_match === true;
  const phoneMatched = ev.phone_match === true;
  const dobMatched = ev.dob_match === true;
  const dobConflict = ev.dob_conflict === true;
  const postalMatched = ev.postal_code_match === true;
  const nameSimilarity = ev.name_similarity ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <ShieldIcon size={24} className="text-indigo-600" />
            <div>
              <h3>Candidate Comparison & Stewardship Review</h3>
              <p className="modal-subtitle">
                Candidate #{candidate.candidateId} • Method: <code>{candidate.matchMethod}</code> • Identified: {formatDateTime(candidate.createdAt)}
              </p>
            </div>
          </div>
          <div className="modal-header-actions">
            <StatusBadge status={candidate.status} />
            <button className="btn-icon-close" onClick={onClose} aria-label="Close dialog">
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* Confidence & Score Header Bar */}
          <div className="match-confidence-bar">
            <div className="confidence-metric-block">
              <span className="confidence-label">Confidence Assessment</span>
              <ConfidenceBadge
                score={candidate.confidenceScore}
                band={candidate.confidenceBand}
              />
            </div>

            {nameSimilarity !== null && (
              <div className="confidence-metric-block">
                <span className="confidence-label">Name Token Similarity</span>
                <span className="similarity-pill">
                  {Math.round(nameSimilarity)}% Similar
                </span>
              </div>
            )}

            <div className="confidence-metric-block">
              <span className="confidence-label">Algorithm Engine</span>
              <span className="engine-pill">
                v{ev.algorithm_version || "1.0.0"} (Deterministic + RapidFuzz)
              </span>
            </div>
          </div>

          {/* Rule Reason Banner */}
          {ev.reason && (
            <div className={`evidence-callout ${dobConflict ? "callout-danger" : "callout-info"}`}>
              <InfoIcon size={20} />
              <div>
                <strong>Matching Rule Evaluation:</strong>
                <p>{ev.reason}</p>
                {ev.score_explanation && (
                  <span className="score-expl-text">{ev.score_explanation}</span>
                )}
              </div>
            </div>
          )}

          {/* Side-by-side Customer Records Comparison */}
          <div className="side-by-side-grid">
            {/* Record 1 Card */}
            <div className="customer-record-card card-record-1">
              <div className="record-card-header">
                <div className="record-badge-wrap">
                  <span className="record-tag tag-primary">Record 1 (Surviving Target)</span>
                  <SystemBadge system={candidate.sourceSystem1} />
                </div>
                <span className="record-id-text">
                  Source ID: <strong>{candidate.sourceCustomerId1}</strong>
                </span>
              </div>

              <div className="record-card-body">
                <div className="attribute-row">
                  <span className="attr-label">Customer Name</span>
                  <strong className="attr-value">{candidate.customerName1}</strong>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Email Address</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.email1 || (emailMatched ? "Verified in Source Engine" : "—")}
                    </span>
                    {emailMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Phone Number</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.phone1 || (phoneMatched ? "Verified in Source Engine" : "—")}
                    </span>
                    {phoneMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Date of Birth (DOB)</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.dob1 || (dobMatched ? "Exact Match" : "—")}
                    </span>
                    {dobMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                    {dobConflict && (
                      <span className="match-flag match-conflict">Conflicting</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Source Record ID</span>
                  <span className="attr-value font-mono">
                    #{candidate.sourceRecordId1 || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Record 2 Card */}
            <div className="customer-record-card card-record-2">
              <div className="record-card-header">
                <div className="record-badge-wrap">
                  <span className="record-tag tag-secondary">Record 2 (Absorbed Source)</span>
                  <SystemBadge system={candidate.sourceSystem2} />
                </div>
                <span className="record-id-text">
                  Source ID: <strong>{candidate.sourceCustomerId2}</strong>
                </span>
              </div>

              <div className="record-card-body">
                <div className="attribute-row">
                  <span className="attr-label">Customer Name</span>
                  <strong className="attr-value">{candidate.customerName2}</strong>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Email Address</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.email2 || (emailMatched ? "Verified in Source Engine" : "—")}
                    </span>
                    {emailMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Phone Number</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.phone2 || (phoneMatched ? "Verified in Source Engine" : "—")}
                    </span>
                    {phoneMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Date of Birth (DOB)</span>
                  <div className="attr-value-wrap">
                    <span className="attr-value">
                      {candidate.dob2 || (dobMatched ? "Exact Match" : "—")}
                    </span>
                    {dobMatched && (
                      <span className="match-flag match-yes">Matched</span>
                    )}
                    {dobConflict && (
                      <span className="match-flag match-conflict">Conflicting</span>
                    )}
                  </div>
                </div>

                <div className="attribute-row">
                  <span className="attr-label">Source Record ID</span>
                  <span className="attr-value font-mono">
                    #{candidate.sourceRecordId2 || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Evidence Matrix */}
          <div className="evidence-matrix-card">
            <h4 className="matrix-title">Match Evidence & Identity Alignment Verification</h4>
            <div className="evidence-grid">
              <div className={`evidence-item ${emailMatched ? "item-match" : "item-neutral"}`}>
                <span className="evidence-label">Email Match</span>
                <span className="evidence-status">{emailMatched ? "EXACT MATCH (100%)" : "NO DIRECT MATCH"}</span>
              </div>

              <div className={`evidence-item ${phoneMatched ? "item-match" : "item-neutral"}`}>
                <span className="evidence-label">Phone Match</span>
                <span className="evidence-status">{phoneMatched ? "EXACT MATCH (100%)" : "NO DIRECT MATCH"}</span>
              </div>

              <div className={`evidence-item ${dobConflict ? "item-conflict" : dobMatched ? "item-match" : "item-neutral"}`}>
                <span className="evidence-label">DOB Verification</span>
                <span className="evidence-status">
                  {dobConflict
                    ? "CONFLICTING DOB DETECTED"
                    : dobMatched
                    ? "EXACT DOB MATCH"
                    : "DOB UNAVAILABLE"}
                </span>
              </div>

              <div className={`evidence-item ${postalMatched ? "item-match" : "item-neutral"}`}>
                <span className="evidence-label">Postal Code Match</span>
                <span className="evidence-status">{postalMatched ? "MATCHED" : "NOT ALIGNED / N/A"}</span>
              </div>
            </div>
          </div>

          {/* Toggleable Raw Evidence JSON */}
          <div className="raw-json-section">
            <button
              type="button"
              className="btn-toggle-json"
              onClick={() => setShowRawJson(!showRawJson)}
            >
              {showRawJson ? "Hide Raw Database Payload ▲" : "View Raw Snowflake JSON Payload ▼"}
            </button>

            {showRawJson && (
              <pre className="raw-json-pre">
                {JSON.stringify(candidate.raw, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>

          {isPending && (
            <div className="footer-action-buttons">
              <button
                type="button"
                className="btn btn-reject"
                onClick={() => onReject(candidate)}
              >
                <XCircleIcon size={18} />
                <span>Reject Match</span>
              </button>
              <button
                type="button"
                className="btn btn-approve"
                onClick={() => onApprove(candidate)}
              >
                <CheckCircleIcon size={18} />
                <span>Approve & Merge</span>
              </button>
            </div>
          )}

          {isApproved && (
            <button
              type="button"
              className="btn btn-unmerge"
              onClick={() => onUnmerge(candidate)}
            >
              <span>Reverse Merge (Unmerge)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
