import { describe, it, expect } from 'vitest';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseDf, parseDrmCard, parseNvidiaSmi, parsePs, readDrmGpus } from './server';

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

/* ---------- DRM sysfs (AMD / Intel GPUs) ---------- */

describe('parseDrmCard', () => {
  // Values as the kernel writes them: trailing newline, millidegrees,
  // microwatts, bytes. A discrete AMD card exposes all of these.
  const discreteAmd = {
    vendor: '0x1002\n',
    driver: 'amdgpu',
    busy: '37\n',
    vramUsed: '2415919104\n', // 2304 MiB
    vramTotal: '8589934592\n', // 8192 MiB
    temp: '58000\n', // 58.0 C
    power: '94500000\n', // 94.5 W
    pwm: '128\n',
    pwmMax: '255\n',
  };

  it('reads a discrete AMD card and converts every unit', () => {
    const gpu = parseDrmCard(discreteAmd)!;
    expect(gpu).not.toBeNull();
    expect(gpu.utilPct).toBe(37);
    expect(gpu.memUsedMb).toBe(2304);
    expect(gpu.memTotalMb).toBe(8192);
    expect(gpu.tempC).toBe(58); // millidegrees -> C
    expect(gpu.powerW).toBe(94.5); // microwatts -> W
    expect(gpu.fanPct).toBe(50.2); // 128/255
  });

  it('names the card from the PCI vendor id and driver, without inventing a model', () => {
    const gpu = parseDrmCard(discreteAmd)!;
    expect(gpu.name).toContain('AMD');
    expect(gpu.name).toContain('amdgpu');
    // The whole point of this path: never claim a specific product.
    expect(gpu.name).not.toMatch(/RTX|GeForce|\bRX\s?\d/);
  });

  it('handles an AMD APU (integrated) that reports no fan and no power', () => {
    // A Lenovo-style AMD laptop: busy% and a VRAM carve-out, but hwmon has no
    // pwm1 and no power1_average, so those files simply do not exist.
    const gpu = parseDrmCard({
      vendor: '0x1002\n',
      driver: 'amdgpu',
      busy: '12\n',
      vramUsed: '536870912\n', // 512 MiB
      vramTotal: '2147483648\n', // 2048 MiB
      temp: '45000\n',
    })!;
    expect(gpu).not.toBeNull();
    expect(gpu.utilPct).toBe(12);
    expect(gpu.memTotalMb).toBe(2048);
    expect(gpu.tempC).toBe(45);
    // Missing must be null, never 0 — 0 W / 0% fan would be a false reading.
    expect(gpu.powerW).toBeNull();
    expect(gpu.fanPct).toBeNull();
  });

  it('accepts a card that reports utilisation but no VRAM figures', () => {
    const gpu = parseDrmCard({ vendor: '0x8086\n', driver: 'i915', busy: '5\n' })!;
    expect(gpu).not.toBeNull();
    expect(gpu.utilPct).toBe(5);
    expect(gpu.memTotalMb).toBe(0);
    expect(gpu.name).toContain('Intel');
  });

  it('accepts a card that reports VRAM but no utilisation', () => {
    const gpu = parseDrmCard({ vendor: '0x1002\n', vramTotal: '4294967296\n', vramUsed: '1073741824\n' })!;
    expect(gpu).not.toBeNull();
    expect(gpu.utilPct).toBe(0);
    expect(gpu.memTotalMb).toBe(4096);
    expect(gpu.memUsedMb).toBe(1024);
  });

  it('rejects a node with nothing measurable (display-only / no driver data)', () => {
    expect(parseDrmCard({})).toBeNull();
    expect(parseDrmCard({ vendor: '0x1002\n' })).toBeNull();
    expect(parseDrmCard({ vendor: '0x1002\n', vramTotal: '0\n' })).toBeNull();
    expect(parseDrmCard({ driver: 'simpledrm' })).toBeNull();
  });

  it('never reports more VRAM used than total', () => {
    const gpu = parseDrmCard({ vendor: '0x1002\n', vramTotal: '1073741824\n', vramUsed: '99999999999\n' })!;
    expect(gpu.memUsedMb).toBeLessThanOrEqual(gpu.memTotalMb);
  });

  it('clamps utilisation and fan duty into range', () => {
    const gpu = parseDrmCard({ vendor: '0x1002\n', busy: '250\n', pwm: '999\n', pwmMax: '255\n' })!;
    expect(gpu.utilPct).toBe(100);
    expect(gpu.fanPct).toBe(100);
  });

  it('treats a zero or missing pwm1_max as "no fan reading" rather than dividing by zero', () => {
    expect(parseDrmCard({ vendor: '0x1002\n', busy: '10\n', pwm: '128\n', pwmMax: '0\n' })!.fanPct).toBeNull();
    expect(parseDrmCard({ vendor: '0x1002\n', busy: '10\n', pwm: '128\n' })!.fanPct).toBeNull();
  });

  it('ignores unparseable file contents instead of emitting NaN', () => {
    const gpu = parseDrmCard({ vendor: '0x1002\n', busy: '10\n', temp: 'garbage\n', power: '\n' })!;
    expect(gpu.tempC).toBeNull();
    expect(gpu.powerW).toBeNull();
    expect(Number.isNaN(gpu.utilPct)).toBe(false);
  });

  it('falls back to a neutral label for an unknown vendor', () => {
    const gpu = parseDrmCard({ vendor: '0xdead\n', driver: 'nouveau', busy: '3\n' })!;
    expect(gpu.name).toBe('GPU (nouveau)');
  });

  it('reads power1_input when power1_average is absent (handled by the caller)', () => {
    // The reader passes whichever exists as `power`; parse must treat it the same.
    expect(parseDrmCard({ vendor: '0x1002\n', busy: '1\n', power: '15000000\n' })!.powerW).toBe(15);
  });
});

