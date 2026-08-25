import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { withFallback } from '@/lib/fallback';
import {
  bucketSeed,
  clamp,
  mockDisks,
  mockGpu,
  mockOverview,
  mockProcesses,
  round1,
  sortProcesses,
} from './mock';
import type { DiskItem, DisksData, GpuData, GpuItem, OverviewData, ProcItem, ProcessesData } from './mock';

/**
 * Reads the machine the dashboard runs on. No credentials, no network — just
 * `node:os`, `/proc` and three well-known command line tools. Everything is
 * written for Linux first and degrades to a deterministic sample on macOS,
 * Windows or inside a container that hides the underlying host.
 */
const ENV: string[] = [];

/** Ring buffer length for the CPU sparkline. */
const HISTORY_MAX = 40;

/* ---------- settings ---------- */

function count(s: WidgetSettings, key: string, fallback: number, min: number, max: number) {
  const v = s[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? clamp(Math.round(n), min, max) : fallback;
}
function decimal(s: WidgetSettings, key: string, fallback: number, min: number, max: number) {
  const v = s[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}
function flag(s: WidgetSettings, key: string, fallback: boolean) {
  const v = s[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return fallback;
}
function choice<T extends string>(s: WidgetSettings, key: string, options: readonly T[], fallback: T): T {
  const v = s[key];
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

/* ---------- process helpers ---------- */

/** Promise wrapper around execFile; no shell, bounded time and output. */
function run(cmd: string, args: string[], timeoutMs = 4000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve(typeof stdout === 'string' ? stdout : String(stdout));
    });
  });
}

function lines(out: string) {
  return out.split('\n').map((l) => l.trim()).filter((l) => l !== '');
}

/* ---------- CPU sampling (module state, survives between requests) ---------- */

interface CpuTicks {
  idle: number;
  total: number;
}

let prevTicks: CpuTicks | null = null;
let lastCpuPct = 0;
const cpuHistory: number[] = [];

function readTicks(): CpuTicks | null {
  const cpus = os.cpus();
  if (!cpus.length) return null;
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return total > 0 ? { idle, total } : null;
}

/**
 * Busy % from the delta against the previous sample. The very first call has no
 * previous sample, so it reports the since-boot average rather than an invented
 * number; every later call is a real interval measurement.
 */
function sampleCpuPct(): number | null {
  const now = readTicks();
  if (!now) return null;
  const prev = prevTicks;
  let pct: number;
  if (prev && now.total - prev.total > 40) {
    const dTotal = now.total - prev.total;
    const dIdle = Math.max(0, now.idle - prev.idle);
    pct = ((dTotal - dIdle) / dTotal) * 100;
    prevTicks = now;
  } else if (prev) {
    // Two calls landed in the same instant (two widgets, one tick): the delta is
    // noise, so repeat the last real reading and keep the old baseline.
    pct = lastCpuPct;
  } else {
    pct = ((now.total - now.idle) / now.total) * 100;
    prevTicks = now;
  }
  lastCpuPct = round1(clamp(pct, 0, 100));
  return lastCpuPct;
}

function pushHistory(pct: number): number[] {
  cpuHistory.push(pct);
  while (cpuHistory.length > HISTORY_MAX) cpuHistory.shift();
  return cpuHistory.slice();
}

/* ---------- overview ---------- */

function meminfoKb(text: string, key: string): number {
  const m = new RegExp(`^${key}:\\s+(\\d+)\\s*kB`, 'm').exec(text);
  return m ? Number(m[1]) : NaN;
}

async function readMemory(): Promise<{ used: number; total: number } | null> {
  try {
    const text = await readFile('/proc/meminfo', 'utf8');
    const total = meminfoKb(text, 'MemTotal');
    const avail = meminfoKb(text, 'MemAvailable');
    if (Number.isFinite(total) && Number.isFinite(avail) && total > 0 && avail >= 0 && avail <= total) {
      return { used: (total - avail) * 1024, total: total * 1024 };
    }
  } catch {
    /* not Linux, or /proc is hidden — fall through to node:os */
  }
  const total = os.totalmem();
  const free = os.freemem();
  if (total > 0) return { used: clamp(total - free, 0, total), total };
  return null;
}

async function readDistro(): Promise<string | null> {
  try {
    const text = await readFile('/etc/os-release', 'utf8');
    const m = /^PRETTY_NAME="?(.*?)"?$/m.exec(text);
    if (m && m[1]) return m[1];
  } catch {
    /* not a systemd-ish Linux */
  }
  return null;
}

