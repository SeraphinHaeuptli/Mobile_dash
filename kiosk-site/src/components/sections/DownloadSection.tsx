import { DownloadButton } from '../DownloadButton';

export function DownloadSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-28 pt-8">
      <div className="flex flex-col items-center gap-7 rounded-[28px] border border-glass-line bg-glass px-6 py-16 text-center">
        <span className="label-caps">Get Kiosk</span>

        <h2 className="display max-w-xl text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.1]">
          Give that old phone a job.
        </h2>

        <p className="prose-measure text-[15px]">
          No account, no sign-in. Your settings are stored on the device, and
          the usage meter talks only to the endpoint you give it — if you give
          it one at all.
        </p>

        <DownloadButton />

        <p className="font-mono text-[11px] tracking-wider text-label-quaternary">
          iOS · iPadOS · Android
        </p>
      </div>
    </section>
  );
}
