// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no markdown renderer). Feature set inspired by commercial UI kits' public
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
//   the way down (blocks → inline nodes → graphemes, keyed by position), so a new chunk appends character `<span>`s and existing
//   nodes stay (no re-render per chunk); new characters / blocks fade in (CSS, `.markdown__character` / `.markdown__live`,
//   reduced motion: none). An open code fence streams as plain characters in the code block frame and is highlighted once it
//   closes (the row then re-renders as a finished block, static: no animation).
// - Smooth growth: a streaming Markdown created in the browser (the live turn appears on submit) follows its content
//   height with `followHeight` (`@rivetjs/cdk/chat`, a `clientEffect` on a root `ref()`, disposed with the Markdown):
//   no line / block jumps. Only when `isStreaming` is an accessor; on a resumed page the effect waits for its trigger
//   (nothing boots at load). A ref callback would not resume (server render error).
// - `components` (scoped from public docs of commercial UI kits): per-node-type override map, keys = HTML tag names
//   (`h1`-`h6`, `p`, `blockquote`, `ul`, `ol`, `li`, `hr`, `a`, `img`, `strong`, `em`, `del`, `code` (inline), `pre` (fenced
//   block: `{ code, language, closed }`), `table`, `th`, `td`, `br`, `input` (task checkbox)). A component is called with the
//   default `class`, the node's attributes and `children` (already rendered, live while streaming) and returns the element
//   that replaces the default one; elements are still built from the AST (never innerHTML). Tight list-item paragraphs have
//   no `<p>`, so `p` is not called for them. Style-only overrides: the `markdown__*` classes.
import { followHeight } from "@rivetjs/cdk/chat";
import { followText, textGraphemes } from "@rivetjs/cdk/chat/text-reveal";
import { closeOpenMarks, parseMarkdown, splitBlocks } from "@rivetjs/cdk/markdown";
import type { MarkdownBlock, MarkdownInline, MarkdownListItem } from "@rivetjs/cdk/markdown";
import { clientEffect, For, ref as createRef, Show } from "@rivetjs/runtime/dom";
import { computed, signal, untrack } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { markdownVariants } from "../../../styles/src/components/markdown/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
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
            () => ({ class: SLOTS.image(), src: node.src, alt: node.alt, title: node.title, loading: "lazy", decoding: "async" }),
            () => <img class={SLOTS.image()} src={node.src} alt={node.alt} title={node.title} loading="lazy" decoding="async" />,
          ),
        );
        break;
    }
  }
  return out;
}

const withCaret = (children: Node[], tail: boolean): Node[] => (tail ? [...children, caret()] : children);

