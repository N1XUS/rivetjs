// DevTools protocol shared by the page agent and the panel UI (spec: Data protocol). Messages cross a
// MessagePort (docked iframe) or a BroadcastChannel (pop-out window) as arrays of envelopes.

export const VERSION = 1;
/** Envelopes per message; more in one frame are dropped and counted (`dropped`). */
export const BATCH = 500;
/** Panel requests without a response reject after this long (ms); `page.inspect` answers within 10 s. */
export const REQUEST_TIMEOUT = 20_000;
/** Panel path on the dev server. */
export const UI_PATH = "__rivet/devtools/";
/** Under `UI_PATH`: `{ v: VERSION, hash }` of the panel's current sources (the panel's staleness check). */
export const BUILD_PATH = "__build";
/** Response of `BUILD_PATH`. */
export interface BuildInfo {
  v: number;
  /** Live source hash; null from an installed package (no `ui/` sources to compare against). */
  hash: string | null;
}
/** `postMessage` source tag (docked iframe handshake). */
export const SOURCE = "rivet-devtools";
/** BroadcastChannel name of a pop-out session. */
export const channelName = (session: string): string => "rivet-devtools:" + session;
/** BroadcastChannel where page agents claim their session (a duplicated tab regenerates a taken one). */
export const CLAIMS = "rivet-devtools";

/** `{ v, s: seq, t: type, ts: page performance.now(), d: payload, r?: request id }`. */
export interface Envelope<T = unknown> {
  v: 1;
  s: number;
  t: string;
  ts: number;
  d: T;
  r?: number;
}

/** Value preview: depth 1, strings ≤ 120 chars, accessors never invoked. */
export interface Preview {
  k: "u" | "n" | "s" | "b" | "big" | "sym" | "o" | "a" | "map" | "set" | "date" | "fn" | "sig" | "dom" | "err" | "cyc" | "get" | "trunc" | "re" | "prom";
  p: string;
  /** Handle for lazy expansion (`value.inspect`; `value.text` for a truncated string). */
  h?: number;
  /** Size of arrays, maps, sets, objects (own keys); full length of a truncated string. */
  n?: number;
  /** A signal getter (`k: "sig"`): its id, so leaves under it edit that signal. */
  sid?: number;
  /** Container shape for edits: plain object, class instance, typed array. */
  c?: "plain" | "inst" | "typed";
}
export interface Entry {
  key: string;
  value: Preview;
  /** A class instance's prototype accessor (listed, never invoked). */
  proto?: true;
  /** Map entry key / Set member handle (edit paths address it by this). */
  kh?: number;
}

/** One step of an edit path: own key or index (`o`), Map entry by key handle (`m`), Set member by handle (`s`). */
export type Seg = { o: string } | { m: number } | { s: number };
/** A typed value from the panel's editors. */
export type Typed =
  | { t: "s"; v: string }
  | { t: "n"; v: string }
  | { t: "b"; v: boolean }
  | { t: "big"; v: string }
  | { t: "date"; v: string }
  | { t: "null" }
  | { t: "u" }
  | { t: "json"; v: string };
/** `set` / `delete` the value at the path; `add` a key, entry, member or item to the container at the path. */
export type EditOp = { op: "set"; value: Typed } | { op: "delete" } | { op: "add"; key?: Typed; value: Typed };
/** What an edit writes: a signal (through `.set`), or a debug override of a computed or prop. */
export type Target = { kind: "signal"; id: number } | { kind: "computed"; id: number } | { kind: "prop"; owner: number; key: string };
export type EditResult = { ok: true; value: Preview; inPlace?: true; note?: string } | { ok: false; error: string };
/** One page of a value's entries (`value.inspect`); `total` counts all of them. */
export interface Inspected {
  entries: Entry[];
  total: number;
}

/** Name parts of a signal / computed / effect: source binding name (`count`, `count#2` on a collision within
 * its component) and component scope. */
export interface Named {
  id: number;
  kind: "signal" | "computed" | "effect";
  name?: string;
  scope?: string;
}
/**
 * The one display format of a reactive node: `Layout › count`; unnamed: `Layout › signal #12`.
 * `scoped: false` drops the component prefix (`count`), for rows under that component's header.
 */
export const displayName = (node: Named, { scoped = true }: { scoped?: boolean } = {}): string =>
  (scoped && node.scope ? node.scope + " › " : "") + (node.name ?? node.kind + " #" + node.id);

