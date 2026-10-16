import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { Nodes } from "mdast";

// #region demo
/**
 * Renders a Markdown syntax tree as JSX. Text is escaped like any other JSX text, so a post cannot
 * inject HTML or scripts. Node types this function does not know (raw HTML included) render nothing.
 */
export function Markdown({ node }: { node: Nodes }): JSX.Element | null {
  const children = () => ("children" in node ? node.children.map((child) => <Markdown node={child} />) : null);
  switch (node.type) {
    case "root":
      return <>{children()}</>;
    case "paragraph":
      return <p class="my-3">{children()}</p>;
    case "heading":
      return node.depth <= 2 ? <h2 class="mt-6 text-xl font-bold">{children()}</h2> : <h3 class="mt-4 font-bold">{children()}</h3>;
    case "text":
      return <>{node.value}</>;
    case "strong":
      return <strong>{children()}</strong>;
    case "emphasis":
      return <em>{children()}</em>;
    case "inlineCode":
      return <code class="rounded bg-slate-100 px-1">{node.value}</code>;
    case "code":
      return (
        <pre class="my-3 overflow-x-auto rounded bg-slate-900 p-3 text-slate-100">
          <code class={node.lang ? "language-" + node.lang : undefined}>{node.value}</code>
        </pre>
      );
    case "link":
      return (
        <a class="text-teal-700 underline" href={node.url}>
          {children()}
        </a>
      );
    case "list":
      return node.ordered ? <ol class="my-3 list-decimal pl-6">{children()}</ol> : <ul class="my-3 list-disc pl-6">{children()}</ul>;
    case "listItem":
      // Tight list items wrap their text in a paragraph; render its children directly.
      return <li>{node.children.map((child) => (child.type === "paragraph" ? child.children.map((c) => <Markdown node={c} />) : <Markdown node={child} />))}</li>;
    case "blockquote":
      return <blockquote class="my-3 border-l-4 border-slate-300 pl-4 text-slate-600">{children()}</blockquote>;
    case "thematicBreak":
      return <hr class="my-6" />;
    case "break":
      return <br />;
    default:
      return null;
  }
}
// #endregion
