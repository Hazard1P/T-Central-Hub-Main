'use client';

import { useEffect, useState } from 'react';

export default function PrayerSeedCollection({ provider }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(''); setData(null);
    const timeout = setTimeout(() => { controller.abort(); if (active) setError('The collection took too long to load. Please retry.'); }, 12000);
    fetch('/api/universe/prayer-seeds', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Unable to load your account collection.');
      if (!controller.signal.aborted) setData(result);
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [attempt]);

  return <div className="seed-profile-card">
    <p className="eyebrow">{provider === 'steam' ? 'Steam' : 'Google'} account · Private collection</p>
    {error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => setAttempt((value) => value + 1)}>Retry collection</button></> : !data ? <p role="status">Loading your discoveries…</p> : !data.total ? <><h2>Your journey is unfolding.</h2><p>Your discoveries will appear here as you explore.</p></> : <>
      <h2>In-Prayer-Intelligence</h2><p>{data.total} {data.total === 1 ? 'seed' : 'seeds'} bound to your account’s cyber-intelligence.</p>
      {data.storage === 'development-local' ? <p className="prayer-meta">Development storage: these records are local to this server.</p> : null}
      <dl className="seed-intelligence"><dt>Cyber-intelligence identity</dt><dd>{data.intelligence.id}</dd><dt>Identity epoch (Unix seconds)</dt><dd>{data.intelligence.epoch_unix}</dd><dt>Synaptics sequence</dt><dd>{data.intelligence.sequence.join(' · ')}</dd></dl>
      <ol className="seed-collection">{data.seeds.map((seed) => <li key={seed.id}>
        <blockquote>{seed.body}</blockquote>
        <p><time dateTime={seed.created_at}>{new Date(seed.created_at).toUTCString()}</time><br />Unix epoch <strong>{seed.epoch_unix}</strong> · {seed.flight_signature === 'legacy-cookie' ? 'Recovered seed' : 'Universe discovery'}</p>
        <details><summary>Seed binding</summary><dl><dt>Seed ID</dt><dd>{seed.id}</dd><dt>Flight signature</dt><dd>{seed.flight_signature}</dd><dt>Account binding SHA-256</dt><dd>{seed.binding_hash}</dd></dl></details>
      </li>)}</ol>
      {data.total > data.seeds.length ? <p className="prayer-meta">Showing your latest {data.seeds.length} seeds. All {data.total} remain bound to your account.</p> : null}
    </>}
  </div>;
}