async function readOverview(): Promise<OverviewData> {
  const fallback = mockOverview(bucketSeed('system.overview', 5), HISTORY_MAX);
  let sample = false;

  const cpus = os.cpus();
  const live = sampleCpuPct();
  const cpuPct = live == null ? fallback.cpuPct : live;
  if (live == null) sample = true;
  const history = pushHistory(cpuPct);

  const mem = await readMemory();
  if (!mem) sample = true;
  const memUsed = mem ? mem.used : fallback.memUsed;
  const memTotal = mem ? mem.total : fallback.memTotal;

  const raw = os.loadavg();
  const hasLoad = raw.length === 3 && raw.some((n) => Number.isFinite(n) && n > 0);
  const loadAvg: [number, number, number] = hasLoad
    ? [round1(raw[0]), round1(raw[1]), round1(raw[2])]
    : fallback.loadAvg;

  const cpuCount = cpus.length || fallback.cpuCount;
  const uptimeSeconds = Math.round(os.uptime());
  const distro = await readDistro();

  return {
    hostname: os.hostname() || fallback.hostname,
    platform: os.platform(),
    distro: distro ?? (os.type() || fallback.distro),
    kernel: os.release() || fallback.kernel,
    arch: os.arch(),
    cpuModel: cpus.length && cpus[0].model ? cpus[0].model.replace(/\s+/g, ' ').trim() : fallback.cpuModel,
    cpuCount,
    cpuPct,
    cpuHistory: history,
    memUsed,
    memTotal,
    memPct: memTotal > 0 ? round1((memUsed / memTotal) * 100) : 0,
    uptimeSeconds: uptimeSeconds > 0 ? uptimeSeconds : fallback.uptimeSeconds,
    loadAvg,
    loadPerCore: round1(loadAvg[0] / Math.max(1, cpuCount)),
    sample,
  };
}

/* ---------- disks ---------- */

/** Pseudo/virtual mounts that are never interesting on a dashboard. */
const SKIP_MOUNT = ['/proc', '/sys', '/dev', '/run', '/snap', '/var/lib/docker/', '/var/lib/kubelet/'];
const SKIP_FS = ['tmpfs', 'devtmpfs', 'udev', 'none', 'devfs', 'map'];

function isPseudo(fs: string, mount: string) {
  if (SKIP_FS.includes(fs)) return true;
  return SKIP_MOUNT.some((p) => mount === p || mount.startsWith(p.endsWith('/') ? p : `${p}/`));
}

/**
 * `df -kP` is POSIX-portable: exactly six columns, never wrapped, sizes in
 * 1024-byte blocks. Device and mount point may both contain spaces, so anchor
 * the four numeric columns instead of splitting on whitespace.
 */
function parseDf(out: string): DiskItem[] {
  const rows: DiskItem[] = [];
  const seen = new Set<string>();
  for (const line of lines(out)) {
    if (/^Filesystem\b/i.test(line)) continue;
    const m = /^(.+?)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)%\s+(.+)$/.exec(line);
    if (!m) continue;
    const fs = m[1];
    const totalBlocks = Number(m[2]);
    const usedBlocks = Number(m[3]);
    const freeBlocks = Number(m[4]);
    const capacity = Number(m[5]);
    const mount = m[6];
    if (!Number.isFinite(totalBlocks) || totalBlocks <= 0) continue;
    if (isPseudo(fs, mount)) continue;
    if (seen.has(mount)) continue;
    seen.add(mount);
    const totalBytes = totalBlocks * 1024;
    const usedBytes = clamp(usedBlocks * 1024, 0, totalBytes);
    const freeBytes = Number.isFinite(freeBlocks) ? Math.max(0, freeBlocks * 1024) : Math.max(0, totalBytes - usedBytes);
    // Prefer df's own capacity column: `total - used` also counts blocks reserved
    // for root, so used/total can read far lower than what `df -h` shows.
    const pct = Number.isFinite(capacity)
      ? clamp(capacity, 0, 100)
      : round1((usedBytes / Math.max(1, usedBytes + freeBytes)) * 100);
    rows.push({ mount, fs, usedBytes, freeBytes, totalBytes, pct });
  }
  return rows;
}

