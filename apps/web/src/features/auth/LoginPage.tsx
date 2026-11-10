import { Link, useNavigate } from "@tanstack/react-router";
import type { IdentityProvider } from "@throughline/contracts";
import { Badge, Button, Card, cn, Eyebrow, GateMark, StatusDot } from "@throughline/ui";
import { ArrowLeft, KeyRound, LockKeyhole, Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { config } from "@/app/config";
import { useSignIn } from "@/auth/session";
import { BrandLogo } from "@/components/brand";
import { Logo } from "@/components/shell/Logo";
import { usePinnedTheme } from "@/theme";

const PROVIDERS: { id: Exclude<IdentityProvider, "sso-email">; label: string; mono: string }[] = [
  { id: "entra", label: "Continue with Microsoft Entra ID", mono: "MS" },
  { id: "okta", label: "Continue with Okta", mono: "OK" },
  { id: "google", label: "Continue with Google Workspace", mono: "G" },
];

const STEPS = [
  { label: "Shape", gate: false },
  { label: "Spec", gate: true },
  { label: "Design", gate: false },
  { label: "Review", gate: true },
  { label: "Build", gate: false },
  { label: "Verify", gate: true },
  { label: "Release", gate: true },
];

export function LoginPage({ redirectTo }: { redirectTo: string }) {
  usePinnedTheme("dark");
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<IdentityProvider | null>(null);

  const go = (provider: IdentityProvider, workEmail?: string) => {
    setPending(provider);
    signIn.mutate(
      { provider, email: workEmail },
      { onSuccess: () => navigate({ href: redirectTo }), onSettled: () => setPending(null) },
    );
  };

  const onEmail = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim()) go("sso-email", email.trim());
  };

  return (
    <div className="bg-grid flex min-h-screen flex-col lg:flex-row">
      <aside className="bg-hero-wash border-line relative hidden flex-1 flex-col justify-between overflow-hidden border-r p-12 lg:flex">
        <Link to="/" className="text-body-sm text-muted hover:text-strong flex items-center gap-2">
          <ArrowLeft className="size-4" aria-hidden /> Back to home
        </Link>
        <div className="animate-rise flex max-w-xl flex-col gap-6">
          <Eyebrow className="text-agent-fg">The journey you're about to enter</Eyebrow>
          <h2 className="font-display text-display-lg text-strong">
            Agents do the work. <span className="text-gate">People decide.</span>
          </h2>
          <ol className="flex flex-wrap items-center gap-3">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                className="animate-rise border-line-strong bg-surface text-body-sm flex items-center gap-2 rounded-xs border px-3 py-1.5"
                style={{ animationDelay: `${0.2 + i * 0.08}s` }}
              >
                {s.gate ? <GateMark size="sm" /> : <StatusDot live />}
                {s.label}
              </li>
            ))}
          </ol>
          <p className="text-body-lg text-subtle">
            Every gate shows who decided, when, and on what evidence. Each workspace is sealed off from every
            other.
          </p>
        </div>
        <span className="text-micro text-faint font-mono">THROUGHLINE</span>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <Card padding="lg" className="animate-rise shadow-lift flex w-full max-w-md flex-col gap-6">
          <div className="flex items-center justify-between">
            <Logo />
            {config.useMocks ? <Badge mono>Demo sign-in</Badge> : null}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-heading-lg text-strong">Sign in</h1>
            <p className="text-body text-muted">Use your organisation's identity provider.</p>
          </div>

          <div className="flex flex-col gap-2.5">
            {PROVIDERS.map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                size="lg"
                className="justify-start"
                disabled={pending !== null}
                onClick={() => go(p.id)}
              >
                <BrandLogo brand={p.id} fallback={p.mono} />
                <span className="flex-1 text-left">{pending === p.id ? "Signing in…" : p.label}</span>
              </Button>
            ))}
          </div>

          <div className="text-caption text-faint flex items-center gap-3">
            <span className="bg-line h-px flex-1" /> or use your work email{" "}
            <span className="bg-line h-px flex-1" />
          </div>

          <form onSubmit={onEmail} className="flex flex-col gap-2.5">
            <label htmlFor="work-email" className="text-body-sm text-subtle">
              Work email
            </label>
            <div className="border-line-strong bg-surface-raised focus-within:border-agent flex h-12 items-center gap-2 rounded-md border px-3">
              <Mail className="text-muted size-4" aria-hidden />
              <input
                id="work-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-body text-foreground placeholder:text-faint h-full min-w-0 flex-1 bg-transparent outline-none"
              />
            </div>
            <Button type="submit" size="lg" disabled={pending !== null || !email.trim()}>
              {pending === "sso-email" ? "Finding your company…" : "Continue with SSO"}
            </Button>
          </form>

          {signIn.isError ? <p className="text-caption text-risk-fg">{signIn.error.message}</p> : null}

          <ul className="border-line text-caption text-muted flex flex-col gap-2 border-t pt-5">
            <li className="flex gap-2">
              <LockKeyhole className={cn("text-agent size-4 shrink-0")} aria-hidden />
              We never see your password. Your identity provider decides who gets in.
            </li>
            <li className="flex gap-2">
              <KeyRound className="text-agent size-4 shrink-0" aria-hidden />
              Sessions use secure cookies. No tokens are stored in your browser.
            </li>
          </ul>
        </Card>
      </main>
    </div>
  );
}
