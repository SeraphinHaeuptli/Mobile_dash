import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseDf, parseNvidiaSmi, parsePs } from './server';

/**
 * Fixtures are local files, so this suite needs no network and no GPU.
 * See __fixtures__/README.md for which are captured and which are hand-written
 * — nvidia-smi.txt is NOT real GPU output and does not discharge PLAN.md
 * Phase 1 step 3.
 */
const fixture = (name: string) => readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8');

/* ---------- df ---------- */

describe('parseDf — captured output', () => {
  const disks = parseDf(fixture('df-kP.txt'));

  it('finds the root filesystem', () => {
    const root = disks.find((d) => d.mount === '/');
    expect(root).toBeDefined();
    expect(root!.fs).toBe('/dev/vda');
  });

  it('converts 1024-byte blocks to bytes', () => {
    const root = disks.find((d) => d.mount === '/')!;
    expect(root.totalBytes).toBe(264212084 * 1024);
    expect(root.usedBytes).toBe(8250276 * 1024);
    expect(root.freeBytes).toBe(30598248 * 1024);
  });

  it("uses df's own capacity column rather than recomputing used/total", () => {
    // total - used would read ~3%; df says 22% because of root-reserved blocks.
    const root = disks.find((d) => d.mount === '/')!;
    expect(root.pct).toBe(22);
  });

  it('filters out tmpfs and other pseudo filesystems', () => {
    expect(disks.some((d) => d.fs === 'tmpfs')).toBe(false);
    expect(disks.some((d) => d.mount === '/dev/shm')).toBe(false);
    expect(disks.some((d) => d.mount.startsWith('/sys/'))).toBe(false);
  });
});

describe('parseDf — edge cases', () => {
  const disks = parseDf(fixture('df-edge.txt'));
  const byMount = (m: string) => disks.find((d) => d.mount === m);

  it('handles spaces in the mount point', () => {
    expect(byMount('/mnt/my data')).toBeDefined();
    expect(byMount('/mnt/my data')!.totalBytes).toBe(1953514584 * 1024);
  });

  it('handles spaces in the device name', () => {
    const net = byMount('/net/shared drive');
    expect(net).toBeDefined();
    expect(net!.fs).toBe('my server:/vol');
  });

  it('de-duplicates a mount listed twice', () => {
    expect(disks.filter((d) => d.mount === '/')).toHaveLength(1);
  });

  it('clamps a negative Available column to zero instead of emitting a negative size', () => {
    const boot = byMount('/boot')!;
    expect(boot.freeBytes).toBe(0);
    expect(boot.pct).toBe(99);
  });

  it('skips docker overlay and snap mounts', () => {
    expect(disks.some((d) => d.mount.startsWith('/var/lib/docker/'))).toBe(false);
    expect(disks.some((d) => d.mount.startsWith('/snap'))).toBe(false);
  });

  it('skips devtmpfs and udev', () => {
    expect(disks.some((d) => d.fs === 'devtmpfs' || d.fs === 'udev')).toBe(false);
  });

  it('keeps a full disk at 100% without dividing by zero', () => {
    const tiny = byMount('/tiny')!;
    expect(tiny.pct).toBe(100);
    expect(Number.isFinite(tiny.pct)).toBe(true);
  });

  it('never returns a used figure larger than the total', () => {
    for (const d of disks) expect(d.usedBytes).toBeLessThanOrEqual(d.totalBytes);
  });
});

describe('parseDf — malformed input', () => {
  it('returns an empty array rather than throwing', () => {
    for (const junk of ['', '   ', 'df: command not found', 'Filesystem 1024-blocks Used Available Capacity Mounted on']) {
      expect(parseDf(junk)).toEqual([]);
    }
  });

  it('skips rows whose numeric columns do not parse', () => {
    expect(parseDf('/dev/sda1 not a number here 50% /mnt')).toEqual([]);
  });

  it('skips a filesystem reporting zero total blocks', () => {
    expect(parseDf('/dev/sda1 0 0 0 0% /empty')).toEqual([]);
  });
});

