import {
  type AskAnswer,
  type AssistantAction,
  type AssistantSource,
  HEALTH_LABEL,
  type PageContext,
  PHASE_LABEL,
  type ProjectSummary,
} from "@throughline/contracts";
import { answer } from "../moduleHandlers";
import { portfolio } from "../projects";
import { findingsFor } from "../security/findings";
import type { TenantSeed } from "../seed/types";

export type Reply = {
  text: string;
  speech: string;
  sources: AssistantSource[];
  actions: AssistantAction[];
  followUps: string[];
};

/** Places you can ask to open, by the words people use for them. */
const PLACES: [RegExp, string, string][] = [
  [/control room|home|dashboard/, "/", "Control room"],
  [/approvals?|sign-?offs?|inbox|waiting on me/, "/approvals", "Approvals"],
  [/programs?|projects? list|all projects|portfolio/, "/projects", "Programs & projects"],
  [/specs?|g1/, "/brd?view=specs", "Specs"],
  [/\bbrds?\b|requirements/, "/brd", "BRDs"],
  [/design options?/, "/architecture?view=options", "Design options"],
  [/architecture|diagram/, "/architecture", "Architecture"],
  [/review|g2/, "/review", "Review"],
  [/test plans?|testing|test cases?/, "/testing", "Test plan"],
  [/verify|g3|evidence/, "/delivery?tab=verify", "Verify"],
  [/release|rollout|g4/, "/delivery?tab=release", "Release"],
  [/build|agents coding|delivery/, "/delivery", "Delivery"],
  [/incidents?|operate/, "/operate", "Operate"],
  [/insights|metrics/, "/insights", "Insights"],
  [/members|roles|people/, "/settings/members", "Members and roles"],
  [/audit/, "/settings/audit", "Audit log"],
  [/security|posture/, "/settings/security", "Security and data"],
  [/integrations?|jira|github|slack/, "/settings/integrations", "Integrations"],
];

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(n);

function findProject(projects: ProjectSummary[], q: string, ctx: PageContext | null) {
  const byKey = projects.find((p) => new RegExp(`\\b${p.key.toLowerCase()}\\b`).test(q));
  if (byKey) return byKey;
  const byName = projects.find((p) => q.includes(p.name.toLowerCase()));
  if (byName) return byName;
  const workspaceWide = /\b(all|every|which|plans|projects|workspace)\b/.test(q);
  if (
    ctx?.projectId &&
    !workspaceWide &&
    /\b(this|it|here|current)\b|project|status|summar|risk|next|plan|on track|test/.test(q)
  )
    return projects.find((p) => p.id === ctx.projectId) ?? null;
  return null;
}

function projectReply(store: TenantSeed, p: ProjectSummary): Reply {
  const plan = store.testPlans.find((t) => t.projectId === p.id);
  const arch = store.architectures.find((a) => a.architecture.projectId === p.id)?.architecture;
  const brds = store.brds.filter((r) => r.brd.projectId === p.id).map((r) => r.brd);
  const lines = [
    `**${p.key} · ${p.name}** is **${HEALTH_LABEL[p.health].toLowerCase()}**, ${p.progress}% done, in ${PHASE_LABEL[p.phase].toLowerCase()}.`,
    "",
    p.health !== "on-track" ? `- Why: ${p.healthNote}` : null,
    `- Target ${p.targetDate} · spent ${money(p.spentUsd)} of ${money(p.budgetUsd)}`,
    `- ${p.counts.workItems} work items, ${p.counts.artifacts} artifacts, ${p.counts.openGates} open gate${p.counts.openGates === 1 ? "" : "s"}`,
    p.counts.staleLinks ? `- ${p.counts.staleLinks} artifact link(s) out of date` : null,
    brds.length ? `- BRDs: ${brds.map((b) => `${b.id} (${b.status}, v${b.version})`).join(", ")}` : null,
    plan
      ? `- Test plan v${plan.version} is ${plan.status}: ${plan.coverage.executed}% executed${plan.coverage.passRate === null ? "" : `, ${plan.coverage.passRate}% passing`}`
      : null,
    p.dependsOn.length ? `- Depends on ${p.dependsOn.join(", ")}` : null,
  ].filter((x): x is string => x !== null);
  const actions: AssistantAction[] = [{ label: `Open ${p.key}`, to: `/projects/${p.key}` }];
  if (plan) actions.push({ label: "Test plan", to: `/testing?plan=${plan.id}` });
  if (arch) actions.push({ label: "Architecture", to: `/architecture?arch=${arch.id}` });
  actions.push({ label: "Project plan", to: `/projects/${p.key}?tab=plan` });
  return {
    text: lines.join("\n"),
    speech: `${p.name} is ${HEALTH_LABEL[p.health].toLowerCase()} and ${p.progress} percent done.${p.health !== "on-track" ? ` ${p.healthNote}` : ""}`,
    sources: [
      { label: "Project plan", tool: "Throughline" },
      ...(store.projects.find((x) => x.id === p.id)?.tools.jira ? [{ label: "Issues", tool: "Jira" }] : []),
    ],
    actions,
    followUps: [`What's blocking ${p.key}?`, `Show the test plan for ${p.key}`, "What's waiting on me?"],
  };
}

