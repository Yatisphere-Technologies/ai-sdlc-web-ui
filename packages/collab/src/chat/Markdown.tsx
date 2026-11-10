import { cn } from "@throughline/ui";
import { Fragment, type ReactNode } from "react";
import { type Inline, parseMarkdown } from "./parseMarkdown";

/** Hook to turn plain text runs into richer nodes, e.g. citation ids into links. */
export type TextTransform = (text: string, key: string) => ReactNode;

function renderInline(nodes: Inline[], key: string, transform?: TextTransform): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}.${i}`;
    switch (n.type) {
      case "text":
        return <Fragment key={k}>{transform ? transform(n.text, k) : n.text}</Fragment>;
      case "strong":
        return (
          <strong key={k} className="text-strong font-semibold">
            {renderInline(n.children, k, transform)}
          </strong>
        );
      case "em":
        return <em key={k}>{renderInline(n.children, k, transform)}</em>;
      case "code":
        return (
          <code key={k} className="bg-surface-sunken text-caption rounded-xs px-1 py-0.5 font-mono">
            {n.text}
          </code>
        );
      case "link":
        return (
          <a
            key={k}
            href={n.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-ion-fg underline underline-offset-2"
          >
            {renderInline(n.children, k)}
          </a>
        );
      default:
        return null;
    }
  });
}

export function Markdown({
  text,
  transform,
  className,
}: {
  text: string;
  transform?: TextTransform;
  className?: string;
}) {
  const blocks = parseMarkdown(text);
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.type === "p")
          return (
            <p key={k} className="whitespace-pre-line">
              {renderInline(b.children, k, transform)}
            </p>
          );
        if (b.type === "h")
          return (
            <p key={k} className="text-strong font-semibold">
              {renderInline(b.children, k, transform)}
            </p>
          );
        const List = b.type === "ul" ? "ul" : "ol";
        return (
          <List
            key={k}
            className={cn("flex flex-col gap-1 pl-5", b.type === "ul" ? "list-disc" : "list-decimal")}
          >
            {b.items.map((item, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond position
              <li key={j}>{renderInline(item, `${k}.${j}`, transform)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
