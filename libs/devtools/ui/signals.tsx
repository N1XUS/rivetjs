// Signals panel: every live signal (search by name, component, value or location) and the selected
// one's dependencies, sources upward and observers downward.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { allSignals, goToSignal, graph, loadSignals, selectSignal, selectedSignal, signalDetails, valueOf } from "./store.ts";
import { Location, NodeLabel, SignalRow, ValueTree } from "./parts.tsx";
import { CompLink, WhyUpdated } from "./components.tsx";
import { displayName, type GraphNode } from "../protocol.ts";

function Graph(props: { node: GraphNode }) {
  return (
    <ul class="graph">
      <For each={() => props.node.next} by={(n) => n.id}>
        {(n) => (
          <li data-kind={n().kind} data-name={displayName(n())}>
            <span class="vline">
              <button type="button" class="node-link" onClick={() => (n().kind === "signal" ? goToSignal(n().id) : undefined)}>
                <NodeLabel node={n()} />
              </button>
              {n().value ? <ValueTree value={() => (n().kind === "signal" ? valueOf(n().id, n().value!)() : n().value!)} /> : null}
            </span>
            {n().next.length ? <Graph node={n()} /> : null}
          </li>
        )}
      </For>
    </ul>
  );
}

export function Signals() {
  const query = signal("");
  const shown = () => {
    const text = query().toLowerCase();
    return allSignals().filter((s) => !text || [displayName(s), s.value.p, s.location?.file ?? "", "#" + s.id].some((part) => part.toLowerCase().includes(text)));
  };
  return (
    <div class="split">
      <div class="tree">
        <div class="toolbar">
          <input class="search" placeholder="Filter signals" model:value={query} />
          <button type="button" onClick={() => void loadSignals()}>
            Refresh
          </button>
        </div>
        <ul class="list signals">
          <For each={shown} by={(s) => s.id}>
            {(s) => (
              <div class={selectedSignal() === s().id ? "pickable selected" : "pickable"} onClick={() => void selectSignal(s().id)}>
                <SignalRow info={s()} />
              </div>
            )}
          </For>
        </ul>
      </div>
      <div class="side">
        {() => {
          const { up, down } = graph();
          if (selectedSignal() === null || !down) return <p class="muted">Select a signal to see what it depends on and what depends on it.</p>;
          return (
            <div class="deps">
              <h2 class="selected-name">{displayName(down)}</h2>
              {() => {
                const more = signalDetails();
                if (!more) return null;
                return (
                  <div class="signal-details">
                    <p class="chain">
                      <For each={() => more.chain} by={(c) => c.id}>
                        {(c) => <CompLink comp={c()} />}
                      </For>
                      {more.location ? <Location at={more.location} /> : <span class="muted">(creation site recorded while the panel is open)</span>}
                      <span class="muted">{more.writes + " writes"}</span>
                    </p>
                    <h3>Last write</h3>
                    {more.lastWrite ? <WhyUpdated last={{ ts: more.lastWrite.ts, causes: [more.lastWrite] }} /> : <p class="muted">None recorded.</p>}
                  </div>
                );
              }}
              <h3>Depends on</h3>
              {up && up.next.length ? <Graph node={up} /> : <p class="muted">Nothing (a signal is a source).</p>}
              <h3>Used by</h3>
              {down.next.length ? <Graph node={down} /> : <p class="muted">Nothing is subscribed.</p>}
            </div>
          );
        }}
      </div>
    </div>
  );
}
