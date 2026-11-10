import {
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from "@throughline/ui";
import { ArrowUp, AudioLines, Link2, Paperclip, Plus, Quote, Upload, X } from "lucide-react";
import {
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ChatAttachment } from "../types";
import { useDictation } from "../voice/hooks";
import { MicButton } from "../voice/MicButton";
import { appendDictation } from "../voice/text";
import { AttachmentChip } from "./ChatThread";

export type ComposerMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  onSelect: () => void;
};

const URL_ONLY = /^https?:\/\/\S+$/i;

/**
 * Message box like a modern assistant chat: grows as you type, Enter sends, attach files from the +
 * menu, by dropping them or by pasting, and paste a URL to attach it as a link. Uploading and
 * reading attachments is the host's job (onFiles / onLink); the composer shows their status.
 */
export function Composer({
  value,
  onChange,
  onSend,
  sending = false,
  disabled = false,
  placeholder = "Message",
  attachments = [],
  onRemoveAttachment,
  onFiles,
  onLink,
  accept,
  menu = [],
  suggestions = [],
  onSuggestion,
  context,
  onClearContext,
  panel,
  footer,
  autoFocus,
  inputRef,
  voice = false,
  onVoiceMode,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Called with the text and the ids of ready attachments. */
  onSend: (text: string, attachmentIds: string[]) => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  attachments?: ChatAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onFiles?: (files: File[]) => void;
  onLink?: (url: string, title?: string, excerpt?: string) => void;
  accept?: string;
  /** Extra + menu entries, e.g. "From workspace" or "Structured entry". */
  menu?: ComposerMenuItem[];
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  /** What the next message is about, e.g. a quoted passage. */
  context?: string | null;
  onClearContext?: () => void;
  /** Tool panel shown inside the composer, above the text box (e.g. a form). */
  panel?: ReactNode;
  footer?: ReactNode;
  autoFocus?: boolean;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  /** Show the dictation mic (Alt+D in the box). Uses the engine from VoiceProvider. */
  voice?: boolean;
  /** Show the hands-free voice button; the host opens VoiceMode. */
  onVoiceMode?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uid = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ url: "", title: "", excerpt: "" });
  const uploading = attachments.some((a) => a.status === "uploading");
  const ready = attachments.filter((a) => a.status !== "uploading" && a.status !== "failed").map((a) => a.id);
  const canSend = !disabled && !sending && !uploading && (value.trim().length > 0 || ready.length > 0);

  const latest = useRef(value);
  latest.current = value;
  const dictation = useDictation({ onFinal: (t) => onChange(appendDictation(latest.current, t)) });
  // Stop listening if the composer gets disabled (e.g. while the agent replies).
  useEffect(() => {
    if (disabled) dictation.stop();
  }, [disabled, dictation.stop]);

  const send = () => {
    if (!canSend) return;
    dictation.stop();
    onSend(value.trim(), ready);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (voice && e.altKey && (e.key === "d" || e.code === "KeyD")) {
      e.preventDefault();
      dictation.toggle();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.length && onFiles) {
      e.preventDefault();
      onFiles(files);
      return;
    }
    const text = e.clipboardData.getData("text/plain").trim();
    if (onLink && URL_ONLY.test(text) && !value.trim()) {
      e.preventDefault();
      onLink(text);
    }
  };
  const addLink = () => {
    if (!onLink || !URL_ONLY.test(link.url.trim())) return;
    onLink(link.url.trim(), link.title.trim() || undefined, link.excerpt.trim() || undefined);
    setLink({ url: "", title: "", excerpt: "" });
    setLinkOpen(false);
  };
  const hasMenu = Boolean(onFiles || onLink || menu.length);

  return (
    <div className="flex flex-col gap-2">
      {suggestions.length && onSuggestion ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled || sending}
              onClick={() => onSuggestion(s)}
              className="border-line text-caption text-subtle hover:border-agent-line hover:text-agent-fg cursor-pointer rounded-full border px-3 py-1 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          "border-line-strong bg-surface focus-within:border-agent shadow-raise flex flex-col gap-2 rounded-2xl border p-2.5 transition-colors",
          disabled && "opacity-60",
        )}
      >
        {panel ? (
          <div className="border-line max-h-112 overflow-y-auto border-b px-1 pb-3">{panel}</div>
        ) : null}
        {linkOpen && onLink ? (
          <div className="border-line flex flex-col gap-2 border-b px-1 pb-3">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted">Attach a link</span>
              <button
                type="button"
                aria-label="Close link form"
                onClick={() => setLinkOpen(false)}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              aria-label="Link URL"
              placeholder="https://…"
              value={link.url}
              onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLink();
                }
              }}
              className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-3 py-2 outline-none"
            />
            <input
              aria-label="Link title (optional)"
              placeholder="Title (optional)"
              value={link.title}
              onChange={(e) => setLink((l) => ({ ...l, title: e.target.value }))}
              className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-3 py-2 outline-none"
            />
            <textarea
              aria-label="Relevant text from the page (optional)"
              placeholder="Paste the part of the page that matters (optional), so the agent can read and cite it"
              rows={2}
              value={link.excerpt}
              onChange={(e) => setLink((l) => ({ ...l, excerpt: e.target.value }))}
              className="border-line bg-surface-sunken text-body-sm focus:border-agent field-sizing-content max-h-40 min-h-16 resize-none rounded-md border px-3 py-2 outline-none"
            />
            <Button
              size="sm"
              className="self-end"
              disabled={!URL_ONLY.test(link.url.trim())}
              onClick={addLink}
            >
              <Link2 className="size-3.5" aria-hidden /> Attach link
            </Button>
          </div>
        ) : null}
        {attachments.length ? (
          <ul aria-label="Attachments" className="flex flex-wrap gap-2 px-1 pt-1">
            {attachments.map((a) => (
              <li key={a.id}>
                <AttachmentChip
                  a={a}
                  onRemove={onRemoveAttachment ? () => onRemoveAttachment(a.id) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {context ? (
          <div className="bg-surface-raised text-caption text-muted flex items-start gap-2 rounded-md px-2.5 py-1.5">
            <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span className="line-clamp-2 flex-1">{context}</span>
            {onClearContext ? (
              <button
                type="button"
                aria-label="Clear quoted context"
                onClick={onClearContext}
                className="text-faint hover:text-foreground cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
        <textarea
          id={`${uid}-input`}
          ref={inputRef}
          aria-label={placeholder}
          // biome-ignore lint/a11y/noAutofocus: the composer is the primary action when the chat opens
          autoFocus={autoFocus}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
          placeholder={placeholder}
          className="text-body text-foreground placeholder:text-ghost field-sizing-content max-h-60 min-h-11 resize-none bg-transparent px-1.5 py-1 outline-none"
        />
        {dictation.listening || dictation.error ? (
          <p
            aria-live="polite"
            className={cn("text-caption px-1.5", dictation.error ? "text-risk-fg" : "text-muted italic")}
          >
            {dictation.error
              ? dictation.error.message
              : dictation.interim || "Listening… speak, then press stop or send"}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {hasMenu ? (
              <Menu>
                <MenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Add files, links and more"
                    disabled={disabled}
                    className="border-line text-muted hover:text-foreground hover:bg-surface-raised grid size-8 cursor-pointer place-items-center rounded-full border"
                  >
                    <Plus className="size-4" />
                  </button>
                </MenuTrigger>
                <MenuContent side="top" align="start">
                  {onFiles ? (
                    <MenuItem onSelect={() => fileInput.current?.click()}>
                      <Upload className="text-muted size-4" aria-hidden />
                      <span className="flex flex-col">
                        <span>Upload files</span>
                        <span className="text-caption text-faint">PDF, Word, text, Markdown, CSV</span>
                      </span>
                    </MenuItem>
                  ) : null}
                  {onLink ? (
                    <MenuItem onSelect={() => setLinkOpen(true)}>
                      <Link2 className="text-muted size-4" aria-hidden />
                      <span className="flex flex-col">
                        <span>Add a link</span>
                        <span className="text-caption text-faint">Or paste a URL into the message box</span>
                      </span>
                    </MenuItem>
                  ) : null}
                  {menu.length ? (
                    <>
                      {onFiles || onLink ? <MenuSeparator /> : null}
                      <MenuLabel>More</MenuLabel>
                      {menu.map((m) => (
                        <MenuItem key={m.id} onSelect={m.onSelect}>
                          {m.icon}
                          <span className="flex flex-col">
                            <span>{m.label}</span>
                            {m.hint ? <span className="text-caption text-faint">{m.hint}</span> : null}
                          </span>
                        </MenuItem>
                      ))}
                    </>
                  ) : null}
                </MenuContent>
              </Menu>
            ) : null}
            {onFiles ? (
              <>
                <button
                  type="button"
                  aria-label="Attach files"
                  disabled={disabled}
                  onClick={() => fileInput.current?.click()}
                  className="text-muted hover:text-foreground hover:bg-surface-raised grid size-8 cursor-pointer place-items-center rounded-full"
                >
                  <Paperclip className="size-4" />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={accept}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    if (files.length) onFiles(files);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
            {footer ? <span className="text-nano text-faint hidden pl-1 sm:inline">{footer}</span> : null}
          </div>
          <div className="flex items-center gap-1">
            {voice ? (
              <MicButton
                listening={dictation.listening}
                blocked={dictation.blocked}
                disabled={disabled}
                onToggle={dictation.toggle}
              />
            ) : null}
            {onVoiceMode && !value.trim() && !ready.length ? (
              <Tooltip content={dictation.blocked ?? "Talk hands-free"}>
                <button
                  type="button"
                  aria-label="Talk hands-free"
                  disabled={disabled || Boolean(dictation.blocked)}
                  onClick={() => {
                    dictation.stop();
                    onVoiceMode();
                  }}
                  className="bg-agent text-agent-ink disabled:bg-surface-raised disabled:text-faint grid size-8 cursor-pointer place-items-center rounded-full transition-colors disabled:cursor-not-allowed"
                >
                  <AudioLines className="size-4" />
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                aria-label={sending ? "Sending" : "Send message"}
                disabled={!canSend}
                onClick={send}
                className="bg-agent text-agent-ink disabled:bg-surface-raised disabled:text-faint grid size-8 cursor-pointer place-items-center rounded-full transition-colors disabled:cursor-not-allowed"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lets files be dropped anywhere on its area, with an overlay while dragging. */
export function DropZone({
  onFiles,
  disabled,
  children,
  className,
  label = "Drop files to attach",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const [over, setOver] = useState(0);
  const has = (e: DragEvent) => [...e.dataTransfer.types].includes("Files");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target only; files can also be attached with the attach button
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (disabled || !has(e)) return;
        e.preventDefault();
        setOver((n) => n + 1);
      }}
      onDragOver={(e) => {
        if (!disabled && has(e)) e.preventDefault();
      }}
      onDragLeave={() => setOver((n) => Math.max(0, n - 1))}
      onDrop={(e) => {
        if (disabled || !has(e)) return;
        e.preventDefault();
        setOver(0);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
    >
      {children}
      {over > 0 ? (
        <div className="border-agent bg-agent-wash pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed">
          <span className="text-body text-agent-fg flex items-center gap-2 font-semibold">
            <Upload className="size-5" aria-hidden /> {label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