async function readDisks(minSizeGb: number, limit: number): Promise<DisksData> {
  const out = await run('df', ['-kP']);
  const parsed = parseDf(out);
  if (!parsed.length) throw new Error('df returned no usable filesystems');
  const eligible = parsed.filter((d) => d.totalBytes >= minSizeGb * 1024 * 1024 * 1024);
  // Root first, then biggest volumes — the order people scan for.
  eligible.sort((a, b) => {
    if (a.mount === '/') return -1;
    if (b.mount === '/') return 1;
    return b.totalBytes - a.totalBytes;
  });
  return { disks: eligible.slice(0, limit), totalCount: eligible.length, minSizeGb, sample: false };
}

/* ---------- gpu ---------- */

const GPU_FIELDS = 'name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,fan.speed';

function gpuNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim();
  if (v === '' || /n\/a|not supported|unknown/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNvidiaSmi(out: string): GpuItem[] {
  const gpus: GpuItem[] = [];
  for (const line of lines(out)) {
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length < 4) continue;
    const name = cells[0];
    const memTotalMb = gpuNumber(cells[3]);
    if (!name || memTotalMb == null || memTotalMb <= 0) continue;
    gpus.push({
      name,
      utilPct: clamp(gpuNumber(cells[1]) ?? 0, 0, 100),
      memUsedMb: clamp(gpuNumber(cells[2]) ?? 0, 0, memTotalMb),
      memTotalMb,
      tempC: gpuNumber(cells[4]),
      powerW: gpuNumber(cells[5]),
      fanPct: gpuNumber(cells[6]),
    });
  }
  return gpus;
}

async function readGpu(): Promise<GpuData> {
  const out = await run('nvidia-smi', [`--query-gpu=${GPU_FIELDS}`, '--format=csv,noheader,nounits']);
  const gpus = parseNvidiaSmi(out);
  if (!gpus.length) throw new Error('nvidia-smi reported no GPUs');
  return { gpus, sample: false };
}

/* ---------- processes ---------- */

function parsePs(out: string): ProcItem[] {
  const rows: ProcItem[] = [];
  for (const line of lines(out)) {
    if (/^COMMAND\b/i.test(line)) continue;
    const m = /^(.*?)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/.exec(line);
    if (!m) continue;
    const name = m[1].trim();
    if (!name) continue;
    rows.push({
      name,
      cpuPct: round1(Number(m[2])),
      memPct: round1(Number(m[3])),
      rssBytes: Number(m[4]) * 1024,
    });
  }
  return rows;
}

async function readProcesses(limit: number, sortBy: 'cpu' | 'memory'): Promise<ProcessesData> {
  const fields = ['-eo', 'comm,pcpu,pmem,rss'];
  const sortFlag = sortBy === 'memory' ? '--sort=-pmem' : '--sort=-pcpu';
  let out: string;
  try {
    out = await run('ps', [...fields, sortFlag]);
  } catch {
    // BSD ps (macOS) has no --sort; the JS sort below covers it either way.
    out = await run('ps', fields);
  }
  const rows = parsePs(out);
  if (!rows.length) throw new Error('ps returned no processes');
  sortProcesses(rows, sortBy);
  return { processes: rows.slice(0, limit), sortBy, sample: false };
}

/* ---------- connector ---------- */

const connector: ConnectorServer = {
  meta: {
    id: 'system',
    name: 'System',
    description: 'Reads the host machine this dashboard runs on: CPU, memory, disks, GPU and top processes.',
    icon: '🖥',
    accent: '#22c55e',
    envKeys: ENV,
    docsUrl: 'https://nodejs.org/api/os.html',
  },
  // No credentials to configure — the host is always readable, at worst partially.
  isLive: () => true,
  handlers: {
    'system.overview': () =>
      withFallback(true, readOverview, () => mockOverview(bucketSeed('system.overview', 5), HISTORY_MAX), 'system.overview'),

    'system.disks': (s) => {
      const minSizeGb = decimal(s, 'minSizeGb', 1, 0, 4096);
      const limit = count(s, 'limit', 6, 1, 30);
      return withFallback(true, () => readDisks(minSizeGb, limit), () => mockDisks(minSizeGb, limit), 'system.disks');
    },

    'system.gpu': () => withFallback(true, readGpu, () => mockGpu(bucketSeed('system.gpu', 15)), 'system.gpu'),

    'system.processes': (s) => {
      const limit = count(s, 'limit', 6, 1, 30);
      const sortBy = choice(s, 'sortBy', ['cpu', 'memory'] as const, 'cpu');
      return withFallback(true, () => readProcesses(limit, sortBy), () => mockProcesses(limit, sortBy), 'system.processes');
    },
  },
};

export default connector;
