// The agent's view of the page: ids for page objects (weak), mount roots and components from façade
// events, signal / node metadata, and lazy queries over the owner graph (`_debug` walks). Holds page
// objects only where the page does (components until unmount); everything sent out is serialized.
import type { DebugView, RawEvent } from "./hook.ts";
import type { DevtoolsHook } from "@rivetjs/reactivity/debug";
import { Handles, MAX_TEXT, entries, inspect, jsonSafe, preview, setPath } from "./preview.ts";
import { edit } from "./edit.ts";
import { appFrame, locate, parseStack } from "./source.ts";
import type {
  Cause,
  CompRef,
  ConsumedInfo,
  ContextRef,
  EditOp,
  EditResult,
  Entry,
  Events,
  GraphNode,
  Inspected,
  LastUpdate,
  Named,
  NodeInfo,
  OwnerInfo,
  Preview,
  PropInfo,
  ProvidedInfo,
  ProviderEntry,
  Seg,
  SignalDetails,
  SignalInfo,
  SourceLocation,
  Target,
  TreeNode,
} from "../protocol.ts";

interface Span {
  start: Node;
  end: Node;
}
interface Comp {
  owner: object;
  fn: Function;
  props: unknown;
  span?: Span;
  spanOf?: () => Span | undefined;
  updates: number;
  /** The writes behind its latest re-run (effects, bindings, computeds it owns). */
  last?: RawCauses;
}
/** Writes of one flush (signal, time, devtools flag, write stack). */
interface RawCause {
  sig: Function;
  ts: number;
  by?: "devtools";
  stack?: Error;
}
interface RawCauses {
  ts: number;
  causes: RawCause[];
}
interface SignalMeta {
  owner: object | null;
  stack?: Error;
  writes: number;
  last?: RawCause;
}
interface NodeMeta {
  runs: number;
  ms: number;
  stack?: Error;
  last?: RawCauses;
}
interface TokenMeta {
  seq: number;
  stack?: Error;
  label?: string;
  ref: WeakRef<object>;
}
type Signal = Function & { set(value: unknown): unknown };
/** A queued agent → panel event (payload computed at flush). */
export type Outgoing = { [K in keyof Events]: { t: K; d: () => Events[K] } }[keyof Events];
type WriteResult = { ok: true; value: Preview } | { ok: false; error: string };
/** What an owner holds directly (nested visible components excluded). */
interface Members {
  signals: Signal[];
  computeds: DebugView[];
  effects: number;
  effectRuns: number;
  effectViews: DebugView[];
  /** Provider owners directly below (context tokens). */
  providers: DebugView[];
  /** Owners visited (the component's own and plain ones below it). */
  owners: object[];
}
/** Per-request cache: collision-numbered names per component scope. */
type Names = Map<Comp, Map<object, string>>;

const MAX_LIST = 500,
  MAX_FANOUT = 50;
/** Upstream graph nodes walked to match a run's causes (past it, all pending writes are kept). */
const MAX_WALK = 2000;
/** A context token (catchError handlers ride the same owner fields with a function token). */
const isToken = (token: unknown): token is object => typeof token === "object" && token !== null;
/** Why a provided value is shown read-only. */
function readonlyReason(value: unknown, shown: Preview): string {
  if (shown.k === "sig") return "";
  if (typeof value === "function") return "a function: provide a signal to edit it from DevTools";
  return "a plain snapshot: consumers read it once at setup, so an edit would not reach them. Provide a signal (value={theme}) to edit it live";
}

export class Model {
  readonly handles = new Handles();
  /** Called per DOM update while flashing is on. */
  onUpdate: ((node: object) => void) | null = null;
  /** Whether a panel is connected (incremental events are queued only then). */
  connected = false;
  /** Performance bookkeeping (runs and DOM updates per component). */
  perf: { run(node: object, comp: number | null, ms: number, ts: number, self?: number): void; dom(comp: number | null): void } | null = null;
  private debugFn: () => ((x: unknown) => DebugView | null) | undefined;
  private hookFn: () => DevtoolsHook | undefined;
  private ids = new WeakMap<object, number>();
  private refs = new Map<number, WeakRef<object>>();
  private next = 1;
  private roots = new Map<object, { container: Element | DocumentFragment }>();
  private comps = new Map<object, Comp>();
  private hidden = new WeakSet<Function>();
  private hot = new WeakMap<Function, { id: string; impl?: Function }>();
  private signals = new WeakMap<Function, SignalMeta>();
  private ownerSignals = new WeakMap<object, Signal[]>();
  private unowned: Signal[] = [];
  private internal = new WeakSet<Function>();
  private nodes = new WeakMap<object, NodeMeta>();
  /** Owner → nearest component; reset at each mount (a lookup during setup, before `comp.mount`, saw an ancestor). */
  private compOf = new WeakMap<object, Comp | null>();
  private writes = new Map<Signal, { by?: "devtools" }>();
  private counts = new Map<Comp, number>();
  private treeChanged = false;
  /** Source binding names (`name` events of the dev transform) by graph ref, with creation order. */
  private labels = new WeakMap<object, { name: string; seq: number }>();
  private labelSeq = 0;
  /** Context tokens (`ctx.create`) and the newest ones per name (numbering). */
  private tokens = new WeakMap<object, TokenMeta>();
  private tokenList: TokenMeta[] = [];
  private tokenSeq = 0;
  /** Context reads: owner → token → provider owner (null: default value); provider → reading owners. */
  private reads = new WeakMap<object, Map<object, object | null>>();
  private readers = new WeakMap<object, Set<WeakRef<object>>>();
  /** Writes since the current flush started (cleared after the task's synchronous work; one task later after a
   * trusted mouse click, whose flush may be deferred — `deferred`, set by `event.defer`). */
  private pendingCauses: RawCause[] = [];
  private causeTs = 0;
  /** Time of runs nested in a still-running run (self time), by the outer run's node. */
  private nested = new Map<object, number>();
  private clearing = false;
  private deferred = false;

