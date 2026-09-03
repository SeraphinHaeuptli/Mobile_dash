/**
 * Everything about this deployment that isn't code.
 *
 * The legal details below are placeholders on purpose. An Impressum naming a
 * person who has not agreed to be named is worse than no Impressum, so the
 * pages that use them show a warning until they are filled in.
 */

export const site = {
  name: 'Kiosk',
  tagline: 'A clock worth leaving on.',
  description:
    'A StandBy-style kiosk clock for iOS and Android: four faces, eight accents, and a live Claude session meter along the bottom.',
  /**
   * The deployed origin, used for canonical and Open Graph URLs. Point this at
   * a custom domain once there is one; until then it is the Vercel production
   * alias, which stays stable across deployments.
   */
  url: 'https://kiosk-site-seraphinhaeuptlis-projects.vercel.app',
} as const;

/**
 * The Play Store listing.
 *
 * `null` until the app is published: the button then reads "Coming soon" rather
 * than sending visitors to a listing that does not exist yet. Once the app is
 * live, set this to the listing URL — for the current package that is
 * `https://play.google.com/store/apps/details?id=com.kioskclock.app` — and the
 * button becomes a real download link with no other change.
 */
export const PLAY_STORE_URL: string | null = null;

/** Marks a value nobody has filled in yet. */
const TODO = 'TODO:';

/** Details required by German TMG §5 / DDG §5. Fill these in before publishing. */
export const operator = {
  name: `${TODO} legal name of the site operator`,
  street: `${TODO} street and number`,
  city: `${TODO} postal code and city`,
  country: `${TODO} country`,
  email: `${TODO} contact email address`,
  /** Optional: only required if you are VAT-registered. Set to null to omit. */
  vatId: null as string | null,
} as const;

export function isUnfilled(value: string | null): boolean {
  return value === null || value.startsWith(TODO);
}

/** True while any legally required field is still a placeholder. */
export const legalDetailsMissing: boolean = [
  operator.name,
  operator.street,
  operator.city,
  operator.country,
  operator.email,
].some(isUnfilled);

export const LAUNCH_YEAR = 2026;
