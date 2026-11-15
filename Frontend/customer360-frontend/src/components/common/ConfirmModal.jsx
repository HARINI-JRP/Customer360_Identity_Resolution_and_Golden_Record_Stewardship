import React, { useState, useEffect } from "react";
import { STEWARD_QUICK_REASONS } from "../../api/models";
import { CheckCircleIcon, XCircleIcon, UnmergeIcon, CloseIcon, InfoIcon } from "./Icons";

export function ConfirmModal({
  isOpen,
  actionType, // "APPROVE" | "REJECT" | "UNMERGE"
  candidate,
  onClose,
  onConfirm,
  isSubmitting = false,
  error = null,
}) {
  const [stewardName, setStewardName] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");

  // Load saved steward name on mount
  useEffect(() => {
    const saved = localStorage.getItem("c360_steward_name");
    if (saved) setStewardName(saved);
  }, []);

  // Reset reason when modal opens or candidate changes
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setValidationError("");
    }
  }, [isOpen, candidate]);

  if (!isOpen || !candidate) return null;

  const actionKey = actionType?.toUpperCase() || "APPROVE";

  const config = {
    APPROVE: {
      title: "Approve & Merge Golden Records",
      actionText: "Approve & Merge",
      btnClass: "btn-approve",
      icon: <CheckCircleIcon size={22} className="text-emerald-500" />,
      description:
        "Approving this match will merge the two source customer records under a unified Golden Record using the survivorship strategy (PREFER_EXISTING_NON_NULL).",
      impact: [
        "A surviving Golden Record will be maintained with unified customer attributes.",
        "The secondary record will be marked as MERGED (absorbed).",
        "Active crosswalk mappings will be redirected to the surviving Golden Record.",
        "An immutable audit trail entry will be written to STEWARDSHIP_AUDIT.",
      ],
      quickReasons: STEWARD_QUICK_REASONS.APPROVE,
    },
    REJECT: {
      title: "Reject Match Candidate",
      actionText: "Reject Match",
      btnClass: "btn-reject",
      icon: <XCircleIcon size={22} className="text-rose-500" />,
      description:
        "Rejecting this match marks the candidate pair as non-matching. No Golden Record merge will occur, and records remain completely independent.",
      impact: [
        "Match candidate status will be updated to REJECTED in Snowflake.",
        "Source records and Golden Records will remain separate.",
        "Rejection decision and rationale are permanently recorded in STEWARDSHIP_AUDIT.",
      ],
      quickReasons: STEWARD_QUICK_REASONS.REJECT,
    },
    UNMERGE: {
      title: "Reverse Merge / Unmerge Records",
      actionText: "Reverse Merge (Unmerge)",
      btnClass: "btn-unmerge",
      icon: <UnmergeIcon size={22} className="text-indigo-500" />,
      description:
        "Reversing this merge restores the absorbed Golden Record and re-establishes original source-to-Golden-Record crosswalk mappings.",
      impact: [
        "Match candidate status changes to UNMERGED.",
        "Previous Golden Record is restored to ACTIVE status with original attribute lineage.",
        "Historical crosswalk mappings are reactivated.",
        "Reversal event is logged to STEWARDSHIP_AUDIT with complete before/after snapshots.",
      ],
      quickReasons: STEWARD_QUICK_REASONS.UNMERGE,
    },
  }[actionKey] || {};

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!stewardName.trim()) {
      setValidationError("Please enter the Steward Name.");
      return;
    }

    if (!reason.trim()) {
      setValidationError("Please provide a decision rationale for audit compliance.");
      return;
    }

    // Save steward name to localStorage for future decisions
    localStorage.setItem("c360_steward_name", stewardName.trim());
    setValidationError("");
    onConfirm({
      stewardName: stewardName.trim(),
      reason: reason.trim(),
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container confirmation-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            {config.icon}
            <div>
              <h3>{config.title}</h3>
              <p className="modal-subtitle">
                Candidate #{candidate.candidateId} • Confidence: {candidate.confidenceScore}% ({candidate.confidenceBand})
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose} aria-label="Close dialog">
            <CloseIcon size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Candidate summary pill */}
            <div className="candidate-recap-box">
              <div className="recap-side">
                <span className="recap-label">Record 1</span>
                <strong>{candidate.customerName1}</strong>
                <span className="recap-sub">
                  {candidate.sourceSystem1} • ID: {candidate.sourceCustomerId1}
                </span>
              </div>
              <div className="recap-divider">⇄</div>
              <div className="recap-side">
                <span className="recap-label">Record 2</span>
                <strong>{candidate.customerName2}</strong>
                <span className="recap-sub">
                  {candidate.sourceSystem2} • ID: {candidate.sourceCustomerId2}
                </span>
              </div>
            </div>

            <div className="modal-info-banner">
              <InfoIcon size={18} />
              <div>
                <p>{config.description}</p>
              </div>
            </div>

            {/* Error alerts */}
            {(validationError || error) && (
              <div className="alert-box alert-error">
                <span>{validationError || error}</span>
              </div>
            )}

            {/* Steward Name Input */}
            <div className="form-group">
              <label htmlFor="steward-name" className="form-label required">
                Data Steward Name
              </label>
              <input
                id="steward-name"
                type="text"
                className="form-input"
                placeholder="e.g. Harini Ravi (Data Governance)"
                value={stewardName}
                onChange={(e) => setStewardName(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <span className="form-hint">
                Required for enterprise compliance tracking in STEWARDSHIP_AUDIT.
              </span>
            </div>

            {/* Decision Reason Textarea */}
            <div className="form-group">
              <label htmlFor="decision-reason" className="form-label required">
                Stewardship Decision Rationale
              </label>
              <textarea
                id="decision-reason"
                className="form-textarea"
                rows={3}
                placeholder="Explain why this decision is being made..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Quick Reason Suggestions */}
            {config.quickReasons && config.quickReasons.length > 0 && (
              <div className="quick-reasons-block">
                <span className="quick-reasons-label">Standard Compliance Presets (click to select):</span>
                <div className="quick-reasons-chips">
                  {config.quickReasons.map((qr, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chip-preset"
                      onClick={() => setReason(qr)}
                      disabled={isSubmitting}
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Impact checklist */}
            <div className="audit-impact-section">
              <span className="impact-title">Snowflake Database Impact:</span>
              <ul className="impact-list">
                {config.impact?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${config.btnClass}`}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Executing Transaction in Snowflake..." : config.actionText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
