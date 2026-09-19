import { createElement, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{inline(part.slice(2, -2))}</strong>;
    return part;
  });
}

/** Bounded Markdown rendering; generated HTML remains escaped text. */
export default function AnswerBody({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const start = i;
      const code: string[] = [];
      while (++i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i]);
      nodes.push(<pre key={start} className="overflow-x-auto rounded-md bg-code-background p-4 mb-4"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      nodes.push(createElement(`h${heading[1].length}`, { key: i, className: "text-section text-foreground mt-6 mb-2 first:mt-0" }, inline(heading[2])));
      continue;
    }
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      nodes.push(<h4 key={i} className="text-ui font-semibold text-foreground mt-5 mb-2 first:mt-0">{inline(line.slice(2, -2))}</h4>);
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*+]\s+|(\d+)\.\s+)(.+)$/);
    if (bullet) {
      const start = i;
      const ordered = bullet[1] !== undefined;
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const match = lines[i].match(/^\s*(?:[-*+]\s+|(\d+)\.\s+)(.+)$/);
        if (!match || (match[1] !== undefined) !== ordered) break;
        items.push(<li key={i} className="my-1">{inline(match[2])}</li>);
        i++;
      }
      i--;
      nodes.push(ordered
        ? <ol key={start} start={Number(bullet[1])} className="ml-5 list-decimal text-body text-foreground/90 mb-4">{items}</ol>
        : <ul key={start} className="ml-5 list-disc text-body text-foreground/90 mb-4">{items}</ul>);
      continue;
    }
    nodes.push(<p key={i} className="text-body text-foreground/90 mb-4">{inline(line)}</p>);
  }
  return <>{nodes}</>;
}
