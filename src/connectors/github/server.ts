import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { hasEnv } from '@/lib/env';
import {
  mockActivity,
  mockContributions,
  mockRepos,
  sortRepos,
  summarise,
  toDateKey,
} from './mock';
import type { ActivityData, ActivityEvent, ActivityKind, ContribDay, ContribData, RepoItem, ReposData } from './mock';

const ENV = ['GITHUB_TOKEN'];
const API = 'https://api.github.com';

/* ---------- settings ---------- */

function text(s: WidgetSettings, key: string, fallback: string) {
  const v = s[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback;
}
function count(s: WidgetSettings, key: string, fallback: number, min: number, max: number) {
  const v = s[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
function seedFor(widgetId: string, s: WidgetSettings) {
  const parts = Object.keys(s)
    .sort()
    .map((k) => `${k}=${String(s[k])}`)
    .join('&');
  return `${widgetId}|${parts}|${toDateKey(new Date())}`;
}

/* ---------- json narrowing ---------- */

function rec(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/* ---------- transport ---------- */

async function gh(path: string, init?: { method?: string; body?: string }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API}${path}`, {
      method: init?.method ?? 'GET',
      body: init?.body,
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'lumen-dashboard',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- live: activity ---------- */

function mapEvent(raw: unknown, index: number): ActivityEvent | null {
  const e = rec(raw);
  const type = str(e.type);
  const payload = rec(e.payload);
  const repo = str(rec(e.repo).name, 'unknown/unknown');
  const short = repo.split('/')[1] ?? repo;
  const at = str(e.created_at, new Date().toISOString());
  const id = str(e.id, `e${index}`);

  if (type === 'PushEvent') {
    const commits = Math.max(num(payload.size, list(payload.commits).length), 1);
    const branch = str(payload.ref).replace('refs/heads/', '') || 'main';
    return { id, kind: 'push', repo, title: `${commits} commit${commits === 1 ? '' : 's'}`, detail: `Pushed to ${branch}`, at };
  }
  if (type === 'PullRequestEvent') {
    const pr = rec(payload.pull_request);
    const merged = pr.merged === true;
    const action = str(payload.action);
    if (action !== 'opened' && action !== 'closed' && action !== 'reopened') return null;
    const kind: ActivityKind = merged ? 'pr-merged' : 'pr-opened';
    const number = num(payload.number, num(pr.number));
    return { id, kind, repo, title: str(pr.title, 'Pull request'), detail: `#${number} ${merged ? 'merged' : action}`, at };
  }
  if (type === 'IssuesEvent') {
    const issue = rec(payload.issue);
    const action = str(payload.action, 'opened');
    if (action !== 'opened' && action !== 'closed' && action !== 'reopened') return null;
    return { id, kind: 'issue', repo, title: str(issue.title, 'Issue'), detail: `#${num(issue.number)} ${action}`, at };
  }
  if (type === 'WatchEvent') return { id, kind: 'star', repo, title: `Starred ${short}`, detail: 'stars', at };
  if (type === 'ForkEvent') return { id, kind: 'fork', repo, title: `Forked ${short}`, detail: 'forks', at };
  if (type === 'ReleaseEvent') {
    const rel = rec(payload.release);
    return { id, kind: 'release', repo, title: str(rel.tag_name, 'Release'), detail: 'release published', at };
  }
  return null;
}

async function liveActivity(username: string, limit: number): Promise<ActivityData> {
  const raw = await gh(`/users/${encodeURIComponent(username)}/events?per_page=${Math.min(100, limit * 3)}`);
  const events: ActivityEvent[] = [];
  list(raw).forEach((r, i) => {
    const mapped = mapEvent(r, i);
    if (mapped) events.push(mapped);
  });
  return { username, events: events.slice(0, limit) };
}

/* ---------- live: repos ---------- */

async function liveRepos(username: string, sort: string, limit: number): Promise<ReposData> {
  const raw = await gh(`/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`);
  const repos: RepoItem[] = list(raw).map((r) => {
    const o = rec(r);
    return {
      name: str(o.name, 'repo'),
      description: str(o.description),
      language: typeof o.language === 'string' ? o.language : null,
      stars: num(o.stargazers_count),
      forks: num(o.forks_count),
      pushedAt: str(o.pushed_at, str(o.updated_at, new Date().toISOString())),
    };
  });
  sortRepos(repos, sort);
  return { username, sort, repos: repos.slice(0, Math.max(1, limit)) };
}

/* ---------- live: contributions ---------- */

const CONTRIB_QUERY = `query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from,to:$to){
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

async function liveContributions(username: string): Promise<ContribData> {
  const to = new Date();
  const from = new Date(to.getTime() - 83 * 864e5);
  const raw = await gh('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query: CONTRIB_QUERY, variables: { login: username, from: from.toISOString(), to: to.toISOString() } }),
  });
  const body = rec(raw);
  if (list(body.errors).length) throw new Error('GitHub GraphQL error');
  const calendar = rec(rec(rec(rec(rec(body.data).user).contributionsCollection).contributionCalendar));
  const weeks: ContribDay[][] = list(calendar.weeks)
    .map((w) =>
      list(rec(w).contributionDays).map((d) => ({
        date: str(rec(d).date),
        count: num(rec(d).contributionCount),
      })),
    )
    .filter((w) => w.length > 0);
  if (!weeks.length) throw new Error('GitHub returned no contribution data');
  return summarise(username, weeks.slice(-12));
}

/* ---------- connector ---------- */

async function safe<T>(live: () => Promise<T>, fallback: () => T): Promise<T> {
  if (!hasEnv(ENV)) return fallback();
  try {
    return await live();
  } catch {
    return fallback();
  }
}

const connector: ConnectorServer = {
  meta: {
    id: 'github',
    name: 'GitHub',
    description: 'Recent activity, repositories and contribution streaks.',
    icon: '⌥',
    accent: '#8b5cf6',
    envKeys: ENV,
    docsUrl: 'https://docs.github.com/en/rest',
  },
  isLive: () => hasEnv(ENV),
  handlers: {
    'github.activity': async (s) => {
      const username = text(s, 'username', 'octocat');
      const limit = count(s, 'limit', 8, 1, 30);
      return safe<ActivityData>(
        () => liveActivity(username, limit),
        () => mockActivity(seedFor('github.activity', s), username, limit),
      );
    },
    'github.repos': async (s) => {
      const username = text(s, 'username', 'octocat');
      const sort = text(s, 'sort', 'updated');
      const limit = count(s, 'limit', 6, 1, 30);
      return safe<ReposData>(
        () => liveRepos(username, sort, limit),
        () => mockRepos(seedFor('github.repos', s), username, sort, limit),
      );
    },
    'github.contributions': async (s) => {
      const username = text(s, 'username', 'octocat');
      return safe<ContribData>(
        () => liveContributions(username),
        () => mockContributions(seedFor('github.contributions', s), username),
      );
    },
  },
};

export default connector;
