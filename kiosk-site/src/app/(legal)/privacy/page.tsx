import type { Metadata } from 'next';

import { LegalNotice } from '@/components/LegalNotice';
import { operator, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `How ${site.name} handles personal data on this website and in the app.`,
};

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1 className="display mb-2 text-4xl">Privacy</h1>
      <p className="mb-8 text-label-tertiary">Datenschutzerklärung</p>

      <LegalNotice />

      <p>
        This page covers two separate things: this website, and the {site.name}{' '}
        app you install on a phone. They share a name and nothing else — the app
        does not talk to this site, and this site holds no data about anyone who
        installs the app.
      </p>

      <h2>Controller</h2>
      <address>
        {operator.name}
        <br />
        {operator.street}
        <br />
        {operator.city}
        <br />
        {operator.country}
        <br />
        <a href={`mailto:${operator.email}`}>{operator.email}</a>
      </address>

      <h2>This website</h2>

      <h3>Server logs</h3>
      <p>
        When you open a page, the hosting provider processes the request. Like
        any web server, it may record your IP address, the page requested, the
        time, the referring page and your browser’s user agent. This is
        necessary to deliver the site and to keep it secure, and rests on Art. 6
        (1)(f) GDPR — our legitimate interest in operating a working website.
      </p>

      <h3>No analytics, no advertising, no third-party scripts</h3>
      <p>
        This site loads no analytics, no advertising, no social widgets, no
        embedded video and no tag manager. There is no profiling and no
        automated decision-making.
      </p>

      <h3>Fonts are served from this domain</h3>
      <p>
        The typefaces used here — Archivo and IBM Plex Mono — are downloaded
        when the site is built and served from this domain. Your browser makes
        no connection to Google Fonts, so no IP address is disclosed to a third
        party in order to render the page.
      </p>

      <h3>The interactive demo</h3>
      <p>
        The clock on the front page runs entirely in your browser. It reads your
        device’s clock to show the time, and the usage figures it displays are
        generated locally as sample data. Nothing you do with the demo — the
        face you pick, the accent you choose — leaves your device or is recorded
        anywhere.
      </p>

      <h3>Local storage</h3>
      <p>
        One entry is stored in your browser to remember that you dismissed the
        cookie notice. It is not a cookie, is never transmitted to the server,
        and you can clear it at any time in your browser settings. See the{' '}
        <a href="/cookies">cookie notice</a> for the details.
      </p>

      <h2>The {site.name} app</h2>

      <h3>No account, no servers of ours</h3>
      <p>
        The app has no sign-in and no backend. Your settings — face, accent,
        backdrop, the toggles — are written to storage on the device itself and
        never leave it.
      </p>

      <h3>The usage endpoint</h3>
      <p>
        The usage meter shows sample data until you enter an endpoint yourself.
        If you do, the app requests that URL directly from your device on a
        roughly one-minute cadence, and displays what it returns. You choose the
        address; there is no intermediary and no copy kept. Point it at
        something on your own network and no data leaves it.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you have the right to access the personal data we hold
        about you (Art. 15), to have it corrected (Art. 16) or erased (Art. 17),
        to restrict its processing (Art. 18), to data portability (Art. 20), and
        to object to processing based on legitimate interests (Art. 21). You may
        also lodge a complaint with a supervisory authority (Art. 77).
      </p>
      <p>
        To exercise any of these, write to{' '}
        <a href={`mailto:${operator.email}`}>{operator.email}</a>.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes, the updated version is published on this page.
      </p>
    </article>
  );
}
