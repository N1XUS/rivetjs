// Rivet DevTools panel: a prebuilt Rivet app in its own realm (iframe or pop-out window).
import { For, mount } from "@rivetjs/runtime/dom";
import { closeDock, connected, docked, dropped, errors, libs, pageMode, popOut, show, stale, start, switching, tab, type Tab } from "./store.ts";
import { FormsPane, I18nPane, RouterPane } from "./framework.tsx";
import { Components } from "./components.tsx";
import { Signals } from "./signals.tsx";
import { Contexts } from "./contexts.tsx";
import { Performance } from "./perf.tsx";
import { Errors, Hmr, Updates } from "./logs.tsx";
import "./styles.css";
import { TriangleAlert, X } from "lucide";
import { Icon } from "./icon.tsx";

const TABS: [Tab, string][] = [
  ["components", "Components"],
  ["signals", "Signals"],
  ["contexts", "Contexts"],
  ["router", "Router"],
  ["i18n", "i18n"],
  ["forms", "Forms"],
  ["performance", "Performance"],
  ["updates", "Updates"],
  ["hmr", "HMR"],
  ["errors", "Errors"],
];

function App() {
  return (
    <div class="app">
      <nav class="tabs">
        <span class="brand">Rivet</span>
        <For each={() => TABS.filter(([id]) => !(id === "router" || id === "i18n" || id === "forms") || libs()[id])} by={([id]) => id}>
          {(entry) => (
            <button type="button" class={tab() === entry()[0] ? "tab active" : "tab"} data-tab={entry()[0]} onClick={() => show(entry()[0])}>
              {entry()[1]}
              {() => (entry()[0] === "errors" && errors().length ? <span class="count">{String(errors().length)}</span> : null)}
            </button>
          )}
        </For>
        <span class="spacer" />
        {() =>
          dropped() ? (
            <span
              class="dropped"
              data-dropped={String(dropped())}
              title="Events over 500 per frame were not sent; the panes refetched, but update counts and flashes may be missing some."
            >
              <Icon icon={TriangleAlert} size={12} />
              {String(dropped()) + " dropped"}
            </span>
          ) : null
        }
        {() => (connected() || stale() ? null : <span class="muted">Connecting…</span>)}
        {docked() ? (
          <span class="dock">
            <button type="button" class="popout" title="Open in a window" onClick={popOut}>
              Pop out
            </button>
            <button type="button" class="close" title="Close (Alt+Shift+R)" aria-label="Close" onClick={closeDock}>
              <Icon icon={X} size={14} />
            </button>
          </span>
        ) : null}
      </nav>
      {() => {
        const reason = stale();
        return reason ? (
          <p class="stale-build" role="alert">
            <Icon icon={TriangleAlert} size={12} />
            {reason}
          </p>
        ) : null;
      }}
      {() => {
        const mode = pageMode();
        if (!mode.resumed) return null;
        const text = switching()
          ? "Switching to client render for inspection…"
          : !mode.switched
            ? "Resumed page: Components, Signals, Contexts, Router and Forms switch it to client render; Performance, Updates, HMR and Errors keep it resumed."
            : mode.by === "devtools"
              ? "Switched to client render for inspection (performance up to " + ((mode.at ?? 0) / 1000).toFixed(1) + " s was measured on the resumed page)."
              : "Client-rendered after a hot update (the page resumed at load).";
        return (
          <p class={"page-mode" + (mode.switched ? " switched" : "")} data-mode={mode.switched ? "client" : "resumed"}>
            {text}
          </p>
        );
      }}
      <main class="body">
        {() => {
          switch (tab()) {
            case "components":
              return <Components />;
            case "signals":
              return <Signals />;
            case "contexts":
              return <Contexts />;
            case "router":
              return <RouterPane />;
            case "i18n":
              return <I18nPane />;
            case "forms":
              return <FormsPane />;
            case "performance":
              return <Performance />;
            case "updates":
              return <Updates />;
            case "hmr":
              return <Hmr />;
            case "errors":
              return <Errors />;
          }
        }}
      </main>
    </div>
  );
}

start();
mount(() => <App />, document.getElementById("app")!);
