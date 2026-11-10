import type { Cloud } from "@throughline/contracts";
import { brandDataUri, brandIn } from "@/components/brand";

/**
 * Official vendor service icons, used unchanged inside diagrams (vendor terms forbid recolouring
 * or distorting them, so they sit on a neutral tile instead of taking the category colour).
 *
 * Azure: Microsoft Azure Public Service Icons V24 (July 2026), from
 * https://learn.microsoft.com/azure/architecture/icons/. Microsoft permits their use in
 * architectural diagrams, training materials and documentation (terms in Microsoft_Terms_of_Use.pdf
 * next to the files). AWS and Google Cloud sets are not bundled yet; those diagrams keep our icons.
 * File names are our role keys (see mocks/architect/catalog.ts); add a role by copying the matching
 * SVG from the official pack under that name.
 */
const azureRaw = import.meta.glob<string>("./azure/*.svg", { query: "?raw", import: "default", eager: true });

const toDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const AZURE: Record<string, string> = Object.fromEntries(
  Object.entries(azureRaw).map(([path, svg]) => [path.replace(/^.*\/|\.svg$/g, ""), toDataUri(svg)]),
);

/** Role keys that share another role's icon. */
const ALIAS: Record<string, string> = { staff: "users" };

/** The vendor icon for a role on a cloud, as a data URI, or null when we draw our own. */
export function vendorIcon(cloud: Cloud | undefined, role: string): string | null {
  if (cloud !== "azure") return null;
  return AZURE[ALIAS[role] ?? role] ?? null;
}

export const VENDOR_ICON_ROLES = { azure: Object.keys(AZURE) };

/**
 * Official logo of a third-party product an external system is named after ("CRM (Salesforce)"),
 * as a data URI so diagram exports stay self-contained. Drawn on `brand-tile`, never recoloured.
 */
export function externalBrandIcon(category: string, label: string): string | null {
  if (category !== "external") return null;
  const id = brandIn(label);
  return id ? brandDataUri(id) : null;
}
