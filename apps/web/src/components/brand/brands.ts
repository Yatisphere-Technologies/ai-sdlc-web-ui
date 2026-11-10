/**
 * Official logos of the products Throughline connects to, used unchanged (vendors forbid
 * recolouring or distorting their marks) on a neutral `bg-brand-tile`. Sources, checked Oct 2026:
 *  - Jira, Confluence: Atlassian Design System `@atlaskit/logo` (2025 tile icons)
 *  - GitHub: Primer Octicons `mark-github`
 *  - Slack: slack.com (brand mark served by Slack); see slack.com/media-kit
 *  - Microsoft Teams, Microsoft 365: Microsoft Fluent brand icons (res-1.cdn.office.net)
 *  - Microsoft sign-in: Microsoft identity platform branding guidelines (four-square symbol)
 *  - Azure DevOps (Boards, Test Plans), Microsoft Sentinel, Azure Monitor: Azure Public Service Icons V24
 *  - Google: Google sign-in "G" (Firebase UI, per Google's sign-in branding guidelines)
 *  - Argo CD: CNCF artwork repository
 *  - Salesforce: the cloud mark from salesforce.com
 *  - Xray, Zephyr: their Atlassian Marketplace listing logos (PNG; no public SVG)
 *  - Claude, Datadog, Okta, Splunk, PagerDuty, Figma, GitHub Actions, Google Cloud: Simple Icons
 *    (CC0 paths) in each brand's own colour
 * Logos are shown only to name the product being connected (nominative use). Add a brand by
 * dropping the vendor's file in ./logos and registering it below.
 */
const files = import.meta.glob<string>("./logos/*.{svg,png}", {
  query: "?url",
  import: "default",
  eager: true,
});
const url = (file: string) => files[`./logos/${file}`] ?? null;
/** Inlined copies for SVG exports, which must not depend on the app's asset URLs. */
const inlined = import.meta.glob<string>("./logos/*.{svg,png}", {
  query: "?inline",
  import: "default",
  eager: true,
});

export const BRANDS = {
  jira: { name: "Jira", file: "jira.svg" },
  confluence: { name: "Confluence", file: "confluence.svg" },
  github: { name: "GitHub", file: "github.svg" },
  "github-actions": { name: "GitHub Actions", file: "github-actions.svg" },
  claude: { name: "Claude", file: "claude.svg" },
  argo: { name: "Argo CD", file: "argo.svg" },
  datadog: { name: "Datadog", file: "datadog.svg" },
  slack: { name: "Slack", file: "slack.svg" },
  teams: { name: "Microsoft Teams", file: "teams.svg" },
  m365: { name: "Microsoft 365", file: "m365.svg" },
  microsoft: { name: "Microsoft", file: "microsoft.svg" },
  "azure-devops": { name: "Azure DevOps", file: "azure-devops.svg" },
  "azure-monitor": { name: "Azure Monitor", file: "azure-monitor.svg" },
  sentinel: { name: "Microsoft Sentinel", file: "sentinel.svg" },
  google: { name: "Google", file: "google.svg" },
  "google-cloud": { name: "Google Cloud", file: "google-cloud.svg" },
  okta: { name: "Okta", file: "okta.svg" },
  splunk: { name: "Splunk", file: "splunk.svg" },
  pagerduty: { name: "PagerDuty", file: "pagerduty.svg" },
  figma: { name: "Figma", file: "figma.svg" },
  xray: { name: "Xray", file: "xray.png" },
  zephyr: { name: "Zephyr", file: "zephyr.png" },
  salesforce: { name: "Salesforce", file: "salesforce.svg" },
} as const;
export type BrandId = keyof typeof BRANDS;

/** Other names the app uses for the same products: integration ids, MCP servers, IdPs, tools. */
const ALIASES: Record<string, BrandId> = {
  "azure-boards": "azure-devops",
  "azure-test-plans": "azure-devops",
  "azure-devops-mcp": "azure-devops",
  "azure-pipelines": "azure-devops",
  "azure-monitor-mcp": "azure-monitor",
  "jira-mcp": "jira",
  "confluence-mcp": "confluence",
  "github-mcp": "github",
  codeql: "github",
  "github-actions-mcp": "github-actions",
  "claude-code": "claude",
  "m365-files-mcp": "m365",
  "microsoft-365": "m365",
  entra: "microsoft",
  "microsoft-entra-id": "microsoft",
  "google-workspace": "google",
  "microsoft-sentinel": "sentinel",
  chronicle: "google-cloud",
  "google-secops": "google-cloud",
  "pagerduty-mcp": "pagerduty",
  "figma-mcp": "figma",
  "xray-api": "xray",
  "zephyr-scale": "zephyr",
  "argo-cd": "argo",
  "microsoft-teams": "teams",
};

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Resolves an id or display name ("azure-boards", "Microsoft Entra ID", "jira-mcp") to a brand. */
export function brandOf(idOrName: string | null | undefined): BrandId | null {
  if (!idOrName) return null;
  const k = key(idOrName);
  if (k in BRANDS) return k as BrandId;
  return ALIASES[k] ?? null;
}

export function brandUrl(id: BrandId) {
  return url(BRANDS[id].file);
}

export function brandDataUri(id: BrandId) {
  return inlined[`./logos/${BRANDS[id].file}`] ?? null;
}

/** Product names to look for inside free text, longest first so "Microsoft 365" beats "Microsoft". */
const EXTRA_NAMES: [string, BrandId][] = [
  ["exchange online", "m365"],
  ["outlook", "m365"],
  ["sharepoint", "m365"],
  ["entra", "microsoft"],
  ["argo", "argo"],
  ["xray", "xray"],
  ["zephyr", "zephyr"],
];
const NAMES: [string, BrandId][] = [
  ...(Object.entries(BRANDS) as [BrandId, { name: string }][]).map(([id, b]): [string, BrandId] => [
    b.name.toLowerCase(),
    id,
  ]),
  ...EXTRA_NAMES,
]
  .filter(([n]) => n !== "microsoft" && n !== "google")
  .sort((a, b) => b[0].length - a[0].length);

/** Finds a product named inside a label such as "CRM (Salesforce)" or "Email (Microsoft 365)". */
export function brandIn(text: string | null | undefined): BrandId | null {
  if (!text) return null;
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  for (const [name, id] of NAMES) if (t.includes(` ${name.replace(/[^a-z0-9]+/g, " ")} `)) return id;
  return null;
}
