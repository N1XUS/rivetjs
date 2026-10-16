// Performance tab: page totals (CLS, worst interaction, resume cost), toggles for the in-page overlays
// and reflow detection, a timeline of findings, a sortable per-component table, interactions and the
// findings with why / how to fix.
import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
import { perfFocus, perfInfo, resetPerf, setPerfOption } from "./store.ts";
import { CompLink } from "./components.tsx";
import { Location } from "./parts.tsx";
import type { PerfFinding, PerfInfo, PerfKind, PerfRow, Rating } from "../protocol.ts";
import { ChevronDown, ChevronUp, TriangleAlert, X } from "lucide";
import { Icon } from "./icon.tsx";

const ms = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString()) + " ms";
const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";
const RATING: Record<Rating, string> = { good: "good", "needs-improvement": "needs improvement", poor: "poor" };
const LANES: [PerfKind, string][] = [
  ["layout-shift", "Shifts"],
  ["forced-reflow", "Reflows"],
  ["long-frame", "Long frames"],
  ["slow-interaction", "Interactions"],
  ["frequent-runs", "Re-runs"],
  ["chunks", "Chunks"],
];
type SortKey = "name" | "runs" | "self" | "ms" | "updates" | "cls" | "reflows" | "longMs" | "maxRuns";
const COLUMNS: [SortKey, string, string][] = [
  ["name", "Component", "Component (click to select)"],
  ["runs", "Runs", "Effect, binding and computed runs it owns"],
  ["self", "Self", "Time of those runs, minus runs nested in them (a computed pulled by an effect counts once)"],
  ["ms", "Total", "Total time of those runs, nested runs included"],
  ["updates", "DOM updates", "Binding re-runs that changed DOM"],
  ["cls", "CLS", "Layout-shift score of its moved nodes"],
  ["reflows", "Reflows", "Forced reflows in its code"],
  ["longMs", "In long frames", "Time its runs took inside long frames"],
  ["maxRuns", "Max re-runs", "Most runs of one of its effects / computeds for one interaction"],
];

function Toggle(props: { label: string; cls: string; on: () => boolean; set: (on: boolean) => void; title: string }) {
  return (
    <label class="check" title={props.title}>
      <input type="checkbox" class={props.cls} checked={props.on()} onChange={(event: Event) => props.set((event.currentTarget as HTMLInputElement).checked)} />
      {props.label}
    </label>
  );
}

function Summary(props: { info: PerfInfo }) {
  const info = props.info;
  return (
    <div class="perf-summary">
      <div class={"metric cls " + info.cls.rating} data-rating={info.cls.rating} title="Largest session window of layout shifts (good ≤ 0.1, poor > 0.25)">
        <span class="label">CLS</span>
        <span class="value">{info.cls.value.toFixed(3)}</span>
        <span class="rating">{RATING[info.cls.rating] + " · " + info.cls.shifts + " shifts"}</span>
      </div>
      <div class={"metric inp " + (info.inp?.rating ?? "")} title="Slowest interaction (good ≤ 200 ms, poor > 500 ms)">
        <span class="label">Slowest interaction</span>
        <span class="value">{info.inp ? ms(info.inp.value) : "—"}</span>
        <span class="rating">{info.inp ? RATING[info.inp.rating] + " · " + info.inp.type : "no interactions yet"}</span>
      </div>
      <div class="metric resume" title="Script chunks loaded after inputs; first interaction latency">
        <span class="label">{info.resume.resumed ? "Resumed page" : "Chunks after input"}</span>
        <span class="value">{info.resume.chunks + " · " + kb(info.resume.bytes)}</span>
        {info.resume.switchedAt !== undefined ? (
          <span class="rating switched">{"client render from " + (info.resume.switchedAt / 1000).toFixed(1) + " s"}</span>
        ) : null}
        <span class="rating">
          {info.resume.first
            ? "first " +
              info.resume.first.type +
              ": " +
              (info.resume.first.duration ? ms(info.resume.first.duration) : "<16 ms") +
              ", " +
              info.resume.first.chunks +
              " chunks"
            : "no input yet"}
        </span>
      </div>
    </div>
  );
}