  constructor(debug: () => ((x: unknown) => DebugView | null) | undefined, hook: () => DevtoolsHook | undefined = () => undefined) {
    this.debugFn = debug;
    this.hookFn = hook;
  }
  private view(x: unknown): DebugView | null {
    return this.debugFn()?.(x) ?? null;
  }
  /** Stable id of a page object. */
  id(object: object): number {
    let id = this.ids.get(object);
    if (id === undefined) {
      this.ids.set(object, (id = this.next++));
      this.refs.set(id, new WeakRef(object));
    }
    return id;
  }
  byId(id: number): object | undefined {
    const object = this.refs.get(id)?.deref();
    if (object === undefined) this.refs.delete(id);
    return object;
  }
  private readSignal = (fn: Function): { value: unknown; id: number } | undefined => {
    if (!this.signals.has(fn)) return undefined;
    const view = this.view(fn);
    return view?.kind === "signal" ? { value: view.value, id: this.id(fn) } : undefined;
  };
  preview(value: unknown): Preview {
    return preview(value, { handles: this.handles, signal: this.readSignal });
  }
  entries(value: object): Entry[] {
    return entries(value, { handles: this.handles, signal: this.readSignal });
  }
  /** One page of a handle's entries; `ancestors` (handles of the path above it) mark cycles. */
  inspect(h: number, offset = 0, ancestors: readonly number[] = []): Inspected | null {
    const value = this.handles.get(h);
    if (typeof value !== "object" || value === null) return null;
    const path = ancestors.map((a) => this.handles.get(a)).filter((a) => a !== undefined);
    return inspect(value, { handles: this.handles, signal: this.readSignal, offset, ancestors: path });
  }
  /** Full text of a truncated string preview (capped). */
  text(h: number): string | null {
    const value = this.handles.get(h);
    return typeof value === "string" ? value.slice(0, MAX_TEXT) : null;
  }

  /** Apply one hook event. */
  handle(event: RawEvent): void {
    const d = event.d;
    switch (event.t) {
      case "sig.create": {
        const sig = d.sig as Signal,
          owner = (d.owner as object | null) ?? null;
        this.signals.set(sig, { owner, writes: 0, ...(d.stack ? { stack: d.stack as Error } : {}) });
        if (owner === null) {
          if (this.unowned.length < MAX_LIST) this.unowned.push(sig);
        } else {
          let list = this.ownerSignals.get(owner);
          if (!list) this.ownerSignals.set(owner, (list = []));
          list.push(sig);
        }
        break;
      }
      case "name": {
        // A signal / computed / context named by the dev transform, keyed by its graph ref (getter / node) or token.
        if (typeof d.name !== "string") break;
        const token = typeof d.value === "object" && d.value !== null ? this.tokens.get(d.value) : undefined;
        if (token) {
          token.label = d.name;
          break;
        }
        const view = this.view(d.value);
        if (view && (view.kind === "signal" || view.kind === "computed")) this.labels.set(view.ref, { name: d.name, seq: ++this.labelSeq });
        break;
      }
      case "ctx.create": {
        const token = d.token as object;
        if (this.tokens.has(token)) break;
        const meta: TokenMeta = { seq: ++this.tokenSeq, ref: new WeakRef(token), ...(d.stack ? { stack: d.stack as Error } : {}) };
        this.tokens.set(token, meta);
        this.tokenList.push(meta);
        if (this.tokenList.length > MAX_LIST) this.tokenList = this.tokenList.filter((t) => t.ref.deref() !== undefined).slice(-MAX_LIST);
        break;
      }
      case "ctx.read": {
        const owner = d.owner as object,
          token = d.token as object,
          provider = (d.provider as object | null) ?? null;
        let map = this.reads.get(owner);
        if (!map) this.reads.set(owner, (map = new Map()));
        if (map.get(token) === provider && map.has(token)) break;
        map.set(token, provider);
        if (provider) {
          let set = this.readers.get(provider);
          if (!set) this.readers.set(provider, (set = new Set()));
          set.add(new WeakRef(owner));
        }
        break;
      }
      case "event.defer":
        this.deferred = true;
        break;
      case "sig.internal":
        this.internal.add(d.sig as Function);
        break;
      case "sig.write": {
        const sig = d.sig as Signal,
          meta = this.signals.get(sig);
        if (meta) meta.writes++;
        if (this.internal.has(sig)) break;
        const cause: RawCause = { sig, ts: event.ts, ...(d.by ? { by: "devtools" as const } : {}), ...(d.stack ? { stack: d.stack as Error } : {}) };
        if (meta) meta.last = cause;
        this.addCause(cause);
        if (this.connected) this.writes.set(sig, d.by ? { by: "devtools" } : {});
        break;
      }
      case "node.create":
        this.nodes.set(d.node as object, { runs: 0, ms: 0, ...(d.stack ? { stack: d.stack as Error } : {}) });
        break;
      case "node.run": {
        const node = d.node as object,
          ms = d.ms as number;
        let meta = this.nodes.get(node);
        if (!meta) this.nodes.set(node, (meta = { runs: 0, ms: 0 }));
        meta.runs++;
        meta.ms = ms;
        // Self time: a run reports when it ends, before the run around it (`hook.current` is that one
        // again), so nested runs (a computed pulled by an effect) are subtracted from their outer run.
        const outer = this.hookFn()?.current ?? null;
        const inner = this.nested.get(node) ?? 0;
        this.nested.delete(node);
        if (outer) this.nested.set(outer, (this.nested.get(outer) ?? 0) + ms);
        else this.nested.clear();
        if (this.perf) {
          const comp = this.componentOf(node);
          this.perf.run(node, comp ? this.id(comp.owner) : null, ms, event.ts, Math.max(0, ms - inner));
        }
        const last = this.causes(node);
        if (last) {
          meta.last = last;
          const comp = this.componentOf(d.node as object);
          if (comp) comp.last = last;
        }
        break;
      }
      case "comp.mount":
        this.compOf = new WeakMap();
        this.comps.set(d.owner as object, {
          owner: d.owner as object,
          fn: d.fn as Function,
          props: d.props,
          ...(d.span ? { span: d.span as Span } : {}),
          ...(d.spanOf ? { spanOf: d.spanOf as () => Span | undefined } : {}),
          updates: 0,
        });
        this.treeChanged = true;
        break;
      case "comp.unmount":
        if (this.comps.delete(d.owner as object)) this.treeChanged = true;
        break;
      case "comp.hide":
        this.hidden.add(d.fn as Function);
        break;
      case "root.mount":
        this.roots.set(d.owner as object, { container: d.container as Element });
        this.treeChanged = true;
        break;
      case "root.unmount":
        this.roots.delete(d.owner as object);
        this.treeChanged = true;
        break;
      case "hot.register":
        this.hot.set(d.wrapper as Function, { id: d.id as string, ...(d.impl ? { impl: d.impl as Function } : {}) });
        break;
      case "dom.update": {
        const comp = this.componentOf(d.owner as object | null);
        if (comp) {
          comp.updates++;
          this.counts.set(comp, comp.updates);
          // The binding running now made the update: its sources filter the causes.
          const last = this.causes(this.hookFn()?.current ?? undefined);
          if (last) comp.last = last;
        }
        this.perf?.dom(comp ? this.id(comp.owner) : null);
        this.onUpdate?.(d.node as object);
        break;
      }
    }
  }

