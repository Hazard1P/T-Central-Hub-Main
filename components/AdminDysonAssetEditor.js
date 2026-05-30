'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = '/api/admin/dyson-assets';
const VECTOR_AXES = ['x', 'y', 'z'];
const PARAMETER_TYPES = {
  label: 'text',
  address: 'text',
  description: 'textarea',
  color: 'color',
  priority: 'number',
  dysonProfile: 'text',
  networkRole: 'text',
  foundationBuilt: 'checkbox',
  systemOwned: 'checkbox',
  playerInteractive: 'checkbox',
  playerBuildable: 'checkbox',
  requestSurface: 'checkbox',
  routeSurface: 'text',
  encryptionOwned: 'checkbox',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatParameterName(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function normalizeAsset(asset) {
  return {
    ...asset,
    mapAnchor: {
      x: asset?.mapAnchor?.x ?? 0,
      y: asset?.mapAnchor?.y ?? 0,
      z: asset?.mapAnchor?.z ?? 0,
    },
    parameters: asset?.parameters || {},
  };
}

export default function AdminDysonAssetEditor() {
  const [assets, setAssets] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [allowedParameters, setAllowedParameters] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadAssets() {
      setLoading(true);
      setErrors({});
      try {
        const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw payload;
        if (!mounted) return;
        const normalizedAssets = (payload.assets || []).map(normalizeAsset);
        setAssets(normalizedAssets);
        setDefaults((payload.defaults || []).map(normalizeAsset));
        setAllowedParameters(payload.allowedParameters || []);
        const firstKey = normalizedAssets[0]?.key || '';
        setSelectedKey((current) => current || firstKey);
        setDraft(normalizedAssets[0] ? clone(normalizedAssets[0]) : null);
        setStatus(payload.persisted ? 'Loaded persisted Dyson overrides.' : 'Loaded lib/worldLayout.js defaults.');
      } catch (error) {
        if (!mounted) return;
        setStatus('Unable to load Dyson assets.');
        setErrors({ form: error?.error || error?.message || 'LOAD_FAILED' });
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedDefault = useMemo(() => defaults.find((asset) => asset.key === selectedKey), [defaults, selectedKey]);

  function selectAsset(key) {
    const selected = assets.find((asset) => asset.key === key);
    setSelectedKey(key);
    setDraft(selected ? clone(selected) : null);
    setErrors({});
    setConfirmDelete(false);
    setStatus('Editing Dyson asset draft.');
  }

  function updateVector(axis, value) {
    setDraft((current) => ({
      ...current,
      mapAnchor: { ...current.mapAnchor, [axis]: value },
    }));
  }

  function updateParameter(name, value) {
    setDraft((current) => ({
      ...current,
      parameters: { ...current.parameters, [name]: value },
    }));
  }

  function applySavedAsset(asset) {
    const normalized = normalizeAsset(asset);
    setAssets((current) => current.map((item) => (item.key === normalized.key ? normalized : item)));
    setDraft(clone(normalized));
    setSelectedKey(normalized.key);
  }

  async function submitPatch(body, successMessage) {
    setSaving(true);
    setErrors({});
    try {
      const response = await fetch(API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setErrors(payload.errors || { form: payload.error || 'SAVE_FAILED' });
        setStatus('Review the inline validation errors before saving again.');
        return;
      }
      applySavedAsset(payload.asset);
      setConfirmDelete(false);
      setStatus(successMessage);
    } catch (error) {
      setErrors({ form: error?.message || 'SAVE_FAILED' });
      setStatus('Unable to save Dyson asset changes.');
    } finally {
      setSaving(false);
    }
  }

  function saveDraft() {
    if (!draft) return;
    submitPatch({ asset: draft }, 'Dyson asset changes saved.');
  }

  function resetToDefaults() {
    if (!selectedDefault) return;
    setDraft(clone(selectedDefault));
    submitPatch({ key: selectedDefault.key, resetToDefaults: true }, 'Reset values to lib/worldLayout.js defaults while keeping the database record.');
  }

  function deleteOverride() {
    if (!draft) return;
    submitPatch({ key: draft.key, deleteOverride: true, confirmDeleteRecord: confirmDelete }, 'Database override deleted; lib/worldLayout.js defaults are active.');
  }

  const preview = draft ? {
    label: draft.parameters.label || draft.key,
    anchor: VECTOR_AXES.map((axis) => Number(draft.mapAnchor[axis] || 0).toFixed(2)).join(', '),
    profile: draft.parameters.dysonProfile || 'unprofiled',
    networkRole: draft.parameters.networkRole || 'none',
    routeSurface: draft.parameters.routeSurface || 'open',
    playerBuildable: draft.parameters.playerBuildable ? 'buildable' : 'sealed',
  } : null;

  return (
    <main className="admin-dyson-editor">
      <section className="admin-dyson-editor__hero">
        <p className="eyebrow">Admin Dyson assets</p>
        <h1>Dyson map-anchor editor</h1>
        <p>Edit world-map anchor vectors and approved Dyson parameters, preview the effective record, then save through the admin API.</p>
      </section>

      {loading ? <p className="admin-dyson-editor__notice">Loading Dyson assets…</p> : null}
      {errors.form ? <p className="admin-dyson-editor__error">{errors.form}</p> : null}
      {status ? <p className="admin-dyson-editor__notice">{status}</p> : null}

      <section className="admin-dyson-editor__grid">
        <aside className="admin-dyson-editor__panel">
          <h2>Editable assets</h2>
          <div className="admin-dyson-editor__asset-list">
            {assets.map((asset) => (
              <button key={asset.key} type="button" className={asset.key === selectedKey ? 'is-active' : ''} onClick={() => selectAsset(asset.key)}>
                <strong>{asset.parameters.label || asset.key}</strong>
                <span>{asset.key}</span>
              </button>
            ))}
          </div>
        </aside>

        {draft ? (
          <form className="admin-dyson-editor__panel admin-dyson-editor__form" onSubmit={(event) => { event.preventDefault(); saveDraft(); }}>
            <div className="admin-dyson-editor__section-head">
              <div>
                <p className="eyebrow">Map anchor vector</p>
                <h2>{draft.key}</h2>
              </div>
              <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>

            <div className="admin-dyson-editor__vector-grid">
              {VECTOR_AXES.map((axis) => (
                <label key={axis}>
                  <span>{axis.toUpperCase()} coordinate</span>
                  <input type="number" step="0.01" value={draft.mapAnchor[axis]} onChange={(event) => updateVector(axis, event.target.value)} />
                  {errors[`mapAnchor.${axis}`] ? <small>{errors[`mapAnchor.${axis}`]}</small> : null}
                </label>
              ))}
            </div>

            <div className="admin-dyson-editor__parameters">
              <p className="eyebrow">Allowed Dyson parameters</p>
              {allowedParameters.map((name) => {
                const type = PARAMETER_TYPES[name] || 'text';
                const value = draft.parameters[name];
                return (
                  <label key={name} className={type === 'checkbox' ? 'admin-dyson-editor__checkbox' : ''}>
                    <span>{formatParameterName(name)}</span>
                    {type === 'textarea' ? (
                      <textarea value={value || ''} onChange={(event) => updateParameter(name, event.target.value)} rows={4} />
                    ) : type === 'checkbox' ? (
                      <input type="checkbox" checked={Boolean(value)} onChange={(event) => updateParameter(name, event.target.checked)} />
                    ) : (
                      <input type={type} step={type === 'number' ? '1' : undefined} value={value ?? ''} onChange={(event) => updateParameter(name, type === 'number' ? Number(event.target.value) : event.target.value)} />
                    )}
                    {errors[`parameters.${name}`] ? <small>{errors[`parameters.${name}`]}</small> : null}
                  </label>
                );
              })}
            </div>
          </form>
        ) : null}

        {preview ? (
          <aside className="admin-dyson-editor__panel admin-dyson-editor__preview">
            <p className="eyebrow">Live preview summary</p>
            <h2>{preview.label}</h2>
            <dl>
              <div><dt>Anchor</dt><dd>{preview.anchor}</dd></div>
              <div><dt>Profile</dt><dd>{preview.profile}</dd></div>
              <div><dt>Network role</dt><dd>{preview.networkRole}</dd></div>
              <div><dt>Route surface</dt><dd>{preview.routeSurface}</dd></div>
              <div><dt>Player state</dt><dd>{preview.playerBuildable}</dd></div>
            </dl>
            <div className="admin-dyson-editor__reset">
              <button type="button" onClick={resetToDefaults} disabled={saving || !selectedDefault}>Reset to defaults</button>
              <p>Restores values from <code>lib/worldLayout.js</code> and saves those defaults without deleting the database record.</p>
              <label>
                <input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />
                Explicitly confirm database record deletion
              </label>
              <button type="button" className="admin-dyson-editor__danger" onClick={deleteOverride} disabled={saving || !confirmDelete}>Delete override record</button>
              {errors.deleteOverride ? <small>{errors.deleteOverride}</small> : null}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
