'use client';
import { useEffect, useState } from 'react';
import type { WidgetModule, WidgetMode, WidgetProps } from '@/lib/types';
import { Stat, Rows, Row, Pill, Empty, clockTime } from '@/components/ui';

/* ---------- shapes returned by ./server.ts ---------- */

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
}
interface AgendaData {
  calendarId: string;
  days: number;
  events: CalEvent[];
}
interface NextEventData {
  calendarId: string;
  event: CalEvent | null;
}

function SampleHint({ mode }: { mode: WidgetMode }) {
  if (mode === 'live') return <></>;
  return (
    <div className="faint" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 10 }}>
      Sample data
    </div>
  );
}

/** Today / Tomorrow / "Thursday, 27 Aug", in the viewer's locale. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const diff = Math.round((start.getTime() - base.getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function timeRange(e: CalEvent): string {
  return `${clockTime(e.start)}–${clockTime(e.end)}`;
}

/* ---------- gcal.agenda ---------- */

function Agenda({ data, mode }: WidgetProps<AgendaData>) {
  const events = data?.events ?? [];
  if (events.length === 0) {
    return <Empty>Nothing scheduled in the next {data?.days ?? 3} days</Empty>;
  }

  const groups: { key: string; label: string; events: CalEvent[] }[] = [];
  for (const e of events) {
    const key = dayKey(e.start);
    const last = groups.length > 0 ? groups[groups.length - 1] : null;
    if (last && last.key === key) last.events.push(e);
    else groups.push({ key, label: dayLabel(e.start), events: [e] });
  }

  return (
    <div>
      {groups.map((g, gi) => (
        <div key={g.key}>
          <div className="stat-label" style={{ marginTop: gi === 0 ? 0 : 12, marginBottom: 2 }}>{g.label}</div>
          <Rows>
            {g.events.map((e) => (
              <Row
                key={e.id}
                title={e.title}
                sub={e.location ?? undefined}
                right={e.allDay ? <Pill tone="accent">All day</Pill> : timeRange(e)}
              />
            ))}
          </Rows>
        </div>
      ))}
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- gcal.next ---------- */

function untilLabel(ms: number): string {
  if (ms <= 0) return 'now';
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${Math.max(1, mins)}m`;
}

function NextEvent({ data, mode }: WidgetProps<NextEventData>) {
  const event = data?.event ?? null;
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  if (!event) return <Empty>Nothing coming up</Empty>;

  const ms = new Date(event.start).getTime() - now;
  const tone = ms <= 0 ? 'bad' : ms < 30 * 60000 ? 'warn' : 'good';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      <Stat label="Starts in" value={untilLabel(ms)} tone={tone} />
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, marginTop: 2 }}>{event.title}</div>
      <div className="muted" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>{dayLabel(event.start)}</span>
        <span className="faint">·</span>
        {event.allDay ? <Pill tone="accent">All day</Pill> : <span>{timeRange(event)}</span>}
      </div>
      {event.location && (
        <div className="faint" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.location}
        </div>
      )}
      <div style={{ marginTop: 'auto' }}>
        <SampleHint mode={mode} />
      </div>
    </div>
  );
}

/* ---------- definitions ---------- */

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'gcal.agenda',
      connectorId: 'gcal',
      title: 'Agenda',
      description: 'Upcoming events grouped by day, with times and locations.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 300,
      settings: [
        { key: 'calendarId', label: 'Calendar id', type: 'text', default: 'primary', placeholder: 'primary', help: 'Calendar id or address; "primary" is your default calendar.' },
        { key: 'days', label: 'Days ahead', type: 'number', default: 3, placeholder: '3', help: '1–30 days.' },
        { key: 'limit', label: 'Max events', type: 'number', default: 10, placeholder: '10', help: '1–50 events.' },
      ],
    },
    Component: Agenda as WidgetModule['Component'],
  },
  {
    def: {
      id: 'gcal.next',
      connectorId: 'gcal',
      title: 'Next event',
      description: 'Countdown to the next thing on your calendar.',
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 3, h: 3 },
      refreshSeconds: 60,
      settings: [
        { key: 'calendarId', label: 'Calendar id', type: 'text', default: 'primary', placeholder: 'primary', help: 'Calendar id or address; "primary" is your default calendar.' },
      ],
    },
    Component: NextEvent as WidgetModule['Component'],
  },
];

export default widgets;
