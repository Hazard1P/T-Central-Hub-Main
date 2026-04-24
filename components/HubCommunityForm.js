'use client';

import { useEffect, useMemo, useState } from 'react';

const initialForm = {
  topic: '',
  category: 'General',
  message: '',
};

const CATEGORIES = ['General', 'Server feedback', 'Bug report', 'Events', 'Feature idea', 'Moderation'];

export default function HubCommunityForm() {
  const [session, setSession] = useState({ loading: true, user: null });
  const [form, setForm] = useState(initialForm);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const canSubmit = useMemo(
    () => Boolean(session.user?.steamid) && form.topic.trim() && form.message.trim(),
    [session.user?.steamid, form.topic, form.message]
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/auth/steam/session', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch('/api/hub-posts', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]).then(([authData, postsData]) => {
      if (!active) return;
      setSession({ loading: false, user: authData?.authenticated ? authData?.user : null });
      setPosts(Array.isArray(postsData?.posts) ? postsData.posts : []);
    });
    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus({ state: 'loading', message: 'Posting to T-Central Hub…' });

    try {
      const res = await fetch('/api/hub-posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Unable to post right now.');

      setForm(initialForm);
      setStatus({ state: 'success', message: `Post published. Reference: ${data?.reference || 'N/A'}.` });
      const refresh = await fetch('/api/hub-posts', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      setPosts(Array.isArray(refresh?.posts) ? refresh.posts : posts);
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Unable to post right now.' });
    }
  };

  return (
    <section className="hub-form-shell">
      <article className="content-card hub-form-card">
        <div className="hub-form-head">
          <p className="eyebrow">Community board</p>
          <h3>Steam-authenticated posting lane</h3>
          <p className="muted">
            Post updates, questions, ideas, and route notes related to anything in T-Central Hub.
          </p>
        </div>

        {session.loading ? <p className="muted">Checking Steam session…</p> : null}
        {!session.loading && !session.user ? (
          <div className="hub-auth-required">
            <p>Steam authentication is required to post.</p>
            <a className="button primary" href="/api/auth/steam/login?redirectTo=/hub-form">Sign in with Steam</a>
          </div>
        ) : null}

        <form className="hub-form-grid" onSubmit={onSubmit}>
          <label>
            Topic
            <input
              value={form.topic}
              onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
              maxLength={120}
              placeholder="Example: Rust monthly events"
              required
            />
          </label>
          <label>
            Category
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="full">
            Message
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              maxLength={3000}
              placeholder="Share updates, requests, bug details, event ideas, or questions for the community."
              required
            />
          </label>
          <button className="button primary" type="submit" disabled={!canSubmit || status.state === 'loading'}>
            {status.state === 'loading' ? 'Posting…' : 'Publish to board'}
          </button>
        </form>

        {status.message ? <p className={`hub-form-status ${status.state}`}>{status.message}</p> : null}
      </article>

      <article className="content-card hub-board-feed">
        <p className="eyebrow">Latest posts</p>
        <h3>Recent community signals</h3>
        <div className="hub-board-list">
          {posts.length ? posts.map((post) => (
            <div key={post.reference} className="hub-board-post">
              <div className="hub-board-post-head">
                <strong>{post.topic}</strong>
                <span>{post.category}</span>
              </div>
              <p>{post.message}</p>
              <small>
                {post.author?.personaname || 'Steam Pilot'} · {new Date(post.createdAt).toLocaleString()}
              </small>
            </div>
          )) : <p className="muted">No posts yet. Be the first to publish a hub update.</p>}
        </div>
      </article>
    </section>
  );
}
