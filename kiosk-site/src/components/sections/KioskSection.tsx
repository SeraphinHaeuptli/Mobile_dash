import { Section } from './Section';

/**
 * A spec list rather than a row of cards. These are the behaviours that justify
 * the word "kiosk", and they read as a set of measured facts — so they get
 * hairlines and real numbers, not borders and icons.
 */
const BEHAVIOURS = [
  {
    term: 'Keep-awake',
    spec: 'While in the foreground',
    body: 'The display never sleeps while the clock is up, and releases the lock the moment you leave. No changing your system timeout and forgetting to change it back.',
  },
  {
    term: 'Night dimming',
    spec: '22:00 – 07:00 · 45%',
    body: 'After ten at night the whole face fades to 45% and comes back at seven in the morning. Bright enough to read at 3 a.m., dark enough to sleep next to.',
  },
  {
    term: 'Burn-in guard',
    spec: 'A few points, slow cycle',
    body: 'Static numerals on an OLED panel for months will ghost. The face drifts by a few points on a long cycle — invisible while you watch it, enough to spare the pixels.',
  },
  {
    term: 'Landscape lock',
    spec: 'Portrait or landscape',
    body: 'Lock the orientation to match how the phone actually sits in its dock or stand, rather than letting it flip every time you pick up the desk.',
  },
  {
    term: 'Tap to reveal',
    spec: 'Hides after 4 seconds',
    body: 'No permanent chrome over the face. Tap anywhere and the settings button fades in; leave it alone and it fades back out four seconds later.',
  },
];

export function KioskSection() {
  return (
    <Section
      id="kiosk"
      eyebrow="Kiosk mode"
      title="Built for a screen that never turns off."
      lede="Most clock apps assume you glance and leave. This one assumes the phone is going to sit in a dock for the next six months, and it is the difference between the two that the app is actually about."
    >
      <dl className="border-t border-white/10">
        {BEHAVIOURS.map((item) => (
          <div
            key={item.term}
            className="grid gap-2 border-b border-white/10 py-6 md:grid-cols-[13rem_1fr] md:gap-10"
          >
            <dt className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{item.term}</span>
              <span className="font-mono text-[11px] tracking-wider text-label-tertiary tabular-nums">
                {item.spec}
              </span>
            </dt>
            <dd className="max-w-[46em] text-[15px] leading-relaxed text-label-secondary">
              {item.body}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
