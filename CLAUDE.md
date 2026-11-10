# Rules for AI assistants

See README.md for setup and architecture. These rules are enforced by lint and tests.

## Routes

- Public: `/` (landing, `features/marketing`), `/login` (`features/auth`). Everything else requires a session via `requireSession()` in the route's `beforeLoad`.
- Post-login redirects must go through `safeRedirect()`.

## Tenancy (never break these)

- Signed-in screens live under `/t/$tenantSlug` (route files in `apps/web/src/app/routes`). Never add tenant data screens outside it.
- Feature code gets tenant data only through `useTenant()`: `api` (tenant-scoped client) and `keys` (tenant-scoped query keys). Never call `fetch` directly and never hand-write query keys.
- New tenant-scoped endpoint: add the zod schema to `packages/contracts`, a handler in `src/mocks/handlers.ts` that starts with `guardTenant(...)`, and extend `isolation.test.ts` if it writes data.
- The UI never decides permissions. Show/hide with `can()` / `<Can>`, and make the mock (and API) enforce with `guardTenant(request, id, action)`.

## Design tokens (strict)

- Style only with semantic token classes from `packages/tokens/src/tokens.css`. No raw colours, no Tailwind palette classes (`bg-blue-500`, `text-white`), no arbitrary sizes (`text-[13px]`), no inline colour or typography styles.
- New design value? Add it to `tokens.css` (primitive → semantic → `@theme`), and give it a value in both themes: dark (`:root, [data-theme="dark"]`) and light (`[data-theme="light"]`). Never hard-code a colour that only works on one of them.
- Themes: `apps/web/src/theme` (`ThemeMenu`, `useThemeChoice`: light, dark or system, saved per browser; `index.html` applies it before first paint). The public pages (`/`, `/login`) stay dark with `usePinnedTheme("dark")`.
- Use `@throughline/ui` components (Button variants `primary`, `gate`, `secondary`, `ghost`, `danger`) instead of hand-styled elements. Standard controls come from there, built on Radix and themed with tokens; never use the browser's own:
  - `Select` (not `<select>`): options can carry a description, icon, status `dot`, `meta` count and `group`.
  - `Tooltip` (not `title=`) on icon-only buttons and truncated text; keep the `aria-label` too. `TooltipProvider` is mounted in `App`.
  - `Dialog`/`DialogContent` for forms in a modal; `ConfirmDialog` before anything consequential or hard to undo (submit, approve, push to Jira, undo all, regenerate). Never `window.confirm`/`alert`/`prompt`.
  - `toast` (sonner, `Toaster` mounted in `App`, follows the theme) to confirm a completed action or report a failed one. Writes declare their toasts with the `notify` option of `useTenantWrite` / `useStudioWrite`; inline `ErrorNote` stays for errors the user must fix in place.
  - `Menu` for action lists, `Popover` for small floating panels.
- Third-party products (integrations, identity providers, test tools, SIEMs, agent tools, named external systems in diagrams) show their official logo through `BrandLogo` / `brandOf` / `brandIn` (`components/brand`), on `bg-brand-tile`, never recoloured. Logo files and their sources are listed in `components/brand/brands.ts`; Biome ignores `brand/logos`. Add a brand only from the vendor's own published asset.
- Keep colour meanings: agent = agents/movement, gate = human decision, ok = verified, risk = danger, ion = secondary.

## Programs and projects (the root of everything)

- Hierarchy: Program → Project → work items → artifacts. Contracts in `packages/contracts/src/projects.ts` (`Program`, `Project`, `ArtifactLink`, `ProjectPlan`, read models `Portfolio`/`ProjectOverview`).
- Nothing is orphaned: `WorkItem`, `Brd` and `Architecture` carry a `projectId`; specs, designs, packs, builds, changes, releases, incidents and gate decisions reach their project through `workItemKey`. `integrityProblems()` (`mocks/projects.ts`) must stay empty for every seeded tenant (tested in `projectsApi.test.ts`). New seed data goes through `placeWorkItems(items, workMap)` and `mocks/seed/projects.ts`.
- A new BRD needs a `projectId` (`POST /brds` returns 400 without one) and gets a work item in that project when none is given. New projects (`POST /projects`, `work.create`) start with a plan.
- Links: stored ones in `store.links` (derives-from with a pinned version, depends-on across projects, implements, traces-to) plus derived ones (backlog → BRD). A link is `stale` when the BRD moved past the pinned version; the project lifecycle shows it.
- Shared platforms (`project.platform`) are their own projects; others link to them with project `depends-on` and cross-project milestones (`"MCP:M4"` in `dependsOn`).
- UI: `features/projects`: `/t/$tenantSlug/projects` lists programs in a table (rolled up from their projects by `rollup.ts`), `/projects/program/$programKey` lists that program's projects, `/projects/$projectKey?tab=overview|plan|artifacts|trace|work&item=` is one project; the Work items tab follows a picked item through every step and tool (`work/WorkTrace`), and `work-item` refs link there. Tables use `components/data/DataTable` (TanStack Table: sorting, search, whole-row open with a real link in the first cell). The top-bar `ProjectSwitcher` sets a per-tenant working scope (`useProjectScope`, `inScope`); BRD and Architecture follow it and show `ScopeNote`. Opening a project sets the scope. Every write invalidates `keys.projects`.

