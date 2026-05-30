'use client';

import { useEffect, useState } from 'react';

function summarizeRing(ring) {
  if (!ring) return 'No ring data';
  const spin = typeof ring.spin === 'number' ? `${Math.round(ring.spin * 100)}% spin` : 'spin n/a';
  return spin;
}

export default function AdminDysonAssetEditor() {
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/dyson-assets', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'ADMIN_DYSON_ASSETS_UNAVAILABLE');
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setAssets(Array.isArray(payload?.assets) ? payload.assets : []);
        setStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setAssets([]);
        setStatus(error.message || 'ADMIN_DYSON_ASSETS_UNAVAILABLE');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="admin-dyson-asset-editor" aria-live="polite">
      <div>
        <p className="eyebrow">Admin Dyson assets</p>
        <h3>Protected asset editor feed</h3>
        <p className="muted">
          Editable Dyson metadata is loaded only from the protected admin route and is not mixed into the public map payload.
        </p>
      </div>

      {status !== 'ready' ? (
        <p className="muted">{status === 'loading' ? 'Loading protected Dyson assets…' : status}</p>
      ) : (
        <div className="admin-dyson-asset-list">
          {assets.map((asset) => (
            <article key={asset.sphere_key} className="admin-dyson-asset-card">
              <header>
                <strong>{asset.label}</strong>
                <span>{asset.database_row_id || asset.source_key}</span>
              </header>
              <p>{asset.description}</p>
              <dl>
                <div>
                  <dt>Ring 1</dt>
                  <dd>{summarizeRing(asset.ring_factors?.ring1)}</dd>
                </div>
                <div>
                  <dt>Ring 2</dt>
                  <dd>{summarizeRing(asset.ring_factors?.ring2)}</dd>
                </div>
                <div>
                  <dt>Ring 3</dt>
                  <dd>{summarizeRing(asset.ring_factors?.ring3)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{asset.updated_at || 'Not persisted'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