/** Findings on a time axis, one lane per kind. */
function Timeline(props: { findings: PerfFinding[]; onPick: (id: number) => void }) {
  const items = props.findings;
  if (!items.length) return <p class="muted">Nothing recorded yet. Use the page: shifts, long frames, reflows and slow interactions show up here.</p>;
  const start = Math.min(...items.map((f) => f.ts));
  const end = Math.max(...items.map((f) => f.ts + (f.dur ?? 0)), start + 1);
  const pct = (t: number) => ((t - start) / (end - start)) * 100;
  return (
    <div class="timeline">
      <For each={() => LANES} by={([kind]) => kind}>
        {(lane) => (
          <div class="lane" data-lane={lane()[0]}>
            <span class="lane-label">{lane()[1]}</span>
            <div class="track">
              <For each={() => items.filter((f) => f.kind === lane()[0])} by={(f) => f.id}>
                {(f) => (
                  <button
                    type="button"
                    class={"mark " + f().kind}
                    title={
                      f().title +
                      (f().comps.length
                        ? " · " +
                          f()
                            .comps.map((c) => "<" + c.name + ">")
                            .join(" ")
                        : "")
                    }
                    ref={(mark: HTMLButtonElement) => {
                      // Positioned from script (no style attribute in compiled JSX).
                      mark.style.left = Math.min(pct(f().ts), 99.5) + "%";
                      mark.style.width = Math.max(((f().dur ?? 0) / (end - start)) * 100, 0.6) + "%";
                    }}
                    onClick={() => props.onPick(f().id)}
                  />
                )}
              </For>
            </div>
          </div>
        )}
      </For>
      <div class="axis">
        <span>{(start / 1000).toFixed(1) + " s"}</span>
        <span>{(end / 1000).toFixed(1) + " s"}</span>
      </div>
    </div>
  );
}

