import type { Metadata } from 'next';

import { LegalNotice } from '@/components/LegalNotice';
import { operator, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Cookies',
  description: `What ${site.name} stores in your browser, and why.`,
};

const STORED = [
  {
    name: 'kiosk.cookie-notice',
    type: 'Local storage',
    purpose: 'Remembers that you dismissed the cookie notice, so it does not reappear on every page.',
    duration: 'Until you clear your browser storage',
  },
];

export default function CookiesPage() {
  return (
    <article className="legal">
      <h1 className="display mb-8 text-4xl">Cookies</h1>

      <LegalNotice />

      <h2>The short version</h2>
      <p>
        This site sets no cookies. It stores exactly one entry in your browser’s
        local storage, and that entry exists only to remember that you have
        already seen the notice at the bottom of the screen.
      </p>
      <p>
        There is no analytics, no advertising, no tracking and no third-party
        script on this site, so there is nothing here to opt in or out of. That
        is also why the notice offers a single button rather than a consent
        dialog: presenting a choice that changes nothing would be misleading.
      </p>

      <h2>What is stored</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Purpose</th>
            <th scope="col">Duration</th>
          </tr>
        </thead>
        <tbody>
          {STORED.map((item) => (
            <tr key={item.name}>
              <td className="font-mono text-white">{item.name}</td>
              <td>{item.type}</td>
              <td>{item.purpose}</td>
              <td>{item.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Is this a cookie?</h2>
      <p>
        Strictly, no. A cookie is sent to the server with every request; local
        storage never leaves your browser. The distinction matters less than the
        substance: either way something is kept on your device, so it is listed
        here.
      </p>
      <p>
        Under § 25 (2) TTDSG and the ePrivacy Directive, storage that is
        strictly necessary to provide a service the user has asked for does not
        require consent. Remembering a dismissed notice qualifies. Anything that
        did not — an analytics script, for instance — would have to ask first,
        and would not load until you agreed.
      </p>

      <h2>Removing it</h2>
      <p>
        Clear site data for this domain in your browser settings, or use a
        private window. The notice will simply appear again on your next visit.
      </p>

      <h2>Questions</h2>
      <p>
        Write to <a href={`mailto:${operator.email}`}>{operator.email}</a>.
      </p>
    </article>
  );
}
