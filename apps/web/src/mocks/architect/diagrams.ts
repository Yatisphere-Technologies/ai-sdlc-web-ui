import type { ArchBrief, Diagram, DiagramEdge, EdgeKind, SequenceMessage } from "@throughline/contracts";
import { CATALOG, CLOUD_LABEL, keyRole, NETWORK_WORD, REGIONS, type ServiceRole } from "./catalog";
import { g, type LGroup, type LNode, layout, n } from "./layout";
import { networkPlan } from "./network";
import type { ArchSubject } from "./subject";

type Ctx = {
  b: ArchBrief;
  s: ArchSubject;
  N: Record<ServiceRole, string>;
  async: boolean;
  bus: "queue" | "stream";
  entry: "apigw" | "ingress";
  customer: ArchSubject["actors"][number] | undefined;
  staff: ArchSubject["actors"][number] | undefined;
  api: ArchSubject["services"][number];
  worker: ArchSubject["services"][number] | undefined;
  console: ArchSubject["services"][number] | undefined;
  partner: ArchSubject["externals"][number] | undefined;
  onprem: ArchSubject["externals"][number][];
  saas: ArchSubject["externals"][number][];
};

function ctx(b: ArchBrief, s: ArchSubject): Ctx {
  const async = b.messaging !== "none";
  const api = s.services.find((x) => !x.async && x.id === "api") ?? (s.services[0] as Ctx["api"]);
  return {
    b,
    s,
    N: CATALOG[b.cloud],
    async,
    bus: b.messaging === "stream" ? "stream" : "queue",
    entry: b.exposure === "partner" ? "apigw" : "ingress",
    customer: s.actors.find((a) => !a.staff),
    staff: s.actors.find((a) => a.staff),
    api,
    worker: async ? s.services.find((x) => x.async) : undefined,
    console: s.services.find((x) => x.id === "console"),
    partner: s.externals.find((x) => x.where === "partner"),
    onprem: s.externals.filter((x) => x.where === "onprem"),
    saas: s.externals.filter((x) => x.where === "saas"),
  };
}

/** The component that runs async work, or the API itself when the design has no messaging. */
const caller = (c: Ctx) => (c.worker ? c.worker.id : c.api.id);

function edges() {
  const list: DiagramEdge[] = [];
  const add = (from: string, to: string, kind: EdgeKind, label?: string, control?: string) => {
    list.push({ id: `e${list.length + 1}`, from, to, kind, label, control });
  };
  return { list, add };
}

const idpNodes = (c: Ctx, prefix = ""): LNode[] => {
  const out: LNode[] = [];
  if (c.b.identity !== "workforce")
    out.push(n(`${prefix}cidp`, "Customer identity", "customer-idp", "identity", c.N["customer-idp"]));
  if (c.b.identity !== "customer")
    out.push(n(`${prefix}widp`, "Workforce identity", "workforce-idp", "identity", c.N["workforce-idp"]));
  return out;
};
const customerIdp = (c: Ctx, prefix = "") =>
  c.b.identity === "workforce" ? `${prefix}widp` : `${prefix}cidp`;
const staffIdp = (c: Ctx, prefix = "") => (c.b.identity === "customer" ? `${prefix}cidp` : `${prefix}widp`);

const comps = (c: Ctx, zone?: "app" | "identity" | "secops") =>
  (c.s.components ?? []).filter((x) => !zone || x.zone === zone);
const compNode = (x: NonNullable<ArchSubject["components"]>[number]) =>
  n(x.id, x.name, x.role, x.category, x.description);
const linkComps = (c: Ctx, add: (from: string, to: string, kind: EdgeKind, label?: string) => void) => {
  for (const x of comps(c)) {
    const from = x.link.from === "worker" ? caller(c) : x.link.from === "api" ? c.api.id : "entry";
    add(from, x.id, x.link.kind, x.link.label);
  }
};

const extNode = (x: ArchSubject["externals"][number]) =>
  n(x.id, x.name, x.where === "onprem" ? "onprem-dc" : "external", "external", x.description);

/* ── C4 level 1 ────────────────────────────────────────────────────────────────────────────── */