  // Writes are reported before the flush they cause: runs that follow in the same task are theirs.
  private addCause(cause: RawCause): void {
    if (!this.clearing) {
      this.clearing = true;
      this.pendingCauses = [];
      this.causeTs = cause.ts;
      queueMicrotask(() => {
        const clear = () => {
          this.clearing = this.deferred = false;
          this.pendingCauses = [];
        };
        // A trusted mouse click (`event.defer`) may flush its effects in a task posted during the click
        // (reactivity `_dispatch`): keep its writes until a task posted now, which runs after that one.
        if (!this.deferred) return clear();
        const channel = new MessageChannel();
        channel.port1.onmessage = () => (channel.port1.close(), clear());
        channel.port2.postMessage(0);
      });
    }
    if (this.pendingCauses.length < 20) this.pendingCauses.push(cause);
  }
  /** Pending writes behind a run of `node`: those to signals it reads, directly or through computeds. */
  private causes(node?: object): RawCauses | undefined {
    if (!this.pendingCauses.length) return undefined;
    let causes = this.pendingCauses;
    const view = node ? this.view(node) : null;
    if (view) {
      const wanted = new Set<unknown>(causes.map((c) => c.sig));
      const found = new Set<unknown>();
      const seen = new Set<object>();
      const walk = (at: DebugView): void => {
        for (const source of at.sources()) {
          if (found.size === wanted.size || seen.size >= MAX_WALK || seen.has(source.ref)) return;
          seen.add(source.ref);
          if (source.kind === "signal") {
            if (wanted.has(source.ref)) found.add(source.ref);
          } else walk(source);
        }
      };
      walk(view);
      if (seen.size < MAX_WALK || found.size) {
        causes = causes.filter((c) => found.has(c.sig));
        if (!causes.length) return undefined;
      }
    }
    return { ts: this.causeTs, causes: causes.slice() };
  }
  /** Shared resolution of raw causes (names, write locations). */
  private async lastUpdate(raw: RawCauses | undefined, names: Names): Promise<LastUpdate | undefined> {
    if (!raw) return undefined;
    return { ts: raw.ts, causes: await Promise.all(raw.causes.map((cause) => this.cause(cause, names))) };
  }
  private async cause(cause: RawCause, names: Names): Promise<Cause> {
    const location = await this.location(cause.stack);
    return { signal: this.namedSignal(cause.sig as Signal, names), ts: cause.ts, ...(cause.by ? { by: cause.by } : {}), ...(location ? { location } : {}) };
  }
  private namedSignal(sig: Signal, names: Names): Named {
    const meta = this.signals.get(sig);
    const comp = meta?.owner ? this.componentOf(meta.owner) : null;
    return { id: this.id(sig), kind: "signal", ...this.naming(sig, comp, names) };
  }

