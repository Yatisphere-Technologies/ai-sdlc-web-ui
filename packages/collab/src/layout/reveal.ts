/**
 * Scroll an element into view inside its own scrolling panel only. `scrollIntoView` also scrolls
 * every ancestor, including overflow-hidden page frames, which shifts a full-screen layout.
 */
export function reveal(
  el: Element | null | undefined,
  {
    block = "nearest",
    smooth = true,
    margin = 16,
  }: { block?: "start" | "center" | "end" | "nearest"; smooth?: boolean; margin?: number } = {},
) {
  if (!el) return;
  let box = el.parentElement;
  while (box) {
    const { overflowY } = getComputedStyle(box);
    if ((overflowY === "auto" || overflowY === "scroll") && box.scrollHeight > box.clientHeight) break;
    box = box.parentElement;
  }
  if (!box) return;
  const view = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const offset = r.top - view.top;
  const room = box.clientHeight - r.height;
  let delta: number;
  if (block === "start") delta = offset - margin;
  else if (block === "center") delta = offset - room / 2;
  else if (block === "end") delta = offset - room;
  else if (offset < margin) delta = offset - margin;
  else if (r.bottom > view.bottom) delta = r.bottom - view.bottom + 16;
  else return;
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  box.scrollTo?.({ top: box.scrollTop + delta, behavior: smooth && !reduce ? "smooth" : "auto" });
}
