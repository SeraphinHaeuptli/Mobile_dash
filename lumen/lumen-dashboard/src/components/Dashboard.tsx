'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Layout } from 'react-grid-layout';
import type { DashboardConfig, DashboardItem, WidgetSettings } from '@/lib/types';
import { defaultSettings, widgetById } from '@/lib/registry.client';
import WidgetShell from './WidgetShell';
import WidgetLibrary from './WidgetLibrary';
import WidgetSettingsModal from './WidgetSettings';
import DashboardSettings from './DashboardSettings';

/** react-grid-layout measures the DOM, so it must not render on the server. */
const Grid = dynamic(() => import('./Grid'), {
  ssr: false,
  loading: () => <div className="faint" style={{ padding: 24 }}>Loading layout…</div>,
});

export default function Dashboard({ initial }: { initial: DashboardConfig }) {
  const [config, setConfig] = useState<DashboardConfig>(initial);
  const [editing, setEditing] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* apply theme + accent to the document */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme);
    document.documentElement.style.setProperty('--accent', config.accent);
  }, [config.theme, config.accent]);

  /* debounced persistence to data/layout.json */
  const persist = useCallback((next: DashboardConfig) => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/layout', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      })
        .then(() => setSaved(true))
        .catch(() => setSaved(false));
    }, 500);
  }, []);

  const update = useCallback((next: DashboardConfig) => {
    setConfig(next);
    persist(next);
  }, [persist]);

  const layout: Layout[] = useMemo(
    () => config.items.map((it) => {
      const min = widgetById(it.widgetId)?.def.minSize;
      return { i: it.i, x: it.x, y: it.y, w: it.w, h: it.h, minW: min?.w ?? 2, minH: min?.h ?? 2 };
    }),
    [config.items],
  );

  const onLayoutChange = useCallback((l: Layout[]) => {
    setConfig((prev) => {
      let changed = false;
      const items = prev.items.map((it) => {
        const pos = l.find((p) => p.i === it.i);
        if (!pos) return it;
        if (pos.x === it.x && pos.y === it.y && pos.w === it.w && pos.h === it.h) return it;
        changed = true;
        return { ...it, x: pos.x, y: pos.y, w: pos.w, h: pos.h };
      });
      if (!changed) return prev;
      const next = { ...prev, items };
      persist(next);
      return next;
    });
  }, [persist]);

  const addWidget = (widgetId: string) => {
    const def = widgetById(widgetId)?.def;
    if (!def) return;
    const maxY = config.items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
    const item: DashboardItem = {
      i: `w${Date.now().toString(36)}`,
      widgetId,
      x: 0,
      y: maxY,
      w: Math.min(def.defaultSize.w, config.columns),
      h: def.defaultSize.h,
      settings: defaultSettings(widgetId),
    };
    update({ ...config, items: [...config.items, item] });
    setLibraryOpen(false);
    setEditing(true);
  };

  const removeWidget = (i: string) => update({ ...config, items: config.items.filter((it) => it.i !== i) });

  const saveWidgetSettings = (i: string, settings: WidgetSettings, title?: string) => {
    update({ ...config, items: config.items.map((it) => (it.i === i ? { ...it, settings, title } : it)) });
    setConfiguring(null);
  };

  const resetLayout = async () => {
    const res = await fetch('/api/layout', { method: 'DELETE' });
    setConfig((await res.json()) as DashboardConfig);
    setSettingsOpen(false);
    setSaved(true);
  };

  const configuringItem = config.items.find((it) => it.i === configuring) ?? null;

  return (
    <>
      <header className="topbar">
        <span className="brand"><span className="brand-dot" /> Lumen</span>
        <span className="faint" style={{ fontSize: 12 }}>{config.items.length} widgets · {saved ? 'saved' : 'saving…'}</span>
        <span className="spacer" />
        <button className={`btn${editing ? ' active' : ''}`} onClick={() => setEditing((e) => !e)}>
          {editing ? '✓ Done' : '✥ Arrange'}
        </button>
        <button className="btn" onClick={() => setLibraryOpen(true)}>+ Widget</button>
        <button className="btn icon" title="Dashboard settings" onClick={() => setSettingsOpen(true)}>⚙</button>
      </header>

      <main className="page">
        {config.items.length === 0 ? (
          <div className="center-msg" style={{ minHeight: '55vh' }}>
            <div style={{ fontSize: 15, color: 'var(--text)' }}>Empty dashboard</div>
            <div>Add your first widget to get started.</div>
            <button className="btn primary" onClick={() => setLibraryOpen(true)}>+ Add widget</button>
          </div>
        ) : (
          <Grid layout={layout} cols={config.columns} editing={editing} onLayoutChange={onLayoutChange}>
            {config.items.map((it) => (
              <div key={it.i}>
                <WidgetShell item={it} editing={editing} onRemove={removeWidget} onConfigure={setConfiguring} />
              </div>
            ))}
          </Grid>
        )}
      </main>

      {libraryOpen && <WidgetLibrary onAdd={addWidget} onClose={() => setLibraryOpen(false)} />}
      {configuringItem && (
        <WidgetSettingsModal item={configuringItem} onSave={saveWidgetSettings} onClose={() => setConfiguring(null)} />
      )}
      {settingsOpen && (
        <DashboardSettings
          config={config}
          onChange={(patch) => update({ ...config, ...patch })}
          onReset={() => void resetLayout()}
          onImport={(c) => { update({ ...c, version: 1 }); setSettingsOpen(false); }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