  /** Incremental events since the last drain (coalesced: latest write per signal, count per component). */
  drain(): Outgoing[] {
    const out: Outgoing[] = [];
    if (this.treeChanged) {
      this.treeChanged = false;
      out.push({ t: "tree.changed", d: () => ({}) });
    }
    for (const [sig, extra] of this.writes) {
      const id = this.id(sig);
      out.push({ t: "sig.write", d: () => ({ id, value: this.preview(this.view(sig)?.value), ...extra }) });
    }
    this.writes.clear();
    if (this.counts.size) {
      const counts = [...this.counts].map(([comp, n]): [number, number] => [this.id(comp.owner), n]);
      this.counts.clear();
      out.push({ t: "dom.update", d: () => ({ counts }) });
    }
    return out;
  }
  resetCounts(): void {
    for (const comp of this.comps.values()) comp.updates = 0;
    this.counts.clear();
  }

  /** Nearest reported component owning `owner` (itself included); cached per owner. */
  componentOf(owner: object | null): Comp | null {
    const chain: object[] = [];
    let found: Comp | null = null;
    for (let at: object | null = owner; at !== null;) {
      const comp = this.comps.get(at);
      if (comp && !this.hidden.has(comp.fn)) {
        found = comp;
        break;
      }
      const cached = this.compOf.get(at);
      if (cached !== undefined && cached !== null && this.comps.get(cached.owner) === cached) {
        found = cached;
        break;
      }
      chain.push(at);
      at = this.view(at)?.parent()?.ref ?? null;
    }
    for (const at of chain) this.compOf.set(at, found);
    return found;
  }
  name(comp: Comp): { name: string; file?: string } {
    const hot = this.hot.get(comp.fn);
    const own = (fn: Function | undefined) => (fn && fn.name && fn.name !== "__rivetDefault" ? fn.name : "");
    if (hot) {
      const [file = "", exported = ""] = hot.id.split("#");
      return { name: own(hot.impl) || (exported === "default" ? file.replace(/^.*\//, "").replace(/\.[^.]+$/, "") : exported), file };
    }
    return { name: own(comp.fn) || "Anonymous" };
  }
  span(comp: Comp): Span | undefined {
    return comp.span ?? comp.spanOf?.();
  }
  private rootName(container: Element | DocumentFragment): string {
    const element = container as Element;
    return element.nodeType === 1 ? element.localName + (element.id ? "#" + element.id : "") : "fragment";
  }

  /** Component tree: mount roots → reported components (plain owners and hidden wrappers collapsed). */
  tree(): TreeNode[] {
    const walk = (owner: object, into: TreeNode[]): void => {
      for (const child of this.view(owner)?.children() ?? []) {
        const comp = this.comps.get(child.ref);
        if (comp && !this.hidden.has(comp.fn)) {
          const node: TreeNode = { id: this.id(comp.owner), ...this.name(comp), kind: "component", updates: comp.updates, children: [] };
          into.push(node);
          walk(child.ref, node.children);
        } else walk(child.ref, into);
      }
    };
    return [...this.roots].map(([owner, root]) => {
      const node: TreeNode = { id: this.id(owner), name: this.rootName(root.container), kind: "root", updates: 0, children: [] };
      walk(owner, node.children);
      return node;
    });
  }

  private location(stack: Error | undefined): Promise<SourceLocation | undefined> {
    const frame = stack && appFrame(parseStack(stack.stack));
    return frame ? locate(frame).catch(() => undefined) : Promise.resolve(undefined);
  }
  /** An owner's members: signals and computeds it (or a plain / hidden owner below it) created, effects, context. */
  private members(owner: object): Members {
    const members: Members = { signals: [], computeds: [], effects: 0, effectRuns: 0, effectViews: [], providers: [], owners: [] };
    const visit = (at: object): void => {
      members.owners.push(at);
      for (const sig of this.ownerSignals.get(at) ?? []) if (!this.internal.has(sig)) members.signals.push(sig);
      for (const child of this.view(at)?.children() ?? []) {
        const nested = this.comps.get(child.ref);
        if (nested && !this.hidden.has(nested.fn)) continue;
        if (child.kind === "computed") members.computeds.push(child);
        else if (child.kind === "effect") {
          members.effects++;
          members.effectRuns += this.nodes.get(child.ref)?.runs ?? 0;
          members.effectViews.push(child);
        } else if (isToken(child.token)) members.providers.push(child);
        visit(child.ref);
      }
    };
    visit(owner);
    return members;
  }
  /** A named ref's name within its component; repeats numbered in creation order (`count`, `count#2`). */
  private named(ref: object, comp: Comp | null, names: Names): string | undefined {
    const label = this.labels.get(ref);
    if (!label || !comp) return label?.name;
    let scope = names.get(comp);
    if (!scope) {
      const { signals, computeds } = this.members(comp.owner);
      const labelled: { at: object; name: string; seq: number }[] = [];
      for (const at of [...signals, ...computeds.map((view) => view.ref)]) {
        const found = this.labels.get(at);
        if (found) labelled.push({ at, ...found });
      }
      labelled.sort((a, b) => a.seq - b.seq);
      const seen = new Map<string, number>();
      names.set(comp, (scope = new Map()));
      for (const { at, name } of labelled) {
        const n = (seen.get(name) ?? 0) + 1;
        seen.set(name, n);
        scope.set(at, n === 1 ? name : name + "#" + n);
      }
    }
    return scope.get(ref) ?? label.name;
  }
  /** `name` / `scope` of a reactive node (see `displayName`). */
  private naming(ref: object, comp: Comp | null, names: Names): { name?: string; scope?: string } {
    const name = this.named(ref, comp, names);
    return { ...(name !== undefined ? { name } : {}), ...(comp ? { scope: this.name(comp).name } : {}) };
  }
  private async signalInfo(sig: Signal, names: Names = new Map()): Promise<SignalInfo> {
    const meta = this.signals.get(sig),
      value = this.view(sig)?.value;
    const comp = meta?.owner ? this.componentOf(meta.owner) : null;
    const location = await this.location(meta?.stack);
    const editable = jsonSafe(value);
    return {
      id: this.id(sig),
      kind: "signal",
      ...this.naming(sig, comp, names),
      value: this.preview(value),
      writes: meta?.writes ?? 0,
      editable,
      ...(editable ? { json: JSON.stringify(value) } : {}),
      ...(comp ? { owner: { id: this.id(comp.owner), name: this.name(comp).name } } : {}),
      ...(location ? { location } : {}),
    };
  }

  /** What a component (or root) owns directly: its signals, computeds, effects and provided context. */
  async owner(id: number): Promise<OwnerInfo | null> {
    const object = this.byId(id);
    if (!object) return null;
    const comp = this.comps.get(object),
      root = this.roots.get(object);
    if (!comp && !root) return null;
    const { signals, computeds, effects, effectRuns, effectViews, providers, owners } = this.members(object);
    const names: Names = new Map();
    const nodeInfos: NodeInfo[] = await Promise.all(
      computeds.slice(0, MAX_LIST).map(async (view) => {
        const meta = this.nodes.get(view.ref);
        const location = await this.location(meta?.stack);
        const pinned = this.hookFn()?.pins?.computedPin?.(view.ref);
        return {
          id: this.id(view.ref),
          kind: "computed" as const,
          ...this.naming(view.ref, comp ?? null, names),
          value: this.preview(view.value),
          state: view.state,
          runs: meta?.runs ?? 0,
          ms: meta?.ms ?? 0,
          ...(location ? { location } : {}),
          ...(pinned ? { pinned: this.preview(pinned.value) } : {}),
        };
      }),
    );
    const title = comp ? this.name(comp) : { name: this.rootName(root!.container) };
    const members = { signals, computeds, effectViews, providers, owners };
    return {
      id,
      ...title,
      kind: comp ? "component" : "root",
      updates: comp?.updates ?? 0,
      props: comp ? this.props(comp) : [],
      signals: await Promise.all(signals.slice(0, MAX_LIST).map((sig) => this.signalInfo(sig, names))),
      computeds: nodeInfos,
      effects: { count: effects, runs: effectRuns },
      context: await Promise.all(providers.map((view) => this.provided(view, names))),
      consumed: await this.consumed(owners),
      chain: this.chain(object),
      ...this.links(object, members, names),
      ...(comp?.last ? { lastUpdate: (await this.lastUpdate(comp.last, names))! } : {}),
    };
  }

  /** Props with their debug overrides. */
  private props(comp: Comp): PropInfo[] {
    if (typeof comp.props !== "object" || comp.props === null) return [];
    const pins = this.hookFn()?.pins?.props?.(comp.owner);
    return this.entries(comp.props)
      .filter((e) => e.key !== "children")
      .map((entry): PropInfo => {
        const pin = pins?.get(entry.key);
        const overridable = !entry.proto && entry.value.k !== "get" && entry.value.k !== "fn" && this.hookFn()?.pins?.prop !== undefined;
        return {
          key: entry.key,
          value: entry.value,
          overridable,
          ...(pin ? { pinned: this.preview(pin.value) } : {}),
          ...(entry.proto ? { proto: true as const } : {}),
        };
      });
  }
  /** Display name of a context token: binding name (dev transform), else `context #n`; repeats numbered. */
  contextRef(token: object): ContextRef {
    const meta = this.tokens.get(token);
    const own = meta?.label;
    let name = own ?? "context #" + this.id(token);
    if (meta && own !== undefined) {
      const same = this.tokenList.filter((t) => t.label === own && t.ref.deref() !== undefined);
      const at = same.indexOf(meta);
      if (at > 0) name = own + "#" + (at + 1);
    }
    return { id: this.id(token), name };
  }
  private async contextRefLocated(token: object): Promise<ContextRef> {
    const ref = this.contextRef(token);
    const location = await this.location(this.tokens.get(token)?.stack);
    return location ? { ...ref, location } : ref;
  }
  /** A provider owner's value: a provided signal is editable (consumers that read it update); plain values are snapshots. */
  private async provided(view: DebugView, _names: Names): Promise<ProvidedInfo> {
    const value = view.context;
    const signal = typeof value === "function" && this.view(value)?.kind === "signal" ? this.id(value) : undefined;
    const consumers: CompRef[] = [];
    const seen = new Set<Comp>();
    for (const ref of this.readers.get(view.ref) ?? []) {
      const owner = ref.deref();
      const comp = owner ? this.componentOf(owner) : null;
      if (owner && this.view(owner)?.disposed) continue;
      if (comp && !seen.has(comp) && this.comps.get(comp.owner) === comp) {
        seen.add(comp);
        consumers.push(this.ref(comp));
      }
    }
    return {
      ctx: await this.contextRefLocated(view.token as object),
      provider: this.id(view.ref),
      value: this.preview(value),
      ...(signal !== undefined ? { signal } : { readonly: readonlyReason(value, this.preview(value)) }),
      consumers,
    };
  }
  /** The component owning `owner` (itself included), as a reference. */
  compRef(owner: object): CompRef | null {
    const comp = this.componentOf(owner);
    return comp ? this.ref(comp) : null;
  }
  disposed(owner: object): boolean {
    return this.view(owner)?.disposed ?? false;
  }
  private ref(comp: Comp): CompRef {
    return { id: this.id(comp.owner), name: this.name(comp).name };
  }
  /** Contexts read by the given owners (the component's own and plain ones). */
  private async consumed(owners: object[]): Promise<ConsumedInfo[]> {
    const out: ConsumedInfo[] = [];
    const seen = new Set<object>();
    for (const owner of owners)
      for (const [token, provider] of this.reads.get(owner) ?? []) {
        if (seen.has(token)) continue;
        seen.add(token);
        const view = provider ? this.view(provider) : null;
        const value = view && !view.disposed ? view.context : (token as { defaultValue?: unknown }).defaultValue;
        const comp = view && !view.disposed ? this.componentOf(view.ref) : null;
        const signal = typeof value === "function" && this.view(value)?.kind === "signal" ? this.id(value) : undefined;
        out.push({
          ctx: await this.contextRefLocated(token),
          value: this.preview(value),
          ...(view && !view.disposed
            ? { provider: { ...(comp ? this.ref(comp) : { id: this.id(view.ref), name: "root" }), instance: this.id(view.ref) } }
            : {}),
          ...(signal !== undefined ? { signal } : {}),
        });
      }
    return out;
  }
  /** Components from the root down to the parent of `owner`. */
  chain(owner: object): CompRef[] {
    const out: CompRef[] = [];
    const start = this.comps.get(owner) ? (this.view(owner)?.parent()?.ref ?? null) : owner;
    for (let comp = start ? this.componentOf(start) : null; comp;) {
      out.unshift(this.ref(comp));
      const parent = this.view(comp.owner)?.parent()?.ref ?? null;
      comp = parent ? this.componentOf(parent) : null;
    }
    const root = this.rootOf(owner);
    if (root) out.unshift({ id: this.id(root), name: this.rootName(this.roots.get(root)!.container) });
    return out;
  }
  private rootOf(owner: object): object | null {
    for (let view = this.view(owner); view; view = view.parent()) if (this.roots.has(view.ref)) return view.ref;
    return null;
  }
  /** What a component's reactive code reads from outside it, and which components read its state. */
  private links(owner: object, members: Pick<Members, "signals" | "computeds" | "effectViews">, names: Names): { deps: GraphNode[]; usedBy: CompRef[] } {
    const own = new Set<object>([...members.signals, ...members.computeds.map((v) => v.ref)]);
    const deps = new Map<object, GraphNode>();
    for (const view of [...members.effectViews, ...members.computeds])
      for (const source of view.sources()) {
        if (own.has(source.ref) || deps.has(source.ref) || (source.kind === "signal" && this.internal.has(source.ref as Function))) continue;
        if (deps.size >= MAX_FANOUT) break;
        const comp = source.kind === "signal" ? this.componentOf(this.signals.get(source.ref as Function)?.owner ?? null) : this.componentOf(source.ref);
        deps.set(source.ref, {
          id: this.id(source.ref),
          kind: source.kind === "owner" ? "effect" : source.kind,
          ...this.naming(source.ref, comp, names),
          ...(source.kind !== "effect" ? { value: this.preview(source.value) } : {}),
          next: [],
        });
      }
    const self = this.comps.get(owner) ?? null;
    const users = new Map<Comp, CompRef>();
    for (const ref of own) {
      const view = this.view(ref);
      for (const observer of view?.observers() ?? []) {
        const comp = this.componentOf(observer.ref);
        if (comp && comp !== self && !users.has(comp)) users.set(comp, this.ref(comp));
      }
    }
    return { deps: [...deps.values()], usedBy: [...users.values()] };
  }

  /** Every live provider instance under the mount roots, with its value and consumers. */
  async contexts(): Promise<ProviderEntry[]> {
    const out: ProviderEntry[] = [];
    const names: Names = new Map();
    const visit = async (owner: object): Promise<void> => {
      for (const child of this.view(owner)?.children() ?? []) {
        if (out.length >= MAX_LIST) return;
        if (isToken(child.token)) {
          const comp = this.componentOf(child.ref);
          out.push({ ...(await this.provided(child, names)), ...(comp ? { owner: this.ref(comp) } : {}) });
        }
        await visit(child.ref);
      }
    };
    for (const owner of this.roots.keys()) await visit(owner);
    return out;
  }

  /** Selected signal: owner chain, creation site, latest write. */
  async signalDetails(id: number): Promise<SignalDetails | null> {
    const sig = this.byId(id) as Signal | undefined;
    if (!sig || this.view(sig)?.kind !== "signal") return null;
    const meta = this.signals.get(sig);
    const names: Names = new Map();
    const location = await this.location(meta?.stack);
    const chain = meta?.owner ? this.chain(meta.owner) : [];
    const comp = meta?.owner ? this.componentOf(meta.owner) : null;
    if (comp) chain.push(this.ref(comp));
    return {
      chain: [...new Map(chain.map((c) => [c.id, c])).values()],
      writes: meta?.writes ?? 0,
      ...(location ? { location } : {}),
      ...(meta?.last ? { lastWrite: await this.cause(meta.last, names) } : {}),
    };
  }

  /** Every live signal reachable from mount roots, plus signals created outside any owner. */
  async allSignals(): Promise<SignalInfo[]> {
    const found: Signal[] = [];
    const visit = (owner: object): void => {
      for (const sig of this.ownerSignals.get(owner) ?? []) if (!this.internal.has(sig) && found.length < MAX_LIST) found.push(sig);
      for (const child of this.view(owner)?.children() ?? []) visit(child.ref);
    };
    for (const owner of this.roots.keys()) visit(owner);
    for (const sig of this.unowned) if (!this.internal.has(sig) && found.length < MAX_LIST) found.push(sig);
    const names: Names = new Map();
    return Promise.all(found.map((sig) => this.signalInfo(sig, names)));
  }

  /** Dependencies of a signal / computed / effect: sources (`up`) or observers (`down`), depth-limited. */
  graph(id: number, dir: "up" | "down", depth: number): GraphNode | null {
    const object = this.byId(id);
    const start = object ? this.view(object) : null;
    if (!start) return null;
    const seen = new Set<object>(),
      names: Names = new Map();
    const node = (view: DebugView, left: number): GraphNode => {
      seen.add(view.ref);
      const comp = view.kind === "signal" ? this.componentOf(this.signals.get(view.ref as Function)?.owner ?? null) : this.componentOf(view.ref);
      const next =
        left <= 0
          ? []
          : (dir === "up" ? view.sources() : view.observers())
              .filter((v) => !seen.has(v.ref) && !(v.kind === "signal" && this.internal.has(v.ref as Function)))
              .slice(0, MAX_FANOUT);
      return {
        id: this.id(view.ref),
        kind: view.kind === "owner" ? "effect" : view.kind,
        ...this.naming(view.ref, comp, names),
        ...(view.kind !== "effect" ? { value: this.preview(view.value) } : {}),
        next: next.map((v) => node(v, left - 1)),
      };
    };
    return node(start, Math.min(depth, 10));
  }

  /** Write a JSON value to a signal through its `.set` (reported `by: "devtools"`). */
  setSignal(id: number, json: string, hook: { writing?: boolean }): WriteResult {
    return this.setSignalPath(id, [], json, hook);
  }
  /** Replace the existing leaf at `path` of a JSON-valued signal: a fresh copy written through `.set`. */
  setSignalPath(id: number, path: readonly string[], json: string, hook: { writing?: boolean }): WriteResult {
    const sig = this.byId(id) as Signal | undefined;
    const view = sig ? this.view(sig) : null;
    if (!sig || view?.kind !== "signal") return { ok: false, error: "not a live signal" };
    if (!jsonSafe(view.value)) return { ok: false, error: "only signals holding JSON values can be edited" };
    let next: unknown;
    try {
      next = JSON.parse(json);
    } catch (error) {
      return { ok: false, error: "invalid JSON: " + (error as Error).message };
    }
    const updated = setPath(view.value, path, next);
    if (!updated.ok) return updated;
    const value = updated.value;
    hook.writing = true;
    try {
      sig.set(value);
    } catch (error) {
      return { ok: false, error: String((error as Error)?.message ?? error) };
    } finally {
      hook.writing = false;
    }
    return { ok: true, value: this.preview(this.view(sig)?.value) };
  }

  /**
   * Typed edit at `path`: of a signal's value (a fresh copy through `.set`; a class instance root is
   * mutated in place, then re-notified), or a debug override of a computed / prop (pinned).
   */
  edit(target: Target, path: readonly Seg[], op: EditOp, hook: { writing?: boolean }): EditResult {
    const pins = this.hookFn()?.pins;
    const resolve = (h: number) => ({ found: this.handles.has(h), value: this.handles.get(h) });
    if (target.kind === "signal") {
      const sig = this.byId(target.id) as Signal | undefined;
      const view = sig ? this.view(sig) : null;
      if (!sig || view?.kind !== "signal") return { ok: false, error: "not a live signal" };
      const result = edit(view.value, path, op, resolve);
      if (!result.ok) return result;
      hook.writing = true;
      try {
        if (result.inPlace) {
          if (!pins?.notify) return { ok: false, error: "in-place edits need the development façade" };
          const notified = pins.notify(sig as never);
          return {
            ok: true,
            value: this.preview(this.view(sig)?.value),
            inPlace: true,
            ...(notified ? {} : { note: "custom equals: observers may skip this change" }),
          };
        }
        sig.set(result.value);
      } catch (error) {
        return { ok: false, error: String((error as Error)?.message ?? error) };
      } finally {
        hook.writing = false;
      }
      return { ok: true, value: this.preview(this.view(sig)?.value) };
    }
    if (target.kind === "computed") {
      const node = this.byId(target.id);
      const view = node ? this.view(node) : null;
      if (!node || view?.kind !== "computed") return { ok: false, error: "not a live computed" };
      if (!pins?.computed) return { ok: false, error: "overrides need the development façade" };
      const current = pins.computedPin?.(node);
      const result = edit(current ? current.value : view.value, path, op, resolve);
      if (!result.ok) return result;
      if (result.inPlace) return { ok: false, error: "class instances in a computed's value cannot be overridden in place" };
      try {
        pins.computed(node, { value: result.value });
      } catch (error) {
        return { ok: false, error: String((error as Error)?.message ?? error) };
      }
      return { ok: true, value: this.preview(result.value) };
    }
    const owner = this.byId(target.owner);
    const comp = owner ? this.comps.get(owner) : undefined;
    if (!comp || typeof comp.props !== "object" || comp.props === null) return { ok: false, error: "not a mounted component" };
    if (!pins?.prop || !pins.props) return { ok: false, error: "overrides need the development façade" };
    const descriptor = Object.getOwnPropertyDescriptor(comp.props, target.key);
    if (!descriptor || !("value" in descriptor)) return { ok: false, error: "no data prop " + target.key };
    const pinned = pins.props(comp.owner)?.get(target.key);
    let base = pinned ? pinned.value : descriptor.value;
    // An accessor prop overrides the value it returns.
    if (!pinned && typeof base === "function") {
      const view = this.view(base);
      if (view?.kind === "signal" || view?.kind === "computed") base = view.value;
      else return { ok: false, error: "functions (handlers, accessors) cannot be overridden" };
    }
    const result = edit(base, path, op, resolve);
    if (!result.ok) return result;
    if (result.inPlace) return { ok: false, error: "class instances in props cannot be overridden in place" };
    try {
      pins.prop(comp.owner, target.key, { value: result.value });
    } catch (error) {
      return { ok: false, error: String((error as Error)?.message ?? error) };
    }
    return { ok: true, value: this.preview(result.value) };
  }
  /** Reset a computed / prop override. */
  clearOverride(target: Target): boolean {
    const pins = this.hookFn()?.pins;
    if (target.kind === "computed") {
      const node = this.byId(target.id);
      return node ? (pins?.computed?.(node, null) ?? false) : false;
    }
    if (target.kind === "prop") {
      const owner = this.byId(target.owner);
      return owner ? (pins?.prop?.(owner, target.key, null) ?? false) : false;
    }
    return false;
  }

  /** A live component by id, with its file (performance rows). */
  perfRef(id: number): (CompRef & { file?: string }) | null {
    const owner = this.byId(id);
    const comp = owner ? this.comps.get(owner) : undefined;
    if (!comp || this.hidden.has(comp.fn)) return null;
    const { name, file } = this.name(comp);
    return { id, name, ...(file ? { file } : {}) };
  }
  /** Component id owning a reactive node or owner. */
  compId(owner: object | null): number | null {
    const comp = this.componentOf(owner);
    return comp ? this.id(comp.owner) : null;
  }
  /** What to call a reactive node in a finding, and its creation stack. */
  describeNode(node: object): { label: string; stack?: Error } {
    const view = this.view(node);
    const comp = this.componentOf(node);
    const name = view?.kind === "computed" ? this.named(node, comp, new Map()) : undefined;
    const label = view?.kind === "computed" ? "computed " + (name ?? "#" + this.id(node)) : "effect #" + this.id(node);
    const stack = this.nodes.get(node)?.stack;
    return { label, ...(stack ? { stack } : {}) };
  }
  /** App frames of a stack (first: the site), mapped to sources. */
  async appFrames(stack: Error): Promise<SourceLocation[]> {
    const frames = parseStack(stack.stack);
    const app: typeof frames = [];
    for (let i = 0; i < frames.length && app.length < 5; i++) {
      const frame = appFrame(frames.slice(i));
      if (!frame) break;
      app.push(frame);
      i = frames.indexOf(frame);
    }
    const found = await Promise.all(app.map((frame) => locate(frame).catch(() => undefined)));
    return found.filter((at): at is SourceLocation => at !== undefined);
  }

  /** The DOM region of a component or root, for highlighting. */
  region(id: number): Span | Element | DocumentFragment | undefined {
    const object = this.byId(id);
    if (!object) return undefined;
    const comp = this.comps.get(object);
    return comp ? this.span(comp) : this.roots.get(object)?.container;
  }
  /** Innermost visible component whose range contains `node`. */
  componentAt(node: Node): number | null {
    let best: { comp: Comp; span: Span } | null = null;
    for (const comp of this.comps.values()) {
      if (this.hidden.has(comp.fn)) continue;
      const span = this.span(comp);
      // Ends inclusive (DOM v2 spans are the output's own first / last node; v1 comment markers hold no node).
      if (
        !span?.start.isConnected ||
        !(span.start === node || span.start.compareDocumentPosition(node) & 4) ||
        !(span.end === node || span.end.compareDocumentPosition(node) & 18)
      )
        continue;
      // Innermost: a later start, or the same start (a v2 component returning its child's node) and an earlier end.
      const at = best && best.span.start.compareDocumentPosition(span.start);
      if (!best || at! & 4 || (at === 0 && span.end !== best.span.end && best.span.end.compareDocumentPosition(span.end) & 18)) best = { comp, span };
    }
    return best ? this.id(best.comp.owner) : null;
  }
}
