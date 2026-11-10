import { type Brd, type BrdDocUpdate, buildBody, type DocNode } from "@throughline/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveDocument } from "./api";

export type SaveState = "saved" | "dirty" | "saving" | "error";

export type LocalDoc = BrdDocUpdate & { body: DocNode };

const fromBrd = (b: Brd): LocalDoc => ({
  body: (b.body as DocNode | undefined) ?? buildBody(b.content, b.layout, b.customSections),
  title: b.title,
  owner: b.owner,
  workItemKey: b.workItemKey,
  content: b.content,
  layout: b.layout,
  customSections: b.customSections,
  approvals: b.approvals.map(({ id, capacity, name }) => ({ id, capacity, name })),
});

/**
 * Local copy of the document with autosave. Edits apply instantly on screen and save after a short
 * pause. When the server's copy changes (an accepted proposal), the local copy follows unless there
 * are unsaved edits; callers flush() first so nothing is lost.
 */
export function useDocument(brd: Brd, editable: boolean) {
  const save = useSaveDocument(brd.id);
  const [doc, setDoc] = useState<LocalDoc>(() => fromBrd(brd));
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string>(brd.updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) {
      const next = fromBrd(brd);
      latest.current = next;
      setDoc(next);
      setSavedAt(brd.updatedAt);
    }
  }, [brd]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    setState("saving");
    try {
      const out = await save.mutateAsync(latest.current);
      dirty.current = false;
      setState("saved");
      setSavedAt(out.brd.updatedAt);
    } catch {
      setState("error");
    }
  }, [save]);

  const update = useCallback(
    (fn: (d: LocalDoc) => LocalDoc) => {
      if (!editable) return;
      const next = fn(latest.current);
      latest.current = next;
      dirty.current = true;
      setDoc(next);
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 900);
    },
    [editable, flush],
  );

  // Leaving the studio saves whatever is pending.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(
    () => () => {
      if (dirty.current) void flushRef.current();
    },
    [],
  );

  return { doc, update, flush, state, savedAt, error: save.error };
}
