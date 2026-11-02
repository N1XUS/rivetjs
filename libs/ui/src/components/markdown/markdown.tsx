// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no markdown renderer). Feature set inspired by commercial UI kits' public
// Markdown docs (renders an assistant response string, memoized blocks so a streaming response only re-renders the block
// being written, incomplete-markdown repair + caret while streaming, fenced code as a CodeBlock); independent
// implementation, Rivet-authored styles.
// - Parser = `@rivetjs/cdk/markdown` (safe plain-data AST): elements are built from the AST, never from HTML strings, so
//   raw HTML in a response stays text and unsafe link / image URLs (`javascript:` …) are dropped (`safeUrl`).
// - Source: `content` (a string or an accessor: streaming) or a string child. Each top-level block (`splitBlocks`) is a
//   keyed `For` row: completed initial blocks use index + text; generated blocks retain their live character DOM.
// - `isStreaming` (value or accessor): the last block gets `closeOpenMarks` (no raw `**` flashing) and a soft caret
//   (`showCaret`, default true). Fenced code renders `CodeBlock` (header with the language + copy button).
// - Live tail (streaming): the block being written is one persistent row (key `<index>:~`) rendered by keyed `For`s all
//   the way down (blocks → inline nodes → graphemes, keyed by position), so a new chunk appends character `<span>`s and existing
//   nodes stay (no re-render per chunk); new characters use StreamingText’s fade (CSS, `.streaming-text__character[data-new]`,
//   reduced motion: none). An open code fence streams as plain characters in the code block frame and is highlighted once it
//   closes (the row then re-renders as a finished block, static: no animation).
// - Natural flow: the root keeps its content height. A separate clipped height animation would hide arriving letters
//   until they have already faded in, making an inline stream look like an accordion opening. Character pacing alone
//   controls the reveal, including inside a bottom-pinned ChatConversation.
// - `components` (scoped from public docs of commercial UI kits): per-node-type override map, keys = HTML tag names
//   (`h1`-`h6`, `p`, `blockquote`, `ul`, `ol`, `li`, `hr`, `a`, `img`, `strong`, `em`, `del`, `code` (inline), `pre` (fenced
//   block: `{ code, language, closed }`), `table`, `th`, `td`, `br`, `input` (task checkbox)). A component is called with the
//   default `class`, the node's attributes and `children` (already rendered, live while streaming) and returns the element
//   that replaces the default one; elements are still built from the AST (never innerHTML). Tight list-item paragraphs have
//   no `<p>`, so `p` is not called for them. Style-only overrides: the `markdown__*` classes.
import { followText } from "@rivetjs/cdk/chat/text-reveal";
import { closeOpenMarks, parseMarkdown, splitBlocks } from "@rivetjs/cdk/markdown";
import type { MarkdownBlock, MarkdownInline, MarkdownListItem } from "@rivetjs/cdk/markdown";
import { clientEffect, For, Show } from "@rivetjs/runtime/dom";
import { computed, signal, untrack } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { markdownVariants } from "../../../styles/src/components/markdown/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { StreamingTextRun } from "../streaming-text/text-run.tsx";
import { CodeBlockCode, CodeBlockCopyButton, CodeBlockHeader, CodeBlockLanguage, CodeBlockRoot } from "../code-block/code-block.tsx";

const SLOTS = markdownVariants();

type Node = JSX.Element;

/** Props every element override receives: the default slot `class` and the rendered `children`. */
interface MarkdownElementProps {
  /** Default slot class (absent for `br`, `th`, `td`). */
  class?: string;
  children?: Content;
}
type Override<P = unknown> = (props: MarkdownElementProps & P) => JSX.Element;
interface MarkdownHeadingProps {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
}
/**
 * Per-node-type element overrides of `Markdown` (`components` prop). Keys are HTML tag names; each component receives the
 * default `class`, the node's attributes and `children`, and returns the element rendered in place of the default one.
 */