function contextDiagram(c: Ctx): Diagram {
  const { b, s, N } = c;
  const top = g(
    "top",
    "",
    "boundary",
    [
      ...s.actors.map((a) => n(a.id, a.name, a.staff ? "staff" : "users", "person", a.description)),
      ...idpNodes(c),
    ],
    { hidden: true },
  );
  const system = g("enterprise", "Enterprise boundary", "boundary", [
    n("system", s.system, "system", "system", s.purpose, { w: 300, h: 96 }),
  ]);
  const externals = g(
    "ext",
    "External systems",
    "external",
    [...s.externals.map(extNode), b.ai !== "none" ? n("llm", "Language model", "llm", "ai", N.llm) : null],
    { cols: 1 },
  );
  const mid = g("mid", "", "boundary", [system, externals], { hidden: true });
  const laid = layout(g("root", "", "boundary", [top, mid], { hidden: true, cols: 1 }));
  const e = edges();
  for (const a of s.actors) e.add(a.id, "system", "request", `Uses · ${a.channel}`);
  for (const a of s.actors) e.add(a.id, a.staff ? staffIdp(c) : customerIdp(c), "identity", "Signs in");
  for (const x of s.externals)
    e.add("system", x.id, x.where === "onprem" ? "private" : "request", x.protocol);
  if (b.ai !== "none") e.add("system", "llm", "request", "Prompts over private endpoint");
  return {
    id: "context",
    kind: "context",
    title: `${s.system} · system context`,
    caption: `Who uses ${s.system} and which systems it depends on. C4 level 1.`,
    ...laid,
    edges: e.list,
  };
}

/* ── C4 level 2 ────────────────────────────────────────────────────────────────────────────── */

const computeTech = (c: Ctx) => c.N[c.b.compute];

function containerDiagram(c: Ctx): Diagram {
  const { b, s, N } = c;
  const top = g(
    "top",
    "",
    "boundary",
    [
      ...s.actors.map((a) => n(a.id, a.name, a.staff ? "staff" : "users", "person", a.channel)),
      ...idpNodes(c),
    ],
    { hidden: true },
  );
  const entryLabel = c.entry === "apigw" ? "API gateway" : "Ingress + WAF";
  const row1: LNode[] = [
    c.console
      ? n(c.console.id, c.console.name, "static-web", "edge", `Single-page app · ${N["static-web"]}`)
      : null,
    n("entry", entryLabel, c.entry, "edge", N[c.entry]),
    n(c.api.id, c.api.name, b.compute, "compute", `${c.api.description} · ${computeTech(c)}`),
    c.worker
      ? n(c.worker.id, c.worker.name, b.compute, "compute", `${c.worker.description} · ${computeTech(c)}`)
      : null,
  ].filter((x): x is LNode => Boolean(x));
  const row2: LNode[] = [
    n("store", "Document store", "object-store", "data", `Exports and audit archives · ${N["object-store"]}`),
    b.cache === "yes"
      ? n("cache", "Cache", "cache", "data", `Idempotency keys, sessions · ${N.cache}`)
      : null,
    n("db", "Database", b.database, "data", `${s.dataEntities} · ${N[b.database]}`),
    c.async
      ? n("bus", b.messaging === "stream" ? "Event stream" : "Message queue", c.bus, "integration", N[c.bus])
      : null,
  ].filter((x): x is LNode => Boolean(x));
  const row3 = comps(c).map(compNode);
  const boundary = g("sys", `${s.system} (system boundary)`, "boundary", [...row1, ...row2, ...row3], {
    cols: Math.max(row1.length, row2.length),
  });
  const externals = g(
    "ext",
    "External systems",
    "external",
    [...s.externals.map(extNode), b.ai !== "none" ? n("llm", "Language model", "llm", "ai", N.llm) : null],
    { cols: 1 },
  );
  const laid = layout(
    g("root", "", "boundary", [top, g("mid", "", "boundary", [boundary, externals], { hidden: true })], {
      hidden: true,
      cols: 1,
    }),
  );
  const e = edges();
  if (c.customer) e.add(c.customer.id, "entry", "request", "HTTPS / JSON");
  if (c.staff && c.console) {
    e.add(c.staff.id, c.console.id, "request", "HTTPS");
    e.add(c.console.id, "entry", "request", "API calls (bearer token)");
  }
  e.add("entry", customerIdp(c), "identity", "Validates tokens (JWKS)");
  e.add("entry", c.api.id, "request", "Routes request");
  linkComps(c, e.add);
  if (b.cache === "yes") e.add(c.api.id, "cache", "data", "Idempotency check");
  e.add(c.api.id, "db", "data", "Reads / writes (TLS)");
  e.add(c.api.id, "store", "data", "Writes exports");
  if (c.worker) {
    e.add(c.api.id, "bus", "async", `Publishes ${s.flow.event}`);
    e.add("bus", c.worker.id, "async", "Delivers (at least once)");
    e.add(c.worker.id, "db", "data", "Updates state");
  }
  for (const x of s.externals)
    e.add(caller(c), x.id, x.where === "onprem" ? "private" : "request", x.protocol);
  if (b.ai !== "none") e.add(caller(c), "llm", "request", "Prompt + response");
  return {
    id: "container",
    kind: "container",
    title: `${s.system} · containers`,
    caption: "The deployable parts, what each is responsible for and how they talk. C4 level 2.",
    ...laid,
    edges: e.list,
  };
}

