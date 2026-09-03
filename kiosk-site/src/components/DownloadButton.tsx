import { PLAY_STORE_URL } from '@/lib/site';

function DownloadGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M9 2v9m0 0 3.5-3.5M9 11 5.5 7.5M3 13.5v1A1.5 1.5 0 0 0 4.5 16h9a1.5 1.5 0 0 0 1.5-1.5v-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The primary action. Deliberately white rather than accent-tinted: the accent
 * is the page's atmosphere and changes under the reader's hand, and the one
 * thing they came to click should not move with it.
 *
 * Until `PLAY_STORE_URL` is set the button states plainly that the listing is
 * not up yet, instead of linking to a store page that would 404.
 */
export function DownloadButton({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const padding = size === 'lg' ? 'px-6 py-3.5 text-[15px]' : 'px-5 py-3 text-sm';
  const shared = `inline-flex items-center gap-2.5 rounded-full font-semibold ${padding}`;

  if (!PLAY_STORE_URL) {
    return (
      <span
        className={`${shared} cursor-default border border-glass-line bg-glass text-label-secondary`}
      >
        <DownloadGlyph />
        Coming soon to Google Play
      </span>
    );
  }

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noreferrer"
      className={`${shared} bg-white text-black transition-transform hover:scale-[1.02] active:scale-100`}
    >
      <DownloadGlyph />
      Get it on Google Play
    </a>
  );
}
