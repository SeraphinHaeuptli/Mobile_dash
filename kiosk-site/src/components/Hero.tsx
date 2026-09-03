'use client';

import { DemoControls } from '@/demo/DemoControls';
import { KioskDevice } from '@/demo/KioskDevice';

import { DownloadButton } from './DownloadButton';
import { SiteHeader } from './SiteHeader';
import { WaveField } from './WaveField';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <WaveField />
      {/* Dissolves the field into the flat black the rest of the page sits on. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-black"
      />

      <div className="relative">
        <SiteHeader />

        <div className="mx-auto grid w-full max-w-6xl items-start gap-14 px-6 pb-14 pt-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20 lg:pt-20">
          <div className="flex flex-col items-start gap-7">
            <span className="label-caps">iPhone · iPad · Android</span>

            <h1 className="display-xl text-[clamp(2.75rem,7vw,4.5rem)]">
              A clock worth leaving on.
            </h1>

            <p className="prose-measure text-[17px]">
              Kiosk turns a spare phone or a docked tablet into a StandBy-style
              display — four faces, eight system accents, and a live read on how
              much of your Claude session is left. Built for screens that stay
              on: it holds the display awake, dims after dark, and drifts a few
              pixels an hour so nothing burns in.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <DownloadButton />
              <a
                href="#faces"
                className="text-sm font-medium text-label-secondary transition-colors hover:text-white"
              >
                See what it does
              </a>
            </div>

            <dl className="mt-2 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
              {[
                { value: 'Four', label: 'clock faces' },
                { value: 'Eight', label: 'system accents' },
                { value: '5-hour', label: 'session meter' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1">
                  <dt className="display text-2xl">{stat.value}</dt>
                  <dd className="label-caps">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex w-full flex-col items-center gap-4 lg:w-[318px]">
            <KioskDevice />
            <p className="text-center text-[13px] text-label-secondary">
              This is the real app, running here. Change anything below.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-6xl px-6 pb-20">
          <DemoControls />
        </div>
      </div>
    </section>
  );
}
