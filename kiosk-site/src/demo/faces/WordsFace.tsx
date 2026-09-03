import type { FaceProps } from './types';

/**
 * Relative to the base numeral size. Sized so the longest token the face can
 * produce — "TWENTY-FIVE" — still fits the narrow axis of a phone.
 */
const FONT_SCALE = 0.4;

const HOURS = [
  'twelve',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
];

/**
 * Indexed by the five-minute step, 0–11. Each relation is pre-split into its
 * own lines: set as a single line, "twenty-five past" is far wider than a
 * phone screen at display size.
 */
const RELATIONS: readonly (readonly string[])[] = [
  [],
  ['five', 'past'],
  ['ten', 'past'],
  ['quarter', 'past'],
  ['twenty', 'past'],
  ['twenty-five', 'past'],
  ['half', 'past'],
  ['twenty-five', 'to'],
  ['twenty', 'to'],
  ['quarter', 'to'],
  ['ten', 'to'],
  ['five', 'to'],
];

/** The half-hour mark is where "past" turns into "to" the next hour. */
const TO_THE_NEXT_HOUR = 7;

interface Line {
  text: string;
  tinted: boolean;
}

export function toWords(date: Date): Line[] {
  const step = Math.round(date.getMinutes() / 5);
  // step is 0–12; 12 means the next hour has effectively arrived.
  const slot = step % 12;
  const hour = (date.getHours() + (step >= TO_THE_NEXT_HOUR ? 1 : 0)) % 12;
  const hourWord = HOURS[hour];

  if (slot === 0) {
    return [
      { text: 'it is', tinted: false },
      { text: hourWord, tinted: true },
      { text: "o'clock", tinted: false },
    ];
  }

  return [
    { text: 'it is', tinted: false },
    ...RELATIONS[slot].map((text) => ({ text, tinted: false })),
    { text: hourWord, tinted: true },
  ];
}

export function WordsFace({ now, accent, size }: FaceProps) {
  const font = size * FONT_SCALE;

  return (
    // Left-aligned, so the varying line lengths read as an editorial stack
    // rather than a ragged centred block.
    <div className="flex flex-col items-start">
      {toWords(now).map((line, index) => (
        <span
          key={index}
          style={{
            fontSize: font,
            lineHeight: 1.2,
            fontWeight: 700,
            letterSpacing: font * 0.04,
            textTransform: 'uppercase',
            color: line.tinted ? accent.color : 'var(--color-label-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {line.text}
        </span>
      ))}
    </div>
  );
}