## Modules and navigation

- The side nav is grouped Overview (Control room, Approvals, Programs & projects) · Plan (BRDs & specs) · Design (Architecture, Review) · Deliver (Test plan, Delivery) · Run (Operate, Insights), from `MODULES`/`MODULE_GROUPS`/`MODULE_ROUTE` in `features/modules/modules.ts`. Each module is `features/<module>/` with a route file `t.$tenantSlug.<module>.tsx`.
- Don't add a top-level screen for something that belongs to a project or to an existing module; add a view (search param) instead. Current views: `/brd?view=specs&wi=` (specs, G1), `/architecture?view=options&wi=` (design options), `/delivery?tab=build|verify|release&wi=` (G3/G4), `/review?wi=`. `wi` is a work item key (specs also accept a spec id) and preselects the item, so gates can deep-link.
- Removed screens (Portfolio, Trace, Shape, Specs, Design, Build, Verify, Release) redirect to their new home in `t.$tenantSlug.$module.tsx`; new intake goes through `/brd/new`. The assistant is reached from its launcher (⌘J) and the full page `/ask`, not the nav.
- Approvals (`features/approvals`) is the one queue of sign-offs: open gate decisions, BRDs in review and test plans in review (`collectApprovals`, tested), mine first, each linked to its evidence with `gateLink`. The nav badge counts what the user can sign. Other features import links from `features/approvals/links` (no page import).
- ⌘K/Ctrl+K (`features/command`) opens the command bar from the top-bar search: pages, programs, projects, BRDs and work items (`searchCommands`, tested), or hands the text to the assistant.
- Read data with `useTenantData(keys.x, path, Schema)`; write with `useTenantWrite(keys.x, Schema, …)` where the server returns the new state.
- Gate rules live server-side (see `mocks/moduleHandlers.ts`): G2 needs both architecture and security sign-off by two different people and no open high/critical findings.

## BRD stage