/** Component tree node (`tree.get`). */
export interface TreeNode {
  id: number;
  name: string;
  /** Root-relative source file (hot id) when known. */
  file?: string;
  kind: "root" | "component";
  updates: number;
  children: TreeNode[];
}
export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}
export interface SignalInfo extends Named {
  kind: "signal";
  value: Preview;
  writes: number;
  /** JSON-valued: editable from the panel; `json` is the current value as JSON. */
  editable: boolean;
  json?: string;
  owner?: { id: number; name: string };
  location?: SourceLocation;
}
export interface NodeInfo extends Named {
  kind: "computed" | "effect";
  value?: Preview;
  state: "clean" | "check" | "dirty";
  runs: number;
  ms: number;
  location?: SourceLocation;
  /** Debug override in effect (consumers see this value until reset). */
  pinned?: Preview;
}
/** A component reference (click-through). */
export interface CompRef {
  id: number;
  name: string;
}
/** A context token: display name (binding name, else its `id`, else `context #n`). */
export interface ContextRef {
  id: number;
  name: string;
  location?: SourceLocation;
}
/** One prop, with its debug override when pinned. */
export interface PropInfo {
  key: string;
  value: Preview;
  /** The value the component sees while overridden. */
  pinned?: Preview;
  /** Overridable from the panel (data and accessor props; not handlers or getters). */
  overridable: boolean;
  proto?: true;
}
/** A context value a provider supplies. */
export interface ProvidedInfo {
  ctx: ContextRef;
  /** The provider owner (instance) id. */
  provider: number;
  value: Preview;
  /** Signal provided: edits write it (consumers update). */
  signal?: number;
  /** Why the value is shown read-only. */
  readonly?: string;
  consumers: CompRef[];
}
/** A context a component read (`useContext`). */
export interface ConsumedInfo {
  ctx: ContextRef;
  value: Preview;
  /** Providing component and provider instance; absent: the token's default value. */
  provider?: CompRef & { instance: number };
  signal?: number;
}
/** A write that made something re-run. */
export interface Cause {
  signal: Named;
  ts: number;
  by?: "devtools";
  location?: SourceLocation;
}
/** Why a component or node last updated: the writes in the flush that re-ran it. */
export interface LastUpdate {
  ts: number;
  causes: Cause[];
}
/** A provider instance (`contexts.get`). */
export interface ProviderEntry extends ProvidedInfo {
  /** The component around the provider. */
  owner?: CompRef;
}
/** Owner details (`owner.get`). */
export interface OwnerInfo {
  id: number;
  name: string;
  file?: string;
  kind: "root" | "component";
  updates: number;
  props: PropInfo[];
  signals: SignalInfo[];
  computeds: NodeInfo[];
  effects: { count: number; runs: number };
  /** Contexts this component provides. */
  context: ProvidedInfo[];
  /** Contexts this component read. */
  consumed: ConsumedInfo[];
  /** Owner chain: root first, the parent component last. */
  chain: CompRef[];
  /** Signals and computeds its effects, bindings and computeds read (outside itself). */
  deps: GraphNode[];
  /** Components whose effects or bindings read this component's signals or computeds. */
  usedBy: CompRef[];
  lastUpdate?: LastUpdate;
}
/** Selected signal details (`signal.details`). */
export interface SignalDetails {
  chain: CompRef[];
  location?: SourceLocation;
  lastWrite?: Cause;
  writes: number;
}
/** One dependency-graph neighbour (`graph.get`), nested to the requested depth. */
export interface GraphNode extends Named {
  value?: Preview;
  next: GraphNode[];
}
export interface HmrEntry {
  kind: "update" | "component" | "invalidate" | "reload" | "error";
  ts: number;
  /** Files (update), file (invalidate / reload / error). */
  files?: string[];
  id?: string;
  instances?: number;
  /** Component state: kept, or why it was reset. */
  state?: "kept" | "refresh-reset" | "shape" | "kind";
  message?: string;
}
export interface Frame {
  fn: string;
  url: string;
  line: number;
  col: number;
  source?: SourceLocation;
}
export interface ErrorEntry {
  id: number;
  kind: "runtime" | "rejection" | "hint" | "vite" | "agent" | "a11y";
  message: string;
  ts: number;
  frames: Frame[];
  hint?: string;
  file?: SourceLocation;
  /**
   * `a11y`: the rule, the offending element (`<img class="x">`), and the component rendering it. Hover highlights it (`error.highlight`).
   * The runtime's hook event also carries `where` (component chain with declaration sites, or server HTML + resume site, and
   * the element's CSS path; runtime `dev/where.ts`); not forwarded into this entry yet.
   */
  rule?: string;
  element?: string;
  comp?: CompRef;
}