/* ── Deployment and network ────────────────────────────────────────────────────────────────── */

function workloadGroup(c: Ctx, prefix = ""): LGroup {
  const { b, N } = c;
  const label =
    b.compute === "kubernetes"
      ? `${N.kubernetes} · user node pool${REGIONS[b.cloud][b.region].zones ? " across 3 zones" : ""}`
      : b.compute === "serverless-containers"
        ? `${N["serverless-containers"]} (${NETWORK_WORD[b.cloud].network}-integrated)`
        : b.compute === "paas"
          ? `${N.paas} (${NETWORK_WORD[b.cloud].network}-integrated)`
          : `${N.functions} (${NETWORK_WORD[b.cloud].network}-integrated)`;
  return g(`${prefix}workload`, label, "boundary", [
    n(`${prefix}${c.api.id}`, c.api.name, b.compute, "compute", "min 3 replicas · autoscale"),
    c.worker
      ? n(`${prefix}${c.worker.id}`, c.worker.name, b.compute, "compute", "scales on queue depth")
      : null,
    b.ai === "self-hosted" ? n(`${prefix}gpu`, "Model server", "gpu", "ai", N.gpu) : null,
  ]);
}

function deploymentDiagram(c: Ctx): Diagram {
  const { b, s, N } = c;
  const region = REGIONS[b.cloud][b.region];
  const plan = networkPlan(b);
  const w = NETWORK_WORD[b.cloud];
  const sub = (key: string) => plan.subnets.find((x) => x.key === key);
  const subnet = (key: string, kids: (LNode | LGroup | null | false)[]) => {
    const p = sub(key);
    return p ? g(`sn-${key}`, p.name, "subnet", kids, { cidr: p.cidr }) : null;
  };
  const onPrem = b.cloud === "on-prem";
  const hubSpoke = Boolean(plan.hub);
  const linked = b.connectivity !== "none" && !onPrem;
  const multi = b.availability.startsWith("multi-region");
  const e = edges();

  const publicEdge = b.exposure !== "internal";
  const users = g(
    "people",
    "",
    "boundary",
    [
      c.customer
        ? n(
            "users",
            c.customer.name,
            "users",
            "person",
            b.exposure === "internal" ? "Corporate network" : "Internet",
          )
        : null,
      c.staff && !linked ? n("staff", c.staff.name, "staff", "person", "Internet, managed devices") : null,
    ],
    { hidden: true },
  );
  const edgeGroup = publicEdge
    ? g("global", "Global edge", "boundary", [
        n("edge", "Edge + WAF", "edge", "edge", `${N.edge} · ${N.waf}`),
        c.console ? n("web", c.console.name, "static-web", "edge", N["static-web"]) : null,
        n("dns", "Public DNS", "dns", "network", N.dns),
      ])
    : b.connectivity === "none"
      ? g(
          "global",
          "Zero-trust access",
          "boundary",
          [n("ztna", "Access proxy", "ztna", "security", N.ztna)],
          { cols: 1 },
        )
      : null;

  const hubKids: (LGroup | null)[] = hubSpoke
    ? [
        subnet("firewall", [n("fw", "Firewall", "firewall", "security", N.firewall)]),
        linked
          ? subnet("gateway", [
              n(
                "gw",
                b.connectivity === "vpn" ? "VPN gateway" : "Circuit gateway",
                b.connectivity === "vpn" ? "vpn" : "private-circuit",
                "network",
                b.connectivity === "vpn" ? N.vpn : `${N["private-circuit"]} gateway`,
              ),
            ])
          : null,
        subnet("bastion", [n("bastion", "Privileged access", "bastion", "security", N.bastion)]),
        linked
          ? subnet("dns", [n("resolver", "DNS resolver", "dns-resolver", "network", N["dns-resolver"])])
          : null,
        b.cloud === "aws" ? subnet("egress", [n("nat", "NAT gateways", "nat", "network", N.nat)]) : null,
      ]
    : [];
  const hub = hubSpoke
    ? g(
        "hub",
        `${plan.hub?.name} · ${b.cloud === "aws" ? "inspection & egress" : "shared services"}`,
        "network",
        hubKids,
        {
          cidr: plan.hub?.cidr,
          cols: 1,
          stretch: true,
        },
      )
    : null;

  const entryNode = n(
    "entry",
    c.entry === "apigw" ? "API gateway" : "Load balancer + WAF",
    c.entry,
    "edge",
    N[c.entry],
  );
  const dataNodes = [
    n(
      "db",
      "Database",
      b.database,
      "data",
      `${N[b.database]} · ${b.availability === "single-zone" ? "single zone" : "zone-redundant HA"}`,
    ),
    b.cache === "yes" ? n("cache", "Cache", "cache", "data", N.cache) : null,
  ];
  const peNodes = [
    n(
      "pe-kv",
      b.keys === "hsm" ? "Keys + secrets" : "Secrets",
      keyRole(b),
      "security",
      `${N[keyRole(b)]} · private endpoint`,
    ),
    c.async
      ? n(
          "pe-bus",
          b.messaging === "stream" ? "Event stream" : "Queue",
          c.bus,
          "integration",
          `${N[c.bus]} · private endpoint`,
        )
      : null,
    n("pe-store", "Object storage", "object-store", "data", `${N["object-store"]} · private endpoint`),
    b.ai === "managed" ? n("pe-llm", "Language model", "llm", "ai", `${N.llm} · private endpoint`) : null,
  ];

  const singleNetExtras =
    !hubSpoke && !onPrem
      ? [
          subnet("firewall", [n("fw", "Firewall", "firewall", "security", N.firewall)]),
          linked
            ? subnet("gateway", [
                n(
                  "gw",
                  "Gateway",
                  b.connectivity === "vpn" ? "vpn" : "private-circuit",
                  "network",
                  b.connectivity === "vpn" ? N.vpn : N["private-circuit"],
                ),
              ])
            : null,
          subnet("bastion", [n("bastion", "Privileged access", "bastion", "security", N.bastion)]),
        ]
      : [];

  const spoke = g(
    "spoke",
    onPrem ? "Network zones (segmented by firewall)" : `${plan.spoke.name} · ${s.system}`,
    "network",
    onPrem
      ? [
          subnet("ingress", [entryNode]),
          subnet("app", [workloadGroup(c)]),
          subnet("data", [
            ...dataNodes,
            c.async ? n("pe-bus", "Message broker", c.bus, "integration", N[c.bus]) : null,
          ]),
          subnet("mgmt", [
            n("bastion", "Privileged access", "bastion", "security", N.bastion),
            n("pe-kv", "Secrets", keyRole(b), "security", N[keyRole(b)]),
          ]),
        ]
      : [
          subnet("ingress", [entryNode]),
          subnet("app", [workloadGroup(c)]),
          subnet("data", dataNodes),
          subnet("endpoints", peNodes),
          ...singleNetExtras,
        ],
    { cidr: plan.spoke.cidr, cols: 1, stretch: true },
  );

  const platform = g(
    "platform",
    onPrem ? "Shared platform" : "Platform services (private access only)",
    "boundary",
    [
      onPrem ? n("fw", "Firewall", "firewall", "security", N.firewall) : null,
      n("registry", "Image registry", "registry", "ops", N.registry),
      n(
        "logs",
        "Logs and metrics",
        b.observability === "native" ? "logs" : b.observability,
        "ops",
        b.observability === "native" ? `${N.monitor} · ${N.logs}` : N[b.observability],
      ),
      n("siem", "SIEM", "siem", "security", N.siem),
      ...idpNodes(c),
      ...comps(c).map(compNode),
    ],
  );

  const transit =
    b.cloud === "aws" && hubSpoke ? n("tgw", "Transit gateway", "transit", "network", N.transit) : null;
  const regionGroup = g(
    "region",
    `${region.primary}${region.zones ? " · 3 availability zones" : ""}`,
    onPrem ? "onprem" : "region",
    [g("net-row", "", "boundary", [spoke, transit, hub], { hidden: true }), platform],
    { cols: 1 },
  );

  const dr = multi
    ? g(
        "dr",
        `${region.dr ?? "Secondary region"} · ${b.availability === "multi-region-active" ? "active" : "warm standby"}`,
        onPrem ? "onprem" : "region",
        [
          g(
            "dr-net",
            `${plan.dr?.name ?? "DR"}`,
            "network",
            [
              n(
                "dr-compute",
                "Workloads (standby)",
                b.compute,
                "compute",
                `${N[b.compute]} · ${b.availability === "multi-region-active" ? "full capacity" : "scaled to 30%"}`,
              ),
              n("dr-db", "Database replica", b.database, "data", "Async geo-replica · promote on failover"),
            ],
            { cidr: plan.dr?.cidr, cols: 1 },
          ),
        ],
        { cols: 1 },
      )
    : null;

  const cloudGroup = onPrem
    ? g("cloud", "Private cloud", "cloud", [regionGroup, dr], { cols: 1 })
    : g("cloud", CLOUD_LABEL[b.cloud], "cloud", [regionGroup, dr], { cols: 1 });

  const partnerGroup = g(
    "partners",
    "Partners and SaaS",
    "external",
    [
      ...s.externals.filter((x) => x.where !== "onprem").map(extNode),
      ...(b.observability === "datadog" ? [n("dd", "Observability SaaS", "datadog", "ops", N.datadog)] : []),
    ],
    { cols: 1 },
  );

  const dc = linked
    ? g(
        "dc",
        `Corporate data centre · ${plan.onprem}`,
        "onprem",
        [
          n(
            "router",
            "Customer edge router",
            "router",
            "network",
            b.connectivity === "vpn" ? "IPsec, BGP" : "BGP, private peering",
          ),
          ...c.onprem.map(extNode),
          c.staff ? n("staff", c.staff.name, "staff", "person", "Corporate network") : null,
        ],
        { cols: 1 },
      )
    : null;

  const onpremInCloud = onPrem
    ? g("legacy", "Existing systems", "onprem", c.onprem.map(extNode), { cols: 1 })
    : null;

  const laid = layout(
    g(
      "root",
      "",
      "boundary",
      [
        g("top-row", "", "boundary", [users, edgeGroup], { hidden: true }),
        g(
          "mid",
          "",
          "boundary",
          [
            cloudGroup,
            g("right", "", "boundary", [partnerGroup, onpremInCloud, dc], { hidden: true, cols: 1 }),
          ],
          { hidden: true },
        ),
      ],
      { hidden: true, cols: 1 },
    ),
  );

  // Traffic
  if (publicEdge) {
    if (c.customer) e.add("users", "edge", "request", "HTTPS 443", "C1");
    if (c.staff && !linked && c.console) e.add("staff", "web", "request", "HTTPS");
    e.add("edge", "entry", "request", onPrem ? "443 to DMZ" : "Private origin · origin lock", "C2");
  } else if (b.connectivity === "none") {
    if (c.customer) e.add("users", "ztna", "request", "Device-posture checked");
    e.add("ztna", "entry", "request", "Per-app tunnel");
  }
  e.add("entry", `${c.api.id}`, "request", "443 · mTLS in cluster", "C4");
  linkComps(c, e.add);
  e.add(c.api.id, "db", "data", "TLS · private", "C5");
  if (b.cache === "yes") e.add(c.api.id, "cache", "data", "TLS 6380");
  if (c.async && c.worker) {
    e.add(c.api.id, "pe-bus", "async", "Publish");
    e.add("pe-bus", c.worker.id, "async", "Consume");
  }
  e.add(c.api.id, "pe-kv", "identity", "Workload identity", "C6");
  const egressFrom = caller(c);
  const egressVia = "fw";
  e.add(egressFrom, egressVia, "request", hubSpoke ? `UDR 0.0.0.0/0 → firewall` : "Egress", "C8");
  for (const x of s.externals.filter((x) => x.where !== "onprem"))
    e.add(egressVia, x.id, "request", x.protocol, x.where === "partner" ? "C9" : undefined);
  if (b.observability === "datadog") e.add(egressVia, "dd", "data", "Telemetry (agent → SaaS)");
  if (linked) {
    e.add(egressVia, "gw", "private", "To on-prem ranges");
    e.add(
      "gw",
      "router",
      "private",
      b.connectivity === "vpn" ? "IPsec tunnels ×2 (BGP)" : `${N["private-circuit"]} · 1 Gbps ×2`,
    );
    for (const x of c.onprem) e.add("router", x.id, "private", x.protocol);
    if (c.staff) e.add("staff", "router", "request", "Corporate WAN");
    if (c.staff) e.add("router", "gw", "request", "Staff to internal ingress");
  } else if (onPrem) {
    for (const x of c.onprem) e.add(egressFrom, x.id, "private", x.protocol);
  }
  if (hubSpoke && b.cloud !== "aws") e.add("hub", "spoke", "private", `${w.network} peering`);
  if (transit) {
    e.add("hub", "tgw", "private", "TGW attachment");
    e.add("tgw", "spoke", "private", "TGW attachment");
  }
  e.add("bastion", "workload", "admin", "JIT admin", "C10");
  e.add("registry", "workload", "admin", "Signed image pull", "C11");
  e.add("workload", "logs", "data", "Logs, metrics, traces", "C12");
  e.add("logs", "siem", "data", "Detections");
  if (b.ai === "managed") e.add(caller(c), "pe-llm", "request", "Private endpoint", "C13");
  if (dr) {
    e.add("db", "dr-db", "replication", "Async geo-replication");
    if (publicEdge) e.add("edge", "dr-compute", "request", "Failover origin");
  }

  return {
    id: "deployment",
    kind: "deployment",
    title: `${s.system} · deployment and network`,
    caption: `${onPrem ? "Data centre zones" : `${CLOUD_LABEL[b.cloud]}, ${region.primary}`} with ${hubSpoke ? "hub-and-spoke" : "single-network"} topology. Address ranges are proposals; check for overlaps with your IPAM.`,
    ...laid,
    edges: e.list,
  };
}

