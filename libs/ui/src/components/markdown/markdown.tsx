// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no markdown renderer). Feature set inspired by HeroUI Pro's public
// Markdown docs (renders an assistant response string, memoized blocks so a streaming response only re-renders the block
// being written, incomplete-markdown repair + caret while streaming, fenced code as a CodeBlock); independent
// implementation, Rivet-authored styles.
// - Parser = `@rivetjs/cdk/markdown` (safe plain-data AST): elements are built from the AST, never from HTML strings, so
//   raw HTML in a response stays text and unsafe link / image URLs (`javascript:` …) are dropped (`safeUrl`).
// - Source: `content` (a string or an accessor: streaming) or a string child. Each top-level block (`splitBlocks`) is a
//   keyed `For` row (key = index + block text): finished blocks keep their DOM while tokens arrive.
// - `isStreaming` (value or accessor): the last block gets `closeOpenMarks` (no raw `**` flashing) and a soft caret
//   (`showCaret`, default true). Fenced code renders `CodeBlock` (header with the language + copy button).
// - Live tail (streaming): the block being written is one persistent row (key `<index>:~`) rendered by keyed `For`s all
//   the way down (blocks → inline nodes → words, keyed by position), so a new chunk appends word `<span>`s and existing
//   nodes stay (no re-render per chunk); new words / blocks fade + un-blur in (CSS, `.markdown__word` / `.markdown__live`,
//   reduced motion: none). An open code fence streams as plain words in the code block frame and is highlighted once it
//   closes (the row then re-renders as a finished block, static: no animation).
// - Smooth growth: a streaming Markdown created in the browser (the live turn appears on submit) follows its content
//   height with `followHeight` (`@rivetjs/cdk/chat`, a `clientEffect` on a root `ref()`, disposed with the Markdown):
//   no line / block jumps. Only when `isStreaming` is an accessor; on a resumed page the effect waits for its trigger
//   (nothing boots at load). A ref callback would not resume (server render error).
// - Pro's `components` override map is not ported (gap): style the `markdown__*` classes instead.
import { followHeight } from "@rivetjs/cdk/chat";
import { closeOpenMarks, parseMarkdown, splitBlocks } from "@rivetjs/cdk/markdown";
import type { MarkdownBlock, MarkdownInline, MarkdownListItem } from "@rivetjs/cdk/markdown";
import { clientEffect, For, ref as createRef, Show } from "@rivetjs/runtime/dom";
import { computed, untrack } from "@rivetjs/reactivity";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import { markdownVariants } from "../../../styles/src/components/markdown/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { CodeBlockCode, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockRoot } from "../code-block/code-block.tsx";

const SLOTS = markdownVariants();

type Node = JSX.Element;

const caret = (): Node => <span class={SLOTS.caret()} aria-hidden="true" data-slot="markdown-caret" />;

function renderInline(nodes: readonly MarkdownInline[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push(node.value as unknown as Node);
        break;
      case "strong":
        out.push(<strong class={SLOTS.strong()}>{renderInline(node.children)}</strong>);
        break;
      case "em":
        out.push(<em class={SLOTS.em()}>{renderInline(node.children)}</em>);
        break;
      case "del":
        out.push(<del class={SLOTS.del()}>{renderInline(node.children)}</del>);
        break;
      case "code":
        out.push(<code class={SLOTS.inlineCode()}>{node.value}</code>);
        break;
      case "br":
        out.push(<br />);
        break;
      case "link":
        out.push(
          <a class={SLOTS.link()} href={node.href} title={node.title} target="_blank" rel="noopener noreferrer">
            {renderInline(node.children)}
          </a>,
        );
        break;
      case "image":
        out.push(<img class={SLOTS.image()} src={node.src} alt={node.alt} title={node.title} loading="lazy" decoding="async" />);
        break;
    }
  }
  return out;
}

const withCaret = (children: Node[], tail: boolean): Node[] => (tail ? [...children, caret()] : children);

