'use client';
import React from 'react';
import { widgetById } from '@/lib/registry.client';
import { useWidgetData } from '@/lib/useWidgetData';
import { connectorById } from '@/lib/connectors';
import type { DashboardItem } from '@/lib/types';
import { Empty } from './ui';

interface Props {
  item: DashboardItem;
  editing: boolean;
  onRemove: (i: string) => void;
  onConfigure: (i: string) => void;
}

export default function WidgetShell({ item, editing, onRemove, onConfigure }: Props) {
  const mod = widgetById(item.widgetId);
  const { res, loading, reload } = useWidgetData(item.widgetId, item.settings, mod?.def.refreshSeconds);
  const connector = connectorById(item.widgetId.split('.')[0]);

  if (!mod) {
    return (
      <div className="widget">
        <div className="widget-head drag-handle"><span className="widget-title">Unknown widget</span></div>
        <div className="widget-body"><Empty>No widget registered for “{item.widgetId}”.</Empty></div>
      </div>
    );
  }

  const { Component, def } = mod;
  const title = item.title || def.title;

  return (
    <div className="widget">
      <div className={`widget-head${editing ? ' drag-handle' : ''}`}>
        <span className="widget-dot" style={{ background: connector?.accent ?? 'var(--accent)' }} />
        <span className="widget-title" title={def.description}>{title}</span>
        {res?.mode === 'mock' && <span className="pill" style={{ fontSize: 10 }}>sample</span>}
        {res?.mode === 'stale' && (
          <span className="pill warn" style={{ fontSize: 10 }} title={res.warning ?? 'Live data unavailable, showing sample'}>
            stale
          </span>
        )}
        <span className="spacer" />
        <span className="widget-actions">
          <button className="btn icon" title="Refresh" onClick={() => void reload()} disabled={loading}>↻</button>
          {def.settings?.length ? (
            <button className="btn icon" title="Widget settings" onClick={() => onConfigure(item.i)}>⚙</button>
          ) : null}
          {editing && <button className="btn icon danger" title="Remove" onClick={() => onRemove(item.i)}>✕</button>}
        </span>
      </div>
      <div className="widget-body">
        {loading && !res ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="skeleton" style={{ height: 22, width: '55%' }} />
            <div className="skeleton" style={{ height: 12, width: '80%' }} />
            <div className="skeleton" style={{ height: 12, width: '65%' }} />
          </div>
        ) : res?.ok ? (
          <ErrorBoundary widgetId={item.widgetId}>
            <Component data={res.data as never} settings={item.settings} mode={res.mode} />
          </ErrorBoundary>
        ) : (
          <Empty>
            <div>Could not load data</div>
            <div className="faint" style={{ fontSize: 11 }}>{res?.error ?? 'unknown error'}</div>
            <button className="btn" onClick={() => void reload()}>Retry</button>
          </Empty>
        )}
      </div>
    </div>
  );
}

/** One bad widget must never take down the dashboard. */
class ErrorBoundary extends React.Component<{ widgetId: string; children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <Empty>
          <div>Widget crashed</div>
          <div className="faint" style={{ fontSize: 11 }}>{this.state.err.message}</div>
        </Empty>
      );
    }
    return this.props.children;
  }
}