- Lifecycle is Shape (G0) → **BRD (sign-off)** → Spec (G1) → Design → Architecture → Review (G2) → …
- BRD schema, `checkBrd` (quality linter), `storyChecks` (definition of ready) and `mustCoverage` live in `packages/contracts/src/brd.ts`; the editor and the server run the same checks. Blocking checks stop submission.
- Workflow rules are server-side (`mocks/brdHandlers.ts`): content is locked while in review or approved; each approver signs only their own slot; whoever submitted can't approve; an approved BRD changes only through a change request, which marks the backlog stale.
- The document canvas, outline, Markdown and DOCX exports are driven by `features/brd/sections.ts` (`placedSections` follows the BRD's `layout`); add a BRD field there once.
- A new BRD starts as a chat (`/t/$tenantSlug/brd/new`, `NewBrdChat`): the first message (plus any attachments) creates the BRD, titled from the message (`titleFrom`), and opens the studio.
- BRD Studio (`features/brd-studio`, full-screen route `t.$tenantSlug_.brd.$brdId.tsx`) is the chat on the left and the live document on the right, in a resizable `SplitPane` (either side collapses; one side at a time below `lg`). The document panel has view tabs (Document / Sign-off / Backlog) and a drawer strip (Outline / Sources / Activity) that slides over the page when the panel is narrow. The editor (`BrdEditor`) autosaves via `PUT /brds/:id/document`.
- The BRD is a free-flowing rich-text document (`Brd.body`, Tiptap/ProseMirror JSON). Section headings carry an `anchor`; requirements, objectives, risks and the other items are smart blocks whose attrs hold the item. `packages/contracts/src/brdDoc.ts` is the single mapping: `buildBody` (content → document), `deriveFromBody` (document → content/layout/custom sections; hidden sections keep their content), `syncBody` (writes agent changes back without touching the author's other text) and the outline operations. The server derives content from the body on save and syncs the body after every agent change, so checks, sign-off and the backlog always read BrdContent. `BRD_SECTION_SPEC` must match `features/brd/sections.ts` (a test checks).
- Collaboration UI comes from `packages/collab`: `RichEditor` (toolbar, `/` menu, bubble menu with Ask agent/Comment, smart blocks rendered by the host, annotations placed in the text), `ChatThread`, `Composer`, `DropZone`, `PresenceBar`, plus the block-based `CollabDocument`. Keep it domain-free: BRD mapping lives in `features/brd-studio` (`BrdEditor.tsx`, `collab.ts`). Reuse it for other documents (specs, architecture) the same way.
- Agent proposals (from chat or comments) show in the document as tracked changes; accept/reject goes through `POST /brds/:id/proposals/:pid` wherever it's clicked. Comment threads (`POST /brds/:id/comments`, `/replies`, `/resolve`) are anchored to a section, row or quote, stay open while a version is in review (editors and approvers), and `askAgent` makes the agent answer in the thread. A message can carry `attachments` (source ids) and a `context` anchor (e.g. a selected passage) — `mocks/ba/agent/rewrite.ts` does the simulated rewrites.
- The guided flow is defined once in `packages/contracts/src/brdSteps.ts`: `BRD_STEPS` (8 steps, their sections, agent focuses and capture forms), `stepChecks` (required checks mirror `checkBrd` errors; a test keeps them in step) and `Capture` (structured entries). Steps can be visited in any order; only sign-off waits for required checks.
- `POST /brds/:id/step` moves the conversation to a step (the agent asks only that step's questions; optional ones can be skipped, required ones can't). `POST /brds/:id/capture` adds a structured entry directly (the author wrote it), then the agent reviews it and proposes refinements.
- Every agent change is a `Proposal` (contracts `brdStudio.ts`) applied through `mocks/ba/agent/apply.ts`, which re-validates with `BrdContent`. With live edits on (`thread.autoApply`, default; `POST /brds/:id/agent-mode`), the server applies them straight away and records `undo {before, after}`; `decision: "undo"` reverts one edit item by item (`mocks/ba/agent/undo.ts`) and returns 409 only if what it touched was edited since. "Ask first" leaves them pending for accept/reject. Proposals from sources must cite passages (`S1.3`) and never duplicate what the document already says.
- Full-screen pages (studio, new BRD) use a `fixed inset-0 overflow-hidden` frame so nothing inside can grow or scroll the window. Scroll inside panels with `reveal()` from `@throughline/collab`, never `scrollIntoView` (it also scrolls the full-screen frame).
- The simulated agent is `mocks/ba/agent/engine.ts` (rule-based, deterministic, tested in `studioApi.test.ts`). A real model agent must keep the same contract: `POST /brds/:id/messages` → a message with proposals and citations.
- Files are read in the browser (`extract.ts`: pdf.js, mammoth, plain text). Scanned PDFs need OCR and fail clearly. Links are saved but not fetched (the browser can't read other sites); the author pastes an excerpt, or a real agent server fetches.
- `mocks/ba/backlog.ts` turns an approved BRD into an enterprise backlog: epics per capability area (business value, outcomes/KPIs, scope, risks, owner), features per BR (benefit hypothesis, business criteria, release from MoSCoW: Must → MVP, Should → Release 2, Could → Release 3), stories (Given/When/Then, test scenarios, NFRs, rules, data, DoD additions, dependencies) and typed, estimated sub-tasks; plus NFR enablers, a transition epic (KPI baselines, training, cut-over, dependencies) and spikes for open questions. Sprints are planned by release, dependencies and `SPRINT_CAPACITY`. Every item traces to BRD ids; Won't-haves are excluded. The fields, `DEFINITION_OF_READY`/`DEFINITION_OF_DONE` and `storyChecks` live in contracts `brd.ts`. Refinement notes per requirement are `StoryHint`s (`mocks/ba/types.ts`). Jira/Azure Boards mapping is `TOOL_TYPES`; CSV exports (with value, tests, DoD, release, estimates) are in `features/brd/export`.
- The backlog UI (`features/brd/BacklogView.tsx` + `features/brd/backlog/`) fills the studio panel: summary bar, views (Hierarchy, Sprint plan, Traceability, Ready & done), filters, and a details panel; view logic is in `backlog/meta.ts` (tested).
- BRD-40 (Acme, "Agentic email listener for support emails", `mocks/ba/emailListenerBrd.ts` + `emailListenerThread.ts`) is the complete reference example: every section, sources, the full 8-step conversation, comments, approvals and a generated backlog. Keep it passing `checkBrd` and the backlog tests.

## Test plans

- One test plan per project (`packages/contracts/src/testing.ts`, ISO/IEC/IEEE 29119-3 sections: scope, approach per level, environments, test data, risks, entry/exit, schedule, roles, defects, cases, runs, coverage). Lifecycle stage `test` sits between backlog and build; artifact type `test-plan`, id `tp-<projectkey>`.
- The QA agent stand-in is `mocks/qa/generate.ts` (deterministic): cases from story scenarios, BR acceptance criteria, business rules, NFRs, architecture security controls and components, AI evaluations (when the project uses AI) and UAT per objective. Every case traces to what it proves; `integrityProblems()` checks that traces resolve and every project has a plan. `refresh()` recomputes coverage and exit criteria E1–E8; `applyRun()` applies CI results.
- Seed: `mocks/qa/seed.ts` `buildTestPlans(base, profiles)`; each tenant seed builds `testPlans` from its own base. Every project must have a profile (throws otherwise).
- API (`mocks/testHandlers.ts`, writes need `work.create`): `GET /test-plans` (marks a plan `stale` when its BRD version or architecture revision moved), `POST /test-plans`, `/:id/generate` (keeps authored cases), `/:id/decision` (submit/approve a slot; all approved → x.0), `PATCH /:id/cases/:caseId`, `/:id/push {target}` (Xray/Zephyr need Jira connected, Azure Test Plans needs `azure-boards`), `/:id/runs` (simulated CI).
- UI: `features/testing` (`/t/$tenantSlug/testing?plan=`): Strategy, Cases, Traceability matrix, Readiness. Exports in `features/testing/export.ts` (Xray CSV, Zephyr Scale CSV, Azure Test Plans CSV, Markdown); importers still show a field-mapping step.

## Security module (Settings)

- Five tabs under `/t/$tenantSlug/settings/`: `security` (controls with settings and framework clauses, encryption key, findings), `members` (roles, invites, access review, role matrix), `sso` (SSO, domains, SCIM token and group mappings), `agents` (agent identities, guardrails, kill switch), `audit` (hash-chained log). UI in `features/settings`, hooks in `security.api.ts`; every security write invalidates the other security views and the audit log.
- Contracts: `packages/contracts/src/settings.ts` (controls, keys, findings, `postureScore`) and `security.ts` (`ROLE_ACTIONS`, members, SSO/SCIM, agents/policies, audit). Permissions are `actionsFor(roles, grants)`; the signed-in user's membership is read from their member record (`mocks/db.ts` `getMembership`), so the role matrix is what the server enforces.
- Mock API: `mocks/security/handlers.ts`. Every write and every refused write appends to the tenant's audit chain (`security/chain.ts`, `record()`); add new security writes the same way. Guardrails are server-side: IP rules can't exclude the caller, no self-demotion or last-admin removal, SCIM-managed roles change only via group mappings, SSO enforcement needs a verified domain and an MFA break-glass admin, production scopes can't get "act" autonomy while production approval is on, restricted data needs PII redaction, the kill switch restores only the agents it stopped.
- Findings (`security/findings.ts`) are computed on read and link to the tab that fixes them. Seeds per tenant in `security/seed.ts`.
- New actions: `members.manage`, `audit.read` (workspace admins, or a direct grant).

## Chat, voice and the workspace assistant

- Reusable kit in `packages/collab` (domain-free): `Chat` (opening screen with starters, `ChatThread`, `Composer`, follow-up suggestions, read-aloud, hands-free `VoiceMode`; fills its container so it works as a page, side panel or phone sheet), `Composer` (`voice` adds the dictation mic, Alt+D; `onVoiceMode` adds the hands-free button), `ChatThread` (read-aloud per reply, `autoRead`; `ChatMessageView.speech` is the short spoken version).
- Voice goes through a `SpeechEngine` (`packages/collab/src/voice/engine.ts`), never a browser API directly. `browserSpeechEngine()` uses the Web Speech API: Chrome/Edge send recognition audio to their vendor's cloud, so workspaces with residency rules either turn it off (Security control `browser-speech`, off for Northwind) or plug in an in-region engine with the same interface through `VoiceProvider`. Hooks: `useDictation`, `useSpeaker`, `useMicLevel`, `useVoiceConversation` (state machine `voiceReducer` in `voice/text.ts`, tested). Errors explain themselves (`VOICE_ERROR_MESSAGE`).
- Every tenant layout (app shell, BRD Studio, new BRD) wraps `WorkspaceVoice` (features/assistant), which applies the workspace's voice policy.
- The workspace assistant (`features/assistant`) is in the app shell on every screen: floating launcher + ⌘J/Ctrl+J, a right-hand sheet (full screen on phones, Esc closes), and a full page at `/t/$tenantSlug/ask?c=` with history. It sends the page context (`routeContext`, or what a page declares with `useAssistantPageContext`); any page can open it with `useAssistant().open({ prompt, context, fresh })`. Reply actions are workspace-relative paths opened in-app.
- API (`mocks/assistant`, contracts `assistant.ts`): `GET /assistant/conversations` (also returns the voice policy), `GET|DELETE /assistant/conversations/:id`, `POST /assistant/messages` (user message + reply with `speech`, `sources`, `actions`, `followUps`; voice is refused when the policy is off). `respond.ts` is the deterministic stand-in; a real model must keep the `Reply` shape.

## Architecture studio

- Questions live in `packages/contracts/src/architecture.ts` (`ARCH_QUESTIONS`, `ArchBrief`); the UI and the server read the same list.
- The architect agent stand-in is `src/mocks/architect/` (catalog → network plan → controls → diagrams → decisions → document). It must stay deterministic; `generate.test.ts` sweeps every main brief combination for layout and wiring problems.
- A subject (`mocks/architect/subject.ts`) can add what the standard building blocks don't cover: `components` (drawn in the container, deployment and security views and linked from the entry point; ids must not clash with standard node ids), `flow.steps` (its own key flow), and extra `decisions`, `risks` and document `sections`. Acme seeds three: INT-52 MCP governance (`acmeMcpSubject`, from BRD-52; product status checked 25 Oct 2026), INT-40 support email agent (`emailListenerSubject`, from BRD-40, depends on INT-52) and INT-31 Mandate platform. The layout sweep rotates through subjects, including the MCP one.
- Every architecture has `components` (contracts `ArchComponent`, built by `mocks/architect/components.ts`): what each building block does here, why the solution needs it, the BRD requirements/NFRs, decisions and controls it serves (from the derives-from BRD, `servesFor`, `decisionFor`), configuration, GA/preview status, docs link, indicative cost and the brief question (`choice`) that changes it. Diagram nodes point at their component (`node.component`); a test checks every node resolves.
- Choices: `POST /architectures/:id/preview` returns a `ChoiceImpact` (cost, components added/removed, decisions, controls, new risks); `POST /architectures/:id/choose` applies it, regenerates as a new revision and records `history`. The UI is `ComponentPanel` (side panel in diagrams, the Components tab, and the full-screen overlay).
- Vendor icons: official Azure Public Service Icons (V24) in `features/architecture/icons/azure/<role>.svg`, rendered unchanged on a neutral tile (`vendorIcon`). Microsoft allows them in architecture diagrams; don't recolour or crop them. AWS/GCP sets aren't bundled; add one only after checking its terms. Biome ignores the folder.
- Diagrams carry absolute coordinates. `features/architecture/routing.ts` routes edges for both the SVG view and the draw.io export, so they always match.
- Third-party file palettes (`export/drawioShapes.json`, `export/drawioTheme.json`) are the only colours outside tokens.css, because they describe draw.io/vendor files, not our UI. Shape names come from draw.io's own Azure2/AWS4/GCP2 libraries; check new ones against those before adding.

## Structure

- Routes stay thin; features live in `apps/web/src/features/<feature>` and are imported through their `index.ts`.
- Pure logic (filters, readiness, scoring) goes in plain `.ts` files with a unit test next to it.
- Respect reduced motion; give every interactive element an accessible name.

## Checks

`pnpm check` before you finish.
