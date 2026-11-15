/**
 * Data models, field normalizers, and constants for Customer 360 Stewardship
 */

export const STATUS_TYPES = {
  PENDING_REVIEW: "PENDING_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  BLOCKED_DOB_CONFLICT: "BLOCKED_DOB_CONFLICT",
  BLOCKED_NAME_CONFLICT: "BLOCKED_NAME_CONFLICT",
  UNMERGED: "UNMERGED",
};

export const CONFIDENCE_BANDS = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

export const STEWARD_QUICK_REASONS = {
  APPROVE: [
    "Verified exact matching contact and identifier across systems",
    "High name similarity and verified common customer profile",
    "Customer service confirmed duplicate account ownership",
    "Billing and CRM accounts unified under customer request",
    "Confirmed same individual with minor spelling variation",
  ],
  REJECT: [
    "Distinct individuals sharing household phone or address",
    "Family member sharing contact info with distinct identity",
    "Conflicting date of birth and demographic data",
    "Low confidence score with unverified attribute alignment",
    "Identity cannot be conclusively confirmed from available data",
  ],
  UNMERGE: [
    "Reversing merge: customer clarified distinct personal accounts",
    "Correction of erroneous steward merge decision",
    "Source system corrected corrupted customer profile",
    "Independent profiles required for compliance/KYC isolation",
  ],
};

/**
 * Safely parse MATCH_EVIDENCE from Snowflake JSON or string
 */
export function parseEvidence(evidence) {
  if (!evidence) {
    return {
      reason: "No evidence details provided by matching engine",
      algorithm_version: "1.0.0",
    };
  }

  if (typeof evidence === "object") {
    return evidence;
  }

  if (typeof evidence === "string") {
    try {
      return JSON.parse(evidence);
    } catch {
      return {
        reason: evidence,
        algorithm_version: "1.0.0",
      };
    }
  }

  return {};
}

/**
 * Normalizes Snowflake match candidate row to consistent object format
 * Supports both Snowflake JDBC UPPERCASE columns and camelCase variations
 */
export function normalizeCandidate(raw) {
  if (!raw) return null;

  const candidateId =
    raw.MATCH_CANDIDATE_ID ??
    raw.matchCandidateId ??
    raw.ID ??
    raw.id;

  const evidence = parseEvidence(
    raw.MATCH_EVIDENCE ?? raw.matchEvidence ?? raw.evidence
  );

  const confidenceScore = Number(
    raw.CONFIDENCE_SCORE ?? raw.confidenceScore ?? 0
  );

  let confidenceBand =
    raw.CONFIDENCE_BAND ?? raw.confidenceBand;

  if (!confidenceBand) {
    if (confidenceScore >= 90) confidenceBand = "HIGH";
    else if (confidenceScore >= 70) confidenceBand = "MEDIUM";
    else confidenceBand = "LOW";
  }

  const status =
    raw.MATCH_STATUS ?? raw.matchStatus ?? "PENDING_REVIEW";

  return {
    candidateId: Number(candidateId),
    id: Number(candidateId),

    // Source record 1
    sourceRecordId1:
      raw.SOURCE_RECORD_ID_1 ?? raw.sourceRecordId1 ?? raw.source1 ?? null,
    customerName1:
      raw.CUSTOMER_NAME_1 ?? raw.customerName1 ?? raw.customer1Name ?? "—",
    sourceCustomerId1:
      raw.SOURCE_CUSTOMER_ID_1 ?? raw.sourceCustomerId1 ?? "—",
    sourceSystem1:
      raw.SOURCE_SYSTEM_1 ?? raw.sourceSystem1 ?? evidence.source_system_1 ?? "—",
    email1: raw.EMAIL_1 ?? raw.email1 ?? raw.EMAIL ?? null,
    phone1: raw.PHONE_1 ?? raw.phone1 ?? raw.PHONE ?? null,
    dob1: raw.DATE_OF_BIRTH_1 ?? raw.dob1 ?? raw.DOB_1 ?? null,

    // Source record 2
    sourceRecordId2:
      raw.SOURCE_RECORD_ID_2 ?? raw.sourceRecordId2 ?? raw.source2 ?? null,
    customerName2:
      raw.CUSTOMER_NAME_2 ?? raw.customerName2 ?? raw.customer2Name ?? "—",
    sourceCustomerId2:
      raw.SOURCE_CUSTOMER_ID_2 ?? raw.sourceCustomerId2 ?? "—",
    sourceSystem2:
      raw.SOURCE_SYSTEM_2 ?? raw.sourceSystem2 ?? evidence.source_system_2 ?? "—",
    email2: raw.EMAIL_2 ?? raw.email2 ?? null,
    phone2: raw.PHONE_2 ?? raw.phone2 ?? null,
    dob2: raw.DATE_OF_BIRTH_2 ?? raw.dob2 ?? raw.DOB_2 ?? null,

    // Metrics & metadata
    confidenceScore,
    confidenceBand: String(confidenceBand).toUpperCase(),
    matchMethod:
      raw.MATCH_METHOD ?? raw.matchMethod ?? "DETERMINISTIC_FUZZY",
    status: String(status).toUpperCase(),
    createdAt: raw.CREATED_AT ?? raw.createdAt ?? null,

    // Evidence
    evidence,
    raw,
  };
}

/**
 * Format timestamp into readable localized string
 */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Format score into percentage display
 */
export function formatScore(score) {
  if (score === null || score === undefined || isNaN(score)) return "0%";
  const num = Number(score);
  return `${Math.round(num)}%`;
}
