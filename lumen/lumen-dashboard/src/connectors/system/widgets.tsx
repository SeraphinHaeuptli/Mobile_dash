'use client';
import type { WidgetModule, WidgetProps } from '@/lib/types';
import { Bar, Empty, Pill, Row, Rows, Sparkline, Stat, StatGrid, bytes } from '@/components/ui';

/* ---------- shapes returned by server.ts ---------- */

interface OverviewData {
  hostname: string;
  platform: string;
  distro: string;
  kernel: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  cpuPct: number;
  cpuHistory: number[];
  memUsed: number;
  memTotal: number;
  memPct: number;
  uptimeSeconds: number;
  loadAvg: [number, number, number];
  loadPerCore: number;
  sample: boolean;
}

interface DiskItem {
  mount: string;
  fs: string;
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
  pct: number;
}
interface DisksData {
  disks: DiskItem[];
  totalCount: number;
  minSizeGb: number;
  sample: boolean;
}

interface GpuItem {
  name: string;
  utilPct: number;
  memUsedMb: number;
  memTotalMb: number;
  tempC: number | null;
  powerW: number | null;
  fanPct: number | null;
}
interface GpuData {
  gpus: GpuItem[];
  sample: boolean;
}

interface ProcItem {
  name: string;
  cpuPct: number;
  memPct: number;
  rssBytes: number;
}
interface ProcessesData {
  processes: ProcItem[];
  sortBy: 'cpu' | 'memory';
  sample: boolean;
}

/* ---------- helpers ---------- */

type Tone = 'good' | 'bad' | 'warn' | undefined;

/** Shared thresholds: amber past `warn`, red past `bad`. */
function toneFor(pct: number, warn: number, bad: number): Tone {
  if (pct >= bad) return 'bad';
  if (pct >= warn) return 'warn';
  return undefined;
}

function pct(n: number) {
  return `${Math.round(n)}%`;
}

function uptimeText(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function gbText(mb: number) {
  return `${(mb / 1024).toFixed(1)} GB`;
}

function SampleHint({ show, note }: { show: boolean; note?: string }) {
  if (!show) return null;
  return (
    <div className="faint" style={{ fontSize: 11, marginTop: 'auto', paddingTop: 6, textAlign: 'right' }}>
      sample data{note ? ` · ${note}` : ''}
    </div>
  );
}

/* ---------- system.overview ---------- */

function Overview({ data, settings }: WidgetProps<OverviewData>) {
  if (!data || typeof data.memTotal !== 'number') return <Empty>No system readings available.</Empty>;

  const showHost = !(settings.showHost === false || settings.showHost === 'false');
  const history = Array.isArray(data.cpuHistory) ? data.cpuHistory : [];
  const cpuTone = toneFor(data.cpuPct, 65, 85);
  const memTone = toneFor(data.memPct, 75, 90);
  const load: number[] = Array.isArray(data.loadAvg) ? data.loadAvg : [0, 0, 0];
  const loadAt = (i: number) => {
    const v = load[i];
    return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '—';
  };
  const perCore = Number.isFinite(data.loadPerCore) ? data.loadPerCore : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <StatGrid>
        <Stat
          label="CPU"
          value={pct(data.cpuPct)}
          sub={`${data.cpuCount} core${data.cpuCount === 1 ? '' : 's'} · ${perCore.toFixed(2)}/core`}
          tone={cpuTone}
        />
        <Stat label="Memory" value={pct(data.memPct)} sub={`${bytes(data.memUsed)} of ${bytes(data.memTotal)}`} tone={memTone} />
      </StatGrid>

      {history.length >= 2 ? (
        <Sparkline points={history} height={34} tone={cpuTone} />
      ) : (
        <div className="faint" style={{ fontSize: 11, height: 34, display: 'flex', alignItems: 'center' }}>
          collecting CPU samples…
        </div>
      )}

      <Bar pct={data.memPct} tone={memTone} />

      <Rows>
        {showHost && (
          <Row
            icon={<span className="faint">▪</span>}
            title={data.hostname}
            sub={`${data.distro} · ${data.kernel} · ${data.arch}`}
            right={<Pill>{data.platform}</Pill>}
          />
        )}
        <Row title="Uptime" sub={data.cpuModel} right={uptimeText(data.uptimeSeconds)} />
        <Row
          title="Load average"
          sub="1m · 5m · 15m"
          right={`${loadAt(0)} · ${loadAt(1)} · ${loadAt(2)}`}
        />
      </Rows>

      <SampleHint show={data.sample} />
    </div>
  );
}

