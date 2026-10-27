"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSteamSession } from "@/components/SteamSessionProvider";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { createRequestId } from "@/lib/requestId";

export default function LiveCommunityChat({ compact = false }) {
  const { steamUser, googleUser, loading } = useSteamSession();
  const identityKey = steamUser?.steamid
    ? "steam:" + steamUser.steamid
    : googleUser?.sub
      ? "google:" + googleUser.sub
      : "visitor";
  const [messages, setMessages] = useState([]),
    [draft, setDraft] = useState(""),
    [state, setState] = useState({
      connected: false,
      canSend: false,
      label: "Connecting…",
    }),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [retry, setRetry] = useState(0);
  const lastIdentity = useRef(identityKey);
  const socketRef = useRef(null),
    pendingRef = useRef(null),
    logRef = useRef(null),
    followRef = useRef(true),
    pendingTimer = useRef(null);
  useEffect(() => {
    if (loading) return;
    let stopped = false,
      socket,
      timer,
      attempts = 0,
      blocked = false;
    if (lastIdentity.current !== identityKey) {
      setDraft("");
      lastIdentity.current = identityKey;
    }
    setMessages([]);
    setPending(false);
    pendingRef.current = null;
    const updateHistory = (rows) => setMessages(rows.slice(-50));
    async function connect() {
      try {
        setState({ connected: false, canSend: false, label: "Connecting…" });
        const response = await fetchWithTimeout(
            "/api/community/chat",
            { method: "POST" },
            8000,
          ),
          ticket = await response.json();
        if (stopped) return;
        if (!response.ok) {
          blocked = ticket.error === "ACCOUNT_BANNED";
          throw Error(
            blocked
              ? "This account is suspended from community chat. Contact support to appeal."
              : ticket.error || "Chat is unavailable.",
          );
        }
        socket = new WebSocket(ticket.endpoint);
        socketRef.current = socket;
        const timeout = setTimeout(() => socket.close(), 8000);
        socket.onopen = () =>
          socket.send(JSON.stringify({ type: "join", ticket: ticket.ticket }));
        socket.onmessage = (event) => {
          if (stopped) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "ready") {
              clearTimeout(timeout);
              attempts = 0;
              updateHistory(data.messages);
              setState({
                connected: true,
                canSend: data.canSend,
                label: "Live community chat",
              });
              setError("");
            }
            if (data.type === "history") updateHistory(data.messages);
            if (data.type === "message")
              setMessages((rows) =>
                [
                  ...rows.filter((message) => message.id !== data.message.id),
                  data.message,
                ].slice(-50),
              );
            if (data.type === "sent" && data.requestId === pendingRef.current) {
              clearTimeout(pendingTimer.current);
              setDraft("");
              setPending(false);
              pendingRef.current = null;
            }
            if (data.type === "error") {
              clearTimeout(pendingTimer.current);
              setError(data.error);
              setPending(false);
              pendingRef.current = null;
            }
            if (data.type === "notice") setError(data.error);
            if (data.type === "rejected") {
              blocked = data.error === "ACCOUNT_BANNED";
              setError(
                blocked
                  ? "This account is suspended from community chat. Contact support to appeal."
                  : "Chat access is temporarily unavailable.",
              );
              setState({
                connected: false,
                canSend: false,
                label: blocked ? "Account suspended" : "Chat unavailable",
              });
            }
          } catch {
            setError("Chat received an unreadable response.");
            socket.close();
          }
        };
        socket.onerror = () => {};
        socket.onclose = () => {
          clearTimeout(timeout);
          if (stopped) return;
          socketRef.current = null;
          clearTimeout(pendingTimer.current);
          setPending(false);
          pendingRef.current = null;
          setState({
            connected: false,
            canSend: false,
            label: blocked ? "Account suspended" : "Reconnecting…",
          });
          if (!blocked)
            timer = setTimeout(
              connect,
              Math.min(15000, 1000 * 2 ** Math.min(attempts++, 4)),
            );
        };
      } catch (failure) {
        if (stopped) return;
        setError(failure.message);
        setState({
          connected: false,
          canSend: false,
          label: blocked ? "Account suspended" : "Chat unavailable",
        });
        if (!blocked)
          timer = setTimeout(
            connect,
            Math.min(15000, 2000 * 2 ** Math.min(attempts++, 3)),
          );
      }
    }
    void connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(pendingTimer.current);
      socketRef.current = null;
      socket?.close(1000, "Chat closed");
    };
  }, [identityKey, loading, retry]);
  useEffect(() => {
    if (followRef.current && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);
  function send(event) {
    event.preventDefault();
    const socket = socketRef.current;
    if (
      !state.connected ||
      !state.canSend ||
      pending ||
      !draft.trim() ||
      socket?.readyState !== WebSocket.OPEN
    )
      return;
    const requestId = createRequestId();
    pendingRef.current = requestId;
    pendingTimer.current = setTimeout(() => {
      if (pendingRef.current !== requestId) return;
      pendingRef.current = null;
      setPending(false);
      setError(
        "Delivery was not confirmed. Check the chat before sending again; your draft is still here.",
      );
    }, 10000);
    setPending(true);
    setError("");
    socket.send(
      JSON.stringify({ type: "message", body: draft.trim(), requestId }),
    );
  }
  return (
    <section
      className={"live-community-chat" + (compact ? " is-compact" : "")}
      aria-label="Live community chat"
    >
      <header className="chat-heading">
        <div>
          <p className="eyebrow">Talk with the community</p>
          <h2>{compact ? "Community chat" : "Live community chat"}</h2>
        </div>
        <span
          className={state.connected ? "chat-status is-live" : "chat-status"}
          role="status"
        >
          {state.label}
        </span>
      </header>
      <p className="muted">
        One community channel across the forum and universe. Messages are
        public; keep private evidence in{" "}
        <Link href="/report-player" target={compact ? "_blank" : undefined}>
          player reports
        </Link>
        .
      </p>
      <ol
        className="chat-messages"
        ref={logRef}
        role="log"
        aria-label="Community messages"
        aria-live="polite"
        aria-relevant="additions"
        onScroll={(event) => {
          const el = event.currentTarget;
          followRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 70;
        }}
      >
        {messages.map((message) => (
          <li key={message.id}>
            <div className="chat-message-heading">
              <strong>{message.displayName}</strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <p>{message.body}</p>
            <Link
              className="chat-report-link"
              href={
                "/report-player?player=" +
                encodeURIComponent(message.displayName) +
                "&message=" +
                encodeURIComponent(message.id)
              }
              target="_blank"
              rel="noopener noreferrer"
              aria-label={"Report chat message by " + message.displayName}
            >
              Report
            </Link>
          </li>
        ))}
        {state.connected && !messages.length ? (
          <li className="muted">No messages yet. Start the conversation.</li>
        ) : null}
      </ol>
      {error ? (
        <p role="alert" className="report-status error">
          {error}
        </p>
      ) : null}
      <form className="chat-compose" onSubmit={send}>
        <label>
          Message the community
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            rows={2}
            disabled={!state.canSend || !state.connected || pending}
            placeholder={
              state.canSend
                ? "Share a message…"
                : "Sign in to join the conversation"
            }
          />
        </label>
        <div className="chat-compose-actions">
          <small>{draft.length}/500 · Please allow others time to speak.</small>
          <button
            className="button primary"
            disabled={
              !state.connected || !state.canSend || pending || !draft.trim()
            }
          >
            {pending ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>
      {identityKey === "visitor" ? (
        <p className="muted">
          Read freely.{" "}
          <Link href="/profile" target={compact ? "_blank" : undefined}>
            Sign in with Google or Steam
          </Link>{" "}
          to send messages.
        </p>
      ) : null}
      {!state.connected ? (
        <button
          className="button secondary"
          onClick={() => {
            setError("");
            setRetry((value) => value + 1);
          }}
        >
          Reconnect chat
        </button>
      ) : null}
    </section>
  );
}
