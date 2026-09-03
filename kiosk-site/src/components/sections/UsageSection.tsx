import { Section } from './Section';

/**
 * The provenance table, straight from the app's README. It is the most
 * characteristic thing about this feature: the meter would rather admit it is
 * showing demo numbers than quietly show plausible wrong ones.
 */
const MODES = [
  {
    mode: 'live',
    meaning: 'The endpoint answered.',
    shown: 'No pill',
    tone: 'text-label-secondary',
  },
  {
    mode: 'sample',
    meaning: 'No endpoint configured; demo data by design.',
    shown: 'Grey “sample”',
    tone: 'text-label-tertiary',
  },
  {
    mode: 'stale',
    meaning: 'An endpoint is configured but the call failed.',
    shown: 'Amber “stale”',
    tone: 'text-warn',
  },
];

const ENDPOINT_EXAMPLE = `{
  "session": { "used": 0.62, "resetsAt": "2026-09-03T22:00:00Z" },
  "week":    { "used": 41, "limit": 100, "resetsInSeconds": 259200 }
}`;

export function UsageSection() {
  return (
    <Section
      id="usage"
      eyebrow="Usage meter"
      title="How much of the session is left, without unlocking anything."
      lede="Claude subscriptions run on a rolling five-hour window with a weekly allowance on top. The bar along the bottom of the clock shows the session as a percentage and counts down to the reset, with the week riding along on the right. It stays on your accent until 75%, turns amber, then red past 90%."
    >
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex min-w-0 flex-col gap-5">
          <h3 className="text-[15px] font-semibold">
            It always tells you where the numbers came from
          </h3>
          <p className="max-w-[40em] text-[15px] leading-relaxed text-label-secondary">
            A broken source that silently shows plausible numbers is worse than
            no source at all. So the meter labels itself, and a configured
            endpoint that fails is never mistaken for one that works.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/12">
                  <th scope="col" className="label-caps py-3 pr-6 font-medium">
                    Mode
                  </th>
                  <th scope="col" className="label-caps py-3 pr-6 font-medium">
                    Meaning
                  </th>
                  <th scope="col" className="label-caps py-3 font-medium">
                    Shown as
                  </th>
                </tr>
              </thead>
              <tbody>
                {MODES.map((row) => (
                  <tr key={row.mode} className="border-b border-white/8">
                    <td className="py-3 pr-6 font-mono text-[13px] text-white">
                      {row.mode}
                    </td>
                    <td className="py-3 pr-6 text-[13px] text-label-secondary">
                      {row.meaning}
                    </td>
                    <td className={`py-3 text-[13px] ${row.tone}`}>{row.shown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <h3 className="text-[15px] font-semibold">Point it at anything</h3>
          <p className="max-w-[40em] text-[15px] leading-relaxed text-label-secondary">
            The meter shows sample data until you give it an endpoint in
            Settings. There is no account to make and no service in the middle —
            anything on your network that serves this shape works.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-glass-line bg-glass p-5">
            <pre className="font-mono text-[12.5px] leading-relaxed text-label-secondary">
              <code>{ENDPOINT_EXAMPLE}</code>
            </pre>
          </div>

          <p className="max-w-[40em] text-[13px] leading-relaxed text-label-tertiary">
            <code className="font-mono text-label-secondary">used</code> is
            either a 0–1 fraction or a count paired with{' '}
            <code className="font-mono text-label-secondary">limit</code>. The
            reset accepts an ISO timestamp, an epoch in seconds or milliseconds,
            or{' '}
            <code className="font-mono text-label-secondary">
              resetsInSeconds
            </code>
            . <code className="font-mono text-label-secondary">week</code> is
            optional.
          </p>
        </div>
      </div>
    </Section>
  );
}
