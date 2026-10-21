'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSteamSession } from '@/components/SteamSessionProvider';
import { HUB_POST_CATEGORIES } from '@/lib/hubPosts';

const initialForm = { topic: '', subheading: '', category: 'General', message: '' };

export default function HubCommunityForm() {
  const { steamUser, googleUser, loading } = useSteamSession();
  const user = steamUser || googleUser;
  const provider = steamUser ? 'Steam' : 'Google';
  const [form, setForm] = useState(initialForm);
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('All topics');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [feed, setFeed] = useState({ loading: true, available: false, error: '', checkedAt: null });
  const requestSequence = useRef(0);
  const submitting = useRef(false);

  const refreshPosts = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch('/api/hub-posts', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to refresh the board.');
      if (sequence !== requestSequence.current) return;
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setFeed({ loading: false, available: data.storageConfigured !== false, error: '', checkedAt: new Date() });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      // Keep previously loaded posts visible when a refresh fails.
      setFeed((previous) => ({ ...previous, loading: false, available: false, error: error.message || 'Unable to refresh the board.' }));
    }
  }, []);

  useEffect(() => {
    refreshPosts();
    const refreshVisible = () => { if (!document.hidden) refreshPosts(); };
    const timer = setInterval(refreshVisible, 15000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tcentral-community') : null;
    if (channel) channel.onmessage = refreshVisible;
    return () => {
      requestSequence.current += 1;
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      channel?.close();
    };
  }, [refreshPosts]);

  const visiblePosts = useMemo(() => posts.filter((post) =>
    (category === 'All topics' || post.category === category) &&
    `${post.topic} ${post.subheading || ''} ${post.message}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [posts, category, search]);
  const canSubmit = Boolean(user) && !loading && feed.available && form.topic.trim() && form.message.trim();

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setStatus({ state: 'loading', message: 'Publishing your post…' });
    try {
      const response = await fetch('/api/hub-posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Unable to publish. Your draft is still here.');
      if (data.post) setPosts((previous) => [data.post, ...previous.filter((post) => post.reference !== data.post.reference)].slice(0, 40));
      setForm(initialForm);
      setCategory('All topics'); setSearch('');
      setStatus({ state: 'success', message: 'Your post is published and visible to the community.' });
      const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('tcentral-community') : null;
      channel?.postMessage('published'); channel?.close();
      await refreshPosts();
    } catch (error) {
      setStatus({ state: 'error', message: error.message || 'Unable to publish. Your draft is still here.' });
    } finally { submitting.current = false; }
  };

  return (
    <section className="hub-form-shell">
      <article className="content-card hub-form-card">
        <p className="eyebrow">Your voice in the project</p>
        <h2>Start a conversation</h2>
        <p className="muted">Give your post a heading, add an optional subheading, and choose the topic it belongs to.</p>
        {loading ? <p className="muted">Checking your account…</p> : !user ? (
          <div className="hub-auth-required">
            <p>Read freely. Sign in with Steam or Google to publish.</p>
            <a className="button primary" href="/api/auth/steam/login?redirectTo=/hub-form">Sign in with Steam</a>
            <a className="button secondary" href="/api/auth/google/login?redirectTo=/hub-form">Sign in with Google</a>
          </div>
        ) : <p className="muted">Posting as {user.personaname || user.name || 'Community Pilot'} through {provider}.</p>}
        <form className="hub-form-grid" onSubmit={onSubmit} aria-busy={status.state === 'loading'}>
          <label>Heading<input value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} maxLength={120} placeholder="What would you like to discuss?" required /></label>
          <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{HUB_POST_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="full">Subheading (optional)<input value={form.subheading} onChange={(event) => setForm({ ...form, subheading: event.target.value })} maxLength={180} placeholder="A short introduction to your post" /></label>
          <label className="full">Message<textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={3000} placeholder="Share your idea, question, event or feedback." required /></label>
          <button className="button primary" type="submit" disabled={!canSubmit || status.state === 'loading'}>{status.state === 'loading' ? 'Publishing…' : 'Publish to board'}</button>
        </form>
        {status.message ? <p role="status" className={`hub-form-status ${status.state}`}>{status.message}</p> : null}
        <p className="muted">Posts are public. Keep account details and private evidence out of the board. <Link href="/report-player">Report a concern</Link> or read the <Link href="/multiplayer-policy">community rules</Link>.</p>
      </article>
      <section className="content-card hub-board-feed" aria-labelledby="community-feed-title">
        <p className="eyebrow">Community conversations</p>
        <h2 id="community-feed-title">From the community</h2>
        <div className="community-feed-tools">
          <label>Browse category<select value={category} onChange={(event) => setCategory(event.target.value)}>{['All topics', ...HUB_POST_CATEGORIES].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Search posts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search headings and messages" /></label>
          <button type="button" className="button secondary" onClick={refreshPosts}>Refresh posts</button>
        </div>
        <p className="muted" role="status">{feed.loading ? 'Loading posts…' : feed.error ? `${feed.error} Previously loaded posts are kept below. You can retry with Refresh posts.` : `Refreshes every 15 seconds while this tab is visible.${feed.checkedAt ? ` Last checked ${feed.checkedAt.toLocaleTimeString()}.` : ''}`}</p>
        <div className="hub-board-list">
          {visiblePosts.map((post) => <article id={`post-${post.reference}`} key={post.reference} className="hub-board-post" aria-labelledby={`title-${post.reference}`}>
            <div className="hub-board-post-head"><span>{post.category}</span><a href={`#post-${post.reference}`} aria-label={`Link to ${post.topic}`}>Link to post</a></div>
            <h3 id={`title-${post.reference}`}>{post.topic}</h3>
            {post.subheading ? <p className="community-post-subheading">{post.subheading}</p> : null}
            <p className="community-post-message">{post.message}</p>
            <small>{post.author?.displayName || 'Community Pilot'} · {post.author?.provider === 'steam' ? 'Steam' : 'Google'} · <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time></small>
          </article>)}
          {!feed.loading && !visiblePosts.length && !feed.error ? <p className="muted">{posts.length ? 'No posts match your search. Try another category or search term.' : 'No posts yet. Start the first conversation.'}</p> : null}
        </div>
      </section>
    </section>
  );
}
