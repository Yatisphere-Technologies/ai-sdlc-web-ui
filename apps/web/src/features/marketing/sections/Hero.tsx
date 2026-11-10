import { Link } from "@tanstack/react-router";
import { Button, StatusDot } from "@throughline/ui";
import { DeliveryBoard } from "../board/DeliveryBoard";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 lg:px-12 lg:pt-20">
      <div className="mx-auto grid max-w-400 items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-16">
        <div className="flex min-w-0 flex-col items-start gap-7">
          <span className="animate-rise border-agent-line bg-agent-wash text-agent-fg text-micro inline-flex items-center gap-2.5 rounded-xs border px-3.5 py-2 font-mono">
            <StatusDot live /> AI-NATIVE SOFTWARE DELIVERY
          </span>
          <h1
            className="animate-rise font-display text-display-lg text-strong 2xl:text-display-xl text-balance"
            style={{ animationDelay: "0.1s" }}
          >
            From a rough idea to running software. <span className="text-agent">Governed end to end.</span>
          </h1>
          <p className="animate-rise text-body-lg text-subtle max-w-xl" style={{ animationDelay: "0.2s" }}>
            Agents shape, specify, build, test and operate. Your people make every decision that matters.
            Every change carries proof, inside the tools your teams already use.
          </p>
          <div className="animate-rise flex flex-wrap gap-3" style={{ animationDelay: "0.3s" }}>
            <Button asChild size="lg">
              <Link to="/login">Start your pilot</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#how">See the journey →</a>
            </Button>
          </div>
        </div>
        <DeliveryBoard className="animate-rise hidden h-auto w-full md:block" />
      </div>
    </section>
  );
}
