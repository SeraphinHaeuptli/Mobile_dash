'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'kiosk.cookie-notice';

/**
 * A notice, not a consent gate — because there is nothing here to consent to.
 *
 * This site loads no analytics, no advertising and no third-party scripts, so
 * the only thing it stores is the dismissal below. That needs no permission
 * under the ePrivacy Directive, and dressing it up as an "Accept all" choice
 * would imply a tracking apparatus that does not exist.
 *
 * If analytics are ever added, this has to become a real opt-in: the script
 * must not load until the visitor has actively agreed.
 */
export function CookieBanner() {
  // Starts hidden and appears after mount: the server cannot know whether this
  // visitor has already dismissed it, and rendering it either way would flash.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage blocked (private mode, or a locked-down browser). Showing the
      // notice every visit is the harmless outcome; failing to render is not.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, 'dismissed');
    } catch {
      // Nothing to do — the notice simply returns next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 sm:justify-start"
    >
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl border border-glass-line bg-[#111113]/95 p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:flex-row sm:items-center">
        <p className="flex-1 text-[13px] leading-relaxed text-label-secondary">
          This site sets no tracking or advertising cookies. It stores one entry
          in your browser so this notice stays dismissed.{' '}
          <Link href="/cookies" className="text-white underline underline-offset-2">
            Details
          </Link>
          .
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black transition-transform hover:scale-[1.03] active:scale-100"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
