import { legalDetailsMissing } from '@/lib/site';

/**
 * Shown while `operator` in `src/lib/site.ts` still holds placeholders.
 *
 * A published Impressum that names nobody is a legal problem, and one that
 * names an invented person is a worse one — so the page says so out loud until
 * a real operator fills it in, and this disappears on its own once they have.
 */
export function LegalNotice() {
  if (!legalDetailsMissing) return null;

  return (
    <div className="mb-10 rounded-2xl border border-warn/40 bg-warn/10 p-5">
      <p className="text-[13px] leading-relaxed text-warn">
        <strong className="font-semibold">Not ready to publish.</strong> The
        operator details on this page are still placeholders. Fill in{' '}
        <code className="font-mono">operator</code> in{' '}
        <code className="font-mono">src/lib/site.ts</code>, and have the wording
        below checked against your jurisdiction before going live — this is a
        starting template, not legal advice.
      </p>
    </div>
  );
}
