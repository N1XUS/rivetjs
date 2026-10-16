import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { MdNode } from "../types.ts";

/** Renders the marked token tree (content.ts `tree`) as JSX; same element structure as marked's HTML renderer. */
export function Markdown({ nodes }: { nodes: MdNode[] }): JSX.Element {
  return (
    <>
      {nodes.map((node) => (
        <Node node={node} />
      ))}
    </>
  );
}

function Node({ node }: { node: MdNode }): JSX.Element | null {
  const kids = () => <Markdown nodes={node.children ?? []} />;
  switch (node.type) {
    case "paragraph":
      return <p>{kids()}</p>;
    case "heading":
      return node.depth === 2 ? <h2>{kids()}</h2> : node.depth === 3 ? <h3>{kids()}</h3> : node.depth === 1 ? <h1>{kids()}</h1> : <h4>{kids()}</h4>;
    case "text":
      return <>{node.value}</>;
    case "strong":
      return <strong>{kids()}</strong>;
    case "em":
      return <em>{kids()}</em>;
    case "codespan":
      return <code>{node.value}</code>;
    case "code":
      return (
        <pre>
          <code class={node.lang ? "language-" + node.lang : undefined}>{node.value}</code>
        </pre>
      );
    case "link":
      return <a href={node.href}>{kids()}</a>;
    case "image":
      return <img src={node.href} alt={node.value} />;
    case "list":
      return node.ordered ? <ol>{kids()}</ol> : <ul>{kids()}</ul>;
    case "item":
      return <li>{kids()}</li>;
    case "blockquote":
      return <blockquote>{kids()}</blockquote>;
    case "hr":
      return <hr />;
    case "br":
      return <br />;
    default:
      return null;
  }
}
