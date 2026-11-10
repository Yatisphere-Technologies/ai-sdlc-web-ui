import { BRANDS, BrandLogo } from "@/components/brand";
import { TOOLS } from "../content";

// The list is rendered twice so the marquee can loop seamlessly; the copy is hidden from screen readers.
const LOOP = [0, 1].flatMap((copy) => TOOLS.map((id) => ({ id, copy })));

export function ToolStrip() {
  return (
    <section
      id="integrations"
      aria-label="Integrations"
      className="flex scroll-mt-24 flex-col items-center gap-6 py-10"
    >
      <span className="eyebrow text-muted">Plugs into the tools you already run · nothing to rip out</span>
      <div className="fade-edges w-full overflow-hidden">
        <ul className="marquee gap-10">
          {LOOP.map(({ id, copy }) => (
            <li
              key={`${copy}-${id}`}
              aria-hidden={copy === 1}
              className="text-subtle text-heading-sm flex items-center gap-3 whitespace-nowrap"
            >
              <BrandLogo brand={id} size="lg" />
              {BRANDS[id].name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
