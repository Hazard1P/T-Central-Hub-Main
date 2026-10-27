"use client";
import LiveCommunityChat from "./LiveCommunityChat";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSteamSession } from "@/components/SteamSessionProvider";
import {
  COMMUNITY_SECTIONS,
  COMMUNITY_BOARDS,
  communityBoard,
  boardForPost,
} from "@/lib/communitySections";

const initialForm = {
  topic: "",
  subheading: "",
  board: "general-discussion",
  message: "",
};

export default function HubCommunityForm() {
  const { steamUser, googleUser, loading } = useSteamSession();
  const user = steamUser || googleUser;
  const provider = steamUser ? "Steam" : "Google";
  const [form, setForm] = useState(initialForm);
  const [posts, setPosts] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [boardFilter, setBoardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [feed, setFeed] = useState({
    loading: true,
    available: false,
    error: "",
    checkedAt: null,
  });
  const requestSequence = useRef(0);
  const submitting = useRef(false);

  const refreshPosts = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch(
        "/api/hub-posts" +
          (boardFilter === "all"
            ? ""
            : "?board=" + encodeURIComponent(boardFilter)),
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || "Unable to refresh the board.");
      if (sequence !== requestSequence.current) return;
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      if (boardFilter === "all")
        setRecentPosts(Array.isArray(data.posts) ? data.posts : []);
      setFeed({
        loading: false,
        available: data.storageConfigured !== false,
        error: "",
        checkedAt: new Date(),
      });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      // Keep previously loaded posts visible when a refresh fails.
      setFeed((previous) => ({
        ...previous,
        loading: false,
        available: false,
        error: error.message || "Unable to refresh the board.",
      }));
    }
  }, [boardFilter]);

  useEffect(() => {
    refreshPosts();
    const refreshVisible = () => {
      if (!document.hidden) refreshPosts();
    };
    const timer = setInterval(refreshVisible, 15000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("tcentral-community")
        : null;
    if (channel) channel.onmessage = refreshVisible;
    return () => {
      requestSequence.current += 1;
      clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      channel?.close();
    };
  }, [refreshPosts]);

  const visiblePosts = useMemo(
    () =>
      posts.filter(
        (post) =>
          (boardFilter === "all" || boardForPost(post).key === boardFilter) &&
          `${post.topic} ${post.subheading || ""} ${post.message} ${boardForPost(post).title} ${boardForPost(post).sectionTitle}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [posts, boardFilter, search],
  );
  const selectedBoard =
    communityBoard(form.board) || communityBoard("general-discussion");
  const selectedSection = COMMUNITY_SECTIONS.find(
    (section) => section.key === selectedBoard.sectionKey,
  );
  const browseBoard = communityBoard(boardFilter);
  const counts = useMemo(
    () =>
      recentPosts.reduce((totals, post) => {
        const key = boardForPost(post).key;
        totals[key] = (totals[key] || 0) + 1;
        return totals;
      }, {}),
    [recentPosts],
  );
  const canSubmit =
    Boolean(user) &&
    !loading &&
    feed.available &&
    form.topic.trim() &&
    form.message.trim();

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setStatus({ state: "loading", message: "Publishing your post…" });
    try {
      const response = await fetch("/api/hub-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok)
        throw new Error(
          data?.error || "Unable to publish. Your draft is still here.",
        );
      if (data.post) {
        setRecentPosts((previous) =>
          [
            data.post,
            ...previous.filter(
              (post) => post.reference !== data.post.reference,
            ),
          ].slice(0, 40),
        );
      }
      if (data.post)
        setPosts((previous) =>
          [
            data.post,
            ...previous.filter(
              (post) => post.reference !== data.post.reference,
            ),
          ].slice(0, 40),
        );
      setForm({ ...initialForm, board: form.board });
      setBoardFilter(form.board);
      setSearch("");
      setStatus({
        state: "success",
        message: "Your post is published and visible to the community.",
      });
      const channel =
        typeof BroadcastChannel !== "undefined"
          ? new BroadcastChannel("tcentral-community")
          : null;
      channel?.postMessage("published");
      channel?.close();
      await refreshPosts();
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error.message || "Unable to publish. Your draft is still here.",
      });
    } finally {
      submitting.current = false;
    }
  };

  return (
    <section className="hub-form-shell">
      <section
        className="content-card community-directory"
        aria-labelledby="discussion-sections-title"
      >
        <p className="eyebrow">Find your conversation</p>
        <h2 id="discussion-sections-title">Discussion sections</h2>
        <p className="muted">
          Choose a subsection to browse posts or start a discussion. Counts
          reflect the latest loaded posts, not the full archive.
        </p>
        <div className="community-section-grid">
          {COMMUNITY_SECTIONS.map((section) => (
            <article className="community-section" key={section.key}>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
              <ul>
                {section.boards.map((board) => (
                  <li key={board.key}>
                    <a
                      href="#community-feed-title"
                      className={boardFilter === board.key ? "is-active" : ""}
                      onClick={() => {
                        setBoardFilter(board.key);
                        setSearch("");
                        setForm((previous) => ({
                          ...previous,
                          board: board.key,
                        }));
                      }}
                    >
                      <strong>{board.title}</strong>
                      <span>{board.description}</span>
                      <small>
                        {counts[board.key] || 0} recent{" "}
                        {(counts[board.key] || 0) === 1 ? "post" : "posts"}
                      </small>
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="muted">
          For player reports, private evidence or appeals, use{" "}
          <Link href="/report-player">player reporting</Link> or{" "}
          <Link href="/contact">contact support</Link>.
        </p>
      </section>
      <div className="content-card community-chat-card">
        <LiveCommunityChat />
      </div>
      <article className="content-card hub-form-card">
        <p className="eyebrow">Your voice in the project</p>
        <h2>Start a conversation</h2>
        <p className="muted">
          Choose a discussion subsection, give your post a clear heading, and
          add an optional subheading.
        </p>
        {loading ? (
          <p className="muted">Checking your account…</p>
        ) : !user ? (
          <div className="hub-auth-required">
            <p>Read freely. Sign in with Steam or Google to publish.</p>
            <a
              className="button primary"
              href="/api/auth/steam/login?redirectTo=/hub-form"
            >
              Sign in with Steam
            </a>
            <a
              className="button secondary"
              href="/api/auth/google/login?redirectTo=/hub-form"
            >
              Sign in with Google
            </a>
          </div>
        ) : (
          <p className="muted">
            Posting as {user.personaname || user.gamertag || "Community Pilot"}{" "}
            through {provider}.
          </p>
        )}
        <form
          className="hub-form-grid"
          onSubmit={onSubmit}
          aria-busy={status.state === "loading"}
        >
          <fieldset className="full community-placement">
            <legend>Discussion placement</legend>
            <label>
              Section
              <select
                aria-label="Discussion section"
                value={selectedSection.key}
                onChange={(event) => {
                  const next = COMMUNITY_SECTIONS.find(
                    (section) => section.key === event.target.value,
                  );
                  setForm({ ...form, board: next.boards[0].key });
                }}
              >
                {COMMUNITY_SECTIONS.map((section) => (
                  <option value={section.key} key={section.key}>
                    {section.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subsection
              <select
                aria-label="Discussion subsection"
                value={form.board}
                onChange={(event) =>
                  setForm({ ...form, board: event.target.value })
                }
              >
                {selectedSection.boards.map((board) => (
                  <option value={board.key} key={board.key}>
                    {board.title}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">{selectedBoard.description}</p>
          </fieldset>
          <label className="full">
            Heading
            <input
              value={form.topic}
              onChange={(event) =>
                setForm({ ...form, topic: event.target.value })
              }
              maxLength={120}
              placeholder="What would you like to discuss?"
              required
            />
          </label>

          <label className="full">
            Subheading (optional)
            <input
              value={form.subheading}
              onChange={(event) =>
                setForm({ ...form, subheading: event.target.value })
              }
              maxLength={180}
              placeholder="A short introduction to your post"
            />
          </label>
          <label className="full">
            Message
            <textarea
              value={form.message}
              onChange={(event) =>
                setForm({ ...form, message: event.target.value })
              }
              maxLength={3000}
              placeholder="Share your idea, question, event or feedback."
              required
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={!canSubmit || status.state === "loading"}
          >
            {status.state === "loading" ? "Publishing…" : "Publish to board"}
          </button>
        </form>
        {status.message ? (
          <p role="status" className={`hub-form-status ${status.state}`}>
            {status.message}
          </p>
        ) : null}
        <p className="muted">
          Posts are public. Keep account details and private evidence out of the
          board. <Link href="/report-player">Report a concern</Link> or read the{" "}
          <Link href="/multiplayer-policy">community rules</Link>.
        </p>
      </article>
      <section
        className="content-card hub-board-feed"
        aria-labelledby="community-feed-title"
      >
        <p className="eyebrow">Community conversations</p>
        <h2 id="community-feed-title">
          {browseBoard
            ? `${browseBoard.sectionTitle} · ${browseBoard.title}`
            : "From the community"}
        </h2>
        {browseBoard ? (
          <p className="muted">{browseBoard.description}</p>
        ) : null}
        <div className="community-feed-tools">
          <label>
            Browse subsection
            <select
              aria-label="Browse subsection"
              value={boardFilter}
              onChange={(event) => setBoardFilter(event.target.value)}
            >
              <option value="all">All discussions</option>
              {COMMUNITY_SECTIONS.map((section) => (
                <optgroup label={section.title} key={section.key}>
                  {section.boards.map((board) => (
                    <option value={board.key} key={board.key}>
                      {board.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            Search posts
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search headings and messages"
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={refreshPosts}
          >
            Refresh posts
          </button>
        </div>
        <p className="muted" role="status">
          {feed.loading
            ? "Loading posts…"
            : feed.error
              ? `${feed.error} Previously loaded posts are kept below. You can retry with Refresh posts.`
              : `Refreshes every 15 seconds while this tab is visible.${feed.checkedAt ? ` Last checked ${feed.checkedAt.toLocaleTimeString()}.` : ""}`}
        </p>
        <div className="hub-board-list">
          {visiblePosts.map((post) => (
            <article
              id={`post-${post.reference}`}
              key={post.reference}
              className="hub-board-post"
              aria-labelledby={`title-${post.reference}`}
            >
              <div className="hub-board-post-head">
                <span>
                  {boardForPost(post).sectionTitle} · {boardForPost(post).title}
                </span>
                <a
                  href={`#post-${post.reference}`}
                  aria-label={`Link to ${post.topic}`}
                >
                  Link to post
                </a>
              </div>
              <h3 id={`title-${post.reference}`}>{post.topic}</h3>
              {post.subheading ? (
                <p className="community-post-subheading">{post.subheading}</p>
              ) : null}
              <p className="community-post-message">{post.message}</p>
              <small>
                {post.author?.displayName || "Community Pilot"} ·{" "}
                {post.author?.provider === "steam" ? "Steam" : "Google"} ·{" "}
                <time dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleString()}
                </time>
              </small>
            </article>
          ))}
          {!feed.loading && !visiblePosts.length && !feed.error ? (
            <p className="muted">
              {posts.length
                ? "No recent posts match this subsection or search. Start a discussion or choose All discussions."
                : "No posts yet. Choose a subsection and start the first conversation."}
            </p>
          ) : null}
        </div>
      </section>
    </section>
  );
}
