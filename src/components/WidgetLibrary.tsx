'use client';
import React, { useMemo, useState } from 'react';
import { WIDGETS } from '@/lib/registry.client';
import { CONNECTORS } from '@/lib/connectors';

export default function WidgetLibrary({ onAdd, onClose }: { onAdd: (widgetId: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [connector, setConnector] = useState<string>('all');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return WIDGETS.filter((w) => connector === 'all' || w.def.connectorId === connector)
      .filter((w) => !needle || `${w.def.title} ${w.def.description} ${w.def.id}`.toLowerCase().includes(needle));
  }, [q, connector]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Add a widget</span>
          <span className="spacer" />
          <input
            className="field"
            style={{ margin: 0, padding: '6px 10px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--border)', outline: 'none' }}
            placeholder="Search…"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <button className={`btn${connector === 'all' ? ' active' : ''}`} onClick={() => setConnector('all')}>All</button>
            {CONNECTORS.map((c) => (
              <button key={c.id} className={`btn${connector === c.id ? ' active' : ''}`} onClick={() => setConnector(c.id)}>
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
          <div className="cards">
            {shown.map((w) => {
              const c = CONNECTORS.find((x) => x.id === w.def.connectorId);
              return (
                <button key={w.def.id} className="card" onClick={() => onAdd(w.def.id)}>
                  <div className="card-t">
                    <span className="widget-dot" style={{ background: c?.accent ?? 'var(--accent)' }} />
                    {w.def.title}
                  </div>
                  <div className="card-d">{w.def.description}</div>
                </button>
              );
            })}
            {!shown.length && <div className="faint">Nothing matches “{q}”.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