/* ---------- ps ---------- */

describe('parsePs — captured output', () => {
  const procs = parsePs(fixture('ps-comm.txt'));

  it('parses rows and drops the header', () => {
    expect(procs.length).toBeGreaterThan(0);
    expect(procs.some((p) => p.name === 'COMMAND')).toBe(false);
  });

  it('reads the command name, percentages and RSS', () => {
    const bash = procs.find((p) => p.name === 'bash');
    expect(bash).toBeDefined();
    expect(bash!.cpuPct).toBe(40);
    expect(bash!.memPct).toBe(0);
    expect(bash!.rssBytes).toBe(6144 * 1024); // ps reports RSS in KiB
  });

  it('keeps command names that contain a slash or colon', () => {
    expect(procs.some((p) => p.name.includes('/'))).toBe(true);
  });

  it('handles a zero-RSS kernel thread', () => {
    const zero = procs.find((p) => p.rssBytes === 0);
    expect(zero).toBeDefined();
  });
});

describe('parsePs — malformed input', () => {
  it('returns an empty array rather than throwing', () => {
    for (const junk of ['', '  ', 'ps: illegal option', 'COMMAND %CPU %MEM RSS']) {
      expect(parsePs(junk)).toEqual([]);
    }
  });

  it('skips rows with a missing column', () => {
    expect(parsePs('node 12.3 4.5')).toEqual([]);
  });

  it('parses a command name containing spaces', () => {
    const rows = parsePs('Google Chrome Helper 12.3 4.5 123456');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Google Chrome Helper');
    expect(rows[0].rssBytes).toBe(123456 * 1024);
  });
});

/* ---------- nvidia-smi ---------- */

describe('parseNvidiaSmi', () => {
  const gpus = parseNvidiaSmi(fixture('nvidia-smi.txt'));

  it('parses every GPU line (multi-GPU safe)', () => {
    expect(gpus).toHaveLength(2);
    expect(gpus[0].name).toBe('NVIDIA GeForce RTX 3070');
    expect(gpus[1].name).toBe('NVIDIA GeForce GTX 1050 Ti');
  });

  it('maps the documented column order', () => {
    const [gpu] = gpus;
    expect(gpu.utilPct).toBe(23);
    expect(gpu.memUsedMb).toBe(1543);
    expect(gpu.memTotalMb).toBe(8192);
    expect(gpu.tempC).toBe(51);
    expect(gpu.powerW).toBe(105.43);
    expect(gpu.fanPct).toBe(42);
  });

  it('turns [N/A] and [Not Supported] into null, not NaN or 0', () => {
    const second = gpus[1];
    expect(second.powerW).toBeNull();
    expect(second.fanPct).toBeNull();
    // A real reading of 0 must stay 0 and not be confused with "unsupported".
    expect(second.utilPct).toBe(0);
  });

  it('never reports more VRAM used than the card has', () => {
    for (const g of gpus) expect(g.memUsedMb).toBeLessThanOrEqual(g.memTotalMb);
  });

  it('clamps utilisation into 0..100', () => {
    const weird = parseNvidiaSmi('Fake GPU, 250, 100, 8192, 40, 50, 30');
    expect(weird[0].utilPct).toBe(100);
  });

  it('returns an empty array rather than throwing on malformed input', () => {
    for (const junk of ['', '   ', 'nvidia-smi: command not found', 'NVIDIA GeForce RTX 3070']) {
      expect(parseNvidiaSmi(junk)).toEqual([]);
    }
  });

  it('skips a line whose total memory is missing or zero', () => {
    expect(parseNvidiaSmi('Broken GPU, 10, 100, [N/A], 40, 50, 30')).toEqual([]);
    expect(parseNvidiaSmi('Broken GPU, 10, 100, 0, 40, 50, 30')).toEqual([]);
  });
});
