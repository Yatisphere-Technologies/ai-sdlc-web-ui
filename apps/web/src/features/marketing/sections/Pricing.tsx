import { Link } from "@tanstack/react-router";
import { Badge, Button, Card, SegmentedControl } from "@throughline/ui";
import { Check } from "lucide-react";
import { useState } from "react";
import { PLANS } from "../content";

type Billing = "monthly" | "annual";

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("annual");
  return (
    <section
      id="pricing"
      className="mx-auto flex max-w-7xl scroll-mt-24 flex-col items-center gap-8 px-6 py-16 lg:px-12"
    >
      <h2 className="font-display text-display-lg text-strong text-center">
        Pay for outcomes, not idle seats.
      </h2>
      <SegmentedControl<Billing>
        label="Billing period"
        value={billing}
        onValueChange={setBilling}
        options={[
          { value: "monthly", label: "Monthly" },
          { value: "annual", label: "Annual · save 20%" },
        ]}
      />
      <div className="grid w-full gap-5 md:grid-cols-3">
        {PLANS.map((p) => {
          const price = billing === "annual" ? p.annual : p.monthly;
          return (
            <Card
              key={p.name}
              padding="lg"
              tone={p.popular ? "agent" : "default"}
              interactive
              className="flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-heading-md text-strong">{p.name}</h3>
                {p.popular ? <Badge tone="agent">Most teams</Badge> : null}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-display-md text-strong">
                  {price === null ? "Custom" : `$${price}`}
                </span>
                {price === null ? null : <span className="text-body-sm text-muted">per builder / month</span>}
              </div>
              <p className="text-body text-subtle">{p.who}</p>
              <ul className="border-line flex flex-col gap-2.5 border-t pt-4">
                {p.features.map((f) => (
                  <li key={f} className="text-body flex items-center gap-2.5">
                    <Check className="text-agent size-4" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" variant={p.popular ? "primary" : "secondary"} className="mt-auto">
                {p.name === "Enterprise" ? <a href="#contact">{p.cta}</a> : <Link to="/login">{p.cta}</Link>}
              </Button>
            </Card>
          );
        })}
      </div>
      <p className="text-caption text-faint">
        Placeholder pricing for design review. Agent usage is billed at cost with hard budgets per team.
      </p>
    </section>
  );
}
