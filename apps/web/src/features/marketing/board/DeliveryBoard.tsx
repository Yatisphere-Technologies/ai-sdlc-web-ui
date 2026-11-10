import { cn } from "@throughline/ui";
import {
  Bot,
  Check,
  CircleCheck,
  Clock,
  FileText,
  GitBranch,
  GitPullRequest,
  ListTree,
  type LucideIcon,
  Network,
  PenLine,
  Rocket,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useId, useRef } from "react";
import {
  APPROVE_POINT,
  APPROVERS,
  ARCH_EDGES,
  ARCH_NODES,
  BACKLOG,
  BACKLOG_TYPE,
  BOARD_VIEWBOX,
  BRD_NFRS,
  BRD_REQUIREMENTS,
  CANARY_STEPS,
  CODE,
  HAND_START,
  PIPELINE,
  type Run,
  TILES,
  type Tone,
  WIRES,
} from "./content";
import { buildTimeline } from "./timeline";

const FILL: Record<Tone, string> = {
  ion: "fill-ion",
  agent: "fill-agent-fg",
  ok: "fill-ok",
  gate: "fill-gate-fg",
  muted: "fill-muted",
  code: "fill-code",
  faint: "fill-faint",
};
const TEXT: Record<Tone, string> = {
  ion: "text-ion",
  agent: "text-agent",
  ok: "text-ok",
  gate: "text-gate",
  muted: "text-muted",
  code: "text-code",
  faint: "text-faint",
};

const path = (pts: [number, number][]) => `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(" L ")}`;

function Icon({
  icon: I,
  x,
  y,
  size,
  className,
}: {
  icon: LucideIcon;
  x: number;
  y: number;
  size: number;
  className: string;
}) {
  return <I x={x} y={y} width={size} height={size} className={className} aria-hidden />;
}

function Tile({
  id,
  icon,
  title,
  who,
  children,
}: {
  id: keyof typeof TILES;
  icon: LucideIcon;
  title: string;
  who: string;
  children: ReactNode;
}) {
  const t = TILES[id];
  const badge = who.length * 5 + 24;
  return (
    <g data-b="tile" transform={`translate(${t.x} ${t.y})`}>
      <rect width={t.w} height={t.h} rx={6} className="fill-surface stroke-line" fillOpacity={0.94} />
      <line x1={0} y1={30} x2={t.w} y2={30} className="stroke-line" />
      <Icon icon={icon} x={12} y={9} size={13} className="text-muted" />
      <text x={32} y={19.5} className="fill-foreground text-nano font-sans font-medium">
        {title}
      </text>
      <rect x={t.w - 12 - badge} y={8} width={badge} height={15} rx={2} className="fill-agent-soft" />
      <Icon icon={Bot} x={t.w - 12 - badge + 5} y={10.5} size={10} className="text-agent-fg" />
      <text x={t.w - 12 - badge + 18} y={18.5} className="fill-agent-fg text-board-sm font-mono">
        {who}
      </text>
      {children}
    </g>
  );
}

