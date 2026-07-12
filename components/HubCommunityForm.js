'use client';

import { useEffect, useMemo, useState } from 'react';
import { HUB_POST_CATEGORIES } from '@/lib/hubPosts';

const initialForm = {
  topic: '',
  category: 'General',
  message: '',
};

export default function HubCommunityForm() {
  const [session, setSession] = useState({ loading: true, provider: null, user: null });
  const [form, setForm] = useState(initialForm);
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [hubStorage, setHubStorage] = useState({ loading: true, storageConfigured: true, storage: 'none' });

  const canSubmit = useMemo(
    () => Boolean(session.user) && hubStorage.storageConfigured && form.topic.trim() && form.message.trim(),
    [session.user, hubStorage.storageConfigured, form.topic, form.message]
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/auth/steam/session', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch('/api/auth/google/session', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
      fetch('/api/hub-posts', { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
    ]).then(([steamData, googleData, postsData]) => {
      if (!active) return;
      const steamUser = steamData?.authenticated ? steamData?.user : null;
      const googleUser = googleData?.authenticated ? googleData?.user : null;
      setSession({
        loading: false,
        provider: steamUser ? 'steam' : googleUser ? 'google' : null,
        user: steamUser || googleUser || null,
      });
      setPosts(Array.isArray(postsData?.posts) ? postsData.posts : []);
      setHubStorage({
        loading: false,
        storageConfigured: postsData?.storageConfigured !== false,
        storage: postsData?.storage || 'none',
      });
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
          <h3>Steam/Google-authenticated posting lane</h3>
          <p className="muted">
            Post updates, questions, ideas, and route notes related to anything in T-Central Hub.
          </p>
        </div>

        {session.loading ? <p className="muted">Checking Steam/Google session…</p> : null}
        {!session.loading && !session.user ? (
          <div className="hub-auth-required">
            <p>Steam or Google authentication is required to post.</p>
            <a className="button primary" href="/api/auth/steam/login?redirectTo=/hub-form">Sign in with Steam</a>
            <a className="button secondary" href="/api/auth/google/login?redirectTo=/hub-form">Sign in with Google</a>
          </div>
        ) : null}
        {!session.loading && session.user ? (
          <p className="muted">Posting as {session.user.personaname || session.user.name || session.user.email || 'Community Pilot'} through {session.provider?.toUpperCase()}.</p>
        ) : null}
        {!hubStorage.loading && !hubStorage.storageConfigured ? (
          <div className="hub-auth-required" role="alert">
            <p>Durable hub storage is not configured; posting is temporarily unavailable.</p>
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
              {HUB_POST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
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
          <button className="button primary" type="submit" disabled={!canSubmit || status.state === 'loading' || hubStorage.loading}>
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
                {post.author?.displayName || post.author?.personaname || 'Community Pilot'} · {post.author?.provider ? `${post.author.provider.toUpperCase()} · ` : ''}{new Date(post.createdAt).toLocaleString()}
              </small>
            </div>
          )) : <p className="muted">No posts yet. Be the first to publish a hub update.</p>}
        </div>
      </article>
    </section>
  );
}
