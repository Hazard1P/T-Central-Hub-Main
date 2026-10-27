"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
const stamp = (value) =>
  value ? new Date(value).toLocaleString() : "No expiry";
const actionNames = {
  hide_chat: "Hide chat message",
  review: "Mark under review",
  dismiss: "Dismiss report",
  resolve: "Resolve report",
  temp_ban: "Temporary ban",
  ban: "Permanent ban",
  unban: "Remove ban",
};
function ActionForm({ report, accountKey, onAction, unbanOnly = false }) {
  const [action, setAction] = useState(
    unbanOnly ? "unban" : report ? "review" : "temp_ban",
  );
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState("24");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = report?.target_key || accountKey;
  useEffect(() => {
    setConfirmed(false);
  }, [target]);
  const banning = action === "ban" || action === "temp_ban";
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (
        await onAction({
          action,
          reason,
          targetKey:
            banning || unbanOnly ? target || null : report?.target_key || null,
          reference: report?.reference || null,
          ...(action === "temp_ban" ? { hours: Number(hours) } : {}),
        })
      ) {
        setReason("");
        setConfirmed(false);
      }
    } finally {
      setBusy(false);
    }
  }
  const options = unbanOnly
    ? ["unban"]
    : report
      ? ["review", "dismiss", "resolve", "temp_ban", "ban"]
      : ["temp_ban", "ban"];
  return (
    <form className="moderation-action-form" onSubmit={submit}>
      <label>
        Action
        <select
          aria-label="Action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setConfirmed(false);
          }}
        >
          {options.map((key) => (
            <option value={key} key={key}>
              {actionNames[key]}
            </option>
          ))}
        </select>
      </label>
      {action === "temp_ban" ? (
        <label>
          Duration
          <select
            aria-label="Duration"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          >
            {[
              [1, "1 hour"],
              [24, "24 hours"],
              [72, "3 days"],
              [168, "7 days"],
              [720, "30 days"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Reason {banning ? "(shown to this player)" : "(private audit note)"}
        <textarea
          required
          minLength={5}
          maxLength={1000}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {banning ? (
        <>
          <p className="muted">
            Target:{" "}
            <code>{target || "Choose an account using the search above."}</code>
          </p>
          <label className="moderation-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            I reviewed the account and evidence for this{" "}
            {action === "ban" ? "permanent" : "temporary"} ban.
          </label>
        </>
      ) : null}
      <button
        className="button secondary"
        disabled={busy || (banning && (!target || !confirmed))}
      >
        {busy ? "Saving…" : actionNames[action]}
      </button>
    </form>
  );
}
function HideChatForm({ message, onAction }) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="moderation-action-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
          if (
            await onAction({
              action: "hide_chat",
              messageId: message.id,
              reason,
            })
          )
            setReason("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Reason for hiding this message
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
        />
      </label>
      <button className="button secondary" disabled={busy}>
        {busy ? "Hiding…" : "Hide chat message"}
      </button>
    </form>
  );
}
export default function ModerationDashboard() {
  const [data, setData] = useState(null),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("open");
  const [account, setAccount] = useState(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async (q = "") => {
    try {
      const response = await fetchWithTimeout(
        "/api/admin/moderation?q=" + encodeURIComponent(q),
        { cache: "no-store" },
        8000,
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Could not load moderation.");
      setData(result);
      setError("");
    } catch (failure) {
      setError(failure.message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(payload) {
    setError("");
    setNotice("");
    try {
      const response = await fetchWithTimeout(
        "/api/admin/moderation",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
        20000,
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Action failed.");
      setNotice(
        result.enforcement === "pending"
          ? "Saved. Game service notification is pending; its periodic account check will enforce the change."
          : "Saved. The moderation history has been updated.",
      );
      await load(query);
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    }
  }
  const reports = (data?.reports || []).filter(
    (report) =>
      filter === "all" ||
      (filter === "open"
        ? ["received", "reviewing"].includes(report.status)
        : report.status === filter),
  );
  return (
    <div className="moderation-dashboard">
      <div className="moderation-toolbar">
        <button className="button secondary" onClick={() => load(query)}>
          Refresh queue
        </button>
        <label>
          Reports
          <select
            aria-label="Reports"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Open reports</option>
            <option value="all">All recent reports</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      </div>
      <p className="muted">
        Reports are private allegations requiring review. Bans apply to the
        selected Google or Steam account across all shared rooms. Temporary bans
        expire automatically. Independent Rust and Arma servers manage their own
        access.
      </p>
      {notice ? (
        <p role="status" className="report-status success">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="report-status error">
          {error}
        </p>
      ) : null}
      <section className="content-card">
        <h2>Find an account</h2>
        <form
          className="moderation-search"
          onSubmit={(event) => {
            event.preventDefault();
            void load(query);
          }}
        >
          <label>
            Gamertag or full account ID
            <input
              minLength={2}
              maxLength={160}
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="button secondary">Search accounts</button>
        </form>
        <ul className="moderation-accounts">
          {data?.accounts.map((item) => (
            <li key={item.account_key}>
              <span>
                {item.username || "Unnamed account"}
                <code>{item.account_key}</code>
              </span>
              <button
                className="button secondary"
                onClick={() => setAccount(item)}
              >
                Select account
              </button>
            </li>
          ))}
        </ul>
        {account ? (
          <details open>
            <summary>
              Selected: {account.username || account.account_key}
            </summary>
            <code>{account.account_key}</code>
            <p className="muted">
              This selection also supplies the target for reports whose account
              is unresolved.
            </p>
            <ActionForm
              key={account.account_key}
              accountKey={account.account_key}
              onAction={act}
            />
            <button
              className="button secondary"
              onClick={() => setAccount(null)}
            >
              Clear selection
            </button>
          </details>
        ) : null}
      </section>
      <section aria-label="Player reports">
        <h2>Report queue</h2>
        <p className="muted">
          Up to 100 matching reports, with open reports listed first. Search by
          player name, account ID or report reference to find older records.
          Refresh to check for new submissions.
        </p>
        {!data ? (
          <p>Loading reports…</p>
        ) : !reports.length ? (
          <p>No reports match this view.</p>
        ) : null}
        {reports.map((report) => (
          <article
            className="content-card moderation-report"
            key={report.reference}
          >
            <header>
              <h3>{report.reported_player}</h3>
              <span>{report.status}</span>
            </header>
            <p>
              <code>{report.reference}</code> · {stamp(report.created_at)}
            </p>
            <dl>
              <dt>Account</dt>
              <dd>
                <code>
                  {report.target_key ||
                    "Unresolved — verify the account before banning"}
                </code>
              </dd>
              <dt>Location</dt>
              <dd>{report.location}</dd>
              <dt>Reporter</dt>
              <dd>
                {report.reporter?.displayName || "Guest reporter"}
                {report.reporter?.accountKey ? (
                  <code>{report.reporter.accountKey}</code>
                ) : null}
              </dd>
              <dt>Reason</dt>
              <dd>{report.reason}</dd>
              {report.chat_message_id ? (
                <>
                  <dt>Chat message reference</dt>
                  <dd>
                    <code>{report.chat_message_id}</code>
                  </dd>
                </>
              ) : null}
              {report.chatMessage ? (
                <>
                  <dt>
                    Reported chat message{" "}
                    {report.chatMessage.hiddenAt
                      ? "(hidden from public chat)"
                      : ""}
                  </dt>
                  <dd className="moderation-evidence">
                    {report.chatMessage.body}
                  </dd>
                </>
              ) : null}
              <dt>Evidence or notes</dt>
              <dd className="moderation-evidence">{report.evidence}</dd>
            </dl>
            <details>
              <summary>Review or take action</summary>
              <ActionForm
                report={report}
                accountKey={account?.account_key}
                onAction={act}
              />
            </details>
          </article>
        ))}
      </section>
      <section aria-label="Active bans">
        <h2>Active bans</h2>
        {data && !data.bans.length ? <p>No active bans.</p> : null}
        {data?.bans.map((ban) => (
          <article className="content-card" key={ban.account_key}>
            <h3>
              <code>{ban.account_key}</code>
            </h3>
            <p>{ban.reason}</p>
            <p>Expires: {stamp(ban.expires_at)}</p>
            <details>
              <summary>Remove ban</summary>
              <ActionForm
                unbanOnly
                accountKey={ban.account_key}
                onAction={act}
              />
            </details>
          </article>
        ))}
      </section>
      <section aria-label="Chat moderation">
        <h2>Recent community chat</h2>
        {data?.chatMessages?.map((message) => (
          <article className="content-card" key={message.id}>
            <h3>{message.display_name}</h3>
            <p className="moderation-evidence">{message.body}</p>
            <p>
              <code>{message.author_key}</code> · {stamp(message.created_at)}
            </p>
            <details>
              <summary>Hide message</summary>
              <HideChatForm message={message} onAction={act} />
            </details>
          </article>
        ))}
      </section>
      <section className="content-card">
        <h2>Recent moderation history</h2>
        <ol className="moderation-history">
          {data?.actions.map((action) => (
            <li key={action.id}>
              <strong>{actionNames[action.action] || action.action}</strong> ·{" "}
              {stamp(action.created_at)}
              <p>{action.reason}</p>
              <small>
                By <code>{action.actor}</code>
                {action.chat_message_id ? (
                  <>
                    {" "}
                    · Chat <code>{action.chat_message_id}</code>
                  </>
                ) : null}
                {action.target_key ? (
                  <>
                    {" "}
                    · Account <code>{action.target_key}</code>
                  </>
                ) : null}
                {action.report_reference ? (
                  <>
                    {" "}
                    · <code>{action.report_reference}</code>
                  </>
                ) : null}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