/** A line of text that the timeline types out by widening its clip. */
function Typed({ x, y, runs }: { x: number; y: number; runs: Run[] }) {
  const id = `bt${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const chars = runs.reduce((n, r) => n + r[0].length, 0);
  return (
    <g data-b="typed" data-chars={chars}>
      <clipPath id={id}>
        <rect data-b="clip" x={x - 2} y={y - 11} width={420} height={15} />
      </clipPath>
      <text x={x} y={y} clipPath={`url(#${id})`} className="text-board-sm font-mono whitespace-pre">
        {runs.map(([text, tone], i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static runs never reorder
          <tspan key={i} className={FILL[tone]}>
            {text}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function Foot({
  x,
  y,
  icon = CircleCheck,
  tone = "ok",
  children,
}: {
  x: number;
  y: number;
  icon?: LucideIcon;
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <g data-b="foot" transform={`translate(${x} ${y})`}>
      <Icon icon={icon} x={0} y={-9} size={11} className={TEXT[tone]} />
      {children}
    </g>
  );
}

function Brd() {
  return (
    <Tile id="brd" icon={FileText} title="BRD-40 · v1.2" who="analyst">
      <text x={14} y={50} className="fill-foreground text-micro font-sans font-medium">
        Agentic email triage
      </text>
      <text x={14} y={64} className="fill-faint text-board-sm font-sans">
        Acme · Customer Support · owner M. Okafor
      </text>
      <text x={14} y={86} className="fill-faint text-board-sm tracking-label font-mono">
        §3 BUSINESS REQUIREMENTS
      </text>
      {BRD_REQUIREMENTS.map((runs, i) => (
        <Typed key={runs.map((r) => r[0]).join("")} x={14} y={104 + i * 19} runs={runs} />
      ))}
      <text x={14} y={194} className="fill-faint text-board-sm tracking-label font-mono">
        §5 NON-FUNCTIONAL
      </text>
      {BRD_NFRS.map((runs, i) => (
        <Typed key={runs.map((r) => r[0]).join("")} x={14} y={212 + i * 19} runs={runs} />
      ))}
      <Foot x={14} y={250}>
        <text x={16} y={0} className="fill-ok text-board-sm font-mono">
          Quality checks 48/48 · ready to sign
        </text>
      </Foot>
    </Tile>
  );
}

function Backlog() {
  return (
    <Tile id="backlog" icon={ListTree} title="Backlog · Sprint 14" who="analyst">
      {BACKLOG.map((b, i) => {
        const x = 14 + b.level * 12;
        const type = BACKLOG_TYPE[b.type];
        return (
          <g key={b.key} data-b="backlog-row" transform={`translate(0 ${50 + i * 24})`}>
            {b.level > 0 && (
              <path d={`M ${x - 7} -10 L ${x - 7} -1 L ${x - 2} -1`} fill="none" className="stroke-ghost" />
            )}
            <rect
              x={x}
              y={-8}
              width={12}
              height={12}
              rx={2.5}
              className={FILL[type.tone]}
              fillOpacity={0.18}
            />
            <Icon icon={type.icon} x={x + 2} y={-6} size={8} className={TEXT[type.tone]} />
            <text x={x + 17} y={1.5} className="fill-muted text-board-sm font-mono">
              {b.key}
            </text>
            <text
              x={x + 22 + b.key.length * 5}
              y={1.5}
              className={cn(
                "text-board font-sans",
                b.level < 2 ? "fill-foreground font-medium" : "fill-code",
              )}
            >
              {b.title}
            </text>
            {b.points !== undefined && (
              <>
                <rect
                  x={212}
                  y={-7.5}
                  width={16}
                  height={11}
                  rx={5.5}
                  className="fill-surface-raised stroke-line-strong"
                />
                <text x={220} y={0.8} textAnchor="middle" className="fill-muted text-board-sm font-mono">
                  {b.points}
                </text>
              </>
            )}
          </g>
        );
      })}
      <Foot x={14} y={250}>
        <text x={16} y={0} className="fill-ok text-board-sm font-mono">
          21 pts · Definition of Ready met
        </text>
      </Foot>
    </Tile>
  );
}

function Architecture() {
  return (
    <Tile id="arch" icon={Network} title="Architecture · rev 7" who="architect">
      {ARCH_EDGES.map((pts) => (
        <path
          key={path(pts)}
          data-b="arch-edge"
          d={path(pts)}
          fill="none"
          strokeWidth={1.2}
          className="stroke-agent"
          strokeOpacity={0.55}
        />
      ))}
      {ARCH_NODES.map((n) => (
        <g key={n.label} data-b="arch-node" transform={`translate(${n.x} ${n.y})`}>
          <rect
            width={94}
            height={34}
            rx={4}
            className={n.agent ? "fill-agent-soft stroke-agent" : "fill-surface-raised stroke-line-strong"}
          />
          <Icon icon={n.icon} x={8} y={10} size={13} className={n.agent ? "text-agent-fg" : "text-muted"} />
          <text
            x={27}
            y={20.5}
            className={cn("text-board font-sans", n.agent ? "fill-agent-fg" : "fill-code")}
          >
            {n.label}
          </text>
        </g>
      ))}
      <Foot x={12} y={236} icon={ShieldCheck}>
        <text x={16} y={0} className="fill-ok text-board-sm font-mono">
          ADR-012 · private endpoints
        </text>
        <text x={16} y={14} className="fill-faint text-board-sm font-mono">
          14 controls · 0 high findings
        </text>
      </Foot>
    </Tile>
  );
}

function PullRequest() {
  return (
    <Tile id="pr" icon={GitPullRequest} title="PR 418 · feat/INT-40-triage" who="developer">
      <g transform="translate(14 50)">
        <Icon icon={GitBranch} x={0} y={-9} size={11} className="text-muted" />
        <text x={16} y={0} className="fill-muted text-board-sm font-mono">
          feat/INT-40-triage → main
        </text>
        <text x={372} y={0} textAnchor="end" className="fill-ok text-board-sm font-mono">
          +312 −18
        </text>
      </g>
      <rect
        x={12}
        y={60}
        width={376}
        height={172}
        rx={4}
        className="fill-background stroke-line"
        fillOpacity={0.6}
      />
      {CODE.map((runs, i) => (
        <g key={runs.map((r) => r[0]).join("")}>
          <text x={30} y={80 + i * 19} textAnchor="end" className="fill-ghost text-board-sm font-mono">
            {41 + i}
          </text>
          <Typed x={40} y={80 + i * 19} runs={runs} />
        </g>
      ))}
      <rect data-b="caret" x={40} y={70} width={5} height={12} className="fill-agent" opacity={0} />
      <Foot x={14} y={254} icon={Users} tone="muted">
        <text x={16} y={0} className="fill-muted text-board-sm font-mono">
          2 reviewers · traced to BR-07, NFR-04
        </text>
        <text x={372} y={0} textAnchor="end" className="fill-agent-fg text-board-sm font-mono">
          Ready for review
        </text>
      </Foot>
    </Tile>
  );
}

function Pipeline() {
  return (
    <Tile id="pipeline" icon={Workflow} title="Pipeline run 2291" who="qa">
      {PIPELINE.map((s, i) => (
        <g key={s.name} transform={`translate(12 ${52 + i * 25})`}>
          {i < PIPELINE.length - 1 && <line x1={6} y1={7} x2={6} y2={18} className="stroke-ghost" />}
          <circle cx={6} cy={0} r={6} strokeWidth={1.5} className="fill-surface stroke-ghost" />
          <g data-b="stage-ok">
            <circle cx={6} cy={0} r={6} strokeWidth={1.5} className="fill-ok-soft stroke-ok" />
            <path
              d="M 3.2 0.2 L 5.3 2.3 L 8.8 -2"
              fill="none"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-ok"
            />
          </g>
          <Icon icon={s.icon} x={18} y={-6} size={11} className="text-faint" />
          <text data-b="stage-name" x={34} y={3} className="fill-code text-board font-sans">
            {s.name}
          </text>
          <text
            data-b="stage-result"
            x={186}
            y={3}
            textAnchor="end"
            className="fill-ok text-board-sm font-mono"
          >
            {s.result}
          </text>
        </g>
      ))}
      <text x={12} y={238} className="fill-faint text-board-sm font-mono">
        Coverage
      </text>
      <text
        data-b="coverage-pct"
        x={198}
        y={238}
        textAnchor="end"
        className="fill-muted text-board-sm font-mono"
      >
        87%
      </text>
      <rect x={12} y={246} width={186} height={5} rx={2.5} className="fill-surface-raised" />
      <rect
        data-b="coverage"
        x={12}
        y={246}
        width={162}
        height={5}
        rx={2.5}
        className="fill-agent"
        fillOpacity={0.8}
      />
    </Tile>
  );
}

function Release({ canaryRef }: { canaryRef: RefObject<SVGTextElement | null> }) {
  const diamond = "translate(6 6) rotate(45) translate(-6 -6)";
  return (
    <Tile id="release" icon={Rocket} title="CHG-20418" who="release">
      <g transform="translate(14 46)">
        <rect width={12} height={12} rx={1.5} transform={diamond} className="fill-gate" />
        <rect data-b="g4-ok" width={12} height={12} rx={1.5} transform={diamond} className="fill-ok" />
        <text
          data-b="g4-wait"
          x={20}
          y={10}
          className="fill-gate-fg text-board font-sans font-medium"
          opacity={0}
        >
          G4 · Release approval
        </text>
        <text data-b="g4-done" x={20} y={10} className="fill-ok text-board font-sans font-medium">
          G4 · Approved
        </text>
      </g>
      {APPROVERS.map((a, i) => (
        <g key={a.role} transform={`translate(14 ${84 + i * 26})`}>
          <g data-b={a.approved ? undefined : "ciso-wait"} opacity={0}>
            {!a.approved && (
              <>
                <circle cx={6} cy={-3} r={6} strokeWidth={1.2} className="fill-gate-soft stroke-gate" />
                <Icon icon={Clock} x={2} y={-7} size={8} className="text-gate" />
                <text x={18} y={9} className="fill-gate-fg text-board-sm font-mono">
                  pending
                </text>
              </>
            )}
          </g>
          <g data-b={a.approved ? undefined : "ciso-ok"}>
            <circle cx={6} cy={-3} r={6} strokeWidth={1.2} className="fill-ok-soft stroke-ok" />
            <Icon icon={Check} x={2} y={-7} size={8} className="text-ok" />
            <text x={18} y={9} className="fill-faint text-board-sm font-mono">
              {a.approved ? a.who : `${a.who} · just now`}
            </text>
          </g>
          <text x={18} y={-2} className="fill-code text-board font-sans">
            {a.role}
          </text>
        </g>
      ))}
      <g data-b="approve" transform="translate(14 166)" opacity={0.25}>
        <rect width={172} height={26} rx={4} className="fill-gate" />
        <rect data-b="approve-flash" width={172} height={26} rx={4} className="fill-gate-fg" opacity={0} />
        <Icon icon={PenLine} x={40} y={7} size={12} className="text-gate-ink" />
        <text x={58} y={17} className="fill-gate-ink text-nano font-sans font-medium">
          Approve release
        </text>
      </g>
      <circle
        data-b="ripple"
        cx={100}
        cy={179}
        r={4}
        fill="none"
        strokeWidth={1.5}
        className="stroke-human-fg"
        opacity={0}
      />
      <text x={14} y={214} className="fill-faint text-board-sm font-mono">
        Canary
      </text>
      <text ref={canaryRef} x={186} y={214} textAnchor="end" className="fill-muted text-board-sm font-mono">
        {CANARY_STEPS[CANARY_STEPS.length - 1]?.label}
      </text>
      <rect x={14} y={222} width={172} height={6} rx={3} className="fill-surface-raised" />
      <rect data-b="canary" x={14} y={222} width={172} height={6} rx={3} className="fill-ok" />
      {[0.1, 0.5].map((f) => (
        <line
          key={f}
          x1={14 + 172 * f}
          y1={220}
          x2={14 + 172 * f}
          y2={230}
          strokeWidth={1.5}
          className="stroke-background"
        />
      ))}
      <Foot x={14} y={254}>
        <text x={16} y={0} className="fill-ok text-board-sm font-mono">
          Live · SLO 99.95% met
        </text>
        <text x={16} y={13} className="fill-faint text-board-sm font-mono">
          Signed · SLSA provenance
        </text>
      </Foot>
    </Tile>
  );
}

function Wire({ points, gate }: { points: [number, number][]; gate?: string }) {
  const last = points[points.length - 1] ?? [0, 0];
  const prev = points[points.length - 2] ?? [0, 0];
  const angle = (Math.atan2(last[1] - prev[1], last[0] - prev[0]) * 180) / Math.PI;
  const mid: [number, number] = [
    (points[0]?.[0] ?? 0) / 2 + last[0] / 2,
    (points[0]?.[1] ?? 0) / 2 + last[1] / 2,
  ];
  const vertical = Math.abs(last[0] - prev[0]) < 1;
  const head = "M -6 -3.5 L 0 0 L -6 3.5";
  const at = `translate(${last[0]} ${last[1]}) rotate(${angle})`;
  return (
    <g data-b="wire">
      <path
        data-b="wire-line"
        d={path(points)}
        fill="none"
        strokeWidth={1.5}
        className="stroke-line-strong"
      />
      <path
        data-b="wire-head"
        d={head}
        transform={at}
        fill="none"
        strokeWidth={1.5}
        className="stroke-line-strong"
      />
      <path
        data-b="wire-live"
        d={path(points)}
        fill="none"
        strokeWidth={1.5}
        className="stroke-agent"
        opacity={0}
      />
      <path
        data-b="wire-live-head"
        d={head}
        transform={at}
        fill="none"
        strokeWidth={1.5}
        className="stroke-agent"
        opacity={0}
      />
      {gate && (
        <g data-b="wire-gate" transform={`translate(${mid[0]} ${mid[1]})`}>
          <rect
            x={-4.5}
            y={-4.5}
            width={9}
            height={9}
            rx={1.2}
            transform="rotate(45)"
            strokeWidth={2}
            className="fill-gate stroke-background"
          />
          <rect
            data-b="wire-gate-ok"
            x={-4.5}
            y={-4.5}
            width={9}
            height={9}
            rx={1.2}
            transform="rotate(45)"
            strokeWidth={2}
            className="fill-ok stroke-background"
          />
          <text
            x={vertical ? 10 : 0}
            y={vertical ? 3 : -11}
            textAnchor={vertical ? "start" : "middle"}
            className="fill-gate-fg text-board-sm tracking-label font-mono"
          >
            {gate}
          </text>
        </g>
      )}
    </g>
  );
}

/**
 * The landing hero's background: one work item built by agents from BRD to release,
 * with a gate on every hand-off and a person approving the release. Renders the finished
 * board; the GSAP timeline replays it, and is skipped under reduced motion.
 */
export function DeliveryBoard({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canaryRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (
      !svg ||
      typeof IntersectionObserver === "undefined" ||
      !("getComputedTextLength" in SVGTextElement.prototype)
    )
      return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    let cleanup = () => {};
    const start = () => {
      if (cancelled) return;
      cleanup = buildTimeline(svg, {
        approve: APPROVE_POINT,
        handStart: HAND_START,
        canarySteps: CANARY_STEPS,
        setCanaryLabel: (label) => {
          if (canaryRef.current) canaryRef.current.textContent = label;
        },
      });
    };
    if (document.fonts?.ready) document.fonts.ready.then(start);
    else start();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={BOARD_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={className}
    >
      <g data-b="wires">
        {WIRES.map((w) => (
          <Wire key={w.id} points={w.points} gate={w.gate} />
        ))}
      </g>
      <g data-b="board">
        <Brd />
        <Backlog />
        <Architecture />
        <PullRequest />
        <Pipeline />
        <Release canaryRef={canaryRef} />
      </g>
      <g data-b="hand" opacity={0}>
        <path
          d="M 0 0 L 0 16 L 4.5 12 L 7.5 18.5 L 10 17.3 L 7 11 L 13 11 Z"
          strokeWidth={1}
          className="fill-human-fg stroke-background"
        />
        <g transform="translate(14 20)">
          <rect width={78} height={18} rx={3} className="fill-human-fg" />
          <text x={8} y={12.5} className="fill-background text-board font-sans font-medium">
            P. Nair · CISO
          </text>
        </g>
      </g>
    </svg>
  );
}
