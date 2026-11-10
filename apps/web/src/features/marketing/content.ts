import type { LucideIcon } from "lucide-react";
import {
  Eye,
  FileCheck2,
  Fingerprint,
  Globe2,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Workflow,
} from "lucide-react";

// Marketing copy in one place so it can move to a CMS later without touching components.

export const HERO_STAGES = [
  // Points sampled on HERO_CURVE (percent of the 960×320 box) so markers sit exactly on the line.
  { label: "SHAPE · G0", x: 4.2, y: 50, gate: true },
  { label: "SPEC · G1", x: 14.8, y: 28.9, gate: true },
  { label: "DESIGN", x: 27.1, y: 21.9, gate: false },
  { label: "REVIEW · G2", x: 39.3, y: 28.9, gate: true },
  { label: "BUILD", x: 50, y: 50, gate: false },
  { label: "VERIFY · G3", x: 63, y: 73.6, gate: true },
  { label: "RELEASE · G4", x: 77.9, y: 77, gate: true },
  { label: "OPERATE", x: 89.3, y: 65.1, gate: false },
  { label: "LEARN", x: 95.8, y: 50, gate: false },
] as const;

export const HERO_CURVE = "M 40 160 C 160 40, 360 40, 480 160 S 800 280, 920 160";

/** Tools on the landing strip; each has its official logo in components/brand. */
export const TOOLS = [
  "jira",
  "github",
  "azure-devops",
  "confluence",
  "slack",
  "teams",
  "datadog",
  "argo",
  "pagerduty",
  "figma",
  "okta",
  "salesforce",
] as const;

export const PILLARS = [
  {
    n: "01",
    tone: "agent",
    title: "Turn rough input into clear decisions",
    body: "Drop notes, emails and call recordings. Agents separate facts from guesses and ask only the questions that change the answer.",
  },
  {
    n: "02",
    tone: "gate",
    title: "Agents do the work. People decide.",
    body: "Gates at shape, spec, architecture and security review, change and release. Strictness follows risk, so small changes fly and risky ones need two people.",
  },
  {
    n: "03",
    tone: "ion",
    title: "Proof for every change",
    body: "Every line traces back to a requirement and every decision is signed. Status questions are answered live from your own tools.",
  },
] as const;

export const JOURNEY = [
  {
    step: "Shape",
    who: "agent",
    text: "Rough input becomes tagged facts, three questions and three options.",
    gate: "G0",
  },
  {
    step: "BRD",
    who: "agent",
    text: "A full business requirements document, quality-checked, signed by sponsor, product and compliance, then broken into a traced backlog in Jira or Azure Boards.",
    gate: "Sign-off",
  },
  {
    step: "Specify",
    who: "agent",
    text: "Requirements and acceptance checks drafted from the decision.",
    gate: "G1",
  },
  {
    step: "Design",
    who: "agent",
    text: "Three options compared on latency, cost, complexity and risk.",
    gate: null,
  },
  {
    step: "Review",
    who: "agent",
    text: "Architecture, threat model, security, NFR, privacy and compliance pack, signed by two people.",
    gate: "G2",
  },
  {
    step: "Build",
    who: "agent",
    text: "Agents code in parallel; every line tagged to a requirement.",
    gate: null,
  },
  {
    step: "Verify",
    who: "agent",
    text: "Tests, security scans and spec checks, signed by two keys.",
    gate: "G3",
  },
  {
    step: "Release",
    who: "agent",
    text: "Progressive rollout where live health decides each step.",
    gate: "G4",
  },
  {
    step: "Operate",
    who: "agent",
    text: "The SRE agent finds the cause; on-call approves the fix.",
    gate: null,
  },
  {
    step: "Learn",
    who: "agent",
    text: "Incidents become tests and team rules, so it never recurs.",
    gate: null,
  },
] as const;

export const SECURITY: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: "Tenant isolation",
    body: "Separate data, encryption keys and agent sandboxes for every customer.",
  },
  {
    icon: Fingerprint,
    title: "SSO, SCIM and MFA",
    body: "Entra ID, Okta or any SAML/OIDC provider. Users sync automatically.",
  },
  {
    icon: KeyRound,
    title: "Bring your own key",
    body: "Encrypt with keys in your Azure Key Vault or AWS KMS. Revoke any time.",
  },
  {
    icon: Globe2,
    title: "Data residency",
    body: "Choose where data and model calls live: India, UAE, EU or US.",
  },
  {
    icon: Eye,
    title: "Model governance",
    body: "Approve which models may see which data classes. No training on your data.",
  },
  {
    icon: Workflow,
    title: "Least-privilege agents",
    body: "Each agent has its own identity, tool allowlist and spend cap.",
  },
  {
    icon: ScrollText,
    title: "Signed audit trail",
    body: "Append-only and tamper-evident, streamed to your SIEM.",
  },
  {
    icon: FileCheck2,
    title: "Secrets stay secret",
    body: "PII and secrets are redacted before any prompt leaves your tenant.",
  },
];

export const DEPLOYMENTS = [
  { kind: "CLOUD", tone: "agent", title: "Isolated tenant", body: "Fastest start. Your region, your keys." },
  { kind: "DEDICATED", tone: "ion", title: "Single-tenant cloud", body: "Your own stack, managed by us." },
  { kind: "YOUR CLOUD", tone: "gate", title: "Inside your VPC", body: "For the strictest data rules." },
] as const;

export const PLANS = [
  {
    name: "Team",
    monthly: 49,
    annual: 39,
    who: "One product team getting started.",
    features: [
      "Shape, Spec and Build",
      "GitHub, Jira, Slack",
      "Shared cloud tenant",
      "Standard SSO",
      "90-day audit log",
    ],
    cta: "Start pilot",
    popular: false,
  },
  {
    name: "Business",
    monthly: 99,
    annual: 79,
    who: "Several teams, the full lifecycle.",
    features: [
      "All 10 stages, 6 sign-offs and review packs",
      "All connectors and MCP gateway",
      "Isolated tenant in your region",
      "SSO, SCIM and custom roles",
      "Policy as code, 1-year audit",
    ],
    cta: "Start pilot",
    popular: true,
  },
  {
    name: "Enterprise",
    monthly: null,
    annual: null,
    who: "Regulated firms and large estates.",
    features: [
      "Dedicated or in your cloud",
      "Your own encryption keys",
      "Model and data residency rules",
      "Audit stream to your SIEM",
      "Legacy modernisation mode",
    ],
    cta: "Talk to us",
    popular: false,
  },
] as const;
