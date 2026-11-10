import { Card, GateMark, StatusDot } from "@throughline/ui";
import { JOURNEY } from "../content";

export function Journey() {
  return (
    <section id="how" className="mx-auto flex max-w-7xl scroll-mt-24 flex-col gap-9 px-6 py-16 lg:px-12">
      <div className="flex flex-col gap-3">
        <span className="eyebrow text-agent-fg">How it works</span>
        <h2 className="font-display text-display-lg text-strong max-w-3xl">
          One journey, ten stages, <span className="text-gate">six human sign-offs.</span>
        </h2>
        <p className="text-body-lg text-subtle max-w-2xl">
          Mint is agent work. Amber is a person deciding. Nothing reaches production without the right people
          having seen the evidence.
        </p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {JOURNEY.map((j, i) => (
          <li key={j.step}>
            <Card interactive className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-micro text-faint font-mono">{String(i + 1).padStart(2, "0")}</span>
                {j.gate ? (
                  <span className="text-gate text-micro flex items-center gap-1.5 font-mono">
                    <GateMark size="sm" /> {j.gate}
                  </span>
                ) : (
                  <StatusDot live />
                )}
              </div>
              <h3 className="font-display text-heading-md text-strong">{j.step}</h3>
              <p className="text-body text-subtle">{j.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
