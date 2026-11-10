import type { PageContext } from "@throughline/contracts";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type OpenOptions = {
  /** Sent straight away. */
  prompt?: string;
  /** Overrides the page's own context for this question. */
  context?: PageContext;
  /** Start a fresh conversation. */
  fresh?: boolean;
};

type AssistantState = {
  isOpen: boolean;
  open: (o?: OpenOptions) => void;
  close: () => void;
  toggle: () => void;
  conversationId: string | null;
  setConversationId: (id: string | null) => void;
  /** Prompt waiting to be sent by whichever assistant view is showing. */
  pending: { prompt: string; context: PageContext | null } | null;
  takePending: () => { prompt: string; context: PageContext | null } | null;
  /** What the current page says it is about. */
  page: PageContext | null;
  setPage: (c: PageContext | null) => void;
};

const Ctx = createContext<AssistantState | null>(null);

/** Holds the assistant's open state, current conversation and the page's context. One per workspace. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [page, setPage] = useState<PageContext | null>(null);
  const [pending, setPending] = useState<AssistantState["pending"]>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const open = useCallback((o: OpenOptions = {}) => {
    if (o.fresh || o.prompt) setConversationId((id) => (o.fresh ? null : id));
    if (o.prompt) setPending({ prompt: o.prompt, context: o.context ?? null });
    setOpen(true);
  }, []);
  const takePending = useCallback(() => {
    const p = pendingRef.current;
    if (p) setPending(null);
    return p;
  }, []);

  const value = useMemo<AssistantState>(
    () => ({
      isOpen,
      open,
      close: () => setOpen(false),
      toggle: () => setOpen((o) => !o),
      conversationId,
      setConversationId,
      pending,
      takePending,
      page,
      setPage,
    }),
    [isOpen, open, conversationId, pending, takePending, page],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAssistant needs AssistantProvider");
  return c;
}

/**
 * Tells the assistant what this page is about, e.g. `{ label: "Project UPI", path: "/projects/UPI",
 * projectId }`. Questions like "summarise this" then refer to it. Cleared when the page unmounts.
 */
export function useAssistantPageContext(context: PageContext | null) {
  const c = useContext(Ctx);
  const key = context ? `${context.label}|${context.path}|${context.projectId}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key captures the context's value
  useEffect(() => {
    if (!c) return;
    c.setPage(context);
    return () => c.setPage(null);
  }, [key]);
}
