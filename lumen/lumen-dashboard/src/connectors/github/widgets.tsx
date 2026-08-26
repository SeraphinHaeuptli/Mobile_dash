'use client';
import type { WidgetMode, WidgetModule, WidgetProps } from '@/lib/types';
import { Empty, Row, Rows, Stat, StatGrid, compact, relTime } from '@/components/ui';

/* ---------- shapes returned by server.ts ---------- */

type ActivityKind = 'push' | 'pr-opened' | 'pr-merged' | 'issue' | 'star' | 'fork' | 'release';

interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  repo: string;
  title: string;
  detail: string;
  at: string;
}
interface ActivityData {
  username: string;
  events: ActivityEvent[];
}

interface RepoItem {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
}
interface ReposData {
  username: string;
  sort: string;
  repos: RepoItem[];
}

interface ContribDay {
  date: string;
  count: number;
}
interface ContribData {
  username: string;
  total: number;
  streak: number;
  max: number;
  weeks: ContribDay[][];
}

/* ---------- helpers ---------- */

const GLYPH: Record<ActivityKind, string> = {
  push: '↑',
  'pr-opened': '⇄',
  'pr-merged': '✓',
  issue: '◉',
  star: '★',
  fork: '⑂',
  release: '⚑',
};

function SampleHint({ mode }: { mode: WidgetMode }) {
  if (mode === 'live') return null;
  return <div className="faint" style={{ fontSize: 11, marginTop: 8, textAlign: 'right' }}>sample data</div>;
}

/** Stable hue per language so the dot reads as an identity, not a fixed palette. */
function langHue(language: string) {
  let h = 0;
  for (let i = 0; i < language.length; i++) h = (h * 31 + language.charCodeAt(i)) % 360;
  return h;
}

function LangDot({ language }: { language: string | null }) {
  if (!language) return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--border)' }} />;
  return (
    <span
      title={language}
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: `hsl(${langHue(language)} 62% 55%)` }}
    />
  );
}

/* ---------- github.activity ---------- */

function Activity({ data, mode }: WidgetProps<ActivityData>) {
  const events = data && Array.isArray(data.events) ? data.events : [];
  if (!events.length) return <Empty>No recent public activity for @{data?.username ?? 'this user'}.</Empty>;
  return (
    <div>
      <Rows>
        {events.map((e) => (
          <Row
            key={e.id}
            icon={<span style={{ color: 'var(--text-dim)' }}>{GLYPH[e.kind] ?? '•'}</span>}
            title={e.title}
            sub={`${e.repo}${e.detail ? ` · ${e.detail}` : ''}`}
            right={<span className="faint">{relTime(e.at)}</span>}
          />
        ))}
      </Rows>
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- github.repos ---------- */

function Repos({ data, mode }: WidgetProps<ReposData>) {
  const repos = data && Array.isArray(data.repos) ? data.repos : [];
  if (!repos.length) return <Empty>No repositories to show.</Empty>;
  return (
    <div>
      <Rows>
        {repos.map((r) => (
          <Row
            key={r.name}
            icon={<LangDot language={r.language} />}
            title={r.name}
            sub={r.description || r.language || 'No description'}
            right={
              <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
                <div>★ {compact(r.stars)}</div>
                <div className="faint" style={{ fontSize: 11 }}>{relTime(r.pushedAt)}</div>
              </div>
            }
          />
        ))}
      </Rows>
      <SampleHint mode={mode} />
    </div>
  );
}

/* ---------- github.contributions ---------- */

const LEVEL_OPACITY = [0.14, 0.32, 0.55, 0.78, 1];

function level(count: number, max: number) {
  if (count <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / Math.max(1, max)) * 4)));
}

function Contributions({ data, mode }: WidgetProps<ContribData>) {
  const weeks = data && Array.isArray(data.weeks) ? data.weeks : [];
  if (!weeks.length) return <Empty>No contribution data available.</Empty>;

  const columns = weeks.map((week) => {
    const column: (ContribDay | null)[] = [null, null, null, null, null, null, null];
    week.forEach((day) => {
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      column[Number.isNaN(weekday) ? 0 : weekday] = day;
    });
    return column;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <StatGrid>
        <Stat label="Contributions" value={compact(data.total)} sub={`last ${weeks.length} weeks`} />
        <Stat label="Current streak" value={`${data.streak}d`} sub={data.streak > 0 ? 'still going' : 'take a day off'} />
      </StatGrid>

      <div style={{ display: 'flex', gap: 3, minHeight: 0 }}>
        {columns.map((column, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            {column.map((day, di) => (
              <div
                key={di}
                title={day ? `${day.count} on ${day.date}` : undefined}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 2,
                  background: day && day.count > 0 ? 'var(--accent)' : 'var(--panel-2)',
                  opacity: day ? (day.count > 0 ? LEVEL_OPACITY[level(day.count, data.max)] : 1) : 0,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }} className="faint">
        <span>Less</span>
        {LEVEL_OPACITY.map((o, i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? 'var(--panel-2)' : 'var(--accent)', opacity: i === 0 ? 1 : o }} />
        ))}
        <span>More</span>
        <span style={{ flex: 1 }} />
        {mode !== 'live' ? <span>sample data</span> : <span>@{data.username}</span>}
      </div>
    </div>
  );
}

/* ---------- module ---------- */

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'github.activity',
      connectorId: 'github',
      title: 'GitHub activity',
      description: 'Recent pushes, pull requests, issues and stars for a user.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 300,
      settings: [
        { key: 'username', label: 'Username', type: 'text', default: 'octocat', placeholder: 'octocat' },
        { key: 'limit', label: 'Events', type: 'number', default: 8, help: 'How many events to list.' },
      ],
    },
    Component: Activity as WidgetModule['Component'],
  },
  {
    def: {
      id: 'github.repos',
      connectorId: 'github',
      title: 'GitHub repositories',
      description: 'Repositories with language, stars and last push.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 900,
      settings: [
        { key: 'username', label: 'Username', type: 'text', default: 'octocat', placeholder: 'octocat' },
        {
          key: 'sort',
          label: 'Sort by',
          type: 'select',
          default: 'updated',
          options: [
            { label: 'Recently pushed', value: 'updated' },
            { label: 'Stars', value: 'stars' },
            { label: 'Name', value: 'name' },
          ],
        },
        { key: 'limit', label: 'Repositories', type: 'number', default: 6 },
      ],
    },
    Component: Repos as WidgetModule['Component'],
  },
  {
    def: {
      id: 'github.contributions',
      connectorId: 'github',
      title: 'Contributions',
      description: 'Twelve-week contribution heatmap with total and current streak.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 3600,
      settings: [{ key: 'username', label: 'Username', type: 'text', default: 'octocat', placeholder: 'octocat' }],
    },
    Component: Contributions as WidgetModule['Component'],
  },
];

export default widgets;
