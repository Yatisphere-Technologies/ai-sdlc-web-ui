/** Saves text or a binary blob as a file in the browser. */
export function download(filename: string, content: string | Blob, type: string) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "color",
] as const;

/**
 * Serialises a rendered diagram as a standalone SVG. Token classes only exist in the app's CSS, so
 * the computed values are written onto each element; the file then renders anywhere.
 */
export function standaloneSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const source = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const target = [clone, ...Array.from(clone.querySelectorAll("*"))];
  source.forEach((el, i) => {
    const out = target[i];
    if (!out) return;
    const cs = getComputedStyle(el);
    const inline = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";");
    out.setAttribute("style", inline);
    out.removeAttribute("class");
    out.removeAttribute("tabindex");
    out.removeAttribute("role");
  });
  clone.setAttribute("width", svg.viewBox.baseVal.width.toString());
  clone.setAttribute("height", svg.viewBox.baseVal.height.toString());
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}
