import Link from 'next/link';

import { site } from '@/lib/site';

const LINKS = [
  { href: '/#faces', label: 'Faces' },
  { href: '/#kiosk', label: 'Kiosk mode' },
  { href: '/#usage', label: 'Usage meter' },
];

export function SiteHeader() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="display text-lg tracking-[-0.02em]">
        {site.name}
      </Link>

      <nav className="hidden gap-7 sm:flex" aria-label="Sections">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-sm text-label-secondary transition-colors hover:text-white"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
