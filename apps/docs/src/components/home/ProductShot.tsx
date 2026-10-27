// Home product shot: editor (ui Tabs: Component / Server HTML / Browser) beside the rendered result: the `ui-counter`
// example's own page (`/examples/ui-counter/frame/`) in an iframe, so what it loads is a real counter page's cost, not
// the home's. Code panes are build-time highlighted fragments (content/_home-*.md = that page's source and server markup,
// no highlighter JS); every panel is force-mounted, so all three are server HTML and readable without JS. The Tabs resume
// on their first input: no automatic indicator (its SharedElement has a `visible` trigger, which would boot the page) and
// no scroll container. The footer meter: the frame page posts the JS files it fetched (docs-kit `frameMeters`, inline
// scripts on both sides, nothing fetched); the server HTML says 0, which the home tests check before any input. The
// iframe has `data-src`: the meter receiver sets `src` once the home has loaded and painted (next idle period), so the frame's document and styles stay
// out of the home's first paint (loaded with the page — eager or `loading="lazy"`, the shot is near the fold —
// Lighthouse mobile FCP 1,354 ms became 1,505 ms, score 100 became 99).
import { Tabs } from "@rivetjs/ui/tabs";
import { framePath } from "@rivetjs/docs-kit/frame-theme.ts";
import Component from "../../generated/fragments/home-component.tsx";
import ServerHtml from "../../generated/fragments/home-server.tsx";
import Browser from "../../generated/fragments/home-browser.tsx";

/** The embedded example (site.config.ts `frameMeters["/"]`). */
export const COUNTER_EXAMPLE = "ui-counter";

export function ProductShot() {
  const src = framePath(COUNTER_EXAMPLE);
  return (
    <div class="rh-shot rh-ui" data-pagefind-ignore="">
      <div class="rh-editor">
        <Tabs class="rh-tabs" defaultSelectedKey="component" indicator={false}>
          <Tabs.List aria-label="Counter code" container={false}>
            <Tabs.Tab id="component">Component</Tabs.Tab>
            <Tabs.Tab id="server">Server HTML</Tabs.Tab>
            <Tabs.Tab id="browser">Browser</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel id="component" class="rh-pane" shouldForceMount>
            <Component />
            <p class="rh-pane-note">A component: JSX and a signal. No hooks, no dependency arrays.</p>
          </Tabs.Panel>
          <Tabs.Panel id="server" class="rh-pane" shouldForceMount>
            <ServerHtml />
            <p class="rh-pane-note">What the server streams: plain markup, painted before any script runs. Resume markers and ids omitted.</p>
          </Tabs.Panel>
          <Tabs.Panel id="browser" class="rh-pane rh-pane-dom" shouldForceMount>
            <Browser />
            <p class="rh-pane-note">The compiled browser code. It loads on the first click and adopts the server nodes.</p>
          </Tabs.Panel>
        </Tabs>
      </div>
      <div class="rh-result">
        <div class="rh-window-bar">
          <span class="rh-dot" aria-hidden="true" />
          <span class="rh-dot" aria-hidden="true" />
          <span class="rh-dot" aria-hidden="true" />
          <a class="rh-url" href={src} target="_blank" rel="noopener" title="Open the counter page in a new tab">
            {src}
          </a>
        </div>
        <div class="rh-result-body">
          <iframe class="rh-frame" data-src={src} title="Live counter: a Rivet page with Rivet UI buttons" data-js-meter="rh-js" />
        </div>
        <p class="rh-result-note">
          <strong id="rh-js" class="rh-js" title="JavaScript files the counter page fetched, compressed size (network transfer, or the cached file's compressed size)">
            JS loaded: 0 B · 0 files
          </strong>
          <span>A real Rivet page in a frame: nothing loads until you reach for a button, then only the counter's code (compressed size).</span>
        </p>
      </div>
    </div>
  );
}
