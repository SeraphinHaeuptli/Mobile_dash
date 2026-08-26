import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { ConnectorServer, WidgetSettings } from '@/lib/types';
import { fromSample } from '@/lib/fallback';
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

/** Always return a payload: any failure in the live read falls back to the sample. */
async function safe<T>(live: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await live();
  } catch {
    return fallback();
  }
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
/** Exported for unit tests (PLAN.md Phase 6). */
export function parseDf(out: string): DiskItem[] {
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

/** Exported for unit tests (PLAN.md Phase 6). */
export function parseNvidiaSmi(out: string): GpuItem[] {
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

/* ---------- gpu: AMD / integrated, via DRM sysfs ----------
 *
 * Not every machine has an NVIDIA card, and `nvidia-smi` simply does not exist
 * on the ones that do not. Before this, that threw and the widget fell back to
 * a sample that names a specific NVIDIA card — i.e. an AMD laptop was shown
 * hardware it does not have. On Linux the kernel exposes the real thing under
 * /sys/class/drm/cardN/device/, so read that instead.
 *
 * Knobs used (amdgpu; all optional, absent on many APUs), relative to
 * /sys/class/drm/cardN/device/ and its hwmon/hwmonN subdirectory:
 *   gpu_busy_percent          utilisation, 0-100
 *   mem_info_vram_used        bytes
 *   mem_info_vram_total       bytes
 *   hwmon temp1_input         millidegrees C
 *   hwmon power1_average      microwatts (power1_input on some parts)
 *   hwmon pwm1 + pwm1_max     fan duty, 0-255 (laptops often have neither)
 */

const DRM_ROOT = '/sys/class/drm';

/** PCI vendor ids seen on the DRM bus. */
const PCI_VENDORS: Record<string, string> = {
  '0x1002': 'AMD',
  '0x1022': 'AMD',
  '0x8086': 'Intel',
  '0x10de': 'NVIDIA',
};

/** Raw sysfs file contents for one card. Every field is optional. */
export interface DrmCardFiles {
  vendor?: string;
  busy?: string;
  vramUsed?: string;
  vramTotal?: string;
  temp?: string;
  power?: string;
  pwm?: string;
  pwmMax?: string;
  /** DRIVER=... line from the device uevent, e.g. 'amdgpu' */
  driver?: string;
}

function sysfsNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const v = raw.trim();
  // Number('') is 0, not NaN — an empty or whitespace-only sysfs file would
  // otherwise be reported as a real reading of zero (0 W, 0 °C).
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * One card's sysfs contents -> a GpuItem, or null when the card exposes nothing
 * worth showing (no utilisation and no VRAM figure — e.g. a display-only
 * device, or a driver that publishes neither).
 * Exported for unit tests.
 */
export function parseDrmCard(files: DrmCardFiles): GpuItem | null {
  const vendorId = files.vendor?.trim().toLowerCase();
  const vendor = vendorId ? PCI_VENDORS[vendorId] : undefined;
  const driver = files.driver?.trim();

  const busy = sysfsNumber(files.busy);
  const vramTotalBytes = sysfsNumber(files.vramTotal);
  const vramUsedBytes = sysfsNumber(files.vramUsed);

  // Nothing measurable -> not a GPU worth a card in the UI.
  if (busy == null && (vramTotalBytes == null || vramTotalBytes <= 0)) return null;

  const memTotalMb = vramTotalBytes != null && vramTotalBytes > 0 ? Math.round(vramTotalBytes / 1024 / 1024) : 0;
  const memUsedMb =
    vramUsedBytes != null && vramUsedBytes >= 0 ? clamp(Math.round(vramUsedBytes / 1024 / 1024), 0, memTotalMb || Infinity) : 0;

  const tempMilli = sysfsNumber(files.temp);
  const powerMicro = sysfsNumber(files.power);
  const pwm = sysfsNumber(files.pwm);
  const pwmMax = sysfsNumber(files.pwmMax);

  // hwmon reports millidegrees and microwatts; a driver that cannot measure
  // omits the file entirely, which must stay null rather than becoming 0.
  const tempC = tempMilli == null ? null : round1(tempMilli / 1000);
  const powerW = powerMicro == null ? null : round1(powerMicro / 1e6);
  const fanPct = pwm == null || pwmMax == null || pwmMax <= 0 ? null : clamp(round1((pwm / pwmMax) * 100), 0, 100);

  // No product-name file exists in sysfs, so build the most honest label the
  // kernel actually gives us instead of inventing a model number.
  const name = vendor
    ? `${vendor} ${vendor === 'AMD' ? 'Radeon' : 'Graphics'}${driver ? ` (${driver})` : ''}`
    : driver
      ? `GPU (${driver})`
      : 'GPU';

  return {
    name,
    utilPct: clamp(busy ?? 0, 0, 100),
    memUsedMb,
    memTotalMb,
    tempC,
    powerW,
    fanPct,
  };
}

async function readMaybe(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return undefined;
  }
}

/** First hwmon directory under a card's device dir, if the driver exposes one. */
async function hwmonDir(deviceDir: string): Promise<string | null> {
  try {
    const base = path.join(deviceDir, 'hwmon');
    const entries = await readdir(base);
    return entries.length ? path.join(base, entries[0]) : null;
  } catch {
    return null;
  }
}

async function readDrmCard(cardDir: string): Promise<GpuItem | null> {
  const device = path.join(cardDir, 'device');
  const hwmon = await hwmonDir(device);
  const [vendor, busy, vramUsed, vramTotal, uevent] = await Promise.all([
    readMaybe(path.join(device, 'vendor')),
    readMaybe(path.join(device, 'gpu_busy_percent')),
    readMaybe(path.join(device, 'mem_info_vram_used')),
    readMaybe(path.join(device, 'mem_info_vram_total')),
    readMaybe(path.join(device, 'uevent')),
  ]);
  const [temp, powerAvg, powerInput, pwm, pwmMax] = hwmon
    ? await Promise.all([
        readMaybe(path.join(hwmon, 'temp1_input')),
        readMaybe(path.join(hwmon, 'power1_average')),
        readMaybe(path.join(hwmon, 'power1_input')),
        readMaybe(path.join(hwmon, 'pwm1')),
        readMaybe(path.join(hwmon, 'pwm1_max')),
      ])
    : [undefined, undefined, undefined, undefined, undefined];

  const driver = /^DRIVER=(.+)$/m.exec(uevent ?? '')?.[1];
  return parseDrmCard({ vendor, busy, vramUsed, vramTotal, temp, power: powerAvg ?? powerInput, pwm, pwmMax, driver });
}

/**
 * Enumerate real GPUs from DRM sysfs. Returns null when sysfs itself is not
 * readable (Windows, macOS, a locked-down container) — that is "cannot tell",
 * which must not be reported as "no GPU".
 *
 * `root` is a parameter so tests can point it at a fake tree and exercise the
 * directory walking and file reads, not just the pure parser. Production always
 * uses DRM_ROOT.
 */
export async function readDrmGpus(root: string = DRM_ROOT): Promise<GpuItem[] | null> {
  let entries: string[];
  try {
    entries = await readdir(root);
  } catch {
    return null;
  }
  // card0, card1 … but not the card0-DP-1 connector nodes.
  const cards = entries.filter((e) => /^card\d+$/.test(e)).sort();
  const found: GpuItem[] = [];
  for (const card of cards) {
    const item = await readDrmCard(path.join(root, card));
    if (item) found.push(item);
  }
  return found;
}

async function readGpu(): Promise<GpuData> {
  // 1. NVIDIA, if the tool is there at all.
  try {
    const out = await run('nvidia-smi', [`--query-gpu=${GPU_FIELDS}`, '--format=csv,noheader,nounits']);
    const gpus = parseNvidiaSmi(out);
    if (gpus.length) return { gpus, sample: false };
  } catch {
    /* no nvidia-smi, or it failed — try the kernel next */
  }

  // 2. Whatever the kernel actually reports (AMD, Intel, or an NVIDIA card
  //    whose userspace tool is not installed).
  const drm = await readDrmGpus();

  // 3. sysfs unreadable => we genuinely cannot tell. Let the caller fall back
  //    to the sample rather than asserting this machine has no GPU.
  if (drm == null) throw new Error('no nvidia-smi and no readable DRM sysfs on this platform');

  // An empty list here is a real finding, not a failure: the widget says
  // "No GPU detected" instead of inventing one.
  return { gpus: drm, sample: false };
}

/* ---------- processes ---------- */

/** Exported for unit tests (PLAN.md Phase 6). */
export function parsePs(out: string): ProcItem[] {
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
    'system.overview': async () =>
      fromSample(
        await safe<OverviewData>(readOverview, () => mockOverview(bucketSeed('system.overview', 5), HISTORY_MAX)),
        'system.overview',
      ),

    'system.disks': async (s) => {
      const minSizeGb = decimal(s, 'minSizeGb', 1, 0, 4096);
      const limit = count(s, 'limit', 6, 1, 30);
      const data = await safe<DisksData>(
        () => readDisks(minSizeGb, limit),
        () => mockDisks(minSizeGb, limit),
      );
      return fromSample(data, 'system.disks');
    },

    'system.gpu': async () => fromSample(await safe<GpuData>(readGpu, () => mockGpu(bucketSeed('system.gpu', 15))), 'system.gpu'),

    'system.processes': async (s) => {
      const limit = count(s, 'limit', 6, 1, 30);
      const sortBy = choice(s, 'sortBy', ['cpu', 'memory'] as const, 'cpu');
      const data = await safe<ProcessesData>(
        () => readProcesses(limit, sortBy),
        () => mockProcesses(limit, sortBy),
      );
      return fromSample(data, 'system.processes');
    },
  },
};

export default connector;
