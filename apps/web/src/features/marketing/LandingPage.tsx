import { Link } from "@tanstack/react-router";
import { Button } from "@throughline/ui";
import { usePinnedTheme } from "@/theme";
import { MarketingNav } from "./MarketingNav";
import { Hero } from "./sections/Hero";
import { Journey } from "./sections/Journey";
import { Pillars } from "./sections/Pillars";
import { Pricing } from "./sections/Pricing";
import { Security } from "./sections/Security";
import { ToolStrip } from "./sections/ToolStrip";

export function LandingPage() {
  usePinnedTheme("dark");
  return (
    <div className="bg-grid min-h-screen overflow-x-hidden">
      <MarketingNav />
      <main>
        <Hero />
        <ToolStrip />
        <Pillars />
        <Journey />
        <Security />
        <Pricing />
        <section
          id="contact"
          className="flex scroll-mt-24 flex-col items-center gap-6 px-6 py-24 text-center"
        >
          <h2 className="font-display text-display-lg text-strong max-w-4xl text-balance">
            Bring one messy idea. <span className="text-agent">Watch it ship with proof.</span>
          </h2>
          <p className="text-body-lg text-subtle max-w-xl">
            A 30-day pilot with one team, on your tools, in your region.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">Start a 30-day pilot</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#pricing">Compare plans</a>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-line text-body-sm text-faint flex flex-wrap justify-between gap-4 border-t px-6 py-8 lg:px-12">
        <span>© 2026 Throughline</span>
        <div className="flex gap-6">
          <a href="#security" className="hover:text-strong">
            Trust
          </a>
          <a href="#pricing" className="hover:text-strong">
            Pricing
          </a>
          <Link to="/login" className="hover:text-strong">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