function heading(level: number, children: Node[], live?: boolean, cx?: MarkdownComponents): Node {
  const cls = live
    ? level === 1
      ? "markdown__heading markdown__heading--1 markdown__live"
      : level === 2
        ? "markdown__heading markdown__heading--2 markdown__live"
        : level === 3
          ? "markdown__heading markdown__heading--3 markdown__live"
          : level === 4
            ? "markdown__heading markdown__heading--4 markdown__live"
            : level === 5
              ? "markdown__heading markdown__heading--5 markdown__live"
              : "markdown__heading markdown__heading--6 markdown__live"
    : level === 1
      ? "markdown__heading markdown__heading--1"
      : level === 2
        ? "markdown__heading markdown__heading--2"
        : level === 3
          ? "markdown__heading markdown__heading--3"
          : level === 4
            ? "markdown__heading markdown__heading--4"
            : level === 5
              ? "markdown__heading markdown__heading--5"
              : "markdown__heading markdown__heading--6";
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

/**
 * Grapheme spans of growing text, keyed by position so each new letter fades independently and existing nodes stay.
 * Wrapped in one `<span>`: a list row that is a single element is cheaper to reconcile than a row of anchors (no
 * start / end Text nodes, no range walk per list update; the runtime keeps either kind's nodes in place).
 */
const liveText = (text: () => string): Node => (
  <span>
    <For each={() => textGraphemes(text())} by={(_character: string, index: number) => index}>
      {(character: () => string) => <span class={SLOTS.character()}>{character()}</span>}
    </For>
  </span>
);

const inlineKey = (node: MarkdownInline, index: number): string => `${index}:${node.type}`;

function liveInline(nodes: () => readonly MarkdownInline[], cx?: MarkdownComponents): Node {
  return (
    <For each={nodes} by={inlineKey}>
      {(node: () => MarkdownInline) => liveInlineNode(node, cx)}
    </For>
  );
}

function liveInlineNode(node: () => MarkdownInline, cx?: MarkdownComponents): Node {
  const first = node();
  const children = (): readonly MarkdownInline[] => {
    const n = node();
    return "children" in n ? n.children : [];
  };
  switch (first.type) {
    case "text":
      return liveText(() => (node() as { value: string }).value);
    case "strong":
      return custom(
        cx,
        "strong",
        () => ({ class: SLOTS.strong(), children: liveInline(children, cx) }),
        () => <strong class={SLOTS.strong()}>{liveInline(children, cx)}</strong>,
      );
    case "em":
      return custom(
        cx,
        "em",
        () => ({ class: SLOTS.em(), children: liveInline(children, cx) }),
        () => <em class={SLOTS.em()}>{liveInline(children, cx)}</em>,
      );
    case "del":
      return custom(
        cx,
        "del",
        () => ({ class: SLOTS.del(), children: liveInline(children, cx) }),
        () => <del class={SLOTS.del()}>{liveInline(children, cx)}</del>,
      );
    case "code":
      return custom(
        cx,
        "code",
        () => ({ class: SLOTS.inlineCode(), children: liveText(() => (node() as { value: string }).value) }),
        () => <code class={SLOTS.inlineCode()}>{liveText(() => (node() as { value: string }).value)}</code>,
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
          target: "_blank",
          rel: "noopener noreferrer",
          children: liveInline(children, cx),
        }),
        () => (
          <a class={SLOTS.link()} href={(node() as { href: string }).href} target="_blank" rel="noopener noreferrer">
            {liveInline(children, cx)}
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
      ? block.ordered
        ? "ol"
        : "ul"
      : block.type === "code"
        ? block.closed
          ? "code"
          : "fence"
        : block.type;

const liveCaret = (on: () => boolean): Node => <Show when={on}>{caret()}</Show>;

function liveBlocks(blocks: () => readonly MarkdownBlock[], caretOn: () => boolean, tight = false, cx?: MarkdownComponents): Node {
  return (
    <For each={blocks} by={(block: MarkdownBlock, index: number) => `${index}:${blockKind(block)}`}>
      {(block: () => MarkdownBlock, index: () => number) => liveBlock(block, () => caretOn() && index() === blocks().length - 1, tight, cx)}
    </For>
  );
}

function liveBlock(block: () => MarkdownBlock, caretOn: () => boolean, tight: boolean, cx?: MarkdownComponents): Node {
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
            {liveInline(inline, cx)}
            {liveCaret(caretOn)}
          </span>
        );
      return custom(
        cx,
        "p",
        () => ({ class: `${SLOTS.paragraph()} ${live}`, children: [liveInline(inline, cx), liveCaret(caretOn)] }),
        () => (
          <p class={`${SLOTS.paragraph()} ${live}`}>
            {liveInline(inline, cx)}
            {liveCaret(caretOn)}
          </p>
        ),
      );
    case "heading":
      return heading(first.level, [liveInline(inline, cx), liveCaret(caretOn)], true, cx);
    case "blockquote": {
      const quoted = (): Node =>
        liveBlocks(
          () => {
            const b = block();
            return b.type === "blockquote" ? b.children : [];
          },
          caretOn,
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
            const content = (): Node =>
              liveBlocks(
                () => item().children,
                () => caretOn() && index() === items().length - 1,
                tightList,
                cx,
              );
            return custom(
              cx,
              "li",
              () => ({ class: `${SLOTS.listItem()} ${live}`, children: content() }),
              () => <li class={`${SLOTS.listItem()} ${live}`}>{content()}</li>,
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
            () => ({ class: SLOTS.list(), children: rows }),
            () => <ul class={SLOTS.list()}>{rows}</ul>,
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
                  <code>{liveText(code)}</code>
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
  const speed = local.streamingSpeed;
  if (displayed && revealing)
    clientEffect(
      () => untrack(() => followText(source, displayed, { isStreaming: inputStreaming, speed, onRevealingChange: (value) => revealing.set(value) })),
      { when: "interaction" },
    );
  const streaming = (): boolean => inputStreaming() || revealing?.() === true;
  const rows = (): MarkdownRow[] => {
    const raw = source();
    const blocks = splitBlocks(displayed ? displayed() : raw);
    const live = streaming();
    return blocks.map((raw, index) => {
      const tail = live && index === blocks.length - 1;
      return { key: tail ? `${index}:~` : `${index}:${raw}`, raw, tail };
    });
  };
  const caretOn = local.showCaret !== false;
  const cx = local.components;
  // Streaming sources: follow content height until both the input and the character queue finish.
  const follow = canStream ? createRef<HTMLDivElement>() : undefined;
  if (follow)
    // Content writes wake the Markdown (its rows read them), which runs this effect: no trigger (CEFF 2026-10-28).
    clientEffect(
      () => {
        const el = follow();
        if (el) return untrack(() => followHeight(el, streaming));
      },
      { when: "interaction" },
    );
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
            const nodes = renderBlocks(parseMarkdown(raw), false, false, cx);
            return nodes.length === 1 ? nodes[0]! : <div class={SLOTS.tail()}>{nodes}</div>;
          }
          // The tail row persists while it grows: its blocks are reactive (keyed) over the repaired text.
          const blocks = computed(() => parseMarkdown(closeOpenMarks(row().raw)));
          return <div class={SLOTS.tail()}>{liveBlocks(blocks, () => caretOn, false, cx)}</div>;
        }}
      </For>
    </div>
  );
};

export { MarkdownRoot };
export type { MarkdownProps, MarkdownComponents, MarkdownElementProps };
