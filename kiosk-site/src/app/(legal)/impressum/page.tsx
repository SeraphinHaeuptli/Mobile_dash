import type { Metadata } from 'next';

import { LegalNotice } from '@/components/LegalNotice';
import { operator, site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Impressum',
  description: `Provider identification for ${site.name} under § 5 DDG.`,
};

export default function ImpressumPage() {
  return (
    <article className="legal">
      <h1 className="display mb-8 text-4xl">Impressum</h1>

      <LegalNotice />

      <h2>Angaben gemäß § 5 DDG</h2>
      <address>
        {operator.name}
        <br />
        {operator.street}
        <br />
        {operator.city}
        <br />
        {operator.country}
      </address>

      <h2>Kontakt</h2>
      <p>
        Email: <a href={`mailto:${operator.email}`}>{operator.email}</a>
      </p>

      {operator.vatId && (
        <>
          <h2>Umsatzsteuer-Identifikationsnummer</h2>
          <p>Gemäß § 27 a Umsatzsteuergesetz: {operator.vatId}</p>
        </>
      )}

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <address>
        {operator.name}
        <br />
        {operator.street}
        <br />
        {operator.city}
      </address>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8
        bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet,
        übermittelte oder gespeicherte fremde Informationen zu überwachen oder
        nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
        hinweisen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden
        Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
        Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
        Seiten unterliegen dem deutschen Urheberrecht. Marken- und
        Produktnamen Dritter — darunter Google Play, Android, Apple, iOS und
        Claude — sind Eigentum der jeweiligen Rechteinhaber und werden hier nur
        beschreibend verwendet.
      </p>
    </article>
  );
}
