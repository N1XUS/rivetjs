// Small shared views: reactive node names, value trees (lazy expansion, typed in-place edits, container
// operations), source links, signal rows with JSON editing.
import { signal, type Signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { editValue, fullText, inspectValue, openInEditor, setSignal, valueOf } from "./store.ts";
import {
  displayName,
  type EditOp,
  type Entry,
  type Inspected,
  type Named,
  type Preview,
  type Seg,
  type SignalInfo,
  type SourceLocation,
  type Target,
  type Typed,
} from "../protocol.ts";
import { ChevronDown, ChevronRight, X } from "lucide";
import { Icon } from "./icon.tsx";

/** A signal / computed / effect name in the one display format (`Layout › count`); `scoped={false}` under a component header. */
export function NodeLabel(props: { node: Named; scoped?: boolean }) {
  const node = props.node;
  return (
    <span class="name" title={displayName(node) + " (#" + node.id + ")"} data-label={displayName(node)}>
      {props.scoped !== false && node.scope ? <span class="scope">{node.scope + " › "}</span> : null}
      {displayName(node, { scoped: false })}
    </span>
  );
}

/** A one-line value preview. */
export function Value(props: { value: () => Preview }) {
  return <code class={"value k-" + props.value().k}>{props.value().p}</code>;
}

const MAX_DEPTH = 32;
type Kind = Typed["t"];
const KINDS: [Kind, string][] = [
  ["s", "string"],
  ["n", "number"],
  ["b", "boolean"],
  ["big", "bigint"],
  ["date", "Date"],
  ["null", "null"],
  ["u", "undefined"],
  ["json", "JSON"],
];
/** Previews edited as leaves, and the editor type they start with. */
function leafKind(value: Preview): Kind | null {
  switch (value.k) {
    case "n":
      return "n";
    case "s":
    case "trunc":
      return "s";
    case "b":
      return "b";
    case "big":
      return "big";
    case "date":
      return "date";
    case "u":
      return value.p === "null" ? "null" : "u";
    default:
      return null;
  }
}
/** A preview of a primitive from its text (`signal(…)` previews carry only the inner text). */
function guess(p: string): Preview {
  if (p === "true" || p === "false") return { k: "b", p };
  if (p === "null" || p === "undefined") return { k: "u", p };
  if (/^-?\d+n$/.test(p)) return { k: "big", p };
  if (p.startsWith('"')) return { k: p.endsWith('…"') ? "trunc" : "s", p };
  if (/^\d{4}-\d\d-\d\dT/.test(p)) return { k: "date", p };
  return /^-?(\d|Infinity|NaN)/.test(p) ? { k: "n", p } : { k: "o", p };
}
/** Initial editor text of a leaf. */
function leafText(value: Preview, kind: Kind): string {
  if (kind === "s") {
    try {
      return JSON.parse(value.k === "trunc" ? value.p.replace(/…"$/, '"') : value.p) as string;
    } catch {
      return value.p;
    }
  }
  if (kind === "big") return value.p.replace(/n$/, "");
  if (kind === "date") return value.p === "Invalid Date" ? "" : value.p;
  return kind === "null" || kind === "u" ? "" : value.p;
}
const typed = (kind: Kind, text: string, flag: boolean): Typed => {
  switch (kind) {
    case "b":
      return { t: "b", v: flag };
    case "null":
      return { t: "null" };
    case "u":
      return { t: "u" };
    default:
      return { t: kind, v: text };
  }
};
const containerOf = (value: Preview): "object" | "array" | "map" | "set" | null =>
  value.k === "map"
    ? "map"
    : value.k === "set"
      ? "set"
      : value.k === "a"
        ? value.c === "typed"
          ? null
          : "array"
        : value.k === "o" && value.c
          ? "object"
          : null;

/** Typed value input: a type picker and a field (checkbox for booleans). */
function TypedInput(props: { kind: Signal<Kind>; text: Signal<string>; flag: Signal<boolean>; onCommit: () => void; onCancel: () => void; cls?: string }) {
  const keys = (event: KeyboardEvent) => (event.key === "Enter" ? props.onCommit() : event.key === "Escape" ? props.onCancel() : undefined);
  return (
    <span class={"typed " + (props.cls ?? "")}>
      <select class="type" title="Value type" onChange={(event: Event) => props.kind.set((event.currentTarget as HTMLSelectElement).value as Kind)}>
        <For each={() => KINDS} by={([k]) => k}>
          {(entry) => (
            <option value={entry()[0]} selected={props.kind() === entry()[0]}>
              {entry()[1]}
            </option>
          )}
        </For>
      </select>
      {() => {
        const kind = props.kind();
        if (kind === "null" || kind === "u") return null;
        if (kind === "b")
          return (
            <input
              type="checkbox"
              class="flag"
              checked={props.flag()}
              onChange={(event: Event) => props.flag.set((event.currentTarget as HTMLInputElement).checked)}
              onKeyDown={keys}
            />
          );
        return (
          <input
            class={"json leaf k-" + kind}
            inputMode={kind === "n" || kind === "big" ? "decimal" : undefined}
            placeholder={kind === "date" ? "ISO date or ms" : kind === "big" ? "integer" : kind === "json" ? "JSON" : undefined}
            model:value={props.text}
            onKeyDown={keys}
          />
        );
      }}
    </span>
  );
}

interface TreeContext {
  /** Expanded paths (kept while the value is re-rendered after writes). */
  open: Set<string>;
  /** What leaf edits write (signal value, or a computed / prop override); none: read-only. */
  target?: Target;
}
const openSets = new Map<string, Set<string>>();

function ValueNode(props: {
  label?: string;
  proto?: boolean;
  value: Preview;
  path: Seg[];
  keys: string[];
  ancestors: number[];
  ctx: TreeContext;
  onRemove?: () => Promise<string | null>;
}) {
  const { value, path, ctx } = props;
  const key = props.keys.join("\u0000");
  const expandable = value.h !== undefined && value.k !== "trunc" && props.keys.length < MAX_DEPTH;
  const open = signal(expandable && ctx.open.has(key));
  const page = signal<Inspected | "expired" | null>(null);
  const text = signal<string | null>(null);
  const editing = signal(false);
  const adding = signal(false);
  const error = signal<string | null>(null);
  // Editor state: leaf value, and for `add` the key.
  const kind = signal<Kind>("s"),
    draft = signal(""),
    flag = signal(false);
  const keyKind = signal<Kind>("s"),
    keyDraft = signal(""),
    keyFlag = signal(false);
  // A signal inside the value (e.g. a provided `{ theme: signal(…) }`): its subtree edits that signal.
  const inner: TreeContext = value.sid !== undefined && ctx.target ? { open: ctx.open, target: { kind: "signal", id: value.sid } } : ctx;
  const innerPath = inner === ctx ? path : [];
  const target = ctx.target;
  const load = async (offset: number) => {
    const next = await inspectValue(value.h!, offset, props.ancestors);
    const current = page();
    page.set(
      next === null ? "expired" : offset && current && current !== "expired" ? { entries: [...current.entries, ...next.entries], total: next.total } : next,
    );
  };
  const toggle = () => {
    if (!expandable) return;
    const next = !open();
    open.set(next);
    if (next) ctx.open.add(key);
    else ctx.open.delete(key);
    if (next && page() === null) void load(0);
  };
  if (open()) void load(0);
  // A signal holding a primitive (inside a provided / prop value): edits write that signal.
  const sigInner = value.k === "sig" && value.sid !== undefined && value.h === undefined && target ? guess(value.p.slice(7, -1)) : null;
  const leaf = sigInner ? leafKind(sigInner) : target ? leafKind(value) : null;
  // At the root of an override (an accessor prop), the edit pins the value instead of writing the signal.
  const writesSignal = sigInner !== null && (path.length > 0 || target?.kind === "signal");
  const leafTarget: Target | undefined = writesSignal ? { kind: "signal", id: value.sid! } : target;
  const leafPath: Seg[] = writesSignal ? [] : path;
  const leafValue = sigInner ?? value;
  const container = target ? containerOf(value) : null;
  const run = async (edit: Promise<string | null>, done: () => void) => {
    const failure = await edit;
    // Notes (e.g. custom equals) show but do not keep the editor open.
    error.set(failure);
    if (!failure || failure.startsWith("custom equals")) done();
  };
  const startEdit = async () => {
    if (!leaf) return;
    // Booleans toggle at once.
    if (leaf === "b") return void run(editValue(leafTarget!, leafPath, { op: "set", value: { t: "b", v: leafValue.p !== "true" } }), () => {});
    kind.set(leaf);
    const full = value.k === "trunc" && value.h !== undefined ? await fullText(value.h) : null;
    draft.set(full ?? (text() !== null ? text()! : leafText(leafValue, leaf)));
    editing.set(true);
  };
  const commit = () => void run(editValue(leafTarget!, leafPath, { op: "set", value: typed(kind(), draft(), flag()) }), () => editing.set(false));
  const add = () => {
    const op: EditOp = {
      op: "add",
      value: typed(kind(), draft(), flag()),
      ...(container === "object" ? { key: { t: "s" as const, v: keyDraft() } } : container === "map" ? { key: typed(keyKind(), keyDraft(), keyFlag()) } : {}),
    };
    void run(editValue(inner.target!, innerPath, op), () => {
      adding.set(false);
      if (open()) void load(0);
    });
  };
  const segOf = (entry: Entry): Seg =>
    value.k === "map" && entry.kh !== undefined ? { m: entry.kh } : value.k === "set" && entry.kh !== undefined ? { s: entry.kh } : { o: entry.key };
  return (
    <li class="vnode" data-key={props.label ?? ""}>
      <span class="vline">
        {expandable ? (
          <button type="button" class="toggle" title={open() ? "Collapse" : "Expand"} onClick={toggle}>
            {() => <Icon icon={open() ? ChevronDown : ChevronRight} />}
          </button>
        ) : (
          <span class="toggle-space" />
        )}
        {props.label !== undefined ? (
          <span class={props.proto ? "vkey proto" : "vkey"} onClick={toggle}>
            {props.label + ":"}
          </span>
        ) : null}
        {() =>
          editing() ? (
            <span class="edit">
              <TypedInput kind={kind} text={draft} flag={flag} onCommit={commit} onCancel={() => editing.set(false)} />
              <button type="button" class="set" onClick={commit}>
                Set
              </button>
            </span>
          ) : (
            <code
              class={"value k-" + value.k + (leaf ? " editable" : "")}
              title={leaf === "b" ? "Double-click to toggle" : leaf ? "Double-click to edit" : undefined}
              onClick={toggle}
              onDblClick={() => void startEdit()}
            >
              {() => (text() !== null ? JSON.stringify(text()) : value.p)}
            </code>
          )
        }
        {() =>
          value.k === "trunc" && value.h !== undefined && text() === null ? (
            <button type="button" class="more-text" onClick={async () => text.set((await fullText(value.h!)) ?? value.p)}>
              {"show all " + value.n + " chars"}
            </button>
          ) : null
        }
        {props.onRemove ? (
          <button type="button" class="remove" title="Remove" aria-label="Remove" onClick={() => void props.onRemove!().then((failure) => error.set(failure))}>
            <Icon icon={X} />
          </button>
        ) : null}
        {() => (error() ? <span class="error">{error()}</span> : null)}
      </span>
      {() => {
        if (!open()) return null;
        const current = page();
        if (current === null)
          return (
            <ul class="vchildren">
              <li class="muted">…</li>
            </ul>
          );
        if (current === "expired")
          return (
            <ul class="vchildren">
              <li class="muted">(value changed: collapse and expand again)</li>
            </ul>
          );
        const ancestors = [...props.ancestors, value.h!];
        const editable = inner.target !== undefined && (containerOf(value) !== null || inner !== ctx);
        return (
          <ul class="vchildren">
            <For each={() => current.entries} by={(entry: Entry) => entry}>
              {(entry) => (
                <ValueNode
                  label={entry().key}
                  proto={entry().proto === true}
                  value={entry().value}
                  path={[...innerPath, segOf(entry())]}
                  keys={[...props.keys, entry().key]}
                  ancestors={ancestors}
                  ctx={inner}
                  {...(editable && !entry().proto && entry().value.k !== "get" && containerOf(value)
                    ? {
                        onRemove: () =>
                          editValue(inner.target!, [...innerPath, segOf(entry())], { op: "delete" }).then((failure) =>
                            failure ? failure : (void load(0), null),
                          ),
                      }
                    : {})}
                />
              )}
            </For>
            {current.entries.length < current.total ? (
              <li>
                <button type="button" class="more" onClick={() => void load(current.entries.length)}>
                  {current.total - current.entries.length + " more…"}
                </button>
              </li>
            ) : null}
            {current.total === 0 ? <li class="muted">(empty)</li> : null}
            {editable && containerOf(value) ? (
              <li class="add-row">
                {() =>
                  adding() ? (
                    <span class="edit add">
                      {container === "object" ? <input class="json key" placeholder="key" model:value={keyDraft} /> : null}
                      {container === "map" ? (
                        <TypedInput kind={keyKind} text={keyDraft} flag={keyFlag} onCommit={add} onCancel={() => adding.set(false)} cls="map-key" />
                      ) : null}
                      {container === "map" || container === "object" ? <span class="muted">→</span> : null}
                      <TypedInput kind={kind} text={draft} flag={flag} onCommit={add} onCancel={() => adding.set(false)} />
                      <button type="button" class="set" onClick={add}>
                        Add
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      class="add"
                      onClick={() => {
                        kind.set("s");
                        draft.set("");
                        keyDraft.set("");
                        adding.set(true);
                      }}
                    >
                      {container === "object" ? "+ key" : container === "map" ? "+ entry" : container === "set" ? "+ member" : "+ item"}
                    </button>
                  )
                }
              </li>
            ) : null}
          </ul>
        );
      }}
    </li>
  );
}

/**
 * A value as an expandable tree: children load on expand, expansion survives value updates (per `id`).
 * With `target`, leaves edit in place (typed), containers add / remove keys, entries, members, items.
 */
export function ValueTree(props: { value: () => Preview; target?: Target | undefined; id?: string }) {
  let open = props.id ? openSets.get(props.id) : undefined;
  if (!open) {
    open = new Set();
    if (props.id) openSets.set(props.id, open);
  }
  const ctx: TreeContext = { open, ...(props.target ? { target: props.target } : {}) };
  // Read here (tracked): component props are evaluated untracked.
  return (
    <ul class="vtree">
      {() => {
        const value = props.value();
        return <ValueNode value={value} path={[]} keys={[]} ancestors={[]} ctx={ctx} />;
      }}
    </ul>
  );
}

const short = (file: string) => file.replace(/^.*\/(?=[^/]+\/[^/]+$)/, "");
export function Location(props: { at: SourceLocation }) {
  return (
    <button type="button" class="location" title={props.at.file + ":" + props.at.line + ":" + props.at.col} onClick={() => openInEditor(props.at)}>
      {short(props.at.file) + ":" + props.at.line}
    </button>
  );
}

/** One signal: name, live value (tree, edited in place), writes, creation site; JSON-valued signals also edit as a whole. */
export function SignalRow(props: { info: SignalInfo; scoped?: boolean }) {
  const info = props.info;
  const value = valueOf(info.id, info.value);
  const editing = signal(false);
  const draft = signal(info.json ?? "");
  const error = signal<string | null>(null);
  const commit = async () => {
    const failure = await setSignal(info.id, draft());
    error.set(failure);
    if (!failure) editing.set(false);
  };
  return (
    <li class="signal" data-id={String(info.id)} data-name={displayName(info)}>
      <NodeLabel node={info} scoped={props.scoped} />
      {() =>
        editing() ? (
          <span class="edit">
            <input
              class="json"
              model:value={draft}
              onKeyDown={(event: KeyboardEvent) => (event.key === "Enter" ? void commit() : event.key === "Escape" ? editing.set(false) : undefined)}
            />
            <button type="button" class="set" onClick={() => void commit()}>
              Set
            </button>
          </span>
        ) : (
          <ValueTree value={value} target={{ kind: "signal", id: info.id }} id={"signal:" + info.id} />
        )
      }
      {info.editable ? (
        <button
          type="button"
          class="edit-toggle"
          title="Replace the whole value as JSON"
          onClick={() => {
            const current = value();
            // Primitive previews are JSON already; others start from the value as loaded.
            draft.set(["n", "s", "b"].includes(current.k) || current.p === "null" ? current.p : (info.json ?? ""));
            editing.set(!editing());
          }}
        >
          edit
        </button>
      ) : null}
      {info.location ? <Location at={info.location} /> : null}
      {() => (error() ? <span class="error">{error()}</span> : null)}
    </li>
  );
}