/* ---------- system.disks ---------- */

function Disks({ data, settings }: WidgetProps<DisksData>) {
  const all = data && Array.isArray(data.disks) ? data.disks : [];
  const limitRaw = Number(settings.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : all.length;
  const disks = all.slice(0, limit);

  if (!disks.length) {
    return (
      <Empty>
        <span>No filesystems above {data?.minSizeGb ?? 1} GB.</span>
        <span>Lower the minimum size to show more mounts.</span>
      </Empty>
    );
  }

  const hidden = Math.max(0, (data.totalCount || disks.length) - disks.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rows">
        {disks.map((d) => {
          const tone = toneFor(d.pct, 85, 95);
          return (
            <div className="row" key={d.mount} style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="row-title" style={{ flex: 1, minWidth: 0 }}>{d.mount}</div>
                <Pill tone={tone}>{pct(d.pct)}</Pill>
              </div>
              <div className="row-sub">
                {`${bytes(d.usedBytes)} of ${bytes(d.totalBytes)} · ${bytes(d.freeBytes)} free · ${d.fs}`}
              </div>
              <div style={{ marginTop: 5 }}>
                <Bar pct={d.pct} tone={tone} />
              </div>
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <div className="faint" style={{ fontSize: 11, paddingTop: 6 }}>
          {hidden} more mount{hidden === 1 ? '' : 's'} hidden
        </div>
      )}
      <SampleHint show={data.sample} note="df unavailable" />
    </div>
  );
}

/* ---------- system.gpu ---------- */

function Gpu({ data }: WidgetProps<GpuData>) {
  const gpus = data && Array.isArray(data.gpus) ? data.gpus : [];
  if (!gpus.length) return <Empty>No GPU detected on this machine.</Empty>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      {gpus.map((g, i) => {
        const vramPct = g.memTotalMb > 0 ? (g.memUsedMb / g.memTotalMb) * 100 : 0;
        const utilTone = toneFor(g.utilPct, 70, 92);
        const vramTone = toneFor(vramPct, 80, 93);
        const tempTone = g.tempC == null ? undefined : toneFor(g.tempC, 75, 85);
        return (
          <div key={`${g.name}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="row-title" style={{ flex: 1, fontWeight: 600 }}>{g.name}</div>
              <Pill tone={utilTone}>{pct(g.utilPct)} util</Pill>
            </div>

            <StatGrid>
              <Stat label="VRAM" value={gbText(g.memUsedMb)} sub={`of ${gbText(g.memTotalMb)}`} tone={vramTone} />
              <Stat label="Temp" value={g.tempC == null ? '—' : `${Math.round(g.tempC)}°C`} tone={tempTone} />
              <Stat label="Power" value={g.powerW == null ? '—' : `${Math.round(g.powerW)} W`} />
            </StatGrid>

            <div>
              <Bar pct={vramPct} tone={vramTone} />
              <div className="row-sub" style={{ marginTop: 4 }}>
                {`VRAM ${pct(vramPct)}`}
                {g.fanPct == null ? '' : ` · fan ${pct(g.fanPct)}`}
              </div>
            </div>
          </div>
        );
      })}
      <SampleHint show={data.sample} note="GPU not readable here" />
    </div>
  );
}

/* ---------- system.processes ---------- */

function Processes({ data, settings }: WidgetProps<ProcessesData>) {
  const all = data && Array.isArray(data.processes) ? data.processes : [];
  const limitRaw = Number(settings.limit);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : all.length;
  const procs = all.slice(0, limit);
  if (!procs.length) return <Empty>No process data available on this host.</Empty>;

  const byMemory = data.sortBy === 'memory';
  const peak = procs.reduce((m, p) => Math.max(m, byMemory ? p.memPct : p.cpuPct), 0) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rows">
        {procs.map((p, i) => {
          const value = byMemory ? p.memPct : p.cpuPct;
          const tone = toneFor(value, byMemory ? 25 : 60, byMemory ? 50 : 90);
          return (
            <div className="row" key={`${p.name}-${i}`} style={{ display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="faint" style={{ fontSize: 11, flex: 'none', width: 12 }}>{i + 1}</span>
                <div className="row-title" style={{ flex: 1, minWidth: 0 }}>{p.name}</div>
                <div style={{ flex: 'none', fontSize: 12, color: tone ? `var(--${tone})` : 'var(--text-dim)' }}>
                  {value.toFixed(1)}% {byMemory ? 'mem' : 'cpu'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, paddingLeft: 20 }}>
                <div className="row-sub" style={{ flex: 'none', marginTop: 0 }}>
                  {bytes(p.rssBytes)} · {p.memPct.toFixed(1)}% mem
                </div>
                <div style={{ flex: 1, minWidth: 24 }}>
                  <Bar pct={(value / peak) * 100} tone={tone} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SampleHint show={data.sample} note="ps unavailable" />
    </div>
  );
}

/* ---------- module ---------- */

const widgets: WidgetModule[] = [
  {
    def: {
      id: 'system.overview',
      connectorId: 'system',
      title: 'System overview',
      description: 'CPU load with a rolling sparkline, memory use, uptime and host details.',
      defaultSize: { w: 4, h: 6 },
      minSize: { w: 3, h: 5 },
      refreshSeconds: 5,
      settings: [
        { key: 'showHost', label: 'Show host details', type: 'boolean', default: true, help: 'Hostname, distribution, kernel and architecture.' },
      ],
    },
    Component: Overview as WidgetModule['Component'],
  },
  {
    def: {
      id: 'system.disks',
      connectorId: 'system',
      title: 'Disks',
      description: 'Mounted filesystems with used space, capacity bar and a warning past 85%.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 30,
      settings: [
        { key: 'minSizeGb', label: 'Minimum size (GB)', type: 'number', default: 1, help: 'Hides tiny and virtual mounts.' },
        { key: 'limit', label: 'Filesystems', type: 'number', default: 6 },
      ],
    },
    Component: Disks as WidgetModule['Component'],
  },
  {
    def: {
      id: 'system.gpu',
      connectorId: 'system',
      title: 'GPU',
      description: 'GPU utilisation, VRAM, temperature and power draw. NVIDIA via nvidia-smi, AMD/Intel via DRM sysfs.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 5,
    },
    Component: Gpu as WidgetModule['Component'],
  },
  {
    def: {
      id: 'system.processes',
      connectorId: 'system',
      title: 'Top processes',
      description: 'Busiest processes by CPU or memory, with resident set size.',
      defaultSize: { w: 4, h: 5 },
      minSize: { w: 3, h: 4 },
      refreshSeconds: 10,
      settings: [
        { key: 'limit', label: 'Processes', type: 'number', default: 6 },
        {
          key: 'sortBy',
          label: 'Sort by',
          type: 'select',
          default: 'cpu',
          options: [
            { label: 'CPU', value: 'cpu' },
            { label: 'Memory', value: 'memory' },
          ],
        },
      ],
    },
    Component: Processes as WidgetModule['Component'],
  },
];

export default widgets;
