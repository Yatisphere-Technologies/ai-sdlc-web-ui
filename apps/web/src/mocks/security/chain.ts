import type { AuditEvent } from "@throughline/contracts";

/**
 * Hash chain for the audit log. Each event's hash covers its content and the previous hash, so
 * editing or deleting any event breaks every hash after it. A stand-in for SHA-256 in the real
 * service (two FNV-1a passes, 64 bits of hex): deterministic and fast, not cryptographic.
 */
function fnv(text: string, seed: number) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export const digest = (text: string) => `${fnv(text, 0x811c9dc5)}${fnv(text, 0x050c5d1f)}`;

export const GENESIS = "0".repeat(16);

type Body = Omit<AuditEvent, "id" | "seq" | "prev" | "hash">;

const canonical = (e: Body & { seq: number; prev: string }) =>
  [
    e.seq,
    e.at,
    e.actor.type,
    e.actor.id,
    e.category,
    e.action,
    e.target,
    e.outcome,
    e.ip ?? "",
    e.detail,
    e.prev,
  ].join("|");

/** Appends to a chain kept oldest first. */
export function chainAppend(chain: AuditEvent[], body: Body): AuditEvent {
  const last = chain[chain.length - 1];
  const seq = (last?.seq ?? 0) + 1;
  const prev = last?.hash ?? GENESIS;
  const hash = digest(canonical({ ...body, seq, prev }));
  const event: AuditEvent = { ...body, id: `ev-${seq}`, seq, prev, hash };
  chain.push(event);
  return event;
}

/** Re-computes every link; returns the seq of the first broken event, or null. */
export function verifyChain(chain: readonly AuditEvent[]): number | null {
  let prev = GENESIS;
  for (const e of chain) {
    if (e.prev !== prev || digest(canonical(e)) !== e.hash) return e.seq;
    prev = e.hash;
  }
  return null;
}
