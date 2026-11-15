/**
 * Customer 360 REST API Client
 * Connects to Spring Boot backend via Vite proxy in development (/api)
 * and Nginx reverse proxy in production EC2 deployments.
 */

const BASE_URL = "/api";

/**
 * Custom API Error class with response status and details
 */
export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Generic request wrapper with JSON serialization and robust error handling
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
    ...options,
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (netErr) {
    throw new ApiError(
      `Cannot connect to backend server at http://localhost:8080. Please ensure the Spring Boot service is running. (${netErr.message})`,
      0,
      netErr
    );
  }

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text ? { message: text } : null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      data?.error ||
      data?.message ||
      `Request failed with HTTP status ${response.status} (${response.statusText})`;
    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
}

/**
 * Test Snowflake Connection and fetch total source records count
 * Endpoint: GET /api/snowflake/test
 */
export async function getSnowflakeStatus() {
  return request("/snowflake/test");
}

/**
 * Fetch match candidates by status
 * Endpoint: GET /api/matches?status={status}
 * Valid statuses: PENDING_REVIEW, BLOCKED_DOB_CONFLICT, BLOCKED_NAME_CONFLICT, APPROVED, REJECTED, UNMERGED
 */
export async function getMatchesByStatus(status = "PENDING_REVIEW") {
  const query = encodeURIComponent(status);
  return request(`/matches?status=${query}`);
}

/**
 * Approve and merge a match candidate
 * Endpoint: POST /api/matches/{id}/approve
 * Payload: { stewardName, reason }
 */
export async function approveMatch(id, stewardName, reason) {
  if (!stewardName?.trim()) {
    throw new ApiError("Steward name is required for approval", 400);
  }
  if (!reason?.trim()) {
    throw new ApiError("Approval reason is required for stewardship audit", 400);
  }

  return request(`/matches/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({
      stewardName: stewardName.trim(),
      reason: reason.trim(),
    }),
  });
}

/**
 * Reject a match candidate
 * Endpoint: POST /api/matches/{id}/reject
 * Payload: { stewardName, reason }
 */
export async function rejectMatch(id, stewardName, reason) {
  if (!stewardName?.trim()) {
    throw new ApiError("Steward name is required for rejection", 400);
  }
  if (!reason?.trim()) {
    throw new ApiError("Rejection reason is required for stewardship audit", 400);
  }

  return request(`/matches/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({
      stewardName: stewardName.trim(),
      reason: reason.trim(),
    }),
  });
}

/**
 * Unmerge a previously approved Golden Record
 * Endpoint: POST /api/matches/{id}/unmerge
 * Payload: { stewardName, reason }
 */
export async function unmergeMatch(id, stewardName, reason) {
  if (!stewardName?.trim()) {
    throw new ApiError("Steward name is required for unmerge reversal", 400);
  }
  if (!reason?.trim()) {
    throw new ApiError("Reversal reason is required for stewardship audit", 400);
  }

  return request(`/matches/${id}/unmerge`, {
    method: "POST",
    body: JSON.stringify({
      stewardName: stewardName.trim(),
      reason: reason.trim(),
    }),
  });
}

/**
 * Fetch overview statistics by aggregating data across actual endpoints
 * Strictly uses live data from the Spring Boot API and Snowflake count
 */
export async function fetchDashboardMetrics() {
  const [snowflakeRes, pendingRes, approvedRes, rejectedRes, dobRes, nameRes, unmergedRes] =
    await Promise.allSettled([
      getSnowflakeStatus(),
      getMatchesByStatus("PENDING_REVIEW"),
      getMatchesByStatus("APPROVED"),
      getMatchesByStatus("REJECTED"),
      getMatchesByStatus("BLOCKED_DOB_CONFLICT"),
      getMatchesByStatus("BLOCKED_NAME_CONFLICT"),
      getMatchesByStatus("UNMERGED"),
    ]);

  const snowflake =
    snowflakeRes.status === "fulfilled"
      ? snowflakeRes.value
      : { status: "FAILED", message: snowflakeRes.reason?.message, sourceRecordCount: 0 };

  const getList = (settled) =>
    settled.status === "fulfilled" && Array.isArray(settled.value) ? settled.value : [];

  const pending = getList(pendingRes);
  const approved = getList(approvedRes);
  const rejected = getList(rejectedRes);
  const dobConflicts = getList(dobRes);
  const nameConflicts = getList(nameRes);
  const unmerged = getList(unmergedRes);

  const totalCandidates =
    pending.length +
    approved.length +
    rejected.length +
    dobConflicts.length +
    nameConflicts.length +
    unmerged.length;

  return {
    snowflake,
    sourceRecordCount: snowflake.sourceRecordCount ?? 0,
    totalCandidates,
    pendingCount: pending.length,
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    blockedDobCount: dobConflicts.length,
    blockedNameCount: nameConflicts.length,
    totalBlockedConflicts: dobConflicts.length + nameConflicts.length,
    unmergedCount: unmerged.length,
    // Sample collections for immediate display/preview
    pendingSample: pending,
    approvedSample: approved,
    conflictsSample: [...dobConflicts, ...nameConflicts],
    errors: {
      snowflake: snowflakeRes.status === "rejected" ? snowflakeRes.reason?.message : null,
      matches: pendingRes.status === "rejected" ? pendingRes.reason?.message : null,
    },
  };
}