interface MarkdownComponents {
  h1?: Override<MarkdownHeadingProps>;
  h2?: Override<MarkdownHeadingProps>;
  h3?: Override<MarkdownHeadingProps>;
  h4?: Override<MarkdownHeadingProps>;
  h5?: Override<MarkdownHeadingProps>;
  h6?: Override<MarkdownHeadingProps>;
  p?: Override;
  blockquote?: Override;
  ul?: Override<{ "data-task"?: "true" }>;
  ol?: Override<{ start?: number }>;
  li?: Override<{ "data-task"?: "true" }>;
  hr?: Override;
  a?: Override<{ href: string; title?: string; target: string; rel: string }>;
  img?: Override<{ src: string; alt: string; title?: string; loading: "lazy"; decoding: "async" }>;
  strong?: Override;
  em?: Override;
  del?: Override;
  /** Inline code (`children` = the code text). */
  code?: Override;
  /** Fenced code block (replaces the whole `CodeBlock`). */
  pre?: Override<{ code: string; language: string; closed: boolean }>;
  table?: Override;
  th?: Override<{ scope: "col"; style?: { "text-align": string } }>;
  td?: Override<{ style?: { "text-align": string } }>;
  br?: Override;
  /** Task list checkbox (`children` unused). */
  input?: Override<{ type: "checkbox"; checked: boolean; disabled: true; "aria-label": string }>;
}

/** The override for `key` called with `props()`, else `fallback()` (props are only built for an override). */
function custom<K extends keyof MarkdownComponents>(
  cx: MarkdownComponents | undefined,
  key: K,
  props: () => Parameters<NonNullable<MarkdownComponents[K]>>[0],
  fallback: () => Node,
): Node {
  const C = cx?.[key] as ((props: unknown) => Node) | undefined;
  return C ? C(props()) : fallback();
}

// Literal class strings (BEM, no utilities: the class-override scan of `libs/compiler/class-merge.ts` reads them as safe; two resolver
// results joined in a template would count as an override source and pull tailwind-merge into every page with a Markdown).
const ORDERED_LIST = "markdown__list markdown__list--ordered";

const caret = (): Node => <span class={SLOTS.caret()} aria-hidden="true" data-slot="markdown-caret" />;

function renderInline(nodes: readonly MarkdownInline[], cx?: MarkdownComponents): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push(node.value as unknown as Node);
        break;
      case "strong":
        out.push(
          custom(
            cx,
            "strong",
            () => ({ class: SLOTS.strong(), children: renderInline(node.children, cx) }),
            () => <strong class={SLOTS.strong()}>{renderInline(node.children, cx)}</strong>,
          ),
        );
        break;
      case "em":
        out.push(
          custom(
            cx,
            "em",
            () => ({ class: SLOTS.em(), children: renderInline(node.children, cx) }),
            () => <em class={SLOTS.em()}>{renderInline(node.children, cx)}</em>,
          ),
        );
        break;
      case "del":
        out.push(
          custom(
            cx,
            "del",
            () => ({ class: SLOTS.del(), children: renderInline(node.children, cx) }),
            () => <del class={SLOTS.del()}>{renderInline(node.children, cx)}</del>,
          ),
        );
        break;
      case "code":
        out.push(
          custom(
            cx,
            "code",
            () => ({ class: SLOTS.inlineCode(), children: node.value }),
            () => <code class={SLOTS.inlineCode()}>{node.value}</code>,
          ),
        );
        break;
      case "br":
        out.push(
          custom(
            cx,
            "br",
            () => ({}),
            () => <br />,
          ),
        );
        break;
      case "link":
        out.push(
          custom(
            cx,
            "a",
            () => ({
              class: SLOTS.link(),
              href: node.href,
              title: node.title,
              target: "_blank",
              rel: "noopener noreferrer",
              children: renderInline(node.children, cx),
            }),
            () => (
              <a class={SLOTS.link()} href={node.href} title={node.title} target="_blank" rel="noopener noreferrer">
                {renderInline(node.children, cx)}
              </a>
            ),
          ),
        );
        break;
      case "image":
        out.push(
          custom(
            cx,
            "img",
            () => ({
              class: SLOTS.image(),
              src: node.src,
              alt: node.alt,
              title: node.title,
              loading: "lazy",
              decoding: "async",
              referrerPolicy: "no-referrer",
            }),
            () => <img class={SLOTS.image()} src={node.src} alt={node.alt} title={node.title} loading="lazy" decoding="async" referrerPolicy="no-referrer" />,
          ),
        );
        break;
    }
  }
  return out;
}

