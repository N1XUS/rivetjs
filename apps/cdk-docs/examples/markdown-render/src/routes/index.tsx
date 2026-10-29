import { parseMarkdown, safeUrl } from "@rivetjs/cdk/markdown";
import type { MarkdownBlock, MarkdownInline } from "@rivetjs/cdk/markdown";

export const head = { title: "Markdown renderer" };

// #region demo
const SOURCE = `## Release notes

The report is **ready** and the export is *faster*.

- [x] CSV export
- [ ] PDF export

See [the changelog](/changelog) or ignore [this link](javascript:alert(1)).

\`\`\`ts
const total = rows.length;
\`\`\``;

function Inline(props: { nodes: MarkdownInline[] }) {
  return props.nodes.map((node) => {
    switch (node.type) {
      case "text":
        return node.value;
      case "strong":
        return (
          <strong>
            <Inline nodes={node.children} />
          </strong>
        );
      case "em":
        return (
          <em>
            <Inline nodes={node.children} />
          </em>
        );
      case "del":
        return (
          <del>
            <Inline nodes={node.children} />
          </del>
        );
      case "code":
        return <code>{node.value}</code>;
      case "link": {
        // safeUrl drops unsafe schemes (javascript:, data:, ...): render the text without a link.
        const href = safeUrl(node.href);
        return href ? (
          <a href={href}>
            <Inline nodes={node.children} />
          </a>
        ) : (
          <span>
            <Inline nodes={node.children} />
          </span>
        );
      }
      case "image":
        return <img src={safeUrl(node.src)} alt={node.alt} />;
      case "br":
        return <br />;
    }
  });
}

function Blocks(props: { blocks: MarkdownBlock[] }) {
  return props.blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return (
          <h2>
            <Inline nodes={block.children} />
          </h2>
        );
      case "paragraph":
        return (
          <p>
            <Inline nodes={block.children} />
          </p>
        );
      case "code":
        // Code is text: never insert it as HTML.
        return (
          <pre data-lang={block.lang}>
            <code>{block.value}</code>
          </pre>
        );
      case "blockquote":
        return (
          <blockquote>
            <Blocks blocks={block.children} />
          </blockquote>
        );
      case "list":
        return (
          <ul>
            {block.items.map((item) => (
              <li>
                {item.checked === undefined ? null : <input type="checkbox" checked={item.checked} disabled aria-label={item.checked ? "Done" : "Not done"} />}
                <Blocks blocks={item.children} />
              </li>
            ))}
          </ul>
        );
      case "hr":
        return <hr />;
      default:
        return null;
    }
  });
}

export default function MarkdownRender() {
  return (
    <article id="md" class="demo">
      <Blocks blocks={parseMarkdown(SOURCE)} />
    </article>
  );
}
// #endregion
