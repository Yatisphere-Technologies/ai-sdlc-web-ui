import { cn } from "@throughline/ui";
import { DEPLOYMENTS, SECURITY } from "../content";

const toneText = { agent: "text-agent", ion: "text-ion", gate: "text-gate" } as const;

export function Security() {
  return (
    <section id="security" className="scroll-mt-24 px-6 py-16 lg:px-12">
      <div className="bg-hero-wash border-agent-line mx-auto flex max-w-7xl flex-col gap-9 rounded-2xl border p-8 lg:p-12">
        <div className="flex flex-col gap-3">
          <span className="eyebrow text-agent-fg">Enterprise grade by default</span>
          <h2 className="font-display text-display-lg text-strong">Your code, your data, your keys.</h2>
        </div>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="border-line bg-background/60 flex flex-col gap-2 rounded-xl border p-5"
            >
              <Icon className="text-agent size-5" aria-hidden />
              <span className="text-body-lg font-semibold">{title}</span>
              <span className="text-body-sm text-muted">{body}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-3.5 md:grid-cols-3">
          {DEPLOYMENTS.map((d) => (
            <div
              key={d.kind}
              className="border-line-strong flex flex-col gap-1.5 rounded-xl border border-dashed p-5"
            >
              <span className={cn("text-micro font-mono", toneText[d.tone])}>{d.kind}</span>
              <span className="text-heading-sm font-semibold">{d.title}</span>
              <span className="text-body-sm text-muted">{d.body}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