/** Router pane (`router.get`): through the router's development façade. */
export interface RouterInfo {
  route: { pattern: string; url: string; params: Readonly<Record<string, string>> } | null;
  data: { id: string; value: Preview }[];
  layouts: string[];
  pending: { to: string; type: string; trigger: string; ms: number; state: string } | null;
  last: NavigationEntry | null;
  history: NavigationEntry[];
  loadMs: number | null;
  error: string | null;
}
export interface NavigationEntry {
  from: string | null;
  to: string;
  type: string;
  trigger: string;
  ms: number | null;
  at: number;
}
/** i18n pane (`i18n.get`): the i18n plugin's dev endpoint plus the page's locale and missing keys. */
export interface I18nInfo {
  locales: string[];
  defaultLocale: string;
  locale: string;
  dir: "ltr" | "rtl";
  catalogs: { locale: string; file?: string; keys: number }[];
  keys: number;
  /** Keys a locale lacks (served from a fallback locale). */
  fallbacks: string[];
  /** Missing message keys hit this session (dev `t()` lookups), with counts. */
  missing: { key: string; count: number }[];
}
/** Forms pane (`forms.get`): one live form store (forms development façade). */
export interface FormInfo {
  id: string;
  name: string;
  component?: CompRef;
  mounted: boolean;
  values: Preview;
  errors: { path: string; issues: string[] }[];
  formErrors: string[];
  touched: string[];
  dirty: string[];
  submitting: boolean;
  submitted: boolean;
  validating: boolean;
  enhanced: boolean;
  submitCount: number;
  result?: Preview;
  autosave?: { status: string; version?: string | number; unsavedFields: number; savedAt?: number; error?: string; conflict?: string | number; draft?: string };
  /** An autosave state without a form store (values and issues not tracked). */
  autosaveOnly?: true;
}

/** Performance findings (Performance tab): what was detected, where, and a short how-to-fix. */
export type PerfKind = "layout-shift" | "forced-reflow" | "long-frame" | "slow-interaction" | "frequent-runs" | "chunks";
export interface PerfHint {
  why: string;
  fix: string;
  docs: string;
}
export interface PerfFinding {
  id: number;
  kind: PerfKind;
  /** Page time (performance.now) of the finding; `dur` for spans (frames, interactions). */
  ts: number;
  dur?: number;
  title: string;
  detail: string;
  comps: CompRef[];
  /** App source of the read / run (forced reflow, frequent runs), and the app frames of its stack. */
  location?: SourceLocation;
  stack?: SourceLocation[];
  /** Repeats of the same finding (same component, read and site). */
  count: number;
  score?: number;
  hint: PerfHint;
}
/** Per-component totals since the panel started recording (or the last reset). */
export interface PerfRow {
  comp: CompRef;
  file?: string;
  /** Effect / binding / computed runs it owns, and their total time (ms; a run nested in another one counts in both). */
  runs: number;
  ms: number;
  /** Self time (ms): run time minus the runs nested in it (computeds pulled by an effect count once). */
  self: number;
  updates: number;
  /** Layout-shift score attributed to its moved nodes, and the shifts involved. */
  cls: number;
  shifts: number;
  reflows: number;
  /** Time its runs took inside long frames (ms), and how many. */
  longMs: number;
  longFrames: number;
  /** Most runs of one of its effects / computeds in one interaction. */
  maxRuns: number;
  hot: boolean;
  /** Badge reasons (tree warnings). */
  reasons: string[];
}
export interface PerfChunk {
  url: string;
  bytes: number;
  ms: number;
  ts: number;
}
/** One interaction (event timing; the longest event of an interaction id). */
export interface PerfInteraction {
  id: number;
  type: string;
  ts: number;
  target?: CompRef;
  inputDelay: number;
  processing: number;
  presentation: number;
  duration: number;
  /** Components whose runs happened while its handlers ran (ms, runs). */
  handlers: { comp: CompRef; ms: number; runs: number }[];
  /** Script chunks loaded after the input (up to the next input, ≤ 3 s). */
  chunks: PerfChunk[];
}
export interface PerfOptions {
  /** Forced-reflow detection (prototype patch of layout reads and DOM writes; off by default). */
  reflow: boolean;
  /** Flash shifted elements in the page. */
  shifts: boolean;
  /** Flash updated DOM nodes, colored by update frequency. */
  heat: boolean;
}
export interface PerfInfo {
  cls: { value: number; rating: Rating; shifts: number };
  inp: { value: number; rating: Rating; type: string } | null;
  rows: PerfRow[];
  findings: PerfFinding[];
  interactions: PerfInteraction[];
  /** `switchedAt`: when a resumed dev page switched to client render (measurements before it are the resumed page's). */
  resume: { resumed: boolean; first?: { type: string; duration: number; chunks: number; bytes: number }; chunks: number; bytes: number; switchedAt?: number };
  options: PerfOptions;
  /** Observer types this browser reports. */
  supports: { layoutShift: boolean; loaf: boolean; longtask: boolean; event: boolean };
  /** Runs and DOM updates are recorded only while the panel is open. */
  recording: boolean;
}
export type Rating = "good" | "needs-improvement" | "poor";

