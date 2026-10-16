// Components panel: mount roots → components (hover outlines, click selects, picker, collapse, name
// filter; one flat keyed list, windowed past 500 rows), and the selected
// owner's details: owner chain, why it last updated, signals, computeds (overridable), effects,
// contexts provided (editable when a signal) and consumed (jump to the provider), props (overridable),
// dependencies and dependents.
import { For } from "@rivetjs/runtime/dom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import {
  clearOverride,
  countOf,
  details,
  focusProvider,
  goToComponent,
  goToPerf,
  goToSignal,
  highlight,
  isSelected,
  openInEditor,
  perfReasons,
  picking,
  select,
  togglePick,
  toggleCollapsed,
  tree,
  treeFilter,
  treeRows,
  valueOf,
  ROW,
  windowRange,
  type TreeRow,
} from "./store.ts";
import { Location, NodeLabel, SignalRow, ValueTree } from "./parts.tsx";
import { displayName, type CompRef, type GraphNode, type LastUpdate, type OwnerInfo } from "../protocol.ts";
import { batch, onCleanup, signal } from "@rivetjs/reactivity";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide";
import { Icon } from "./icon.tsx";

function Row(props: { row: () => TreeRow }) {
  const node = () => props.row().node;
  return (
    <li
      class={isSelected(node().id) ? "row selected" : "row"}
      style={{ "--depth": String(props.row().depth) }}
      data-name={node().name}
      data-kind={node().kind}
      onMouseEnter={() => highlight(node().id)}
      onMouseLeave={() => highlight(null)}
      onClick={() => void select(node().id)}
    >
      {props.row().parent ? (
        <button
          type="button"
          class="toggle"
          aria-label={props.row().open ? "Collapse" : "Expand"}
          aria-expanded={props.row().open ? "true" : "false"}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            toggleCollapsed(node().id);
          }}
        >
          <Icon icon={props.row().open ? ChevronDown : ChevronRight} size={12} />
        </button>
      ) : (
        <span class="toggle" />
      )}
      <span class="tag">{node().kind === "root" ? node().name : "<" + node().name + ">"}</span>
      {() => {
        const n = countOf(node().id) ?? node().updates;
        return n ? (
          <span class="count" title="DOM updates">
            {String(n)}
          </span>
        ) : null;
      }}
      {() => {
        const reasons = perfReasons().get(node().id);
        return reasons ? (
          <button
            type="button"
            class="perf-badge"
            title={"Performance: " + reasons.join("; ")}
            aria-label={"Performance warning: " + reasons.join("; ")}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              goToPerf(node().id);
            }}
          >
            <Icon icon={TriangleAlert} /> {reasons[0] + (reasons.length > 1 ? " +" + (reasons.length - 1) : "")}
          </button>
        ) : null;
      }}
    </li>
  );
}

/** The component tree as one flat list (collapse / filter in `treeRows`), windowed past `WINDOW` rows. */
function TreeRows() {
  const scrollTop = signal(0),
    height = signal(600);
  const range = () => windowRange(treeRows().length, scrollTop(), height());
  let resize: ResizeObserver | undefined;
  onCleanup(() => resize?.disconnect());
  return (
    <div
      class="tree-rows"
      ref={(element: HTMLDivElement) => {
        const measure = () => batch(() => (scrollTop.set(element.scrollTop), height.set(element.clientHeight || 600)));
        element.addEventListener("scroll", measure, { passive: true });
        if (typeof ResizeObserver !== "undefined") (resize = new ResizeObserver(measure)).observe(element);
      }}
    >
      {() =>
        treeRows().length ? (
          <ul
            class="branch"
            data-rows={String(treeRows().length)}
            style={{ "padding-top": range().start * ROW + "px", "padding-bottom": (treeRows().length - range().end) * ROW + "px" }}
          >
            <For each={() => treeRows().slice(range().start, range().end)} by={(row) => row.node.id}>
              {(row) => <Row row={row} />}
            </For>
          </ul>
        ) : (
          <p class="muted">{tree().length ? "No component matches." : "No mounted components yet."}</p>
        )
      }
    </div>
  );
}

export function Section(props: { title: string; cls?: string; children?: JSX.Element | JSX.Element[] }) {
  return (
    <section class={"section " + (props.cls ?? "")}>
      <h3>{props.title}</h3>
      {props.children}
    </section>
  );
}

