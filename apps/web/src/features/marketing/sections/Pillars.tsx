import { Card, cn } from "@throughline/ui";
import { PILLARS } from "../content";

const toneText = { agent: "text-agent", gate: "text-gate", ion: "text-ion" } as const;

export function Pillars() {
  return (
    <section className="mx-auto flex max-w-7xl flex-col gap-9 px-6 py-16 lg:px-12">
      <h2 className="font-display text-display-lg text-strong max-w-3xl">
        AI writes the code. <span className="text-muted">The hard part is everything around it.</span>
      </h2>
      <div className="grid gap-5 md:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.n} padding="lg" interactive className="flex flex-col gap-4">
            <span className={cn("font-display text-display-md", toneText[p.tone])}>{p.n}</span>
            <h3 className="font-display text-heading-md text-strong">{p.title}</h3>
            <p className="text-body-lg text-subtle">{p.body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
