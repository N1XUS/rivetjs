// Home product shot: editor (ui Tabs: Component / Server HTML / Browser) beside the rendered result (the live Counter).
// Code panes are build-time highlighted fragments (content/_home-*.md, no highlighter JS); every panel is force-mounted,
// so all three are server HTML and readable without JS. The Tabs and the Counter resume on their first input: no
// automatic indicator (its SharedElement has a `visible` trigger, which would boot the page) and no scroll container.
import { Tabs } from "@rivetjs/ui/tabs";
import Component from "../../generated/fragments/home-component.tsx";
import ServerHtml from "../../generated/fragments/home-server.tsx";
import Browser from "../../generated/fragments/home-browser.tsx";
import Counter from "./Counter.tsx";

export function ProductShot() {
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
        <div class="rh-window-bar" aria-hidden="true">
          <span class="rh-dot" />
          <span class="rh-dot" />
          <span class="rh-dot" />
          <span class="rh-url">localhost:5173</span>
        </div>
        <div class="rh-result-body">
          <Counter />
        </div>
        <p class="rh-result-note">Live. Server HTML until you click, then only this component wakes up.</p>
      </div>
    </div>
  );
}
