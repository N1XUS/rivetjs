// Panel state (the panel's own signals, in its own realm) and the actions that talk to the agent.
import { batch, computed, effect, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { connect, type Link } from "./link.ts";
import { BUILD_PATH, VERSION, type BuildInfo } from "../protocol.ts";
import type {
  FormInfo,
  I18nInfo,
  PageMode,
  PerfInfo,
  PerfOptions,
  RouterInfo,
  EditOp,
  ErrorEntry,
  Events,
  GraphNode,
  HmrEntry,
  Inspected,
  OwnerInfo,
  Preview,
  ProviderEntry,
  Seg,
  SignalDetails,
  SignalInfo,
  SourceLocation,
  Target,
  TreeNode,
} from "../protocol.ts";

export type Tab = "components" | "signals" | "contexts" | "router" | "i18n" | "forms" | "performance" | "updates" | "hmr" | "errors";
// The last tab is kept for the browser tab session: a panel reopened on Performance keeps a resumed
// dev page resumed across reloads.
const TAB_KEY = "rivet-devtools-ui:tab";
const savedTab = ((): Tab | null => {
  try {
    return sessionStorage.getItem(TAB_KEY) as Tab | null;
  } catch {
    return null;
  }
})();
export const tab = signal<Tab>(savedTab ?? "components");
/** Resumed dev page, and whether (and why) it switched to client render. */
export const pageMode = signal<PageMode>({ resumed: false, switched: false });
export const switching = signal(false);
/** Tabs that need live components: on a resumed dev page they switch it to client render. */
const LIVE: ReadonlySet<Tab> = new Set(["components", "signals", "contexts", "router", "forms"]);
export const connected = signal(false);
export const tree = signal<TreeNode[]>([]);
export const selected = signal<number | null>(null);
export const details = signal<OwnerInfo | null>(null);
export const allSignals = signal<SignalInfo[]>([]);
export const selectedSignal = signal<number | null>(null);
export const graph = signal<{ up: GraphNode | null; down: GraphNode | null }>({ up: null, down: null });
export const signalDetails = signal<SignalDetails | null>(null);
export const providers = signal<ProviderEntry[]>([]);
/** Framework panes present (their development façades / dev endpoints answered). */
export const libs = signal({ router: false, i18n: false, forms: false });
export const routerInfo = signal<RouterInfo | null>(null);
export const i18nInfo = signal<I18nInfo | null>(null);
export const formsInfo = signal<FormInfo[]>([]);
/** Highlighted provider instance (after a jump), in the owner pane and the Contexts tab. */
export const focusProvider = signal<number | null>(null);
export const hmr = signal<HmrEntry[]>([]);
export const errors = signal<ErrorEntry[]>([]);
export const flashing = signal(false);
/** Performance tab data; badges on the component tree come from its rows. */
export const perfInfo = signal<PerfInfo | null>(null);
/** Component the Performance tab filters findings by (a tree badge click). */
export const perfFocus = signal<number | null>(null);
export const picking = signal(false);
/** Why this panel build cannot be trusted (protocol mismatch / built from older sources), or null. */
export const stale = signal<string | null>(null);
declare const __RIVET_DEVTOOLS_BUILD__: string;
const REBUILD = "rebuild it (node libs/devtools/build.ts) and reload.";
/** The dev server's live source hash vs the one this build was made from (`server.ts` `sourceHash`). */
async function checkBuild(): Promise<void> {
  try {
    const live = (await (await fetch("./" + BUILD_PATH, { cache: "no-store" })).json()) as BuildInfo;
    if (live.v !== VERSION) stale.set("This DevTools panel speaks protocol v" + VERSION + ", the dev server v" + live.v + ": " + REBUILD);
    else if (live.hash !== null && live.hash !== __RIVET_DEVTOOLS_BUILD__) stale.set("This DevTools panel was built from older sources (protocol.ts / ui/): " + REBUILD);
  } catch {}
}
/** Events the agent dropped (over `BATCH` per frame) since the panel connected: views may be stale. */
export const dropped = signal(0);

/**
 * Keyed view of `source() === key`: a change flips the old and the new key's flag only, so N tree rows
 * reading `is(row.id)` do O(1) work per selection instead of all re-running.
 */
export function keyed<K>(source: () => K): (key: K) => boolean {
  const flags = new Map<K, Signal<boolean>>();
  let last: K | undefined;
  effect(() => {
    const next = source();
    untrack(() =>
      batch(() => {
        if (last !== undefined) flags.get(last)?.set(false);
        flags.get(next)?.set(true);
      }),
    );
    last = next;
  });
  return (key) => {
    let flag = flags.get(key);
    if (!flag) flags.set(key, (flag = signal(untrack(source) === key)));
    return flag();
  };
}
export const isSelected = keyed(selected);

// Live DOM update counts by component id (`dom.update` sets the ids it names; no Map copy per event).
const counts = new Map<number, Signal<number | undefined>>();
/** DOM updates of a component since the panel connected (undefined: none seen; fall back to the tree's). */
export function countOf(id: number): number | undefined {
  let count = counts.get(id);
  if (!count) counts.set(id, (count = signal<number | undefined>(undefined)));
  return count();
}
/** Performance reasons by component id (one index per `perfInfo` change, not a row scan per tree row). */
export const perfReasons = computed(() => {
  const index = new Map<number, string[]>();
  for (const row of perfInfo()?.rows ?? []) if (row.reasons.length) index.set(row.comp.id, row.reasons);
  return index;
});

// Components tree view: collapsed ids, name filter, flattened visible rows (windowed by the view).
export const collapsed = signal<ReadonlySet<number>>(new Set());
export const treeFilter = signal("");
export interface TreeRow {
  node: TreeNode;
  depth: number;
  /** Has children (a toggle is shown). */
  parent: boolean;
  open: boolean;
}
/**
 * Visible rows in document order. With a filter (case-insensitive name substring), matching components
 * and their ancestors, all open; without, the tree minus collapsed subtrees.
 */
export function flattenTree(nodes: readonly TreeNode[], closed: ReadonlySet<number>, filter: string): TreeRow[] {
  const out: TreeRow[] = [];
  const needle = filter.trim().toLowerCase();
  const walk = (list: readonly TreeNode[], depth: number): boolean => {
    let any = false;
    for (const node of list) {
      const parent = node.children.length > 0;
      if (!needle) {
        const open = parent && !closed.has(node.id);
        out.push({ node, depth, parent, open });
        if (open) walk(node.children, depth + 1);
        continue;
      }
      const at = out.length;
      // Filtering: no toggles (collapse state applies to the unfiltered tree).
      out.push({ node, depth, parent: false, open: true });
      const inner = parent && walk(node.children, depth + 1);
      if (inner || node.name.toLowerCase().includes(needle)) any = true;
      else out.length = at;
    }
    return any;
  };
  walk(nodes, 0);
  return out;
}
/** Row height (px, fixed: windowing math) and the size above which only the rows in view render. */
export const ROW = 20,
  WINDOW = 500,
  OVERSCAN = 20;
/** Rows to render for a scroll position: everything up to `WINDOW` rows, else the viewport ± `OVERSCAN`. */
export function windowRange(total: number, scrollTop: number, height: number): { start: number; end: number } {
  if (total <= WINDOW) return { start: 0, end: total };
  const start = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  return { start, end: Math.min(total, start + Math.ceil(height / ROW) + 2 * OVERSCAN) };
}
export const treeRows = computed(() => flattenTree(tree(), collapsed(), treeFilter()));
export function toggleCollapsed(id: number): void {
  const next = new Set(collapsed());
  if (!next.delete(id)) next.add(id);
  collapsed.set(next);
}

// Live signal values by id: rows read these, `sig.write` events set them.
const values = new Map<number, Signal<Preview>>();
export function valueOf(id: number, initial: Preview): Signal<Preview> {
  let value = values.get(id);
  if (!value) values.set(id, (value = signal(initial)));
  return value;
}

let link: Link | null = null;
let refetch: ReturnType<typeof setTimeout> | null = null;
const refreshTree = () => {
  refetch ??= setTimeout(async () => {
    refetch = null;
    tree.set(await link!.request("tree.get", {}));
    const id = selected();
    if (id !== null) details.set(await link!.request("owner.get", { id }));
  }, 30);
};

function onEvent<K extends keyof Events>(type: K, data: Events[K]): void {
  switch (type) {
    case "snapshot": {
      const snapshot = data as Events["snapshot"];
      batch(() => {
        tree.set(snapshot.tree);
        hmr.set(snapshot.hmr);
        errors.set(snapshot.errors);
      });
      break;
    }
    case "tree.changed":
      refreshTree();
      break;
    case "sig.write": {
      const write = data as Events["sig.write"];
      values.get(write.id)?.set(write.value);
      break;
    }
    case "dom.update":
      batch(() => {
        for (const [id, n] of (data as Events["dom.update"]).counts) {
          const count = counts.get(id);
          if (count) count.set(n);
          else counts.set(id, signal<number | undefined>(n));
        }
      });
      break;
    case "hmr": {
      const entry = data as HmrEntry;
      // Updates to the latest entry (state reset after the update) replace it.
      const list = hmr();
      const last = list.at(-1);
      hmr.set(last && last.ts === entry.ts && last.kind === entry.kind && last.id === entry.id ? [...list.slice(0, -1), entry] : [...list, entry]);
      break;
    }
    case "error": {
      const entry = data as ErrorEntry;
      const list = errors().filter((e) => e.id !== entry.id);
      errors.set([...list, entry].sort((a, b) => a.id - b.id));
      break;
    }
    case "pick.hover":
      break;
    case "dropped":
      dropped.set(dropped() + (data as number));
      // Missed tree.changed / sig.write: refetch what the panes show.
      refreshTree();
      break;
    case "perf.changed":
      refreshPerf();
      break;
    case "page.mode":
      pageMode.set(data as PageMode);
      refreshTree();
      break;
    case "lib.changed": {
      const lib = (data as Events["lib.changed"]).lib;
      if (!libs()[lib]) void loadLibs();
      if (tab() === lib) void loadPane(lib);
      break;
    }
    case "pick.done": {
      picking.set(false);
      const id = (data as Events["pick.done"]).id;
      if (id !== null) void select(id);
      break;
    }
  }
}

export function start(): Link {
  void checkBuild();
  link = connect(onEvent, (welcome) => {
    if (welcome.v !== VERSION) {
      // Wire shapes differ: talking further would misread every message.
      stale.set("Page agent speaks protocol v" + welcome.v + ", this panel v" + VERSION + ": " + REBUILD);
      return;
    }
    connected.set(true);
    void loadLibs();
    void loadPerf();
    void link!.request("page.mode", {}).then((mode) => {
      pageMode.set(mode);
      void ensureLive(tab());
    });
    if (flashing()) void link!.request("updates.flash", { on: true });
  });
  return link;
}
export const docked = (): boolean => link?.docked ?? true;

export async function select(id: number | null): Promise<void> {
  selected.set(id);
  details.set(id === null ? null : await link!.request("owner.get", { id }));
}
export const highlight = (id: number | null) => void link?.request("highlight", { id });
/** Highlight the element of an a11y error in the page (null clears). */
export const highlightError = (id: number | null) => void link?.request("error.highlight", { id });
export function togglePick(): void {
  const next = !picking();
  picking.set(next);
  void link!.request(next ? "pick.start" : "pick.stop", {});
}
export async function setSignal(id: number, json: string): Promise<string | null> {
  const result = await link!.request("signal.set", { id, json });
  if (!result.ok) return result.error;
  values.get(id)?.set(result.value);
  return null;
}
/** Replace the leaf at `path` of a JSON-valued signal; the error text, or null. */
export async function setSignalPath(id: number, path: string[], json: string): Promise<string | null> {
  const result = await link!.request("signal.setPath", { id, path, json });
  if (!result.ok) return result.error;
  values.get(id)?.set(result.value);
  return null;
}
/** One page of a value handle's entries (null: the handle expired). */
export const inspectValue = (h: number, offset: number, ancestors: number[]): Promise<Inspected | null> =>
  link!.request("value.inspect", { h, offset, ancestors });
export const fullText = (h: number): Promise<string | null> => link!.request("value.text", { h });
export async function loadSignals(): Promise<void> {
  allSignals.set(await link!.request("signals.get", {}));
}
export async function selectSignal(id: number): Promise<void> {
  selectedSignal.set(id);
  const [up, down, more] = await Promise.all([
    link!.request("graph.get", { id, dir: "up", depth: 3 }),
    link!.request("graph.get", { id, dir: "down", depth: 3 }),
    link!.request("signal.details", { id }),
  ]);
  batch(() => {
    graph.set({ up, down });
    signalDetails.set(more);
  });
}
/** Typed edit / override at a path; the error text, or null. Overrides refresh the owner pane. */
export async function editValue(target: Target, path: Seg[], op: EditOp): Promise<string | null> {
  const result = await link!.request("value.edit", { target, path, op });
  if (!result.ok) return result.error;
  if (target.kind === "signal") values.get(target.id)?.set(result.value);
  else await refreshDetails();
  return result.note ?? null;
}
export async function clearOverride(target: Target): Promise<void> {
  await link!.request("override.clear", { target });
  await refreshDetails();
}
export async function refreshDetails(): Promise<void> {
  const id = selected();
  if (id !== null) details.set(await link!.request("owner.get", { id }));
}
export async function loadContexts(): Promise<void> {
  providers.set(await link!.request("contexts.get", {}));
}
/** Jump to a component in the Components tab (optionally a provider instance in its pane). */
export function goToComponent(id: number, provider: number | null = null): void {
  focusProvider.set(provider);
  tab.set("components");
  void select(id);
  highlight(id);
  setTimeout(() => highlight(null), 800);
}
export function goToSignal(id: number): void {
  tab.set("signals");
  void loadSignals().then(() => selectSignal(id));
}
export function setFlashing(on: boolean): void {
  flashing.set(on);
  void link!.request("updates.flash", { on });
}
export function resetCounts(): void {
  batch(() => {
    for (const count of counts.values()) count.set(undefined);
  });
  void link!.request("updates.reset", {});
  refreshTree();
}
export const openInEditor = (location: SourceLocation) => void link?.request("editor.open", location);
export const closeDock = () => void link?.request("dock.close", {});
export const popOut = () => void link?.request("dock.popout", {});
export async function loadLibs(): Promise<void> {
  libs.set(await link!.request("libs.get", {}));
}
export async function loadPane(lib: "router" | "i18n" | "forms"): Promise<void> {
  if (lib === "router") routerInfo.set(await link!.request("router.get", {}));
  else if (lib === "i18n") i18nInfo.set(await link!.request("i18n.get", {}));
  else formsInfo.set(await link!.request("forms.get", {}));
}
// Form state changes are not pushed: the Forms pane polls while shown.
let polling: ReturnType<typeof setInterval> | null = null;
/** On a resumed dev page, a tab needing live components switches it to client render (once). */
async function ensureLive(next: Tab): Promise<void> {
  const mode = pageMode();
  if (!LIVE.has(next) || !mode.resumed || mode.switched || switching()) return;
  switching.set(true);
  try {
    pageMode.set(await link!.request("page.inspect", {}));
  } finally {
    switching.set(false);
  }
  refreshTree();
  void loadLibs();
  if (tab() === next) show(next);
}
export function show(next: Tab): void {
  tab.set(next);
  try {
    sessionStorage.setItem(TAB_KEY, next);
  } catch {}
  void ensureLive(next);
  if (polling) clearInterval(polling);
  polling = null;
  if (next === "router" || next === "i18n" || next === "forms") void loadPane(next);
  if (next === "forms") polling = setInterval(() => void loadPane("forms"), 700);
  if (next === "signals") void loadSignals();
  if (next === "contexts") void loadContexts();
  if (next === "performance") void loadPerf();
}

let perfTimer: ReturnType<typeof setTimeout> | null = null;
/** Refetch performance data (coalesced: findings arrive in bursts). */
function refreshPerf(): void {
  perfTimer ??= setTimeout(
    () => {
      perfTimer = null;
      void loadPerf();
    },
    tab() === "performance" ? 150 : 600,
  );
}
export async function loadPerf(): Promise<void> {
  perfInfo.set(await link!.request("perf.get", {}));
}
export async function setPerfOption(next: Partial<PerfOptions>): Promise<void> {
  await link!.request("perf.options", next);
  await loadPerf();
}
export async function resetPerf(): Promise<void> {
  await link!.request("perf.reset", {});
  await loadPerf();
}
/** Tree badge click: the Performance tab, filtered by that component. */
export function goToPerf(id: number | null): void {
  perfFocus.set(id);
  show("performance");
}
