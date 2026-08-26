'use client';
import React, { useEffect, useState } from 'react';
import type { DashboardConfig } from '@/lib/types';

const THEMES = ['dark', 'light', 'nord', 'paper'];
const ACCENTS = ['#6ea8fe', '#a78bfa', '#4ade80', '#fbbf24', '#f472b6', '#38bdf8', '#f97316', '#e5e7eb'];

interface ConnectorStatus {
  id: string; name: string; icon: string; accent: string;
  envKeys: string[]; docsUrl: string | null; live: boolean; missing: string[]; widgets: string[];
}

interface Props {
  config: DashboardConfig;
  onChange: (patch: Partial<DashboardConfig>) => void;
  onReset: () => void;
  onImport: (config: DashboardConfig) => void;
  onClose: () => void;
}

export default function DashboardSettings({ config, onChange, onReset, onImport, onClose }: Props) {
  const [status, setStatus] = useState<ConnectorStatus[] | null>(null);
  const [importErr, setImportErr] = useState('');

  useEffect(() => {
    fetch('/api/connectors', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { connectors: ConnectorStatus[] }) => setStatus(j.connectors))
      .catch(() => setStatus([]));
  }, []);

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dashboard.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importConfig = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as DashboardConfig;
      if (!Array.isArray(parsed.items)) throw new Error('missing items[]');
      onImport(parsed);
      setImportErr('');
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : 'invalid file');
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Dashboard settings</span>
          <span className="spacer" />
          <button className="btn icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="sectionlabel" style={{ marginTop: 0 }}>Theme</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {THEMES.map((t) => (
              <button key={t} className={`btn${config.theme === t ? ' active' : ''}`} onClick={() => onChange({ theme: t })}>{t}</button>
            ))}
          </div>

          <div className="sectionlabel">Accent</div>
          <div className="swatches">
            {ACCENTS.map((a) => (
              <button
                key={a}
                aria-label={a}
                className={`swatch${config.accent === a ? ' on' : ''}`}
                style={{ background: a }}
                onClick={() => onChange({ accent: a })}
              />
            ))}
          </div>

          <div className="sectionlabel">Grid</div>
          <div className="field">
            <label>Columns: {config.columns}</label>
            <input
              type="range" min={6} max={16} value={config.columns}
              onChange={(e) => onChange({ columns: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>

          <div className="sectionlabel">Connectors</div>
          {status === null ? (
            <div className="skeleton" style={{ height: 60 }} />
          ) : (
            <div className="rows">
              {status.map((c) => (
                <div className="row" key={c.id}>
                  <span className="widget-dot" style={{ background: c.accent }} />
                  <div className="row-main">
                    <div className="row-title">{c.icon} {c.name}</div>
                    <div className="row-sub">
                      {c.live
                        ? `${c.widgets.length} widget${c.widgets.length === 1 ? '' : 's'} · live`
                        : `set ${c.missing.join(', ')} in .env.local for live data`}
                    </div>
                  </div>
                  <div className="row-right">
                    <span className={`pill ${c.live ? 'good' : ''}`}>{c.live ? 'live' : 'sample'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="sectionlabel">Layout file</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" onClick={exportConfig}>Export JSON</button>
            <label className="btn" style={{ cursor: 'pointer' }}>
              Import JSON
              <input
                type="file" accept="application/json" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void importConfig(f); }}
              />
            </label>
            <button className="btn danger" onClick={onReset}>Reset to default</button>
          </div>
          {importErr && <div className="help" style={{ color: 'var(--bad)' }}>Import failed: {importErr}</div>}
          <div className="help" style={{ marginTop: 8 }}>Saved to <code>data/layout.json</code> in the project folder.</div>
        </div>
      </div>
    </div>
  );
}
