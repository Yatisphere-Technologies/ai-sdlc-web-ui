import type { Backlog, Brd, BrdSource, BrdThread, CommentThread } from "@throughline/contracts";

/** How the BA agent would split one business requirement into stories (from its refinement notes). */
export type StoryHint = {
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  criteria: [given: string, when: string, then: string][];
  points: number;
  components: string[];
  labels?: string[];
  /** NFR ids that apply, when the agent knows better than the defaults. */
  nfrs?: string[];
  /** Titles of stories this one needs first. */
  dependsOn?: string[];
  /** Edge cases worth testing beyond the criteria. */
  edge?: string[];
  /** Implementation notes and assumptions. */
  notes?: string[];
};

/**
 * Server-side record for one BRD: the document, its reference sources, the conversation with the
 * BA agent, the agent's refinement notes and the backlog generated from it.
 */
export type BrdRecord = {
  brd: Brd;
  sources: BrdSource[];
  thread: BrdThread;
  /** Comment threads anchored to parts of the document. */
  comments: CommentThread[];
  /** Counter for proposal and message ids. */
  seq: number;
  hints: Record<string, StoryHint[]>;
  backlog: Backlog;
};
