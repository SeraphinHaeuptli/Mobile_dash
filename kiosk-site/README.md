# Kiosk — marketing site

The advertising and explanation site for the [Kiosk](../kiosk-clock) clock app.

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Verification:

```bash
npm run typecheck  # tsc --noEmit
npm run build      # every route prerenders statically
```

## Before you publish

Two things are deliberately left unset, because guessing at either would be
worse than leaving them blank. Both live in `src/lib/site.ts`.

**1. The Play Store link.** `PLAY_STORE_URL` is `null`, so the download button
reads "Coming soon to Google Play" and is not a link. Set it to the listing URL
once the app is published — for the current package that is
`https://play.google.com/store/apps/details?id=com.kioskclock.app` — and the
button becomes a live download link with no other change.

**2. The operator's legal details.** The `operator` object holds placeholders.
While any of them is unfilled, `/impressum`, `/privacy` and `/cookies` render a
visible warning instead of quietly publishing an Impressum that names nobody.
Fill them in, and the warning disappears on its own.

The legal copy is a starting template written for a German operator (DDG § 5,
MStV § 18, GDPR, TTDSG § 25). Have it checked against your own jurisdiction and
circumstances before going live.

## How it relates to the app

The site does not screenshot the app — it runs it.

- `src/design/palette.ts` is the app's `src/design/palette.ts`, ported. All
  eight accents, the label roles and the status colours are the same values.
- `src/demo/faces/` are web ports of the app's four faces, keeping the app's
  rule that every face derives its typography from a single `size` prop. The
  gallery previews and the phone render the same components at different sizes,
  which is how the app's own settings picker works.
- `src/demo/usage.ts` ports the app's sample-usage generator, so the meter in
  the demo shows what the app shows when no endpoint is configured — including
  the grey "sample" pill, which is there precisely so demo numbers are never
  mistaken for live ones.

Changing a colour or a face in the app means porting that change here. The two
copies are deliberate: the site is a web build with no React Native in it.

## The background

`src/lib/perlin.ts` is a hand-written classic 2D Perlin implementation with a
seeded permutation table, plus fBm over three octaves.
`src/components/WaveField.tsx` draws 34 contour lines across a canvas, each
displaced by that noise, tinted from the selected accent to its companion hue
and composited additively so the crossings glow on black.

It pauses when scrolled out of view or when the tab is hidden, and renders a
single still frame under `prefers-reduced-motion`.

## Layout

```
src/
  app/
    page.tsx            Landing page composition
    globals.css         Tokens (@theme), base layer, component classes
    (legal)/            Impressum, privacy, cookies — shared layout
  components/
    Hero.tsx            Wave field + copy + device + control bar
    WaveField.tsx       The Perlin canvas
    sections/           Faces, kiosk mode, usage meter, download
    ui.tsx              Segmented control, switch
  demo/
    DemoContext.tsx     Shared demo state — accent tints the whole page
    KioskDevice.tsx     The phone
    faces/              The four faces + registry
    usage.ts            Usage model + sample source
  design/palette.ts     The app's colour system
  lib/                  Perlin, formatting, clock tick, site config
```
