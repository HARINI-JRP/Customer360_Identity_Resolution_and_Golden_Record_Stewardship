
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [connection, setConnection] = useState("Checking...");
  const [recordCount, setRecordCount] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState("dashboard");
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [conflictType, setConflictType] = useState("BLOCKED_DOB_CONFLICT");
  const [conflicts, setConflicts] = useState([]);
  const [conflictsLoading, setConflictsLoading] = useState(false);
  const [conflictsError, setConflictsError] = useState("");
  const [approvedMatches, setApprovedMatches] = useState([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [approvedError, setApprovedError] = useState("");
  const [unmergeLoading, setUnmergeLoading] = useState(false);
  const [unmergeMessage, setUnmergeMessage] = useState("");
  const [auditRows, setAuditRows] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  async function checkConnection() {
    setConnection("Checking...");
    setError("");

    try {
      const response = await fetch("/api/snowflake/test");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== "SUCCESS") {
        throw new Error(data.message || "Connection failed");
      }

      setConnection("Connected");
      setRecordCount(data.sourceRecordCount);
    } catch (err) {
      setConnection("Disconnected");
      setError(err.message);
    }
  }
  async function loadMatches() {
  setMatchesLoading(true);
  setMatchesError("");

  try {
    const response = await fetch("/api/matches?status=PENDING_REVIEW");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setMatches(Array.isArray(data) ? data : []);
  } catch (error) {
    setMatchesError(error.message);
  } finally {
    setMatchesLoading(false);
  }
}
  useEffect(() => {
  if (page === "pending") {
    loadMatches();
  }
}, [page]);
  useEffect(() => {
    checkConnection();
  }, []);

async function handleDecision(action) {
  if (!selectedMatch || decisionLoading) return;

  const candidateId = selectedMatch.MATCH_CANDIDATE_ID;

  const stewardName = window.prompt("Enter steward name:");
  if (!stewardName?.trim()) return;

  const reason = window.prompt(
    `Enter reason for ${action === "approve" ? "approval" : "rejection"}:`
  );
  if (!reason?.trim()) return;

  const confirmed = window.confirm(
    action === "approve"
      ? `Approve candidate ${candidateId} and merge the Golden Records?`
      : `Reject candidate ${candidateId}?`
  );

  if (!confirmed) return;

  setDecisionLoading(true);
  setDecisionMessage("");

  try {
    const response = await fetch(
      `/api/matches/${candidateId}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stewardName: stewardName.trim(),
          reason: reason.trim(),
        }),
      }
    );

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }

    if (!response.ok) {
      throw new Error(
        result.error || result.message || `HTTP ${response.status}`
      );
    }

    setSelectedMatch(null);
    setDecisionMessage(
      result.message ||
        `Candidate ${candidateId} ${action === "approve" ? "approved" : "rejected"} successfully`
    );

    await loadMatches();
  } catch (error) {
    setDecisionMessage(`Action failed: ${error.message}`);
  } finally {
    setDecisionLoading(false);
  }
}

async function loadConflicts(status) {
  setConflictsLoading(true);
  setConflictsError("");

  try {
    const response = await fetch(
      `/api/matches?status=${encodeURIComponent(status)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    setConflicts(Array.isArray(data) ? data : []);
  } catch (error) {
    setConflicts([]);
    setConflictsError(error.message);
  } finally {
    setConflictsLoading(false);
  }
}
useEffect(() => {
  if (page === "conflicts") {
    loadConflicts(conflictType);
  }
}, [page, conflictType]);
  async function loadApprovedMatches() {
    setApprovedLoading(true);
    setApprovedError("");
    try {
      const response = await fetch("/api/matches?status=APPROVED");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setApprovedMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      setApprovedMatches([]);
      setApprovedError(err.message);
    } finally {
      setApprovedLoading(false);
    }
  }

  async function loadAudit() {
    setAuditLoading(true);
    setAuditError("");
    try {
      const response = await fetch("/api/audit");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAuditRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setAuditRows([]);
      setAuditError(err.message);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleUnmerge(match) {
    if (unmergeLoading) return;
    const id = match.MATCH_CANDIDATE_ID;
    const stewardName = window.prompt("Enter steward name:");
    if (!stewardName?.trim()) return;
    const reason = window.prompt("Reason for reversing this merge:");
    if (!reason?.trim()) return;
    if (!window.confirm(`Reverse merge for candidate ${id}?`)) return;
    setUnmergeLoading(true);
    setUnmergeMessage("");
    try {
      const response = await fetch(`/api/matches/${id}/unmerge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stewardName: stewardName.trim(), reason: reason.trim() }),
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch { result = { message: text }; }
      if (!response.ok || result.status === "ERROR") {
        throw new Error(result.error || result.message || `HTTP ${response.status}`);
      }
      setUnmergeMessage(result.message || `Candidate ${id} unmerged successfully.`);
      await loadApprovedMatches();
    } catch (err) {
      setUnmergeMessage(`Unmerge failed: ${err.message}`);
    } finally {
      setUnmergeLoading(false);
    }
  }

  useEffect(() => {
    if (page === "approved") loadApprovedMatches();
    if (page === "audit") loadAudit();
  }, [page]);


function formatAuditDate(timestamp) {
  if (!timestamp) return "—";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Customer 360</h2>
        <p>Identity Resolution & Stewardship</p>

        <nav>
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => setPage("dashboard")}
          >
            Dashboard
          </button>

          <button
            className={page === "pending" ? "active" : ""}
            onClick={() => setPage("pending")}
          >
            Pending Reviews
          </button>
          <button
  className={page === "conflicts" ? "active" : ""}
  onClick={() => setPage("conflicts")}
>
  Conflict Review
</button>
          <button className={page === "approved" ? "active" : ""} onClick={() => setPage("approved")}>Approved Matches</button>
          <button className={page === "audit" ? "active" : ""} onClick={() => setPage("audit")}>Audit History</button>
        </nav>
      </aside>

      <main className="content">
        {page === "dashboard" && (
          <>
            <header>
              <div>
                <h1>Dashboard</h1>
                <p>Welcome to Customer 360 Stewardship</p>
              </div>
              <button className="refresh" onClick={checkConnection}>Refresh</button>
            </header>
        <section className="cards">
          <div className="card">
            <p>Total Source Records</p>
            <h2>
              {recordCount === null
                ? "—"
                : recordCount.toLocaleString()}
            </h2>
          </div>

          <div className="card">
            <p>Snowflake Connection</p>
            <h2 className={connection === "Connected" ? "connected" : ""}>
              {connection}
            </h2>
          </div>
        </section>

        <section className="welcome">
          <h2>Customer Identity Management</h2>
          <p>
            Review potential duplicate customer records, approve or reject
            matches, and maintain accurate Golden Records.
          </p>
          <p>
            Use the navigation menu to manage customer identities.
          </p>

          {error && <p className="error">Connection error: {error}</p>}
        </section>
          </>
        )}

        {page === "pending" && (
          <>
            <header>
              <div>
                <h1>Pending Reviews</h1>
                <p>Review potential duplicate customer records</p>
              </div>
              <button className="refresh" onClick={loadMatches}>Refresh</button>
            </header>
            {decisionMessage && (
              <div className="decision-message">{decisionMessage}</div>
            )}
    <section className="welcome">
      <h2>Match Candidates</h2>
      <p>Showing up to 100 pending matches from Snowflake.</p>

      {matchesLoading && <p>Loading matches...</p>}
      {matchesError && <p className="error">{matchesError}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate ID</th>
              <th>Customer 1</th>
              <th>Customer 2</th>
              <th>Confidence</th>
              <th>Match Method</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {matches.map((match, index) => (
              <tr key={match.MATCH_CANDIDATE_ID ?? index}>
                <td>{match.MATCH_CANDIDATE_ID ?? "—"}</td>
                <td>{match.CUSTOMER_NAME_1 ?? "—"}</td>
                <td>{match.CUSTOMER_NAME_2 ?? "—"}</td>
                <td>{match.CONFIDENCE_SCORE ?? "—"}</td>
                <td>{match.MATCH_METHOD ?? "—"}</td>
                <td>
  <button
    className="review-btn"
    onClick={() => setSelectedMatch(match)}
  >
    Review
  </button>
</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
          </>
        )}

        {page === "conflicts" && (
  <>
    <header>
      <div>
        <h1>Conflict Review</h1>
        <p>Review potentially unsafe customer matches</p>
      </div>

      <button
        className="refresh"
        onClick={() => loadConflicts(conflictType)}
      >
        Refresh
      </button>
    </header>

    <section className="welcome">
      <h2>Blocked Match Candidates</h2>

      <p>
        These matches were blocked by the Identity Resolution
        Engine to prevent incorrect customer merging.
      </p>

      <div className="conflict-tabs">
        <button
          className={
            conflictType === "BLOCKED_DOB_CONFLICT"
              ? "conflict-tab active-tab"
              : "conflict-tab"
          }
          onClick={() => setConflictType("BLOCKED_DOB_CONFLICT")}
        >
          DOB Conflicts
        </button>

        <button
          className={
            conflictType === "BLOCKED_NAME_CONFLICT"
              ? "conflict-tab active-tab"
              : "conflict-tab"
          }
          onClick={() => setConflictType("BLOCKED_NAME_CONFLICT")}
        >
          Name Conflicts
        </button>
      </div>

      <p>Showing up to 100 records from the selected category.</p>

      {conflictsLoading && <p>Loading conflicts...</p>}

      {conflictsError && (
        <p className="error">{conflictsError}</p>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate ID</th>
              <th>Customer 1</th>
              <th>Customer 2</th>
              <th>Conflict Type</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {!conflictsLoading &&
              conflicts.map((match, index) => (
                <tr key={match.MATCH_CANDIDATE_ID ?? index}>
                  <td>{match.MATCH_CANDIDATE_ID}</td>
                  <td>{match.CUSTOMER_NAME_1 ?? "—"}</td>
                  <td>{match.CUSTOMER_NAME_2 ?? "—"}</td>
                  <td>
                    <span className="conflict-badge">
                      {match.MATCH_STATUS === "BLOCKED_DOB_CONFLICT"
                        ? "DOB Conflict"
                        : "Name Conflict"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="review-btn"
                      onClick={() => setSelectedMatch(match)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}

            {!conflictsLoading &&
              !conflictsError &&
              conflicts.length === 0 && (
                <tr>
                  <td colSpan="5">No conflicts found.</td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </section>
  </>
)}

        {page === "approved" && (
          <>
            <header>
              <div><h1>Approved Matches</h1><p>Review and reverse approved Golden Record merges</p></div>
              <button className="refresh" onClick={loadApprovedMatches}>Refresh</button>
            </header>
            <section className="welcome">
              <h2>Approved Golden Record Merges</h2>
              <p>Unmerge only when a stewardship correction is required.</p>
              {unmergeMessage && <div className="decision-message">{unmergeMessage}</div>}
              {approvedLoading && <p>Loading approved matches...</p>}
              {approvedError && <p className="error">{approvedError}</p>}
              <div className="table-wrap"><table>
                <thead><tr><th>Candidate ID</th><th>Customer 1</th><th>Customer 2</th><th>Confidence</th><th>Method</th><th>Action</th></tr></thead>
                <tbody>
                  {!approvedLoading && approvedMatches.map(match => (
                    <tr key={match.MATCH_CANDIDATE_ID}>
                      <td>{match.MATCH_CANDIDATE_ID}</td>
                      <td>{match.CUSTOMER_NAME_1 ?? "—"}</td>
                      <td>{match.CUSTOMER_NAME_2 ?? "—"}</td>
                      <td>{match.CONFIDENCE_SCORE ?? "—"}</td>
                      <td>{match.MATCH_METHOD ?? "—"}</td>
                      <td><div className="approved-actions">
                        <button className="review-btn" onClick={() => setSelectedMatch(match)}>View Details</button>
                        <button className="unmerge-btn" disabled={unmergeLoading} onClick={() => handleUnmerge(match)}>
                          {unmergeLoading ? "Processing..." : "Unmerge"}
                        </button>
                      </div></td>
                    </tr>
                  ))}
                  {!approvedLoading && !approvedError && approvedMatches.length === 0 && (
                    <tr><td colSpan="6">No approved matches found.</td></tr>
                  )}
                </tbody>
              </table></div>
            </section>
          </>
        )}

        {page === "audit" && (
          <>
            <header>
              <div><h1>Audit History</h1><p>Trace steward decisions and Golden Record changes</p></div>
              <button className="refresh" onClick={loadAudit}>Refresh</button>
            </header>
            <section className="welcome">
              <h2>Stewardship Audit Log</h2>
              <p>Showing up to 200 most recent recorded actions.</p>
              {auditLoading && <p>Loading audit history...</p>}
              {auditError && <p className="error">{auditError}</p>}
              <div className="table-wrap"><table>
                <thead><tr><th>Audit ID</th><th>Candidate ID</th><th>Action</th><th>Decision</th><th>Steward</th><th>Reason</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {!auditLoading && auditRows.map((entry, i) => (
                    <tr key={entry.AUDIT_ID ?? i}>
                      <td>{entry.AUDIT_ID ?? "—"}</td>
                      <td>{entry.MATCH_CANDIDATE_ID ?? "—"}</td>
                      <td>{entry.ACTION_TYPE ?? "—"}</td>
                      <td>{entry.DECISION ?? "—"}</td>
                      <td>{entry.STEWARD_NAME ?? "—"}</td>
                      <td>{entry.DECISION_REASON ?? "—"}</td>
                      <td>{entry.ACTION_TIMESTAMP == null ? "—" : String(formatAuditDate(entry.ACTION_TIMESTAMP))}</td>
                    </tr>
                  ))}
                  {!auditLoading && !auditError && auditRows.length === 0 && (
                    <tr><td colSpan="7">No audit events found.</td></tr>
                  )}
                </tbody>
              </table></div>
            </section>
          </>
        )}
      </main>

{selectedMatch && (
  <div
    className="modal-overlay"
    onClick={() => setSelectedMatch(null)}
  >
    <div
      className="comparison-modal"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="modal-header">
        <div>
          <h2>Compare Customer Records</h2>
          <p>
            Match Candidate #{selectedMatch.MATCH_CANDIDATE_ID}
          </p>
        </div>

        <button
          className="close-btn"
          onClick={() => setSelectedMatch(null)}
        >
          ×
        </button>
      </div>

      <div className="match-summary">
        <span>
          Confidence: {selectedMatch.CONFIDENCE_SCORE}
        </span>
        <span>
          Method: {selectedMatch.MATCH_METHOD}
        </span>
      </div>

      <div className="customer-comparison">
        <div className="customer-card">
          <h3>Customer 1</h3>

          <p>
            <strong>Name:</strong>{" "}
            {selectedMatch.CUSTOMER_NAME_1 ?? "Not available"}
          </p>

          <p>
            <strong>Source:</strong>{" "}
            {selectedMatch.SOURCE_SYSTEM_1 ?? "Not available"}
          </p>

          <p>
            <strong>Source Customer ID:</strong>{" "}
            {selectedMatch.SOURCE_CUSTOMER_ID_1 ?? "Not available"}
          </p>

          <p>
            <strong>Source Record ID:</strong>{" "}
            {selectedMatch.SOURCE_RECORD_ID_1 ?? "Not available"}
          </p>

          <p>
            <strong>Email:</strong>{" "}
            {selectedMatch.EMAIL_1 ?? "Not available"}
          </p>

          <p>
            <strong>Phone:</strong>{" "}
            {selectedMatch.PHONE_1 ?? "Not available"}
          </p>

          <p>
            <strong>Date of Birth:</strong>{" "}
            {selectedMatch.DATE_OF_BIRTH_1 ?? "Not available"}
          </p>
        </div>

        <div className="customer-card">
          <h3>Customer 2</h3>

          <p>
            <strong>Name:</strong>{" "}
            {selectedMatch.CUSTOMER_NAME_2 ?? "Not available"}
          </p>

          <p>
            <strong>Source:</strong>{" "}
            {selectedMatch.SOURCE_SYSTEM_2 ?? "Not available"}
          </p>

          <p>
            <strong>Source Customer ID:</strong>{" "}
            {selectedMatch.SOURCE_CUSTOMER_ID_2 ?? "Not available"}
          </p>

          <p>
            <strong>Source Record ID:</strong>{" "}
            {selectedMatch.SOURCE_RECORD_ID_2 ?? "Not available"}
          </p>

          <p>
            <strong>Email:</strong>{" "}
            {selectedMatch.EMAIL_2 ?? "Not available"}
          </p>

          <p>
            <strong>Phone:</strong>{" "}
            {selectedMatch.PHONE_2 ?? "Not available"}
          </p>

          <p>
            <strong>Date of Birth:</strong>{" "}
            {selectedMatch.DATE_OF_BIRTH_2 ?? "Not available"}
          </p>
        </div>
      </div>

      <div className="evidence-box">
        <h3>Why was this match suggested?</h3>

        <pre>
          {typeof selectedMatch.MATCH_EVIDENCE === "string"
            ? selectedMatch.MATCH_EVIDENCE
            : JSON.stringify(
                selectedMatch.MATCH_EVIDENCE ?? {},
                null,
                2
              )}
        </pre>
      </div>

<div className="modal-footer">
  {selectedMatch.MATCH_STATUS === "PENDING_REVIEW" && (
    <>
      <button
        className="approve-btn"
        disabled={decisionLoading}
        onClick={() => handleDecision("approve")}
      >
        {decisionLoading ? "Processing..." : "Approve & Merge"}
      </button>

      <button
        className="reject-btn"
        disabled={decisionLoading}
        onClick={() => handleDecision("reject")}
      >
        Reject Match
      </button>
    </>
  )}

  <button
    className="close-action"
    disabled={decisionLoading}
    onClick={() => setSelectedMatch(null)}
  >
    Close
  </button>
</div>

    </div>
  </div>
)}

    </div>
  );
}

export default App;
