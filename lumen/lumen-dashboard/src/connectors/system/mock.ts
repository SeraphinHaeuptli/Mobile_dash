/**
 * Shapes and deterministic fallbacks for the `system` connector.
 *
 * The system connector needs no credentials — it reads the host the dashboard
 * runs on — so it is always "live". Individual readings can still be
 * unavailable (no `df` on Windows, no `nvidia-smi` without an NVIDIA card, no
 * `/proc` inside a locked-down container), and every payload therefore carries
 * a `sample` flag so the widget can show a small "sample data" hint instead of
 * an empty box.
 */
import { intBetween, seeded, walk } from '@/lib/mock';

/* ---------- shapes ---------- */

export interface OverviewData {
  hostname: string;
  platform: string;
  distro: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  /** busy % over the interval between this call and the previous one */
  cpuPct: number;
  /** rolling ring buffer of recent cpuPct samples, oldest first */
  cpuHistory: number[];
  memUsed: number;
  memTotal: number;
  memPct: number;
  uptimeSeconds: number;
  loadAvg: [number, number, number];
  /** 1-minute load average divided by core count, 1.0 = fully saturated */
  loadPerCore: number;
  sample: boolean;
}

export interface DiskItem {
  /** mount point, e.g. '/' */
  mount: string;
  /** device / filesystem source, e.g. '/dev/nvme0n1p2' */
  fs: string;
  usedBytes: number;
  /** space actually available to the user — `total - used` also counts blocks reserved for root */
  freeBytes: number;
  totalBytes: number;
  /** the capacity figure `df` prints: used / (used + free) */
  pct: number;
}
export interface DisksData {
  disks: DiskItem[];
  /** how many mounts passed the size filter before `limit` was applied */
  totalCount: number;
  minSizeGb: number;
  sample: boolean;
}

export interface GpuItem {
  name: string;
  utilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  tempC: number | null;
  powerW: number | null;
  fanPct: number | null;
}
export interface GpuData {
  gpus: GpuItem[];
  sample: boolean;
}

export interface ProcItem {
  name: string;
  cpuPct: number;
  memPct: number;
  rssBytes: number;
}
export interface ProcessesData {
  processes: ProcItem[];
  sortBy: 'cpu' | 'memory';
  sample: boolean;
}

/* ---------- helpers ---------- */

const GB = 1024 * 1024 * 1024;

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * A seed that changes every `seconds` seconds, so sample data drifts gently on
 * refresh instead of being frozen, while staying identical for every caller
 * inside the same bucket.
 */
export function bucketSeed(widgetId: string, seconds: number) {
  return `${widgetId}|${Math.floor(Date.now() / (seconds * 1000))}`;
}

/* ---------- mock: overview ---------- */

export function mockOverview(seed: string, historyLength = 40): OverviewData {
  const rnd = seeded(seed);
  const cpuCount = 8;
  const memTotal = 16 * GB;
  const memUsed = Math.round(memTotal * (0.42 + rnd() * 0.16));
  const history = walk(rnd, Math.max(2, historyLength), intBetween(rnd, 12, 34), 0.55, 2, 100).map(round1);
  const cpuPct = history[history.length - 1] ?? 18;
  const load1 = round1((cpuPct / 100) * cpuCount);
  return {
    hostname: 'localhost',
    platform: 'linux',
    distro: 'Linux',
    kernel: '6.8.0',
    arch: 'x64',
    cpuModel: 'Generic 8-core CPU',
    cpuCount,
    cpuPct,
    cpuHistory: history,
    memUsed,
    memTotal,
    memPct: round1((memUsed / memTotal) * 100),
    uptimeSeconds: intBetween(rnd, 3 * 3600, 9 * 86400),
    loadAvg: [load1, round1(load1 * 0.9), round1(load1 * 0.8)],
    loadPerCore: round1(load1 / cpuCount),
    sample: true,
  };
}

/* ---------- mock: disks ---------- */

