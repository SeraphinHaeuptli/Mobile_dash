import { formatDuration, formatPercent } from '@/lib/format';

import { levelColor, levelOf, timeUntilReset, type UsageSnapshot } from './usage';

/**
 * The Claude session meter: how much of the rolling five-hour allowance is
 * gone, when it rolls over, and the weekly allowance alongside.
 *
 * The grey "sample" pill is not decoration. The app shows it whenever no live
 * endpoint is configured, and this demo has none — a meter that looked live
 * here would misrepresent the product.
 */
export function UsageMeter({
  snapshot,
  now,
  accentColor,
}: {
  snapshot: UsageSnapshot;
  now: number;
  accentColor: string;
}) {
  const { session, week } = snapshot;
  const used = session.used;
  const color = levelColor(levelOf(used), accentColor);
  const remaining = timeUntilReset(session, now);

  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-glass-line bg-glass px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-label-secondary">
          Claude session
        </span>
        <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
          {formatPercent(used)}
        </span>
      </div>

      <div className="h-[5px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(used * 100)}%`, backgroundColor: color }}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-label-tertiary">
            {remaining === 0
              ? 'Resetting now'
              : `Resets in ${formatDuration(remaining)}`}
          </span>
          <span className="rounded-full bg-white/8 px-2 py-px text-[10px] font-semibold tracking-[0.3px] text-label-tertiary">
            sample
          </span>
        </div>

        <span className="text-xs tabular-nums text-label-tertiary">
          Week {formatPercent(week.used)}
        </span>
      </div>
    </div>
  );
}