/* ---------- DRM sysfs enumeration (directory walking + file reads) ---------- */

describe('readDrmGpus', () => {
  /**
   * Builds a fake /sys/class/drm tree in a temp dir. This exercises the parts
   * parseDrmCard cannot: finding cardN dirs, skipping connector nodes,
   * locating hwmonN, and tolerating absent files. Without real AMD hardware
   * available, this is how the read path itself gets covered.
   */
  function makeTree(cards: Record<string, Record<string, string>>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'drm-'));
    for (const [card, files] of Object.entries(cards)) {
      const device = path.join(root, card, 'device');
      mkdirSync(device, { recursive: true });
      for (const [rel, contents] of Object.entries(files)) {
        const target = path.join(device, rel);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, contents);
      }
    }
    return root;
  }

  it('reads an AMD laptop: one APU with hwmon temp but no fan or power', async () => {
    const root = makeTree({
      'card0': {
        vendor: '0x1002\n',
        uevent: 'DRIVER=amdgpu\nPCI_ID=1002:15BF\n',
        gpu_busy_percent: '18\n',
        mem_info_vram_used: '805306368\n', // 768 MiB
        mem_info_vram_total: '2147483648\n', // 2048 MiB
        'hwmon/hwmon3/temp1_input': '52000\n',
      },
      // Connector nodes live alongside the cards and must be ignored.
      'card0-eDP-1': { vendor: 'ignored\n' },
    });
    const gpus = (await readDrmGpus(root))!;
    expect(gpus).toHaveLength(1);
    expect(gpus[0].name).toContain('AMD');
    expect(gpus[0].utilPct).toBe(18);
    expect(gpus[0].memUsedMb).toBe(768);
    expect(gpus[0].memTotalMb).toBe(2048);
    expect(gpus[0].tempC).toBe(52);
    expect(gpus[0].powerW).toBeNull();
    expect(gpus[0].fanPct).toBeNull();
  });

  it('falls back to power1_input when power1_average is absent', async () => {
    const root = makeTree({
      'card0': {
        vendor: '0x1002\n',
        uevent: 'DRIVER=amdgpu\n',
        gpu_busy_percent: '40\n',
        mem_info_vram_total: '8589934592\n',
        'hwmon/hwmon0/power1_input': '75000000\n',
      },
    });
    expect((await readDrmGpus(root))![0].powerW).toBe(75);
  });

  it('reads a discrete card with a fan', async () => {
    const root = makeTree({
      'card0': {
        vendor: '0x1002\n',
        uevent: 'DRIVER=amdgpu\n',
        gpu_busy_percent: '65\n',
        mem_info_vram_used: '4294967296\n',
        mem_info_vram_total: '8589934592\n',
        'hwmon/hwmon2/temp1_input': '71000\n',
        'hwmon/hwmon2/power1_average': '180000000\n',
        'hwmon/hwmon2/pwm1': '204\n',
        'hwmon/hwmon2/pwm1_max': '255\n',
      },
    });
    const gpu = (await readDrmGpus(root))![0];
    expect(gpu.tempC).toBe(71);
    expect(gpu.powerW).toBe(180);
    expect(gpu.fanPct).toBe(80);
  });

  it('handles more than one card', async () => {
    const root = makeTree({
      'card0': { vendor: '0x8086\n', uevent: 'DRIVER=i915\n', gpu_busy_percent: '4\n' },
      'card1': { vendor: '0x1002\n', uevent: 'DRIVER=amdgpu\n', gpu_busy_percent: '55\n', mem_info_vram_total: '8589934592\n' },
    });
    const gpus = (await readDrmGpus(root))!;
    expect(gpus).toHaveLength(2);
    expect(gpus[0].name).toContain('Intel');
    expect(gpus[1].name).toContain('AMD');
  });

  it('returns an EMPTY LIST (a real finding) for a machine with no usable GPU', async () => {
    // A display-only node with nothing measurable. This must be [] and not
    // null: the widget should say "No GPU detected", not show a sample.
    const root = makeTree({ 'card0': { uevent: 'DRIVER=simpledrm\n' } });
    const gpus = await readDrmGpus(root);
    expect(gpus).toEqual([]);
    expect(gpus).not.toBeNull();
  });

  it('returns NULL ("cannot tell") when sysfs is not readable at all', async () => {
    // Windows / macOS: no /sys. The caller must fall back to the sample rather
    // than asserting the machine has no GPU.
    expect(await readDrmGpus(path.join(tmpdir(), 'definitely-not-a-real-drm-root'))).toBeNull();
  });
});