/* ── Security architecture ─────────────────────────────────────────────────────────────────── */

function securityDiagram(c: Ctx): Diagram {
  const { b, s, N } = c;
  const untrusted = g(
    "z-untrusted",
    "Untrusted · internet",
    "zone",
    [
      c.customer
        ? n(
            "users",
            c.customer.name,
            "users",
            "person",
            b.exposure === "internal" ? "Corporate network" : "Internet",
          )
        : null,
      b.exposure === "partner" && c.partner && c.partner.callsIn !== false
        ? n("caller", "Partner caller", "external", "external", "mTLS client")
        : null,
    ],
    { trust: "untrusted", cols: 1 },
  );
  const dmz = g(
    "z-dmz",
    "Edge zone (DMZ)",
    "zone",
    [
      b.exposure !== "internal" ? n("edge", "Edge + WAF", "edge", "edge", `${N.edge} · ${N.waf}`) : null,
      n("entry", c.entry === "apigw" ? "API gateway" : "Load balancer + WAF", c.entry, "edge", N[c.entry]),
      n("fw", "Egress firewall", "firewall", "security", N.firewall),
    ],
    { trust: "dmz", cols: 1 },
  );
  const trusted = g(
    "z-app",
    "Application zone",
    "zone",
    [
      n(c.api.id, c.api.name, b.compute, "compute", N[b.compute]),
      c.worker ? n(c.worker.id, c.worker.name, b.compute, "compute", N[b.compute]) : null,
      ...comps(c, "app").map(compNode),
    ],
    { trust: "trusted", cols: 1 },
  );
  const restricted = g(
    "z-data",
    `Restricted data zone · ${b.classification}`,
    "zone",
    [
      n("db", "Database", b.database, "data", N[b.database]),
      b.cache === "yes" ? n("cache", "Cache", "cache", "data", N.cache) : null,
      c.async
        ? n("bus", b.messaging === "stream" ? "Event stream" : "Queue", c.bus, "integration", N[c.bus])
        : null,
      n("store", "Object storage", "object-store", "data", N["object-store"]),
    ],
    { trust: "restricted", cols: 1 },
  );
  const partners = g(
    "z-ext",
    "Partners and on-prem",
    "zone",
    [...s.externals.map(extNode), b.ai === "managed" ? n("llm", "Language model", "llm", "ai", N.llm) : null],
    { trust: "untrusted", cols: 1 },
  );
  const identity = g(
    "z-identity",
    "Identity and key management",
    "zone",
    [
      ...idpNodes(c),
      n("wid", "Workload identity", "workload-identity", "identity", N["workload-identity"]),
      ...comps(c, "identity").map(compNode),
      n(
        "kv",
        b.keys === "hsm" ? "HSM-backed keys" : "Secrets and keys",
        keyRole(b),
        "security",
        N[keyRole(b)],
      ),
    ],
    { trust: "management" },
  );
  const mgmt = g(
    "z-mgmt",
    "Management zone",
    "zone",
    [
      n("cicd", "CI/CD", "cicd", "ops", N.cicd),
      n("registry", "Signed images", "registry", "ops", N.registry),
      n("bastion", "Privileged access", "bastion", "security", N.bastion),
    ],
    { trust: "management" },
  );
  const secops = g(
    "z-secops",
    "Security operations",
    "zone",
    [
      n("logs", "Audit + flow logs", "logs", "ops", N.logs),
      n("siem", "SIEM / SOC", "siem", "security", N.siem),
      ...comps(c, "secops").map(compNode),
    ],
    { trust: "management" },
  );
  const laid = layout(
    g(
      "root",
      "",
      "boundary",
      [
        g("row1", "", "boundary", [untrusted, dmz, trusted, restricted, partners], { hidden: true }),
        g("row2", "", "boundary", [identity, mgmt, secops], { hidden: true }),
      ],
      { hidden: true, cols: 1 },
    ),
  );
  const e = edges();
  const front = b.exposure !== "internal" ? "edge" : "entry";
  if (c.customer) e.add("users", front, "request", "TLS 1.2+", "C1");
  if (b.exposure === "partner" && c.partner && c.partner.callsIn !== false)
    e.add("caller", front, "request", "mTLS + IP allow-list", "C1");
  if (front === "edge") e.add("edge", "entry", "request", "WAF · rate limit", "C2");
  e.add("entry", customerIdp(c), "identity", "Token validation", "C3");
  e.add("entry", c.api.id, "request", "Validated claims", "C4");
  linkComps(c, e.add);
  e.add(c.api.id, "db", "data", "Private endpoint", "C5");
  if (c.worker) {
    e.add(c.api.id, "bus", "async", "Private endpoint", "C5");
    e.add("bus", c.worker.id, "async", "Consume");
  }
  e.add("wid", "z-app", "identity", "Federated tokens", "C6");
  e.add("kv", "z-data", "identity", "Wraps data keys", "C7");
  e.add(caller(c), "fw", "request", "Forced tunnel", "C8");
  e.add("fw", "z-ext", "request", "Allow-listed FQDNs · mTLS", "C9");
  e.add("bastion", "z-app", "admin", "Just-in-time", "C10");
  e.add("cicd", "registry", "admin", "Sign + SBOM", "C11");
  e.add("z-app", "logs", "data", "Audit trail", "C12");
  e.add("logs", "siem", "data", "Detections");
  if (b.ai === "managed") e.add(caller(c), "llm", "request", "Filtered, private", "C13");
  return {
    id: "security",
    kind: "security",
    title: `${s.system} · security architecture`,
    caption:
      "Trust zones, what crosses each boundary, and the control (C-number) that guards it. Controls are listed in the document.",
    ...laid,
    edges: e.list,
  };
}

