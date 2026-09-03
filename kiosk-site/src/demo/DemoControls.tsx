'use client';

import { Segmented, Switch } from '@/components/ui';
import { ACCENTS } from '@/design/palette';

import { useDemo } from './DemoContext';
import { BACKDROPS, FACES, WEIGHTS } from './settings';

/**
 * The app's settings, live on the page, laid out as a control bar under the
 * hero. Picking an accent here retints the device, the previews further down
 * *and* the wave field behind the whole hero — one control, and the page
 * becomes the argument for the product.
 */
export function DemoControls() {
  const { settings, accent, set } = useDemo();

  return (
    <div className="flex flex-col gap-7 rounded-[24px] border border-glass-line bg-glass p-6 backdrop-blur-xl sm:p-7">
      <div className="grid gap-6 sm:grid-cols-3">
        <Segmented
          label="Face"
          options={FACES}
          value={settings.face}
          onChange={(id) => set('face', id)}
        />
        <Segmented
          label="Backdrop"
          options={BACKDROPS}
          value={settings.backdrop}
          onChange={(id) => set('backdrop', id)}
        />
        <Segmented
          label="Weight"
          options={WEIGHTS}
          value={settings.weight}
          onChange={(id) => set('weight', id)}
        />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/8 pt-6">
        <span className="label-caps">Accent</span>
        <div role="radiogroup" aria-label="Accent" className="flex flex-wrap gap-2.5">
          {ACCENTS.map((option) => {
            const selected = option.id === accent.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={option.name}
                title={option.name}
                onClick={() => set('accent', option.id)}
                className="grid h-8 w-8 place-items-center rounded-full transition-transform hover:scale-110"
                style={{
                  // The ring is drawn outside the swatch, so the colour itself
                  // is never overlaid by chrome.
                  boxShadow: selected
                    ? `0 0 0 2px #000, 0 0 0 4px ${option.color}`
                    : 'none',
                }}
              >
                <span
                  className="h-[22px] w-[22px] rounded-full"
                  style={{ backgroundColor: option.color }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t border-white/8 pt-6 lg:grid-cols-4">
        <Switch
          label="24-hour time"
          checked={!settings.hour12}
          tint={accent.color}
          onChange={(value) => set('hour12', !value)}
        />
        <Switch
          label="Seconds"
          checked={settings.showSeconds}
          tint={accent.color}
          onChange={(value) => set('showSeconds', value)}
        />
        <Switch
          label="Date"
          checked={settings.showDate}
          tint={accent.color}
          onChange={(value) => set('showDate', value)}
        />
        <Switch
          label="Usage meter"
          checked={settings.showUsage}
          tint={accent.color}
          onChange={(value) => set('showUsage', value)}
        />
      </div>
    </div>
  );
}