const MOCK_MOUNTS: readonly { mount: string; fs: string; sizeGb: number; usedFrac: number }[] = [
  { mount: '/', fs: '/dev/nvme0n1p2', sizeGb: 460, usedFrac: 0.63 },
  { mount: '/home', fs: '/dev/nvme0n1p3', sizeGb: 930, usedFrac: 0.88 },
  { mount: '/mnt/data', fs: '/dev/sda1', sizeGb: 1860, usedFrac: 0.41 },
  { mount: '/boot', fs: '/dev/nvme0n1p1', sizeGb: 2, usedFrac: 0.34 },
  { mount: '/boot/efi', fs: '/dev/nvme0n1p1', sizeGb: 0.5, usedFrac: 0.12 },
];

export function mockDisks(minSizeGb: number, limit: number): DisksData {
  const all: DiskItem[] = MOCK_MOUNTS.map((m) => {
    const totalBytes = Math.round(m.sizeGb * GB);
    const usedBytes = Math.round(totalBytes * m.usedFrac);
    // Mirror the ~5% root reserve a real ext4 keeps back.
    const freeBytes = Math.max(0, Math.round(totalBytes * 0.95) - usedBytes);
    const pct = usedBytes + freeBytes > 0 ? round1((usedBytes / (usedBytes + freeBytes)) * 100) : 0;
    return { mount: m.mount, fs: m.fs, usedBytes, freeBytes, totalBytes, pct };
  });
  const eligible = all.filter((d) => d.totalBytes >= minSizeGb * GB);
  return {
    disks: eligible.slice(0, Math.max(1, limit)),
    totalCount: eligible.length,
    minSizeGb,
    sample: true,
  };
}

/* ---------- mock: gpu ---------- */

/**
 * A generic 8 GB discrete card under light-to-moderate load.
 *
 * Deliberately NOT named as a real product. This is only reached when the GPU
 * genuinely cannot be read (no nvidia-smi *and* no DRM sysfs — i.e. Windows or
 * macOS), and naming a specific model there told people they owned hardware
 * they did not. A machine that can be read but has no GPU now returns an empty
 * list and renders "No GPU detected" instead of this.
 */
export function mockGpu(seed: string): GpuData {
  const rnd = seeded(seed);
  const memTotalMb = 8192;
  const utilPct = intBetween(rnd, 12, 74);
  const memUsedMb = intBetween(rnd, 1400, 5600);
  return {
    gpus: [
      {
        name: 'Sample GPU',
        utilPct,
        memUsedMb,
        memTotalMb,
        tempC: intBetween(rnd, 44, 68),
        powerW: round1(70 + (utilPct / 100) * 130 + rnd() * 8),
        fanPct: intBetween(rnd, 30, 58),
      },
    ],
    sample: true,
  };
}

/* ---------- mock: processes ---------- */

const MOCK_PROCS: readonly { name: string; cpu: number; mem: number; rssMb: number }[] = [
  { name: 'node', cpu: 34.2, mem: 6.1, rssMb: 998 },
  { name: 'chrome', cpu: 21.7, mem: 9.4, rssMb: 1540 },
  { name: 'code', cpu: 12.4, mem: 4.8, rssMb: 786 },
  { name: 'Xorg', cpu: 6.9, mem: 1.2, rssMb: 196 },
  { name: 'postgres', cpu: 3.1, mem: 2.6, rssMb: 425 },
  { name: 'systemd', cpu: 1.4, mem: 0.3, rssMb: 49 },
  { name: 'docker', cpu: 0.9, mem: 1.1, rssMb: 180 },
  { name: 'sshd', cpu: 0.2, mem: 0.1, rssMb: 12 },
];

export function mockProcesses(limit: number, sortBy: 'cpu' | 'memory'): ProcessesData {
  const rows: ProcItem[] = MOCK_PROCS.map((p) => ({
    name: p.name,
    cpuPct: p.cpu,
    memPct: p.mem,
    rssBytes: Math.round(p.rssMb * 1024 * 1024),
  }));
  sortProcesses(rows, sortBy);
  return { processes: rows.slice(0, Math.max(1, limit)), sortBy, sample: true };
}

/** Shared so live and mock rows always end up in the same order. */
export function sortProcesses(rows: ProcItem[], sortBy: 'cpu' | 'memory') {
  rows.sort((a, b) => (sortBy === 'memory' ? b.rssBytes - a.rssBytes : b.cpuPct - a.cpuPct));
  return rows;
}
