import { Link } from "@tanstack/react-router";
import { Button } from "@throughline/ui";
import { useOptionalSession } from "@/auth/session";
import { Logo } from "@/components/shell/Logo";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#integrations", label: "Integrations" },
  { href: "#pricing", label: "Pricing" },
];

export function MarketingNav() {
  const session = useOptionalSession();
  return (
    <nav
      aria-label="Main"
      className="border-line bg-scrim sticky top-0 z-20 flex items-center justify-between gap-4 border-b px-6 py-4 backdrop-blur-md lg:px-12"
    >
      <Link to="/" aria-label="Throughline home">
        <Logo />
      </Link>
      <div className="text-body text-muted hidden items-center gap-7 md:flex">
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} className="hover:text-strong transition-colors">
            {l.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        {session ? (
          <Button asChild>
            <Link to="/workspaces">Open the app</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="secondary" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <a href="#contact">Book a demo</a>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
