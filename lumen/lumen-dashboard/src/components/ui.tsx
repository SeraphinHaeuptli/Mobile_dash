'use client';
import React from 'react';

/** Shared primitives every widget should build from, so all widgets look like one system. */

export function Stat({ value, label, sub, tone }: { value: React.ReactNode; label?: string; sub?: React.ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const color = tone ? `var(--${tone})` : undefined;
  return (
    <div>
      {label && <div className="stat-label">{label}</div>}
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid2">{children}</div>;
}

export function Rows({ children }: { children: React.ReactNode }) {
  return <div className="rows">{children}</div>;
}

export function Row({ icon, title, sub, right }: { icon?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="row">
      {icon != null && <span style={{ flex: 'none', fontSize: 14, width: 18, textAlign: 'center' }}>{icon}</span>}
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub != null && <div className="row-sub">{sub}</div>}
      </div>
      {right != null && <div className="row-right">{right}</div>}
    </div>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'bad' | 'warn' | 'accent' }) {
  return <span className={`pill${tone ? ' ' + tone : ''}`}>{children}</span>;
}

export function Bar({ pct, tone }: { pct: number; tone?: 'good' | 'bad' | 'warn' }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="bar">
      <span style={{ width: `${p}%`, background: tone ? `var(--${tone})` : undefined }} />
    </div>
  );
}

export function Sparkline({ points, height = 34, tone }: { points: number[]; height?: number; tone?: 'good' | 'bad' | 'warn' }) {
  if (!points.length) return null;
  const w = 100;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((v, i) => `${(i / Math.max(1, points.length - 1)) * w},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' L ');
  const stroke = tone ? `var(--${tone})` : 'var(--accent)';
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <polyline points={`0,${height} ${d.replace(/ L /g, ' ')} ${w},${height}`} fill={stroke} opacity={0.12} stroke="none" />
      <path d={`M ${d}`} fill="none" stroke={stroke} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="center-msg">{children}</div>;
}

/* ---------- formatters ---------- */
export function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}
export function compact(n: number) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
export function bytes(n: number) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
export function relTime(iso: string | number | Date) {
  const t = new Date(iso).getTime();
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3]];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, ms] of units) if (abs >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
  return '';
}
export function clockTime(iso: string | number | Date) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