/** A resumed dev page (`data-rivet-dev="resume"`) and whether it switched to client render (by DevTools inspection or a hot update). */
export interface PageMode {
  resumed: boolean;
  switched: boolean;
  by?: "devtools" | "hmr";
  /** Page time the switch started. */
  at?: number;
}
/** Agent → UI events (incremental after `snapshot`). */
export interface Events {
  welcome: { v: number; mode: "serve" | "build"; features: string[]; level: number; session: string };
  snapshot: { tree: TreeNode[]; hmr: HmrEntry[]; errors: ErrorEntry[] };
  "tree.changed": {};
  "sig.write": { id: number; value: Preview; by?: "devtools" };
  "dom.update": { counts: [component: number, total: number][] };
  hmr: HmrEntry;
  error: ErrorEntry;
  "pick.hover": { id: number | null };
  "pick.done": { id: number | null };
  /** A framework pane's data changed (router navigation, form state). */
  "lib.changed": { lib: "router" | "forms" | "i18n" };
  /** New performance findings or totals (coalesced per frame). */
  "perf.changed": {};
  "page.mode": PageMode;
  /** Envelopes over `BATCH` in one frame, not sent. */
  dropped: number;
  /** Response (same `r`) to a request whose handler threw, or of an unknown type: the panel rejects it. */
  "error.request": { message: string };
}
/** UI → agent requests and their responses. */
export interface Requests {
  hello: [{ v: number }, Events["welcome"]];
  "level.set": [{ level: 0 | 1 | 2 }, { level: number }];
  "tree.get": [{}, TreeNode[]];
  "owner.get": [{ id: number }, OwnerInfo | null];
  "signals.get": [{}, SignalInfo[]];
  "graph.get": [{ id: number; dir: "up" | "down"; depth: number }, GraphNode | null];
  "value.inspect": [{ h: number; offset?: number; ancestors?: number[] }, Inspected | null];
  "value.text": [{ h: number }, string | null];
  "signal.set": [{ id: number; json: string }, { ok: true; value: Preview } | { ok: false; error: string }];
  /** Replace the leaf at `path` of a JSON-valued signal (fresh copy, through `.set`). */
  "signal.setPath": [{ id: number; path: string[]; json: string }, { ok: true; value: Preview } | { ok: false; error: string }];
  /** Typed edit at a path of a signal, or a debug override of a computed / prop. */
  "value.edit": [{ target: Target; path: Seg[]; op: EditOp }, EditResult];
  /** Reset a computed / prop override. */
  "override.clear": [{ target: Target }, { ok: boolean }];
  "signal.details": [{ id: number }, SignalDetails | null];
  "contexts.get": [{}, ProviderEntry[]];
  /** Which framework panes have data (development façades / dev endpoints present). */
  "libs.get": [{}, { router: boolean; i18n: boolean; forms: boolean }];
  "router.get": [{}, RouterInfo | null];
  "i18n.get": [{}, I18nInfo | null];
  "forms.get": [{}, FormInfo[]];
  "perf.get": [{}, PerfInfo];
  "page.mode": [{}, PageMode];
  /** Switch a resumed dev page to client render (the hot-update fallback), for live components. */
  "page.inspect": [{}, PageMode];
  "perf.options": [Partial<PerfOptions>, PerfOptions];
  "perf.reset": [{}, null];
  highlight: [{ id: number | null }, null];
  /** Highlight the element of an `a11y` error (null clears). */
  "error.highlight": [{ id: number | null }, null];
  "pick.start": [{}, null];
  "pick.stop": [{}, null];
  "updates.flash": [{ on: boolean }, null];
  "updates.reset": [{}, null];
  "editor.open": [SourceLocation, { ok: boolean }];
  "dock.close": [{}, null];
  "dock.popout": [{}, null];
}