function fromAsk(a: AskAnswer): Reply {
  const sources = [...new Set(a.rows.map((r) => r.source))].map((tool) => ({ label: tool, tool }));
  const text = [
    `**${a.headline}**`,
    "",
    ...a.rows.map((r) => `- ${r.text} · ${r.sub}`),
    "",
    `_${a.asOf}_`,
  ].join("\n");
  return { text, speech: a.headline, sources, actions: [], followUps: a.actions.slice(0, 2) };
}

/**
 * The assistant stand-in: deterministic, answers from this workspace's data only, and uses the
 * page context for "this project". A real model must keep the same contract (Reply).
 */
export function respond(store: TenantSeed, question: string, ctx: PageContext | null): Reply {
  const q = question.toLowerCase().trim();
  const { projects } = portfolio(store);

  if (/^(hi|hello|hey|good (morning|afternoon|evening))\b|what can you do|^help\b/.test(q)) {
    return {
      text: [
        "I can answer from this workspace's live data and take you to things. Try:",
        "",
        "- **Status:** “How is UPI doing?” or “Summarise this project”",
        "- **Your queue:** “What's waiting on me?”",
        "- **Quality:** “How are the test plans looking?”",
        "- **Security:** “What should I fix in security?”",
        "- **Navigate:** “Open the architecture for MCP”",
        "",
        "You can type, dictate with the mic, or talk hands-free.",
      ].join("\n"),
      speech:
        "I can answer from this workspace's data and open things for you. Ask about a project, your approvals, test plans or security.",
      sources: [],
      actions: [],
      followUps: ["What's waiting on me?", "Which projects are at risk?"],
    };
  }

  // "Open / go to / show me …"
  const nav = /^(open|go to|take me to|show me|navigate to)\b/.test(q);
  const project = findProject(projects, q, ctx);
  const brd = q.match(/\bbrd-\d+\b/i)?.[0]?.toUpperCase();
  if (nav || brd) {
    if (brd && store.brds.some((r) => r.brd.id === brd))
      return {
        text: `Opening **${brd}** in BRD Studio.`,
        speech: `Opening ${brd}.`,
        sources: [],
        actions: [{ label: `Open ${brd}`, to: `/brd/${brd}` }],
        followUps: [],
      };
    if (project && /test/.test(q)) {
      const plan = store.testPlans.find((t) => t.projectId === project.id);
      if (plan)
        return {
          text: `Here's the **${project.key}** test plan: ${plan.cases.length} cases, ${plan.status}.`,
          speech: `Opening the ${project.name} test plan.`,
          sources: [],
          actions: [{ label: "Open test plan", to: `/testing?plan=${plan.id}` }],
          followUps: [],
        };
    }
    if (project && /architect|diagram/.test(q)) {
      const arch = store.architectures.find((a) => a.architecture.projectId === project.id)?.architecture;
      if (arch)
        return {
          text: `Here's the architecture for **${project.key}**: ${arch.title}, revision ${arch.revision}.`,
          speech: `Opening the ${project.name} architecture.`,
          sources: [],
          actions: [{ label: "Open architecture", to: `/architecture?arch=${arch.id}` }],
          followUps: [],
        };
    }
    if (project && !PLACES.some(([re]) => re.test(q.replace(project.key.toLowerCase(), ""))))
      return {
        text: `Opening **${project.key} · ${project.name}**.`,
        speech: `Opening ${project.name}.`,
        sources: [],
        actions: [{ label: `Open ${project.key}`, to: `/projects/${project.key}` }],
        followUps: [],
      };
    const place = PLACES.find(([re]) => re.test(q));
    if (place)
      return {
        text: `Opening **${place[2]}**.`,
        speech: `Opening ${place[2]}.`,
        sources: [],
        actions: [{ label: `Open ${place[2]}`, to: place[1] }],
        followUps: [],
      };
  }

  if (/at risk|off track|behind|red\b|in trouble/.test(q) && !project) {
    const bad = projects.filter((p) => p.health !== "on-track");
    return {
      text: bad.length
        ? [
            `**${bad.length} of ${projects.length} projects need attention.**`,
            "",
            ...bad.map((p) => `- **${p.key}** ${p.name} · ${HEALTH_LABEL[p.health]} · ${p.healthNote}`),
          ].join("\n")
        : `All ${projects.length} projects are on track.`,
      speech: bad.length
        ? `${bad.length} projects need attention: ${bad.map((p) => p.name).join(", ")}.`
        : "All projects are on track.",
      sources: [{ label: "Project plans", tool: "Throughline" }],
      actions: bad.slice(0, 3).map((p) => ({ label: `Open ${p.key}`, to: `/projects/${p.key}` })),
      followUps: bad[0] ? [`What's blocking ${bad[0].key}?`] : [],
    };
  }

  if (project && !/waiting on me|my approvals/.test(q)) {
    if (/test|quality|coverage/.test(q)) {
      const plan = store.testPlans.find((t) => t.projectId === project.id);
      if (plan) {
        const unmet = plan.exit.filter((e) => e.met === false);
        return {
          text: [
            `**${project.key} test plan** v${plan.version} is ${plan.status}: ${plan.cases.length} cases, ${plan.coverage.automation}% automated, ${plan.coverage.executed}% executed.`,
            "",
            unmet.length
              ? `Not ready to release yet: ${unmet.map((e) => `${e.id} ${e.criterion} (${e.actual ?? "—"} vs ${e.target})`).join("; ")}.`
              : plan.runs.length
                ? "All exit criteria are met."
                : "No CI results yet.",
          ].join("\n"),
          speech: `${project.name} has ${plan.cases.length} test cases, ${plan.coverage.executed} percent executed. ${unmet.length ? `${unmet.length} exit criteria are not met yet.` : ""}`,
          sources: [
            { label: "Test plan", tool: plan.target === "azure-test-plans" ? "Azure Test Plans" : "Jira" },
          ],
          actions: [{ label: "Open test plan", to: `/testing?plan=${plan.id}` }],
          followUps: [`How is ${project.key} doing overall?`],
        };
      }
    }
    return projectReply(store, project);
  }

  if (/test plans?|quality|coverage/.test(q)) {
    const rows = store.testPlans.map((t) => {
      const p = projects.find((x) => x.id === t.projectId);
      return `- **${p?.key ?? t.projectId}** v${t.version} ${t.status} · ${t.cases.length} cases · ${t.coverage.executed}% run${t.coverage.passRate === null ? "" : ` · ${t.coverage.passRate}% pass`}`;
    });
    const stale = store.testPlans.filter((t) => t.status === "stale").length;
    return {
      text: [
        `**${store.testPlans.length} test plans** across the workspace${stale ? `, ${stale} out of date` : ""}.`,
        "",
        ...rows,
      ].join("\n"),
      speech: `There are ${store.testPlans.length} test plans${stale ? `, and ${stale} are out of date` : ""}.`,
      sources: [{ label: "Test plans", tool: "Throughline" }],
      actions: [{ label: "Open test plans", to: "/testing" }],
      followUps: [],
    };
  }

  if (/security|posture|findings|mfa|fix/.test(q)) {
    const f = findingsFor(store);
    return {
      text: f.length
        ? [
            `**${f.length} things to fix in security:**`,
            "",
            ...f.slice(0, 6).map((x) => `- ${x.severity.toUpperCase()} · ${x.title} · ${x.detail}`),
          ].join("\n")
        : "Nothing to fix in security right now.",
      speech: f.length
        ? `There are ${f.length} security findings. The top one: ${f[0]?.title}.`
        : "Nothing to fix in security right now.",
      sources: [{ label: "Security posture", tool: "Throughline" }],
      actions: [{ label: "Open security", to: "/settings/security" }],
      followUps: [],
    };
  }

  return fromAsk(answer(store, question));
}

/** Short title for a new conversation from its first message. */
export function titleOf(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 45).trimEnd()}…` : t;
}