// Kept across refreshes (the tab re-renders when new data arrives).
const sort = signal<SortKey>("self");
const desc = signal(true);
const openHints = new Set<number>();
function ComponentTable(props: { rows: PerfRow[] }) {
  const sorted = () => {
    const key = sort(),
      dir = desc() ? -1 : 1;
    return props.rows.slice().sort((a, b) => (key === "name" ? a.comp.name.localeCompare(b.comp.name) : (a[key] as number) - (b[key] as number)) * dir);
  };
  return (
    <table class="perf-table">
      <thead>
        <tr>
          <For each={() => COLUMNS} by={([key]) => key}>
            {(col) => (
              <th
                title={col()[2]}
                data-sort={col()[0]}
                class={sort() === col()[0] ? "sorted " + (desc() ? "desc" : "asc") : ""}
                onClick={() => {
                  if (sort() === col()[0]) desc.set(!desc());
                  else {
                    sort.set(col()[0]);
                    desc.set(col()[0] !== "name");
                  }
                }}
              >
                {col()[1]}
                {() => (sort() === col()[0] ? <Icon icon={desc() ? ChevronDown : ChevronUp} class="icon sort" /> : null)}
              </th>
            )}
          </For>
          <th>Flags</th>
        </tr>
      </thead>
      <tbody>
        <For each={sorted} by={(row) => row.comp.id}>
          {(row) => (
            <tr class={row().hot ? "hot" : ""} data-name={row().comp.name}>
              <td>
                <CompLink comp={row().comp} />
              </td>
              <td class="n runs">{String(row().runs)}</td>
              <td class="n self">{ms(row().self)}</td>
              <td class="n ms">{ms(row().ms)}</td>
              <td class="n updates">{String(row().updates)}</td>
              <td class="n cls">{row().cls ? row().cls.toFixed(3) : "—"}</td>
              <td class="n reflows">{String(row().reflows)}</td>
              <td class="n long">{row().longMs ? ms(row().longMs) : "—"}</td>
              <td class="n max">{String(row().maxRuns)}</td>
              <td class="flags">
                {row().reasons.length ? (
                  <span class="perf-badge static" title={row().reasons.join("; ")}>
                    <Icon icon={TriangleAlert} /> {row().reasons.join(" · ")}
                  </span>
                ) : null}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function Interactions(props: { info: PerfInfo }) {
  const list = () =>
    props.info.interactions
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 20);
  return (
    <table class="perf-table interactions">
      <thead>
        <tr>
          <th>Event</th>
          <th>Total</th>
          <th title="Start to the first handler (another task was running)">Input delay</th>
          <th title="Handlers and the effects they ran">Processing</th>
          <th title="Handlers done to the next paint">Presentation</th>
          <th>Target</th>
          <th>Runs while handling</th>
          <th>Chunks</th>
        </tr>
      </thead>
      <tbody>
        <For each={list} by={(i) => i.id}>
          {(i) => (
            <tr class={i().duration >= 200 ? "slow" : ""} data-type={i().type}>
              <td>{i().type}</td>
              <td class="n total">{ms(i().duration)}</td>
              <td class="n delay">{ms(i().inputDelay)}</td>
              <td class="n processing">{ms(i().processing)}</td>
              <td class="n presentation">{ms(i().presentation)}</td>
              <td>{i().target ? <CompLink comp={i().target!} /> : <span class="muted">—</span>}</td>
              <td class="handlers">
                <For each={() => i().handlers} by={(h) => h.comp.id}>
                  {(h) => (
                    <span class="handler">
                      <CompLink comp={h().comp} />
                      <span class="muted">{ms(h().ms)}</span>
                    </span>
                  )}
                </For>
              </td>
              <td
                class="n chunks"
                title={i()
                  .chunks.map((c) => c.url)
                  .join("\n")}
              >
                {i().chunks.length ? i().chunks.length + " · " + kb(i().chunks.reduce((n, c) => n + c.bytes, 0)) : "—"}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}

function Finding(props: { f: PerfFinding; picked: () => number | null }) {
  const f = props.f;
  return (
    <li class={props.picked() === f.id ? "finding picked " + f.kind : "finding " + f.kind} data-kind={f.kind} data-id={String(f.id)}>
      <div class="finding-head">
        <span class={"kind " + f.kind}>{f.kind.replace("-", " ")}</span>
        <strong class="title">{f.title}</strong>
        {f.count > 1 && f.kind === "forced-reflow" ? <span class="badge">{"×" + f.count}</span> : null}
        <For each={() => f.comps} by={(c) => c.id}>
          {(c) => <CompLink comp={c()} />}
        </For>
        {f.location ? <Location at={f.location} /> : null}
      </div>
      <p class="detail">{f.detail}</p>
      {f.stack && f.stack.length > 1 ? (
        <ol class="stack">
          <For each={() => f.stack!} by={(at) => at.file + ":" + at.line + ":" + at.col}>
            {(at) => (
              <li>
                <Location at={at()} />
              </li>
            )}
          </For>
        </ol>
      ) : null}
      <details
        class="hint"
        open={openHints.has(f.id)}
        ref={(element: HTMLDetailsElement) => element.addEventListener("toggle", () => void (element.open ? openHints.add(f.id) : openHints.delete(f.id)))}
      >
        <summary>Why this matters / how to fix</summary>
        <p>{f.hint.why}</p>
        <p>{f.hint.fix}</p>
        <a href={f.hint.docs} target="_blank" rel="noreferrer">
          Learn more
        </a>
      </details>
    </li>
  );
}

export function Performance() {
  const picked = signal<number | null>(null);
  const kind = signal<PerfKind | "all">("all");
  const pick = (id: number) => {
    picked.set(id);
    kind.set("all");
    perfFocus.set(null);
  };
  return (
    <div class="pane perf-pane">
      {() => {
        const info = perfInfo();
        if (!info) return <p class="muted">Loading…</p>;
        const focus = perfFocus();
        const findings = info.findings
          .filter((f) => (kind() === "all" || f.kind === kind()) && (focus === null || f.comps.some((c) => c.id === focus)))
          .slice()
          .reverse();
        return (
          <div>
            <Summary info={info} />
            <div class="toolbar">
              <Toggle
                label="Detect forced reflows"
                cls="reflow-toggle"
                title="Patches DOM prototypes to see layout reads after writes (slows DOM work a little; kept for this tab session, reload to cover page start)"
                on={() => info.options.reflow}
                set={(on) => void setPerfOption({ reflow: on })}
              />
              <Toggle
                label="Show layout shifts"
                cls="shifts-toggle"
                title="Flash shifted elements in the page"
                on={() => info.options.shifts}
                set={(on) => void setPerfOption({ shifts: on })}
              />
              <Toggle
                label="Highlight updates by frequency"
                cls="heat-toggle"
                title="Flash updated DOM nodes: blue once, green, amber, red for 8+ updates a second"
                on={() => info.options.heat}
                set={(on) => void setPerfOption({ heat: on })}
              />
              <button type="button" class="perf-reset" onClick={() => void resetPerf()}>
                Reset
              </button>
              {info.supports.loaf ? null : (
                <span class="muted">{info.supports.longtask ? "Long tasks (no long-animation-frame here)" : "No long-frame timing in this browser"}</span>
              )}
              {info.recording ? null : <span class="muted">Runs are recorded while the panel is open.</span>}
            </div>
            <Timeline findings={info.findings} onPick={pick} />
            <h3>Components</h3>
            {info.rows.length ? <ComponentTable rows={info.rows} /> : <p class="muted">No component runs recorded yet.</p>}
            <h3>Interactions</h3>
            {info.interactions.length ? <Interactions info={info} /> : <p class="muted">No interactions yet.</p>}
            <h3>Findings</h3>
            <div class="toolbar filters">
              <select class="kind-filter" onChange={(event: Event) => kind.set((event.currentTarget as HTMLSelectElement).value as PerfKind | "all")}>
                <option value="all">All kinds</option>
                <For each={() => LANES} by={([k]) => k}>
                  {(lane) => (
                    <option value={lane()[0]} selected={kind() === lane()[0]}>
                      {lane()[1]}
                    </option>
                  )}
                </For>
              </select>
              {focus !== null ? (
                <button type="button" class="clear-focus" onClick={() => perfFocus.set(null)}>
                  {"Only <" + (info.rows.find((r) => r.comp.id === focus)?.comp.name ?? "component") + ">"} <Icon icon={X} />
                </button>
              ) : null}
            </div>
            {findings.length ? (
              <ul class="list findings">
                <For each={() => findings} by={(f) => f.id + ":" + f.count + ":" + f.title}>
                  {(f) => <Finding f={f()} picked={picked} />}
                </For>
              </ul>
            ) : (
              <p class="muted">No findings.</p>
            )}
          </div>
        );
      }}
    </div>
  );
}
