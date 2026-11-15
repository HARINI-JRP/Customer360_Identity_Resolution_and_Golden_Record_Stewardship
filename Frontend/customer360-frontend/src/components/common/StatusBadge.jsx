import React from "react";

export function StatusBadge({ status }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();

  const configs = {
    PENDING_REVIEW: {
      label: "Pending Review",
      className: "badge badge-pending",
    },
    APPROVED: {
      label: "Approved & Merged",
      className: "badge badge-approved",
    },
    REJECTED: {
      label: "Rejected",
      className: "badge badge-rejected",
    },
    BLOCKED_DOB_CONFLICT: {
      label: "Blocked (DOB Conflict)",
      className: "badge badge-conflict",
    },
    BLOCKED_NAME_CONFLICT: {
      label: "Blocked (Name Conflict)",
      className: "badge badge-conflict-alt",
    },
    UNMERGED: {
      label: "Unmerged / Reverted",
      className: "badge badge-unmerged",
    },
    MERGED: {
      label: "Merged (Absorbed)",
      className: "badge badge-merged",
    },
    ACTIVE: {
      label: "Active Golden Record",
      className: "badge badge-active",
    },
  };

  const config = configs[normalized] || {
    label: normalized.replaceAll("_", " "),
    className: "badge badge-default",
  };

  return <span className={config.className}>{config.label}</span>;
}

export function ConfidenceBadge({ score, band }) {
  const numericScore = Number(score ?? 0);
  let resolvedBand = band;

  if (!resolvedBand) {
    if (numericScore >= 90) resolvedBand = "HIGH";
    else if (numericScore >= 70) resolvedBand = "MEDIUM";
    else resolvedBand = "LOW";
  }

  const bandUpper = String(resolvedBand).toUpperCase();

  const bandConfigs = {
    HIGH: { label: "High Confidence", className: "confidence-high" },
    MEDIUM: { label: "Medium Confidence", className: "confidence-medium" },
    LOW: { label: "Low Confidence", className: "confidence-low" },
  };

  const config = bandConfigs[bandUpper] || bandConfigs.LOW;

  return (
    <div className={`confidence-pill ${config.className}`}>
      <span className="confidence-dot" />
      <span className="confidence-score">{Math.round(numericScore)}%</span>
      <span className="confidence-band">{bandUpper}</span>
    </div>
  );
}

export function SystemBadge({ system }) {
  if (!system || system === "—") return <span className="system-tag">—</span>;

  let colorClass = "system-default";
  const lower = system.toLowerCase();

  if (lower.includes("salesforce") || lower.includes("crm")) colorClass = "system-crm";
  else if (lower.includes("stripe") || lower.includes("billing")) colorClass = "system-billing";
  else if (lower.includes("shopify") || lower.includes("ecommerce")) colorClass = "system-ecommerce";
  else if (lower.includes("erp") || lower.includes("sap")) colorClass = "system-erp";

  return <span className={`system-tag ${colorClass}`}>{system}</span>;
}