/* ── Sequence ──────────────────────────────────────────────────────────────────────────────── */

function sequenceDiagram(c: Ctx): Diagram {
  const { b, s, N } = c;
  const parts: {
    id: string;
    label: string;
    role: ServiceRole;
    category: Diagram["nodes"][number]["category"];
    tech?: string;
  }[] = [];
  const add = (p: (typeof parts)[number] | null) => {
    if (p) parts.push(p);
  };
  const actor = c.customer ?? c.staff;
  add(
    actor ? { id: "actor", label: actor.name, role: "users", category: "person", tech: actor.channel } : null,
  );
  add(
    b.exposure !== "internal"
      ? { id: "edge", label: "Edge + WAF", role: "edge", category: "edge", tech: N.edge }
      : null,
  );
  add({
    id: "entry",
    label: c.entry === "apigw" ? "API gateway" : "Ingress",
    role: c.entry,
    category: "edge",
    tech: N[c.entry],
  });
  add({
    id: "idp",
    label: "Identity provider",
    role: b.identity === "workforce" ? "workforce-idp" : "customer-idp",
    category: "identity",
    tech: b.identity === "workforce" ? N["workforce-idp"] : N["customer-idp"],
  });
  for (const x of comps(c).filter((x) => x.inFlow))
    add({ id: x.id, label: x.name, role: x.role, category: x.category, tech: x.description.split(" · ")[0] });
  add({ id: "api", label: c.api.name, role: b.compute, category: "compute", tech: N[b.compute] });
  add(
    b.cache === "yes"
      ? { id: "cache", label: "Cache", role: "cache", category: "data", tech: N.cache }
      : null,
  );
  add({ id: "db", label: "Database", role: b.database, category: "data", tech: N[b.database] });
  add(
    c.worker
      ? {
          id: "bus",
          label: b.messaging === "stream" ? "Event stream" : "Queue",
          role: c.bus,
          category: "integration",
          tech: N[c.bus],
        }
      : null,
  );
  add(
    c.worker
      ? { id: "worker", label: c.worker.name, role: b.compute, category: "compute", tech: N[b.compute] }
      : null,
  );
  add(
    s.flow.steps?.some((x) => x.from === "llm" || x.to === "llm") && b.ai !== "none"
      ? { id: "llm", label: "Language model", role: "llm", category: "ai", tech: N.llm }
      : null,
  );
  add(
    c.partner
      ? {
          id: "partner",
          label: c.partner.name,
          role: "external",
          category: "external",
          tech: c.partner.protocol,
        }
      : null,
  );
  const onprem = c.onprem.find(() => Boolean(s.flow.onpremCall));
  add(
    onprem
      ? { id: "onprem", label: onprem.name, role: "onprem-dc", category: "external", tech: onprem.protocol }
      : null,
  );
  const notify = c.saas[0] && s.flow.notifyCall ? c.saas[0] : undefined;
  add(
    notify
      ? { id: "notify", label: notify.name, role: "external", category: "external", tech: notify.protocol }
      : null,
  );

  const has = (id: string) => parts.some((p) => p.id === id);
  const msgs: Omit<SequenceMessage, "step">[] = [];
  const m = (
    from: string,
    to: string,
    label: string,
    kind: EdgeKind,
    extra: Partial<SequenceMessage> = {},
  ) => {
    if (has(from) && has(to)) msgs.push({ from, to, label, kind, ...extra });
  };
  const first = has("edge") ? "edge" : "entry";
  const custom = s.flow.steps;
  if (custom) {
    // Steps are written with an edge in front; without one, the gateway takes its place.
    const lane = (id: string) => (id === "edge" && !has("edge") ? "entry" : id);
    for (const x of custom) {
      const from = lane(x.from);
      const to = lane(x.to);
      if (from !== to) m(from, to, x.label, x.kind, { note: x.note, reply: x.reply });
    }
  } else {
    m("actor", first, s.flow.command, "request", { note: "TLS 1.2+, bearer token" });
    m("edge", "entry", "Forward (WAF passed)", "request");
    m("entry", "idp", "Fetch signing keys (cached)", "identity");
    m("idp", "entry", "JWKS", "identity", { reply: true });
    m("entry", "api", "Request + validated claims", "request");
    if (has("cache")) m("api", "cache", "SET idempotency key NX", "data");
    m("api", "db", c.worker ? "Write state + outbox row (one transaction)" : "Write state", "data");
    if (c.worker) {
      m("api", "bus", `Publish ${s.flow.event}`, "async", { note: "Outbox relay; at-least-once" });
      m("api", "actor", "202 Accepted + tracking id", "request", { reply: true });
      m("bus", "worker", `Deliver ${s.flow.event}`, "async");
      m("worker", "partner", s.flow.partnerCall, "request", {
        note: "mTLS · retry ×5 with backoff · then dead-letter",
      });
      m("partner", "worker", "Confirmed", "request", { reply: true });
      m("worker", "onprem", s.flow.onpremCall ?? "Update system of record", "private");
      m("worker", "db", "Mark complete", "data");
      m("worker", "notify", s.flow.notifyCall ?? "Notify", "request");
    } else {
      m("api", "partner", s.flow.partnerCall, "request", { note: "Synchronous; timeout 2 s" });
      m("partner", "api", "Confirmed", "request", { reply: true });
      m("api", "onprem", s.flow.onpremCall ?? "Update system of record", "private");
      m("api", "notify", s.flow.notifyCall ?? "Notify", "request");
      m("api", "actor", "200 OK", "request", { reply: true });
    }
  }
  const messages: SequenceMessage[] = msgs.map((x, i) => ({ ...x, step: i + 1 }));
  const COL = 190;
  const PW = 164;
  const nodes = parts.map((p, i) => ({
    id: p.id,
    label: p.label,
    tech: p.tech,
    role: p.role,
    category: p.category,
    x: 24 + i * COL,
    y: 24,
    w: PW,
    h: 60,
  }));
  return {
    id: "sequence",
    kind: "sequence",
    title: `${s.flow.name} · request flow`,
    caption:
      custom && s.flow.caption
        ? s.flow.caption
        : c.worker
          ? "The request is acknowledged once state is safely stored; partner and on-prem calls run asynchronously with retries."
          : "Everything happens inside the request, so partner latency is user latency.",
    width: 48 + parts.length * COL - (COL - PW),
    height: 120 + messages.length * 46 + 40,
    groups: [],
    nodes,
    edges: [],
    messages,
  };
}

/** Drops edges whose ends were left out by the brief (no cache, no console, …). */
function prune(d: Diagram): Diagram {
  const ids = new Set([...d.nodes.map((x) => x.id), ...d.groups.map((x) => x.id)]);
  return { ...d, edges: d.edges.filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to) };
}

export function buildDiagrams(b: ArchBrief, s: ArchSubject): Diagram[] {
  const c = ctx(b, s);
  return [
    contextDiagram(c),
    containerDiagram(c),
    deploymentDiagram(c),
    securityDiagram(c),
    sequenceDiagram(c),
  ].map(prune);
}
