import Link from 'next/link';

import { LAUNCH_YEAR, site } from '@/lib/site';

const LEGAL = [
  { href: '/impressum', label: 'Impressum' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  const span = year > LAUNCH_YEAR ? `${LAUNCH_YEAR}–${year}` : `${LAUNCH_YEAR}`;

  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="display text-base">{site.name}</span>
          <span className="text-[13px] text-label-tertiary">
            © {span} {site.name}. All rights reserved.
          </span>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Legal">
          {LEGAL.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] text-label-secondary transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
