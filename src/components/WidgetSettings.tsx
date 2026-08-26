'use client';
import React, { useState } from 'react';
import { widgetById } from '@/lib/registry.client';
import type { DashboardItem, WidgetSettings as S } from '@/lib/types';

interface Props {
  item: DashboardItem;
  onSave: (i: string, settings: S, title?: string) => void;
  onClose: () => void;
}

export default function WidgetSettingsModal({ item, onSave, onClose }: Props) {
  const def = widgetById(item.widgetId)?.def;
  const [values, setValues] = useState<S>({ ...item.settings });
  const [title, setTitle] = useState(item.title ?? '');
  if (!def) return null;

  const set = (k: string, v: string | number | boolean) => setValues((p) => ({ ...p, [k]: v }));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 'min(460px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{def.title}</span>
          <span className="spacer" />
          <button className="btn icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Widget title</label>
            <input type="text" value={title} placeholder={def.title} onChange={(e) => setTitle(e.target.value)} />
            <div className="help">Leave empty to use the default name.</div>
          </div>

          {(def.settings ?? []).map((f) => {
            const v = values[f.key] ?? f.default ?? '';
            return (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                {f.type === 'boolean' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                    <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} />
                    <span className="faint" style={{ fontSize: 12 }}>{Boolean(v) ? 'on' : 'off'}</span>
                  </label>
                ) : f.type === 'select' ? (
                  <select value={String(v)} onChange={(e) => set(f.key, e.target.value)}>
                    {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'number' ? (
                  <input type="number" value={String(v)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
                ) : (
                  <input type="text" value={String(v)} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
                )}
                {f.help && <div className="help">{f.help}</div>}
              </div>
            );
          })}
          {!def.settings?.length && <div className="faint" style={{ fontSize: 12 }}>This widget has no options.</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={() => onSave(item.i, values, title.trim() || undefined)}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