/** A clickable component reference. */
export function CompLink(props: { comp: CompRef; provider?: number }) {
  return (
    <button
      type="button"
      class="comp-link"
      data-comp={props.comp.name}
      onMouseEnter={() => highlight(props.comp.id)}
      onMouseLeave={() => highlight(null)}
      onClick={() => goToComponent(props.comp.id, props.provider ?? null)}
    >
      {"<" + props.comp.name + ">"}
    </button>
  );
}
/** A clickable signal / computed: signals open in the Signals tab, computeds and effects at their component. */
export function NodeLink(props: { node: GraphNode }) {
  const node = props.node;
  return (
    <li class="dep" data-kind={node.kind} data-name={displayName(node)}>
      <button type="button" class="node-link" onClick={() => (node.kind === "signal" ? goToSignal(node.id) : undefined)}>
        <NodeLabel node={node} />
      </button>
      {node.value ? <ValueTree value={() => (node.kind === "signal" ? valueOf(node.id, node.value!)() : node.value!)} /> : null}
    </li>
  );
}

const ago = (ts: number) => {
  const s = (performance.now() - ts) / 1000;
  return s < 1 ? "just now" : s < 120 ? Math.round(s) + "s ago" : Math.round(s / 60) + "min ago";
};
export function WhyUpdated(props: { last: LastUpdate }) {
  return (
    <ul class="list causes">
      <For each={() => props.last.causes} by={(c) => c}>
        {(c) => (
          <li class="cause" data-name={displayName(c().signal)}>
            <span class="muted">write to</span>
            <button type="button" class="node-link" onClick={() => goToSignal(c().signal.id)}>
              <NodeLabel node={c().signal} />
            </button>
            {c().by === "devtools" ? <span class="badge devtools">DevTools edit</span> : null}
            {c().location ? <Location at={c().location!} /> : <span class="muted">(write site unknown)</span>}
            <span class="muted">{ago(c().ts)}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

function Owner(props: { info: OwnerInfo }) {
  const info = props.info;
  return (
    <div class="owner-pane" data-owner={info.name}>
      <header>
        <h2>{info.kind === "root" ? info.name : "<" + info.name + ">"}</h2>
        {info.file ? (
          <button type="button" class="location" onClick={() => openInEditor({ file: info.file!, line: 1, col: 1 })}>
            {info.file}
          </button>
        ) : null}
        {() => <span class="muted">{String(countOf(info.id) ?? info.updates) + " DOM updates"}</span>}
      </header>
      {info.chain.length ? (
        <nav class="chain" title="Owner chain">
          <For each={() => info.chain} by={(c) => c.id}>
            {(c) => (
              <span class="crumb">
                <CompLink comp={c()} />
                <span class="muted">›</span>
              </span>
            )}
          </For>
          <span class="tag">{"<" + info.name + ">"}</span>
        </nav>
      ) : null}
      {info.lastUpdate ? (
        <Section title="Why it last updated" cls="why">
          <WhyUpdated last={info.lastUpdate} />
        </Section>
      ) : null}
      <Section title="Signals">
        {info.signals.length ? (
          <ul class="list">
            <For each={() => info.signals} by={(s) => s.id}>
              {(s) => <SignalRow info={s()} scoped={false} />}
            </For>
          </ul>
        ) : (
          <p class="muted">None</p>
        )}
      </Section>
      {info.computeds.length ? (
        <Section title="Computeds">
          <ul class="list">
            <For each={() => info.computeds} by={(c) => c.id}>
              {(c) => (
                <li class={c().pinned ? "computed overridden" : "computed"} data-name={displayName(c())}>
                  <NodeLabel node={c()} scoped={false} />
                  {c().pinned ? (
                    <>
                      <span class="badge override" title="Debug override: consumers see this value until reset">
                        overridden
                      </span>
                      <ValueTree value={() => c().pinned!} target={{ kind: "computed", id: c().id }} id={"computed:" + c().id} />
                      <button type="button" class="reset" onClick={() => void clearOverride({ kind: "computed", id: c().id })}>
                        Reset
                      </button>
                      <span class="muted">{"real: " + (c().value?.p ?? "—")}</span>
                    </>
                  ) : c().value ? (
                    <ValueTree value={() => c().value!} target={{ kind: "computed", id: c().id }} id={"computed:" + c().id} />
                  ) : null}
                  <span class="muted">{c().runs + " runs, " + c().ms.toFixed(2) + " ms"}</span>
                  {c().location ? <Location at={c().location!} /> : null}
                </li>
              )}
            </For>
          </ul>
          <p class="muted hint-line">Edit a computed's value to override it (debug only).</p>
        </Section>
      ) : null}
      <Section title="Effects">
        <p class="muted effects">{info.effects.count + " effects and bindings, " + info.effects.runs + " recorded runs"}</p>
      </Section>
      {info.context.length ? (
        <Section title="Context provided" cls="provided">
          <ul class="list">
            <For each={() => info.context} by={(e) => e.provider}>
              {(e) => (
                <li class={focusProvider() === e().provider ? "provided-row focused" : "provided-row"} data-context={e().ctx.name}>
                  <span class="name ctx-name">{e().ctx.name}</span>
                  {e().signal !== undefined ? (
                    <ValueTree value={valueOf(e().signal!, e().value)} target={{ kind: "signal", id: e().signal! }} id={"ctx:" + e().provider} />
                  ) : (
                    <>
                      <ValueTree value={() => e().value} target={undefined} id={"ctx:" + e().provider} />
                      <span class="badge readonly" title={e().readonly}>
                        read-only
                      </span>
                    </>
                  )}
                  {e().ctx.location ? <Location at={e().ctx.location!} /> : null}
                  <span class="consumers">
                    {e().consumers.length ? <span class="muted">used by</span> : <span class="muted">no consumers yet</span>}
                    <For each={() => e().consumers} by={(c) => c.id}>
                      {(c) => <CompLink comp={c()} />}
                    </For>
                  </span>
                  {e().readonly ? <p class="muted reason">{e().readonly}</p> : null}
                </li>
              )}
            </For>
          </ul>
        </Section>
      ) : null}
      {info.consumed.length ? (
        <Section title="Contexts read" cls="consumed">
          <ul class="list">
            <For each={() => info.consumed} by={(e) => e.ctx.id}>
              {(e) => (
                <li class="consumed-row" data-context={e().ctx.name}>
                  <span class="name ctx-name">{e().ctx.name}</span>
                  <ValueTree
                    value={e().signal !== undefined ? valueOf(e().signal!, e().value) : () => e().value}
                    target={e().signal !== undefined ? { kind: "signal", id: e().signal! } : undefined}
                    id={"read:" + info.id + ":" + e().ctx.id}
                  />
                  {e().provider ? (
                    <span class="from">
                      <span class="muted">from</span>
                      <CompLink comp={e().provider!} provider={e().provider!.instance} />
                    </span>
                  ) : (
                    <span class="muted">default value (no provider)</span>
                  )}
                </li>
              )}
            </For>
          </ul>
        </Section>
      ) : null}
      {info.props.length ? (
        <Section title="Props">
          <ul class="list">
            <For each={() => info.props} by={(e) => e.key}>
              {(e) => (
                <li class={e().pinned ? "prop overridden" : "prop"} data-key={e().key}>
                  <span class="name">{e().key}</span>
                  {e().pinned ? (
                    <>
                      <span class="badge override" title="Debug override: the component sees this value until reset (or the prop's next real change)">
                        overridden
                      </span>
                      <ValueTree value={() => e().pinned!} target={{ kind: "prop", owner: info.id, key: e().key }} id={"prop:" + info.id + ":" + e().key} />
                      <button type="button" class="reset" onClick={() => void clearOverride({ kind: "prop", owner: info.id, key: e().key })}>
                        Reset
                      </button>
                      <span class="muted">{"real: " + e().value.p}</span>
                    </>
                  ) : (
                    <ValueTree
                      value={() => e().value}
                      target={e().overridable ? { kind: "prop", owner: info.id, key: e().key } : undefined}
                      id={"prop:" + info.id + ":" + e().key}
                    />
                  )}
                </li>
              )}
            </For>
          </ul>
          <p class="muted hint-line">Edit a prop to override it (debug only; data and accessor props).</p>
        </Section>
      ) : null}
      {info.deps.length ? (
        <Section title="Depends on" cls="deps-out">
          <ul class="list">
            <For each={() => info.deps} by={(n) => n.id}>
              {(n) => <NodeLink node={n()} />}
            </For>
          </ul>
        </Section>
      ) : null}
      {info.usedBy.length ? (
        <Section title="State used by" cls="used-by">
          <p class="links">
            <For each={() => info.usedBy} by={(c) => c.id}>
              {(c) => <CompLink comp={c()} />}
            </For>
          </p>
        </Section>
      ) : null}
    </div>
  );
}

export function Components() {
  return (
    <div class="split">
      <div class="tree comp-tree">
        <div class="toolbar">
          <button type="button" class={picking() ? "pick active" : "pick"} title="Select an element in the page" onClick={togglePick}>
            {picking() ? "Picking…" : "Pick"}
          </button>
          <input class="search tree-filter" type="search" placeholder="Filter components" aria-label="Filter components" model:value={treeFilter} />
        </div>
        <TreeRows />
      </div>
      <div class="side">
        {() => {
          const info = details();
          return info ? <Owner info={info} /> : <p class="muted">Select a component.</p>;
        }}
      </div>
    </div>
  );
}
