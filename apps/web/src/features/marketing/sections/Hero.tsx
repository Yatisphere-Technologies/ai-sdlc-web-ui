import { Link } from "@tanstack/react-router";
import { Button, cn, GateMark, StatusDot } from "@throughline/ui";
import { HERO_CURVE, HERO_STAGES } from "../content";

const ORBITS = [
  { delay: "0s", tone: "text-agent" },
  { delay: "-2.3s", tone: "text-ion" },
  { delay: "-4.6s", tone: "text-agent" },
];

function FloatingCard({
  className,
  tone,
  label,
  text,
  delay,
}: {
  className: string;
  tone: "agent" | "gate" | "ok";
  label: string;
  text: string;
  delay: string;
}) {
  return (
    <div
      className={cn(
        "float absolute flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left",
        tone === "agent" && "border-agent-line bg-agent-wash",
        tone === "gate" && "border-gate-line bg-gate-wash",
        tone === "ok" && "border-ok-line bg-ok-wash",
        className,
      )}
      style={{ animationDelay: delay }}
    >
      <span
        className={cn(
          "text-nano font-mono",
          tone === "agent" && "text-agent-fg",
          tone === "gate" && "text-gate",
          tone === "ok" && "text-ok",
        )}
      >
        {label}
      </span>
      <span className="text-body-sm text-foreground">{text}</span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex flex-col items-center gap-7 overflow-hidden px-6 pt-24 pb-16 text-center lg:px-12">
      <div
        aria-hidden
        className="bg-agent pointer-events-none absolute -top-32 left-1/12 size-128 rounded-full opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="bg-ion pointer-events-none absolute top-0 right-1/12 size-104 rounded-full opacity-20 blur-3xl"
      />

      <span className="animate-rise border-agent-line bg-agent-wash text-agent-fg text-micro relative inline-flex items-center gap-2.5 rounded-xs border px-3.5 py-2 font-mono">
        <StatusDot live /> AI-NATIVE SOFTWARE DELIVERY · BY LATENTBRIDGE
      </span>
      <h1
        className="animate-rise font-display text-display-lg text-strong md:text-display-xl relative max-w-5xl text-balance"
        style={{ animationDelay: "0.1s" }}
      >
        From a rough idea to running software. <span className="text-agent">Governed end to end.</span>
      </h1>
      <p
        className="animate-rise text-body-lg text-subtle relative max-w-2xl"
        style={{ animationDelay: "0.2s" }}
      >
        Agents shape, specify, build, test and operate. Your people make every decision that matters. Every
        change carries proof, inside the tools your teams already use.
      </p>
      <div
        className="animate-rise relative flex flex-wrap justify-center gap-3"
        style={{ animationDelay: "0.3s" }}
      >
        <Button asChild size="lg">
          <Link to="/login">Start your pilot</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <a href="#how">See the journey →</a>
        </Button>
      </div>

      <div
        className="animate-rise border-line bg-surface/80 shadow-lift relative mt-8 hidden w-full max-w-5xl rounded-2xl border p-7 lg:block"
        style={{ animationDelay: "0.45s" }}
      >
        <div className="relative mx-auto h-80 w-240">
          <svg viewBox="0 0 960 320" className="absolute inset-0 h-80 w-240" aria-hidden>
            <path d={HERO_CURVE} fill="none" className="stroke-line" strokeWidth="2" />
            <path d={HERO_CURVE} fill="none" className="flow-dash stroke-agent-line" strokeWidth="2" />
          </svg>
          {ORBITS.map((o) => (
            <span
              key={o.delay}
              aria-hidden
              className={cn("orbit", o.tone)}
              style={{ offsetPath: `path("${HERO_CURVE}")`, animationDelay: o.delay }}
            />
          ))}
          {HERO_STAGES.map((s) => (
            <div
              key={s.label}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
            >
              {s.gate ? (
                <GateMark size="lg" />
              ) : (
                <span className="border-agent bg-background size-4 rounded-full border-2" />
              )}
              <span className={cn("text-nano font-mono", s.gate ? "text-gate" : "text-agent-fg")}>
                {s.label}
              </span>
            </div>
          ))}
          <FloatingCard
            className="bottom-2 left-6"
            tone="agent"
            label="builder-1 · sonnet"
            text="16 tests passing · PR 418 opened"
            delay="0s"
          />
          <FloatingCard
            className="top-2 left-5/12"
            tone="gate"
            label="G1 · waiting on Priya"
            text="Approve spec: UPI AutoPay cancel"
            delay="-2s"
          />
          <FloatingCard
            className="top-4 right-2"
            tone="ok"
            label="release · 100%"
            text="Signed · SBOM · 0 rollbacks"
            delay="-3.5s"
          />
        </div>
      </div>
    </section>
  );
}