function heading(level: number, children: Node[], extra?: string): Node {
  const cls = `${SLOTS.heading()} ${SLOTS.heading()}--${level}${extra ? ` ${extra}` : ""}`;
  switch (level) {
    case 1:
      return <h1 class={cls}>{children}</h1>;
    case 2:
      return <h2 class={cls}>{children}</h2>;
    case 3:
      return <h3 class={cls}>{children}</h3>;
    case 4:
      return <h4 class={cls}>{children}</h4>;
    case 5:
      return <h5 class={cls}>{children}</h5>;
    default:
      return <h6 class={cls}>{children}</h6>;
  }
}

/** Elements of `blocks`; `tail` puts the streaming caret at the end of the last one. `tight` = list item paragraphs inline. */
function renderBlocks(blocks: readonly MarkdownBlock[], tail: boolean, tight = false): Node[] {
  const out: Node[] = [];
  blocks.forEach((block, index) => {
    const last = tail && index === blocks.length - 1;
    switch (block.type) {
      case "heading":
        out.push(heading(block.level, withCaret(renderInline(block.children), last)));
        break;
      case "paragraph":
        if (tight) out.push(...withCaret(renderInline(block.children), last));
        else out.push(<p class={SLOTS.paragraph()}>{withCaret(renderInline(block.children), last)}</p>);
        break;
      case "blockquote":
        out.push(<blockquote class={SLOTS.blockquote()}>{renderBlocks(block.children, last)}</blockquote>);
        break;
      case "hr":
        out.push(<hr class={SLOTS.hr()} />);
        if (last) out.push(caret());
        break;
      case "code": {
        const code = block.value;
        const lang = block.lang || "plaintext";
        out.push(
          <CodeBlockRoot class={SLOTS.codeBlock()} data-streaming={block.closed ? undefined : "true"}>
            <CodeBlockHeader>
              <CodeBlockLanguage language={lang} />
              <CodeBlockCopyButton code={code} />
            </CodeBlockHeader>
            <CodeBlockCode code={code} language={lang} />
          </CodeBlockRoot>,
        );
        break;
      }
      case "list": {
        const items = block.items.map((item, i) => {
          const lastItem = last && i === block.items.length - 1;
          const task = item.checked !== undefined;
          return (
            <li class={SLOTS.listItem()} data-task={task ? "true" : undefined}>
              {task ? (
                <input class={SLOTS.taskCheckbox()} type="checkbox" checked={item.checked} disabled aria-label={item.checked ? "Done" : "To do"} />
              ) : null}
              {renderBlocks(item.children, lastItem, block.tight)}
            </li>
          );
        });
        out.push(
          block.ordered ? (
            <ol class={`${SLOTS.list()} ${SLOTS.list()}--ordered`} start={block.start === 1 ? undefined : block.start}>
              {items}
            </ol>
          ) : (
            <ul class={SLOTS.list()} data-task={block.items.some((item) => item.checked !== undefined) ? "true" : undefined}>
              {items}
            </ul>
          ),
        );
        break;
      }
      case "table": {
        const align = block.align;
        const cellStyle = (i: number): { "text-align": string } | undefined => (align[i] ? { "text-align": align[i]! } : undefined);
        out.push(
          <div class={SLOTS.tableWrapper()} role="region" tabIndex={0} aria-label="Table">
            <table class={SLOTS.table()}>
              <thead>
                <tr>
                  {block.head.map((cell, i) => (
                    <th scope="col" style={cellStyle(i)}>
                      {renderInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr>
                    {row.map((cell, i) => (
                      <td style={cellStyle(i)}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        if (last) out.push(caret());
        break;
      }
    }
  });
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * Live tail (streaming): keyed all the way down so appended text only adds nodes
 * -----------------------------------------------------------------------------------------------*/

const words = (text: string): string[] => text.match(/\s*\S+\s*|\s+/g) ?? [];

/**
 * Word spans of a growing text: keyed by position, so a chunk appends spans and a growing last word updates in place.
 * Wrapped in one `<span>`: a list row that is a single element is cheaper to reconcile than a row of anchors (no
 * start / end Text nodes, no range walk per list update; the runtime keeps either kind's nodes in place).
 */
const liveText = (text: () => string): Node => (
  <span>
    <For each={() => words(text())} by={(_word: string, index: number) => index}>
      {(word: () => string) => <span class={SLOTS.word()}>{word()}</span>}
    </For>
  </span>
);

const inlineKey = (node: MarkdownInline, index: number): string => `${index}:${node.type}`;

function liveInline(nodes: () => readonly MarkdownInline[]): Node {
  return (
    <For each={nodes} by={inlineKey}>
      {(node: () => MarkdownInline) => liveInlineNode(node)}
    </For>
  );
}

function liveInlineNode(node: () => MarkdownInline): Node {
  const first = node();
  const children = (): readonly MarkdownInline[] => {
    const n = node();
    return "children" in n ? n.children : [];
  };
  switch (first.type) {
    case "text":
      return liveText(() => (node() as { value: string }).value);
    case "strong":
      return <strong class={SLOTS.strong()}>{liveInline(children)}</strong>;
    case "em":
      return <em class={SLOTS.em()}>{liveInline(children)}</em>;
    case "del":
      return <del class={SLOTS.del()}>{liveInline(children)}</del>;
    case "code":
      return <code class={`${SLOTS.inlineCode()} ${SLOTS.word()}`}>{(node() as { value: string }).value}</code>;
    case "br":
      return <br />;
    case "link":
      return (
        <a class={SLOTS.link()} href={(node() as { href: string }).href} target="_blank" rel="noopener noreferrer">
          {liveInline(children)}
        </a>
      );
    case "image":
      // One element (not the array): a single-element row is the cheaper list row (no anchors).
      return renderInline([first])[0]!;
  }
}

const blockKind = (block: MarkdownBlock): string =>
  block.type === "heading"
    ? `h${block.level}`
    : block.type === "list"
      ? block.ordered
        ? "ol"
        : "ul"
      : block.type === "code"
        ? block.closed
          ? "code"
          : "fence"
        : block.type;

const liveCaret = (on: () => boolean): Node => <Show when={on}>{caret()}</Show>;

function liveBlocks(blocks: () => readonly MarkdownBlock[], caretOn: () => boolean, tight = false): Node {
  return (
    <For each={blocks} by={(block: MarkdownBlock, index: number) => `${index}:${blockKind(block)}`}>
      {(block: () => MarkdownBlock, index: () => number) => liveBlock(block, () => caretOn() && index() === blocks().length - 1, tight)}
    </For>
  );
}

function liveBlock(block: () => MarkdownBlock, caretOn: () => boolean, tight: boolean): Node {
  const first = block();
  const inline = (): readonly MarkdownInline[] => {
    const b = block();
    return b.type === "heading" || b.type === "paragraph" ? b.children : [];
  };
  const live = SLOTS.live();
  switch (first.type) {
    case "paragraph":
      // Tight list item: one wrapper element (not an array) so the row keeps its nodes, as in `liveText`.
      if (tight)
        return (
          <span>
            {liveInline(inline)}
            {liveCaret(caretOn)}
          </span>
        );
      return (
        <p class={`${SLOTS.paragraph()} ${live}`}>
          {liveInline(inline)}
          {liveCaret(caretOn)}
        </p>
      );
    case "heading":
      return heading(first.level, [liveInline(inline), liveCaret(caretOn)], live);
    case "blockquote":
      return (
        <blockquote class={`${SLOTS.blockquote()} ${live}`}>
          {liveBlocks(() => {
            const b = block();
            return b.type === "blockquote" ? b.children : [];
          }, caretOn)}
        </blockquote>
      );
    case "list": {
      const items = (): readonly MarkdownListItem[] => {
        const b = block();
        return b.type === "list" ? b.items : [];
      };
      const tightList = first.tight;
      const rows = (
        <For each={items} by={(_item: MarkdownListItem, index: number) => index}>
          {(item: () => MarkdownListItem, index: () => number) => (
            <li class={`${SLOTS.listItem()} ${live}`}>
              {liveBlocks(
                () => item().children,
                () => caretOn() && index() === items().length - 1,
                tightList,
              )}
            </li>
          )}
        </For>
      );
      return first.ordered ? (
        <ol class={`${SLOTS.list()} ${SLOTS.list()}--ordered`} start={first.start === 1 ? undefined : first.start}>
          {rows}
        </ol>
      ) : (
        <ul class={SLOTS.list()}>{rows}</ul>
      );
    }
    case "code":
      if (!first.closed) {
        const lang = first.lang || "plaintext";
        const code = (): string => {
          const b = block();
          return b.type === "code" ? b.value : "";
        };
        return (
          <CodeBlockRoot class={`${SLOTS.codeBlock()} ${live}`} data-streaming="true">
            <CodeBlockHeader>
              <CodeBlockLanguage language={lang} />
            </CodeBlockHeader>
            <div class="code-block__code" data-slot="code-block-code">
              <pre class="code-block__pre">
                <code>{liveText(code)}</code>
              </pre>
            </div>
          </CodeBlockRoot>
        );
      }
      return renderBlocks([first], false)[0]!;
    default:
      // hr / table / closed code: small or atomic, rendered whole (re-rendered when the block's text changes).
      return renderBlocks([first], false)[0]!;
  }
}

interface MarkdownRow {
  key: string;
  raw: string;
  tail: boolean;
}

interface MarkdownProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children" | "content"> {
  /** Markdown source: a string or an accessor (streaming). Takes precedence over `children`. */
  content?: string | (() => string);
  /** Markdown source as a string child. */
  children?: string;
  /** The response is still streaming: repair open marks in the last block and show the caret. Value or accessor. */
  isStreaming?: boolean | (() => boolean);
  /** Caret after the streamed text while `isStreaming`. @default true */
  showCaret?: boolean;
  class?: string;
}

const MarkdownRoot = (props: MarkdownProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "content", "isStreaming", "showCaret"]);
  const source = (): string => {
    const value = local.content ?? local.children;
    const text = typeof value === "function" ? (value as () => unknown)() : value;
    return typeof text === "string" ? text : "";
  };
  const streaming = (): boolean => {
    const value = local.isStreaming;
    return (typeof value === "function" ? value() : value) === true;
  };
  const rows = (): MarkdownRow[] => {
    const blocks = splitBlocks(source());
    const live = streaming();
    return blocks.map((raw, index) => {
      const tail = live && index === blocks.length - 1;
      return { key: tail ? `${index}:~` : `${index}:${raw}`, raw, tail };
    });
  };
  const caretOn = local.showCaret !== false;
  const isStreaming = local.isStreaming;
  // Streaming accessor only: the root follows its content height while streaming (disposed with the Markdown).
  const follow = typeof isStreaming === "function" ? createRef<HTMLDivElement>() : undefined;
  if (follow)
    clientEffect(() => {
      const el = follow();
      if (el) return untrack(() => followHeight(el, streaming));
    });
  return (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      data-slot="markdown"
      data-streaming={() => (streaming() ? "true" : undefined)}
      ref={follow}
      {...rest}
    >
      <For each={rows} by={(row: MarkdownRow) => row.key}>
        {(row: () => MarkdownRow) => {
          const { raw, tail } = row();
          // Every row is one element: cheaper to reconcile than a row of several nodes between anchors (a perf choice;
          // since 2026-10-09 the runtime also keeps a ranged row's later nodes in place when rows are added / removed).
          if (!tail) {
            const nodes = renderBlocks(parseMarkdown(raw), false);
            return nodes.length === 1 ? nodes[0]! : <div class={SLOTS.tail()}>{nodes}</div>;
          }
          // The tail row persists while it grows: its blocks are reactive (keyed) over the repaired text.
          const blocks = computed(() => parseMarkdown(closeOpenMarks(row().raw)));
          return <div class={SLOTS.tail()}>{liveBlocks(blocks, () => caretOn)}</div>;
        }}
      </For>
    </div>
  );
};

export { MarkdownRoot };
export type { MarkdownProps };
