import type { ReactNode } from 'react';

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-24">
      <div className="flex flex-col gap-4">
        <span className="label-caps">{eyebrow}</span>
        <h2 className="display max-w-3xl text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.1]">
          {title}
        </h2>
        {lede && <p className="prose-measure text-[17px]">{lede}</p>}
      </div>

      <div className="mt-12">{children}</div>
    </section>
  );
}
