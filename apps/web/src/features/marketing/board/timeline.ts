import { gsap } from "gsap";

type Options = {
  approve: { x: number; y: number };
  handStart: { x: number; y: number };
  canarySteps: readonly { at: number; label: string }[];
  setCanaryLabel: (label: string) => void;
};

/**
 * Replays the delivery board as one loop: each agent produces its artifact, every hand-off
 * passes a gate, and a person approves the release. Elements are found by `data-b` names
 * rendered in DeliveryBoard.tsx. Returns a cleanup that restores the finished board.
 */
export function buildTimeline(svg: SVGSVGElement, opts: Options): () => void {
  const all = (name: string, root: Element = svg) =>
    Array.from(root.querySelectorAll<SVGGraphicsElement>(`[data-b="${name}"]`));
  const one = (name: string, root: Element = svg) => all(name, root)[0] ?? null;

  const tiles = all("tile");
  const [brd, backlog, arch, pr, pipeline, release] = tiles;
  if (!brd || !backlog || !arch || !pr || !pipeline || !release) return () => {};

  const typedIn = (root: Element) =>
    all("typed", root).map((g) => {
      const text = g.querySelector("text");
      const chars = Number(g.dataset.chars ?? 1);
      return {
        clip: g.querySelector('[data-b="clip"]'),
        chars,
        width: (text?.getComputedTextLength() ?? chars * 5) + 6,
      };
    });
  const brdLines = typedIn(brd);
  const codeLines = typedIn(pr);

  const wires = all("wire").map((g) => {
    const line = one("wire-line", g) as SVGPathElement | null;
    return {
      line,
      live: one("wire-live", g),
      head: one("wire-head", g),
      liveHead: one("wire-live-head", g),
      gate: one("wire-gate", g),
      gateOk: one("wire-gate-ok", g),
      len: line?.getTotalLength() ?? 0,
    };
  });
  const archEdges = (all("arch-edge", arch) as SVGPathElement[]).map((p) => ({ p, len: p.getTotalLength() }));
  const caret = one("caret", pr);
  const hand = one("hand");
  const ripple = one("ripple", release);

  const ctx = gsap.context(() => {
    for (const w of wires) gsap.set([w.line, w.live], { attr: { "stroke-dasharray": w.len } });
    for (const e of archEdges) gsap.set(e.p, { attr: { "stroke-dasharray": e.len } });

    const tl = gsap.timeline({
      repeat: -1,
      repeatDelay: 0.3,
      paused: true,
      defaults: { ease: "power2.out" },
    });

    // Start of every loop: an empty board.
    tl.set(tiles, { opacity: 0.5 }, 0)
      .set(all("clip"), { attr: { width: 0 } }, 0)
      .set(all("foot"), { opacity: 0 }, 0)
      .set(all("backlog-row"), { opacity: 0, x: -8 }, 0)
      .set(all("arch-node"), { opacity: 0, scale: 0.9, transformOrigin: "50% 50%" }, 0)
      .set(all("stage-ok"), { opacity: 0 }, 0)
      .set(all("stage-result"), { opacity: 0 }, 0)
      .set(all("stage-name"), { opacity: 0.5 }, 0)
      .set(one("coverage"), { scaleX: 0, transformOrigin: "0% 50%" }, 0)
      .set(one("coverage-pct"), { opacity: 0 }, 0)
      .set([one("g4-ok"), one("g4-done"), one("ciso-ok")], { opacity: 0 }, 0)
      .set([one("g4-wait"), one("ciso-wait"), one("approve")], { opacity: 1 }, 0)
      .set(one("canary"), { scaleX: 0, transformOrigin: "0% 50%" }, 0)
      .call(() => opts.setCanaryLabel("0%"), undefined, 0)
      .set(hand, { opacity: 0, ...opts.handStart }, 0)
      .set([one("board"), one("wires")], { opacity: 1 }, 0);
    for (const w of wires) {
      tl.set([w.line, w.live], { attr: { "stroke-dashoffset": w.len } }, 0)
        .set([w.head, w.liveHead, w.gateOk], { opacity: 0 }, 0)
        .set(w.live, { opacity: 1 }, 0)
        .set(w.gate, { opacity: 0.5 }, 0);
    }
    for (const e of archEdges) tl.set(e.p, { attr: { "stroke-dashoffset": e.len } }, 0);

    const focus = (tile: Element, at: number) => tl.to(tile, { opacity: 1, duration: 0.4 }, at);
    const settle = (tile: Element, at: number) => tl.to(tile, { opacity: 0.82, duration: 0.6 }, at);
    const type = (
      line: { clip: Element | null; chars: number; width: number },
      at: number,
      perChar = 0.018,
    ) => {
      const d = Math.min(0.7, line.chars * perChar);
      tl.to(line.clip, { attr: { width: line.width }, duration: d, ease: `steps(${line.chars})` }, at);
      return d;
    };
    const handoff = (i: number, at: number) => {
      const w = wires[i];
      if (!w) return at;
      let t = at;
      if (w.gate) {
        tl.to(w.gate, { opacity: 1, duration: 0.2 }, t)
          .to(w.gateOk, { opacity: 1, duration: 0.2 }, t + 0.25)
          .fromTo(
            w.gate,
            { scale: 1.5, transformOrigin: "50% 50%" },
            { scale: 1, duration: 0.4, ease: "back.out(3)" },
            t + 0.25,
          );
        t += 0.35;
      }
      tl.to([w.line, w.live], { attr: { "stroke-dashoffset": 0 }, duration: 0.4, ease: "power1.inOut" }, t)
        .to([w.head, w.liveHead], { opacity: 1, duration: 0.15 }, t + 0.3)
        .to([w.live, w.liveHead], { opacity: 0, duration: 0.8 }, t + 0.9);
      return t + 0.45;
    };

    let t = 0.15;
    // 1 · BRD: the analyst agent writes requirements
    focus(brd, t);
    for (const line of brdLines) t += type(line, t + 0.1) + 0.08;
    tl.to(one("foot", brd), { opacity: 1, duration: 0.3 }, t + 0.1);
    settle(brd, t + 0.9);
    t = handoff(0, t + 0.4);

    // 2 · Backlog: epic → features → stories
    focus(backlog, t);
    const rows = all("backlog-row", backlog);
    tl.to(rows, { opacity: 1, x: 0, duration: 0.3, stagger: 0.13 }, t + 0.1);
    t += 0.3 + rows.length * 0.13;
    tl.to(one("foot", backlog), { opacity: 1, duration: 0.3 }, t);
    settle(backlog, t + 0.8);
    t = handoff(1, t + 0.3);

    // 3 · Architecture: building blocks and their connections
    focus(arch, t);
    tl.to(
      all("arch-node", arch),
      { opacity: 1, scale: 1, duration: 0.3, stagger: 0.1, ease: "back.out(2)" },
      t + 0.1,
    );
    archEdges.forEach((e, i) => {
      tl.to(
        e.p,
        { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "power1.inOut" },
        t + 0.6 + i * 0.12,
      );
    });
    t += 1.4;
    tl.to(one("foot", arch), { opacity: 1, duration: 0.3 }, t);
    settle(arch, t + 0.8);
    t = handoff(2, t + 0.3);

    // 4 · Pull request: the developer agent types the change
    focus(pr, t);
    tl.set(caret, { opacity: 1 }, t + 0.1);
    codeLines.forEach((line, i) => {
      const start = t + 0.15;
      tl.set(caret, { attr: { x: 40, y: 71 + i * 19 } }, start);
      const d = type(line, start, 0.016);
      tl.to(caret, { attr: { x: 34 + line.width }, duration: d, ease: `steps(${line.chars})` }, start);
      t = start + d + 0.04;
    });
    tl.to(caret, { opacity: 0, duration: 0.15 }, t).to(one("foot", pr), { opacity: 1, duration: 0.3 }, t);
    settle(pr, t + 0.9);
    t = handoff(3, t + 0.2);

    // 5 · Pipeline: each stage passes
    focus(pipeline, t);
    const oks = all("stage-ok", pipeline);
    const names = all("stage-name", pipeline);
    const results = all("stage-result", pipeline);
    oks.forEach((ok, i) => {
      const at = t + 0.15 + i * 0.24;
      tl.to(ok, { opacity: 1, duration: 0.15 }, at)
        .to(names[i] ?? null, { opacity: 1, duration: 0.15 }, at)
        .to(results[i] ?? null, { opacity: 1, duration: 0.2 }, at + 0.05);
    });
    t += 0.15 + oks.length * 0.24;
    tl.to(one("coverage"), { scaleX: 1, duration: 0.6 }, t).to(
      one("coverage-pct"),
      { opacity: 1, duration: 0.3 },
      t + 0.3,
    );
    settle(pipeline, t + 1.2);
    t = handoff(4, t + 0.5);

    // 6 · Release: a person approves G4, then the canary rolls out
    focus(release, t);
    const { x, y } = opts.approve;
    tl.to(hand, { opacity: 1, duration: 0.3 }, t + 0.2)
      .to(hand, { x, y, duration: 1.1, ease: "power3.inOut" }, t + 0.2)
      .to(one("approve-flash"), { opacity: 1, duration: 0.08, yoyo: true, repeat: 1 }, t + 1.35)
      .fromTo(
        ripple,
        { attr: { r: 4 }, opacity: 0.9 },
        { attr: { r: 26 }, opacity: 0, duration: 0.6 },
        t + 1.35,
      )
      .to(one("approve"), { opacity: 0.25, duration: 0.25 }, t + 1.6)
      .to(one("ciso-ok"), { opacity: 1, duration: 0.2 }, t + 1.5)
      .to(one("ciso-wait"), { opacity: 0, duration: 0.2 }, t + 1.5)
      .to([one("g4-ok"), one("g4-done")], { opacity: 1, duration: 0.25 }, t + 1.65)
      .to(one("g4-wait"), { opacity: 0, duration: 0.25 }, t + 1.65)
      .to(hand, { opacity: 0, x: x + 60, y: y + 40, duration: 0.6 }, t + 1.9);
    const rollout = t + 2;
    opts.canarySteps.forEach((s, i) => {
      tl.to(one("canary"), { scaleX: s.at, duration: 0.6, ease: "power1.inOut" }, rollout + i * 0.9).call(
        () => opts.setCanaryLabel(s.label),
        undefined,
        rollout + i * 0.9 + 0.3,
      );
    });
    tl.to(one("foot", release), { opacity: 1, duration: 0.3 }, rollout + 2.8);

    // Hold the finished board, then fade before the loop starts again.
    const end = rollout + 5.2;
    tl.to([one("board"), one("wires")], { opacity: 0.2, duration: 0.6 }, end - 0.6);

    // Run only while the hero is on screen and the tab is visible.
    let onScreen = true;
    const sync = () => (onScreen && !document.hidden ? tl.play() : tl.pause());
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    observer.observe(svg);
    document.addEventListener("visibilitychange", sync);
    tl.play();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, svg);

  return () => ctx.revert();
}
