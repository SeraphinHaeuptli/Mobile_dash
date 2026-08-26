/** Deterministic sample data for the GitHub connector. */
import { seeded, pick, intBetween, minutesFromNow } from '@/lib/mock';

export type ActivityKind = 'push' | 'pr-opened' | 'pr-merged' | 'issue' | 'star' | 'fork' | 'release';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** 'owner/name' */
  repo: string;
  title: string;
  detail: string;
  at: string;
}
export interface ActivityData {
  username: string;
  events: ActivityEvent[];
}

export interface RepoItem {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  pushedAt: string;
}
export interface ReposData {
  username: string;
  sort: string;
  repos: RepoItem[];
}

export interface ContribDay {
  date: string;
  count: number;
}
export interface ContribData {
  username: string;
  total: number;
  streak: number;
  max: number;
  /** oldest week first; each week is Sunday-first and the last one may be partial */
  weeks: ContribDay[][];
}

interface Seed {
  name: string;
  description: string;
  language: string | null;
}

const REPOS: readonly Seed[] = [
  { name: 'matura-arbeit-cnn', description: 'Maturaarbeit: a CNN that grades my own film scans', language: 'Python' },
  { name: 'homelab', description: 'Ansible + compose for the 3070 box under the desk', language: 'Shell' },
  { name: 'photo-cull', description: 'RAW culling TUI — rate 800 frames without Lightroom', language: 'Rust' },
  { name: 'aarau-bus-board', description: 'E-ink departure board for the stop outside', language: 'TypeScript' },
  { name: 'eth-vorkurs-notes', description: 'Analysis I and linear algebra notes, in LaTeX', language: 'TeX' },
  { name: 'dotfiles', description: 'Neovim, zsh, tmux — one bootstrap script', language: 'Lua' },
  { name: 'sd-bench', description: 'Diffusion throughput benchmarks on a single 3070', language: 'Python' },
  { name: 'raw-pipeline', description: 'Batch RAW to web JPEG with watermark presets', language: 'Go' },
  { name: 'gpu-fanctl', description: 'Fan curve daemon so the homelab stays quiet at night', language: 'C' },
];

const COMMIT_TITLES: readonly string[] = [
  'Pushed to main',
  'Pushed to feat/exif-parser',
  'Pushed to fix/cuda-oom',
  'Pushed to main',
  'Pushed to refactor/loader',
];

const PR_TITLES: readonly string[] = [
  'Cache decoded thumbnails between sessions',
  'Half precision inference on the 3070',
  'Swap the SBB timetable poller for the GTFS feed',
  'Split the training notebook into modules',
  'Add a contact-sheet export preset',
];

const ISSUE_TITLES: readonly string[] = [
  'Fan curve resets after suspend',
  'Sony ARW files rotate the wrong way',
  'Validation loss plateaus after epoch 12',
  'E-ink refresh ghosts at night',
  'Watermark is off-centre on portrait crops',
];

const STARRED: readonly string[] = ['ggml-org/llama.cpp', 'astral-sh/uv', 'darktable-org/darktable', 'tailscale/tailscale', 'sharkdp/fd'];

export function mockActivity(seed: string, username: string, limit: number): ActivityData {
  const rnd = seeded(seed);
  const kinds: readonly ActivityKind[] = ['push', 'push', 'push', 'pr-opened', 'pr-merged', 'issue', 'star', 'fork', 'release'];
  const events: ActivityEvent[] = [];
  let minutes = -intBetween(rnd, 8, 40);
  for (let i = 0; i < limit; i++) {
    const kind = pick(rnd, kinds);
    const repo = pick(rnd, REPOS);
    const full = `${username}/${repo.name}`;
    let title = '';
    let detail = '';
    let where = full;
    if (kind === 'push') {
      const commits = intBetween(rnd, 1, 9);
      title = `${commits} commit${commits === 1 ? '' : 's'}`;
      detail = pick(rnd, COMMIT_TITLES);
    } else if (kind === 'pr-opened' || kind === 'pr-merged') {
      title = pick(rnd, PR_TITLES);
      detail = `#${intBetween(rnd, 3, 88)} ${kind === 'pr-merged' ? 'merged' : 'opened'}`;
    } else if (kind === 'issue') {
      title = pick(rnd, ISSUE_TITLES);
      detail = `#${intBetween(rnd, 2, 61)} opened`;
    } else if (kind === 'star') {
      where = pick(rnd, STARRED);
      title = `Starred ${where.split('/')[1]}`;
      detail = 'stars';
    } else if (kind === 'fork') {
      where = pick(rnd, STARRED);
      title = `Forked ${where.split('/')[1]}`;
      detail = 'forks';
    } else {
      title = `v0.${intBetween(rnd, 1, 9)}.${intBetween(rnd, 0, 6)}`;
      detail = 'release published';
    }
    events.push({ id: `m${i}`, kind, repo: where, title, detail, at: minutesFromNow(minutes) });
    minutes -= intBetween(rnd, 45, 900);
  }
  return { username, events };
}

export function mockRepos(seed: string, username: string, sort: string, limit: number): ReposData {
  const rnd = seeded(seed);
  const repos: RepoItem[] = REPOS.map((r, i) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    stars: intBetween(rnd, 0, 240 - i * 18),
    forks: intBetween(rnd, 0, 12),
    pushedAt: minutesFromNow(-intBetween(rnd, 30, 60 * 24 * 40)),
  }));
  sortRepos(repos, sort);
  return { username, sort, repos: repos.slice(0, Math.max(1, limit)) };
}

export function sortRepos(repos: RepoItem[], sort: string) {
  if (sort === 'stars') repos.sort((a, b) => b.stars - a.stars);
  else if (sort === 'name') repos.sort((a, b) => a.name.localeCompare(b.name));
  else repos.sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime());
}

/** 12 Sunday-first weeks ending today. */
export function mockContributions(seed: string, username: string): ContribData {
  const rnd = seeded(seed);
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  cursor.setDate(cursor.getDate() - cursor.getDay() - 77);

  const weeks: ContribDay[][] = [];
  for (let w = 0; w < 12; w++) {
    const week: ContribDay[] = [];
    for (let d = 0; d < 7; d++) {
      if (cursor.getTime() <= end.getTime()) {
        const weekend = d === 0 || d === 6;
        const idle = rnd() < (weekend ? 0.1 : 0.24);
        const count = idle ? 0 : intBetween(rnd, 1, weekend ? 14 : 8);
        week.push({ date: toDateKey(cursor), count });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.length) weeks.push(week);
  }
  return summarise(username, weeks);
}

export function summarise(username: string, weeks: ContribDay[][]): ContribData {
  const flat = weeks.flat();
  const total = flat.reduce((s, d) => s + d.count, 0);
  const max = flat.reduce((m, d) => Math.max(m, d.count), 0);
  let streak = 0;
  for (let i = flat.length - 1; i >= 0; i--) {
    const day = flat[i];
    if (day.count > 0) streak++;
    else if (i !== flat.length - 1) break;
  }
  return { username, total, streak, max: Math.max(max, 1), weeks };
}

export function toDateKey(d: Date) {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
