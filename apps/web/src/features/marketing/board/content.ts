import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Box,
  Container,
  Database,
  FileCheck,
  FlaskConical,
  Hammer,
  KeyRound,
  Layers,
  Lock,
  Package,
  Plug,
  Radio,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

// Example content for the landing hero's delivery board (one work item, BRD to release).
// Coordinates are in the board's own viewBox (BOARD_VIEWBOX).

export type Tone = "ion" | "agent" | "ok" | "gate" | "muted" | "code" | "faint";
/** A run of text in one colour; a line is a list of runs. */
export type Run = readonly [text: string, tone: Tone];

export const BOARD_VIEWBOX = "-12 -12 944 644";

export const TILES = {
  brd: { x: 0, y: 0, w: 250, h: 270 },
  backlog: { x: 310, y: 0, w: 250, h: 270 },
  arch: { x: 620, y: 0, w: 300, h: 270 },
  pr: { x: 520, y: 340, w: 400, h: 280 },
  pipeline: { x: 250, y: 340, w: 210, h: 280 },
  release: { x: 0, y: 340, w: 200, h: 280 },
} as const;

/** Hand-offs between tiles; a gate marks a human sign-off on the way. */
export const WIRES: { id: string; points: [number, number][]; gate?: string }[] = [
  {
    id: "w1",
    points: [
      [250, 135],
      [310, 135],
    ],
    gate: "SIGN-OFF",
  },
  {
    id: "w2",
    points: [
      [560, 135],
      [620, 135],
    ],
    gate: "G1",
  },
  {
    id: "w3",
    points: [
      [770, 270],
      [770, 340],
    ],
    gate: "G2 REVIEW",
  },
  {
    id: "w4",
    points: [
      [520, 480],
      [460, 480],
    ],
  },
  {
    id: "w5",
    points: [
      [250, 480],
      [200, 480],
    ],
    gate: "G3",
  },
];

/** Where the reviewer's cursor starts, off to the right of the release tile. */
export const HAND_START = { x: 420, y: 660 } as const;

export const BRD_REQUIREMENTS: Run[][] = [
  [
    ["BR-01 ", "ion"],
    ["MUST   ", "gate"],
    ["Classify inbound intent", "code"],
  ],
  [
    ["BR-02 ", "ion"],
    ["MUST   ", "gate"],
    ["Redact PII before storage", "code"],
  ],
  [
    ["BR-03 ", "ion"],
    ["SHOULD ", "muted"],
    ["Route to the right queue", "code"],
  ],
  [
    ["BR-07 ", "ion"],
    ["MUST   ", "gate"],
    ["High risk goes to a human", "code"],
  ],
];
export const BRD_NFRS: Run[][] = [
  [
    ["NFR-04 ", "ion"],
    ["p95 latency < 2 s", "code"],
  ],
  [
    ["NFR-05 ", "ion"],
    ["EU data residency", "code"],
  ],
];

export type BacklogType = "epic" | "feature" | "story" | "spike";
export const BACKLOG_TYPE: Record<BacklogType, { icon: LucideIcon; tone: Tone }> = {
  epic: { icon: Layers, tone: "ion" },
  feature: { icon: Box, tone: "agent" },
  story: { icon: BookOpen, tone: "ok" },
  spike: { icon: FlaskConical, tone: "gate" },
};
export const BACKLOG: { level: 0 | 1 | 2; key: string; title: string; points?: number; type: BacklogType }[] =
  [
    { level: 0, key: "EP-7", title: "Agentic email triage", type: "epic" },
    { level: 1, key: "FT-21", title: "Intent classification", type: "feature" },
    { level: 2, key: "INT-41", title: "Classify refund intent", points: 5, type: "story" },
    { level: 2, key: "INT-42", title: "Redact PII in replies", points: 3, type: "story" },
    { level: 1, key: "FT-22", title: "Human hand-off", type: "feature" },
    { level: 2, key: "INT-43", title: "Route high risk to G2", points: 8, type: "story" },
    { level: 2, key: "INT-44", title: "Audit every decision", points: 3, type: "story" },
    { level: 2, key: "SPK-3", title: "Spike: model eval set", points: 2, type: "spike" },
  ];

export const ARCH_NODES: { x: number; y: number; label: string; icon: LucideIcon; agent?: boolean }[] = [
  { x: 52, y: 46, label: "API gateway", icon: Waypoints },
  { x: 154, y: 46, label: "Triage service", icon: Bot, agent: true },
  { x: 52, y: 112, label: "Identity · OIDC", icon: KeyRound },
  { x: 154, y: 112, label: "Event bus", icon: Radio },
  { x: 52, y: 178, label: "Secrets vault", icon: Lock },
  { x: 154, y: 178, label: "PostgreSQL", icon: Database },
];
export const ARCH_EDGES: [number, number][][] = [
  [
    [146, 63],
    [154, 63],
  ],
  [
    [99, 80],
    [99, 112],
  ],
  [
    [201, 80],
    [201, 112],
  ],
  [
    [248, 63],
    [254, 63],
    [254, 195],
    [248, 195],
  ],
  [
    [146, 63],
    [150, 63],
    [150, 195],
    [146, 195],
  ],
];

export const CODE: Run[][] = [
  [["// INT-43 · BR-07: high-risk email goes to a person", "faint"]],
  [
    ["export async function ", "ion"],
    ["triage", "agent"],
    ["(msg: InboundEmail) {", "code"],
  ],
  [
    ["  const ", "ion"],
    ["intent = ", "code"],
    ["await ", "ion"],
    ["classifier.run(msg, { redact: PII });", "code"],
  ],
  [
    ["  if ", "ion"],
    ["(intent.risk >= Risk.High) {", "code"],
  ],
  [
    ["    return ", "ion"],
    ["gates.request(", "code"],
    ['"G2"', "gate"],
    [", intent.trace);", "code"],
  ],
  [["  }", "code"]],
  [
    ["  return ", "ion"],
    ["bus.publish(", "code"],
    ['"support.triaged"', "gate"],
    [", intent);", "code"],
  ],
  [["}", "code"]],
];

export const PIPELINE: { icon: LucideIcon; name: string; result: string }[] = [
  { icon: Hammer, name: "Build", result: "2m 14s" },
  { icon: FlaskConical, name: "Unit", result: "1,284 ✓" },
  { icon: Plug, name: "Integration", result: "212 ✓" },
  { icon: FileCheck, name: "Contract", result: "38 ✓" },
  { icon: ShieldCheck, name: "SAST · SCA", result: "0 high" },
  { icon: Container, name: "Image scan", result: "0 crit" },
  { icon: Package, name: "SBOM", result: "signed" },
];

export const APPROVERS = [
  { role: "Release manager", who: "A. Rao", approved: true },
  { role: "Change board (CAB)", who: "auto · standard", approved: true },
  { role: "Security · CISO", who: "P. Nair", approved: false },
] as const;

export const CANARY_STEPS = [
  { at: 0.1, label: "10% · errors 0.02%" },
  { at: 0.5, label: "50% · p95 180 ms" },
  { at: 1, label: "100%" },
] as const;

/** Where the reviewer's cursor clicks "Approve release" (board coordinates). */
export const APPROVE_POINT = { x: TILES.release.x + 100, y: TILES.release.y + 179 } as const;
