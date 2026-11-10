import { cn } from "@throughline/ui";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type SplitCollapsed = "start" | "end" | null;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Reads a stored ratio; storage may be missing or blocked (private windows, previews). */
function readRatio(key: string | undefined, fallback: number) {
  if (!key) return fallback;
  try {
    const v = Number(globalThis.localStorage?.getItem(key));
    return Number.isFinite(v) && v > 0 && v < 1 ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeRatio(key: string | undefined, v: number) {
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, String(v));
  } catch {
    // Storage is a convenience; the layout works without it.
  }
}

/** Width share for the start pane after a drag to clientX inside a box. */
export function ratioAt(
  clientX: number,
  box: { left: number; width: number },
  minStartPx: number,
  minEndPx: number,
) {
  if (box.width <= 0) return 0.5;
  const lo = Math.min(0.9, minStartPx / box.width);
  const hi = Math.max(0.1, 1 - minEndPx / box.width);
  return clamp((clientX - box.left) / box.width, lo, Math.max(lo, hi));
}

/**
 * Two panes side by side with a draggable divider (pointer or arrow keys), either of which can be
 * collapsed. The split is remembered per `storageKey`. Below the `lg` breakpoint only one pane shows
 * at a time; the host chooses which with `mobile`.
 */
export function SplitPane({
  start,
  end,
  startLabel,
  endLabel,
  collapsed = null,
  defaultRatio = 0.42,
  minStart = 320,
  minEnd = 420,
  storageKey,
  mobile = "start",
  className,
}: {
  start: ReactNode;
  end: ReactNode;
  startLabel: string;
  endLabel: string;
  /** Which side is collapsed (hidden), if any. Controlled by the host. */
  collapsed?: SplitCollapsed;
  /** Share of the width for the start pane, 0–1. */
  defaultRatio?: number;
  minStart?: number;
  minEnd?: number;
  storageKey?: string;
  /** On narrow screens, which pane shows. */
  mobile?: "start" | "end";
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => readRatio(storageKey, defaultRatio));
  const [dragging, setDragging] = useState(false);
  const latest = useRef(ratio);
  latest.current = ratio;

  useEffect(() => {
    if (!dragging) writeRatio(storageKey, ratio);
  }, [dragging, ratio, storageKey]);

  const move = useCallback(
    (clientX: number) => {
      const r = box.current?.getBoundingClientRect();
      if (r) setRatio(ratioAt(clientX, r, minStart, minEnd));
    },
    [minStart, minEnd],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.03;
    const r = box.current?.getBoundingClientRect();
    // Keyboard moves respect the same minimum widths as dragging.
    const to = (v: number) =>
      setRatio(r && r.width > 0 ? ratioAt(r.left + v * r.width, r, minStart, minEnd) : clamp(v, 0.15, 0.85));
    if (e.key === "ArrowLeft") to(clamp(latest.current - step, 0, 1));
    else if (e.key === "ArrowRight") to(clamp(latest.current + step, 0, 1));
    else if (e.key === "Home") to(0);
    else if (e.key === "End") to(1);
    else return;
    e.preventDefault();
  };

  const both = collapsed === null;
  const pct = `${Math.round(ratio * 1000) / 10}%`;
  return (
    <div
      ref={box}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1",
        dragging && "cursor-col-resize select-none",
        className,
      )}
    >
      <section
        aria-label={startLabel}
        className={cn(
          "min-h-0 min-w-0 flex-col",
          collapsed === "start" ? "hidden" : mobile === "start" ? "flex" : "hidden lg:flex",
          // Full width on small screens; the dragged share from lg up.
          "flex-1",
          both && "lg:shrink-0 lg:grow-0 lg:basis-(--split)",
          dragging ? "" : "transition-[flex-basis] duration-200 motion-reduce:transition-none",
        )}
        // The width is the user's own drag position, so it can't come from the token scale.
        style={both ? ({ "--split": pct } as CSSProperties) : undefined}
      >
        {start}
      </section>
      {both ? (
        // biome-ignore lint/a11y/useSemanticElements: an interactive window splitter has no native element
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${startLabel} and ${endLabel}`}
          aria-valuemin={15}
          aria-valuemax={85}
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={(e) => dragging && move(e.clientX)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onDoubleClick={() => setRatio(defaultRatio)}
          onKeyDown={onKey}
          className="group/sep hover:bg-agent-wash focus-visible:bg-agent-wash relative z-20 hidden w-1.5 shrink-0 cursor-col-resize outline-none lg:block"
        >
          <span
            className={cn(
              "bg-line group-hover/sep:bg-agent group-focus-visible/sep:bg-agent absolute inset-y-0 left-1/2 w-px -translate-x-1/2",
              dragging && "bg-agent",
            )}
          />
        </div>
      ) : null}
      <section
        aria-label={endLabel}
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          collapsed === "end" ? "hidden" : mobile === "end" ? "flex" : "hidden lg:flex",
        )}
      >
        {end}
      </section>
    </div>
  );
}