const withCaret = (children: Node[], tail: boolean): Node[] => (tail ? [...children, caret()] : children);

const HEADING_CLASS = [
  "markdown__heading markdown__heading--1",
  "markdown__heading markdown__heading--2",
  "markdown__heading markdown__heading--3",
  "markdown__heading markdown__heading--4",
  "markdown__heading markdown__heading--5",
  "markdown__heading markdown__heading--6",
];

function heading(level: number, children: Node[], live?: boolean, cx?: MarkdownComponents): Node {
  const cls = HEADING_CLASS[Math.min(level, 6) - 1]! + (live ? " markdown__live" : "");
  const C = cx?.[`h${level}` as "h1"] as Override<MarkdownHeadingProps> | undefined;
  if (C) return C({ class: cls, level: level as 1, children });
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
function renderBlocks(blocks: readonly MarkdownBlock[], tail: boolean, tight = false, cx?: MarkdownComponents): Node[] {
  const out: Node[] = [];
  blocks.forEach((block, index) => {
    const last = tail && index === blocks.length - 1;
    switch (block.type) {
      case "heading":
        out.push(heading(block.level, withCaret(renderInline(block.children, cx), last), undefined, cx));
        break;
      case "paragraph":
        if (tight) out.push(...withCaret(renderInline(block.children, cx), last));
        else
          out.push(
            custom(
              cx,
              "p",
              () => ({ class: SLOTS.paragraph(), children: withCaret(renderInline(block.children, cx), last) }),
              () => <p class={SLOTS.paragraph()}>{withCaret(renderInline(block.children, cx), last)}</p>,
            ),
          );
        break;
      case "blockquote":
        out.push(
          custom(
            cx,
            "blockquote",
            () => ({ class: SLOTS.blockquote(), children: renderBlocks(block.children, last, false, cx) }),
            () => <blockquote class={SLOTS.blockquote()}>{renderBlocks(block.children, last, false, cx)}</blockquote>,
          ),
        );
        break;
      case "hr":
        out.push(
          custom(
            cx,
            "hr",
            () => ({ class: SLOTS.hr() }),
            () => <hr class={SLOTS.hr()} />,
          ),
        );
        if (last) out.push(caret());
        break;
      case "code": {
        const code = block.value;
        const lang = block.lang || "plaintext";
        out.push(
          custom(
            cx,
            "pre",
            () => ({ class: SLOTS.codeBlock(), code, language: lang, closed: block.closed }),
            () => (
              <CodeBlockRoot class={SLOTS.codeBlock()} data-streaming={block.closed ? undefined : "true"}>
                <CodeBlockHeader>
                  <CodeBlockLanguage language={lang} />
                  <CodeBlockCopyButton code={code} />
                </CodeBlockHeader>
                <CodeBlockCode code={code} language={lang} />
              </CodeBlockRoot>
            ),
          ),
        );
        break;
      }
      case "list": {
        const items = block.items.map((item, i) => {
          const lastItem = last && i === block.items.length - 1;
          const task = item.checked !== undefined;
          const box = task
            ? custom(
                cx,
                "input",
                () => ({
                  class: SLOTS.taskCheckbox(),
                  type: "checkbox",
                  checked: item.checked === true,
                  disabled: true,
                  "aria-label": item.checked ? "Done" : "To do",
                }),
                () => <input class={SLOTS.taskCheckbox()} type="checkbox" checked={item.checked} disabled aria-label={item.checked ? "Done" : "To do"} />,
              )
            : null;
          const taskAttr = task ? ("true" as const) : undefined;
          return custom(
            cx,
            "li",
            () => ({ class: SLOTS.listItem(), "data-task": taskAttr, children: [box, renderBlocks(item.children, lastItem, block.tight, cx)] }),
            () => (
              <li class={SLOTS.listItem()} data-task={taskAttr}>
                {box}
                {renderBlocks(item.children, lastItem, block.tight, cx)}
              </li>
            ),
          );
        });
        const listTask = block.items.some((item) => item.checked !== undefined) ? ("true" as const) : undefined;
        out.push(
          block.ordered
            ? custom(
                cx,
                "ol",
                () => ({ class: ORDERED_LIST, start: block.start === 1 ? undefined : block.start, children: items }),
                () => (
                  <ol class={ORDERED_LIST} start={block.start === 1 ? undefined : block.start}>
                    {items}
                  </ol>
                ),
              )
            : custom(
                cx,
                "ul",
                () => ({ class: SLOTS.list(), "data-task": listTask, children: items }),
                () => (
                  <ul class={SLOTS.list()} data-task={listTask}>
                    {items}
                  </ul>
                ),
              ),
        );
        break;
      }
      case "table": {
        const align = block.align;
        const cellStyle = (i: number): { "text-align": string } | undefined => (align[i] ? { "text-align": align[i]! } : undefined);
        const head = block.head.map((cell, i) =>
          custom(
            cx,
            "th",
            () => ({ scope: "col", style: cellStyle(i), children: renderInline(cell, cx) }),
            () => (
              <th scope="col" style={cellStyle(i)}>
                {renderInline(cell, cx)}
              </th>
            ),
          ),
        );
        const body = block.rows.map((row) => (
          <tr>
            {row.map((cell, i) =>
              custom(
                cx,
                "td",
                () => ({ style: cellStyle(i), children: renderInline(cell, cx) }),
                () => <td style={cellStyle(i)}>{renderInline(cell, cx)}</td>,
              ),
            )}
          </tr>
        ));
        const tableRows = [
          <thead>
            <tr>{head}</tr>
          </thead>,
          <tbody>{body}</tbody>,
        ];
        out.push(
          <div class={SLOTS.tableWrapper()} role="region" tabIndex={0} aria-label="Table">
            {custom(
              cx,
              "table",
              () => ({ class: SLOTS.table(), children: tableRows }),
              () => (
                <table class={SLOTS.table()}>{tableRows}</table>
              ),
            )}
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

/** Use the same character component and animation as StreamingText; pacing is already applied to the source. */
const liveText = (text: () => string, animate: () => boolean): Node => (
  <StreamingTextRun content={text} isRevealing={animate} characterClass={SLOTS.character()} />
);

const inlineKey = (node: MarkdownInline, index: number): string => `${index}:${node.type}${node.type === "image" ? JSON.stringify(node) : ""}`;

function liveInline(nodes: () => readonly MarkdownInline[], animate: () => boolean, cx?: MarkdownComponents): Node {
  return (
    <For each={nodes} by={inlineKey}>
      {(node: () => MarkdownInline) => liveInlineNode(node, animate, cx)}
    </For>
  );
}

function liveInlineNode(node: () => MarkdownInline, animate: () => boolean, cx?: MarkdownComponents): Node {
  const first = node();
  const children = (): readonly MarkdownInline[] => {
    const n = node();
    return "children" in n ? n.children : [];
  };
  switch (first.type) {
    case "text":
      return liveText(() => (node() as { value: string }).value, animate);
    case "strong":
      return custom(
        cx,
        "strong",
        () => ({ class: SLOTS.strong(), children: liveInline(children, animate, cx) }),
        () => <strong class={SLOTS.strong()}>{liveInline(children, animate, cx)}</strong>,
      );
    case "em":
      return custom(
        cx,
        "em",
        () => ({ class: SLOTS.em(), children: liveInline(children, animate, cx) }),
        () => <em class={SLOTS.em()}>{liveInline(children, animate, cx)}</em>,
      );
    case "del":
      return custom(
        cx,
        "del",
        () => ({ class: SLOTS.del(), children: liveInline(children, animate, cx) }),
        () => <del class={SLOTS.del()}>{liveInline(children, animate, cx)}</del>,
      );
    case "code":
      return custom(
        cx,
        "code",
        () => ({ class: SLOTS.inlineCode(), children: liveText(() => (node() as { value: string }).value, animate) }),
        () => <code class={SLOTS.inlineCode()}>{liveText(() => (node() as { value: string }).value, animate)}</code>,
      );
    case "br":
      return custom(
        cx,
        "br",
        () => ({}),
        () => <br />,
      );
    case "link":
      return custom(
        cx,
        "a",
        () => ({
          class: SLOTS.link(),
          get href() {
            return (node() as { href: string }).href;
          },
          get title() {
            return (node() as { title?: string }).title;
          },
          target: "_blank",
          rel: "noopener noreferrer",
          children: liveInline(children, animate, cx),
        }),
        () => (
          <a
            class={SLOTS.link()}
            href={(node() as { href: string }).href}
            title={(node() as { title?: string }).title}
            target="_blank"
            rel="noopener noreferrer"
          >
            {liveInline(children, animate, cx)}
          </a>
        ),
      );
    case "image":
      // One element (not the array): a single-element row is the cheaper list row (no anchors).
      return renderInline([first], cx)[0]!;
  }
}

const blockKind = (block: MarkdownBlock): string =>
  block.type === "heading"
    ? `h${block.level}`
    : block.type === "list"
      ? `${block.ordered ? `ol:${block.start}` : "ul"}:${block.tight}`
      : block.type === "code"
        ? block.closed
          ? "code"
          : "fence"
        : block.type;

const liveCaret = (on: () => boolean): Node => <Show when={on}>{caret()}</Show>;

function liveBlocks(blocks: () => readonly MarkdownBlock[], caretOn: () => boolean, animate: () => boolean, tight = false, cx?: MarkdownComponents): Node {
  return (
    <For
      each={blocks}
      by={(block: MarkdownBlock, index: number) =>
        `${index}:${blockKind(block)}${block.type === "table" || (block.type === "code" && block.closed) ? JSON.stringify(block) : ""}`
      }
    >
      {(block: () => MarkdownBlock, index: () => number) => liveBlock(block, () => caretOn() && index() === blocks().length - 1, animate, tight, cx)}
    </For>
  );
}

function liveBlock(block: () => MarkdownBlock, caretOn: () => boolean, animate: () => boolean, tight: boolean, cx?: MarkdownComponents): Node {
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
            {liveInline(inline, animate, cx)}
            {liveCaret(caretOn)}
          </span>
        );
      return custom(
        cx,
        "p",
        () => ({ class: `${SLOTS.paragraph()} ${live}`, children: [liveInline(inline, animate, cx), liveCaret(caretOn)] }),
        () => (
          <p class={`${SLOTS.paragraph()} ${live}`}>
            {liveInline(inline, animate, cx)}
            {liveCaret(caretOn)}
          </p>
        ),
      );
    case "heading":
      return heading(first.level, [liveInline(inline, animate, cx), liveCaret(caretOn)], true, cx);
    case "blockquote": {
      const quoted = (): Node =>
        liveBlocks(
          () => {
            const b = block();
            return b.type === "blockquote" ? b.children : [];
          },
          caretOn,
          animate,
          false,
          cx,
        );
      return custom(
        cx,
        "blockquote",
        () => ({ class: `${SLOTS.blockquote()} ${live}`, children: quoted() }),
        () => <blockquote class={`${SLOTS.blockquote()} ${live}`}>{quoted()}</blockquote>,
      );
    }
    case "list": {
      const items = (): readonly MarkdownListItem[] => {
        const b = block();
        return b.type === "list" ? b.items : [];
      };
      const tightList = first.tight;
      const rows = (
        <For each={items} by={(_item: MarkdownListItem, index: number) => index}>
          {(item: () => MarkdownListItem, index: () => number) => {
            const task = (): "true" | undefined => (item().checked !== undefined ? "true" : undefined);
            const box = (
              <Show when={() => item().checked !== undefined}>
                {() =>
                  custom(
                    cx,
                    "input",
                    () => ({
                      class: SLOTS.taskCheckbox(),
                      type: "checkbox",
                      get checked() {
                        return item().checked === true;
                      },
                      disabled: true,
                      get "aria-label"() {
                        return item().checked ? "Done" : "To do";
                      },
                    }),
                    () => (
                      <input class={SLOTS.taskCheckbox()} type="checkbox" checked={item().checked} disabled aria-label={item().checked ? "Done" : "To do"} />
                    ),
                  )
                }
              </Show>
            );
            const content = (): Node =>
              liveBlocks(
                () => item().children,
                () => caretOn() && index() === items().length - 1,
                animate,
                tightList,
                cx,
              );
            return custom(
              cx,
              "li",
              () => ({
                class: `${SLOTS.listItem()} ${live}`,
                get "data-task"() {
                  return task();
                },
                children: [box, content()],
              }),
              () => (
                <li class={`${SLOTS.listItem()} ${live}`} data-task={task()}>
                  {box}
                  {content()}
                </li>
              ),
            );
          }}
        </For>
      );
      return first.ordered
        ? custom(
            cx,
            "ol",
            () => ({ class: ORDERED_LIST, start: first.start === 1 ? undefined : first.start, children: rows }),
            () => (
              <ol class={ORDERED_LIST} start={first.start === 1 ? undefined : first.start}>
                {rows}
              </ol>
            ),
          )
        : custom(
            cx,
            "ul",
            () => ({
              class: SLOTS.list(),
              get "data-task"() {
                return items().some((item) => item.checked !== undefined) ? ("true" as const) : undefined;
              },
              children: rows,
            }),
            () => (
              <ul class={SLOTS.list()} data-task={items().some((item) => item.checked !== undefined) ? "true" : undefined}>
                {rows}
              </ul>
            ),
          );
    }
    case "code":
      if (!first.closed) {
        const lang = first.lang || "plaintext";
        const code = (): string => {
          const b = block();
          return b.type === "code" ? b.value : "";
        };
        return custom(
          cx,
          "pre",
          () => ({
            class: `${SLOTS.codeBlock()} ${live}`,
            get code() {
              return code();
            },
            language: lang,
            closed: false,
          }),
          () => (
            <CodeBlockRoot class={`${SLOTS.codeBlock()} ${live}`} data-streaming="true">
              <CodeBlockHeader>
                <CodeBlockLanguage language={lang} />
              </CodeBlockHeader>
              <div class="code-block__code" data-slot="code-block-code">
                <pre class="code-block__pre">
                  <code>{liveText(code, animate)}</code>
                </pre>
              </div>
            </CodeBlockRoot>
          ),
        );
      }
      return renderBlocks([first], false, false, cx)[0]!;
    default:
      // hr / table / closed code: small or atomic, rendered whole (re-rendered when the block's text changes).
      return renderBlocks([first], false, false, cx)[0]!;
  }
}

interface MarkdownRow {
  key: string;
  raw: string;
  tail: boolean;
  last: boolean;
}

interface MarkdownProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children" | "content"> {
  /** Markdown source: a string or an accessor (streaming). Takes precedence over `children`. */
  content?: string | (() => string);
  /** Markdown source as a string child. */
  children?: string;
  /** The response is still streaming: repair open marks in the last block and show the caret. Value or accessor. */
  isStreaming?: boolean | (() => boolean);
  /** Graphemes per second, with bounded catch-up for bursts; 0 displays chunks immediately. @default 80 */
  streamingSpeed?: number;
  /** Caret after the streamed text while `isStreaming`. @default true */
  showCaret?: boolean;
  /** Per-node-type element overrides (`h1`, `p`, `a`, `code`, `pre`, …): see `MarkdownComponents`. Read once at creation. */
  components?: MarkdownComponents;
  class?: string;
}

const MarkdownRoot = (props: MarkdownProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "content", "isStreaming", "streamingSpeed", "showCaret", "components"]);
  const source = (): string => {
    const value = local.content ?? local.children;
    const text = typeof value === "function" ? (value as () => unknown)() : value;
    return typeof text === "string" ? text : "";
  };
  const inputStreaming = (): boolean => {
    const value = local.isStreaming;
    return (typeof value === "function" ? value() : value) === true;
  };
  const canStream = typeof local.content === "function" || local.isStreaming !== undefined;
  const displayed = canStream ? signal(untrack(source)) : undefined;
  const revealing = canStream ? signal(false) : undefined;
  // Once text has animated, keep those character nodes through block completion and stream end, just like
  // StreamingText. Replacing them with static text would cut their in-flight CSS fades short.
  const liveFrom = canStream ? signal(-1) : undefined;
  const speed = local.streamingSpeed;
  if (displayed && revealing && liveFrom)
    clientEffect(
      () =>
        untrack(() =>
          followText(source, displayed, {
            isStreaming: inputStreaming,
            speed,
            onRevealingChange: (value) => {
              if (value) {
                const start = Math.max(0, splitBlocks(untrack(displayed)).length - 1);
                const previous = untrack(liveFrom);
                // Establish existing glyphs before enabling motion, so prior text never reanimates.
                liveFrom.set(previous < 0 ? start : Math.min(previous, start));
              }
              revealing.set(value);
            },
          }),
        ),
      { when: "interaction" },
    );
  const streaming = (): boolean => inputStreaming() || revealing?.() === true;
  const rows = (): MarkdownRow[] => {
    // Streaming reads only the revealed text (`followText` writes it from `source`): reading `source` too re-split every
    // chunk write a second time, before the reveal caught up.
    const blocks = splitBlocks(displayed ? displayed() : source());
    const live = streaming();
    const retained = liveFrom?.() ?? -1;
    return blocks.map((raw, index) => {
      const last = index === blocks.length - 1;
      const tail = (live && last) || (retained >= 0 && index >= retained);
      return { key: tail ? `${index}:~` : `${index}:${raw}`, raw, tail, last };
    });
  };
  const caretOn = local.showCaret !== false;
  const cx = local.components;
  return (
    <div class={composeSlotClassName(SLOTS.base, local.class)} data-slot="markdown" data-streaming={() => (streaming() ? "true" : undefined)} {...rest}>
      <For each={rows} by={(row: MarkdownRow) => row.key}>
        {(row: () => MarkdownRow) => {
          const { raw, tail } = row();
          // Every row is one element: cheaper to reconcile than a row of several nodes between anchors (a perf choice;
          // since 2026-10-09 the runtime also keeps a ranged row's later nodes in place when rows are added / removed).
          if (!tail) {
            const nodes = renderBlocks(parseMarkdown(raw), false, false, cx);
            return nodes.length === 1 ? nodes[0]! : <div class={SLOTS.tail()}>{nodes}</div>;
          }
          // The tail row persists while it grows: its blocks are reactive (keyed) over the repaired text.
          const blocks = computed(() => parseMarkdown(row().last && streaming() ? closeOpenMarks(row().raw) : row().raw));
          return (
            <div class={SLOTS.tail()}>
              {liveBlocks(
                blocks,
                () => caretOn && streaming() && row().last,
                () => revealing?.() === true,
                false,
                cx,
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
};

export { MarkdownRoot };
export type { MarkdownProps, MarkdownComponents, MarkdownElementProps };
