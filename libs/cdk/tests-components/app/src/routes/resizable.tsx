import { Group, Panel, Separator, cookieStorage, useDefaultLayout, useGroupRef, usePanelRef, type PanelImperativeHandle } from "@rivetjs/cdk/resizable";
import type { PageProps } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable" };

const BOX = { width: "800px", height: "240px", border: "1px solid #888", marginBlockEnd: "16px" };
const SEP = { width: "8px", background: "#ccc" };
const SEP_Y = { height: "8px", background: "#ccc" };

// Story for `@rivetjs/cdk/resizable` on a resumed page: a horizontal group (collapsible left panel with an
// imperative ref), a nested vertical group, and a cookie-persisted group (`useDefaultLayout` + `cookieStorage`,
// server-rendered from the request cookie: resizable.server.ts).
export default function ResizableStory({ data }: PageProps<{ cookie: string; refKind: string }, {}>) {
  const resized = signal("");
  const leftRef = usePanelRef();
  const groupRef = useGroupRef();
  const topRef = { current: null as PanelImperativeHandle | null };
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "story", storage: cookieStorage(data.cookie), debounceSaveMs: 0 });
  return (
    <section>
      <h1>Resizable</h1>
      <output id="resized">{resized()}</output>
      <button id="collapse" onClick={() => leftRef.current?.collapse()}>
        collapse
      </button>
      <button id="resize-group" onClick={() => groupRef.current?.setLayout({ left: 20, right: 80 })}>
        resize group
      </button>
      <button id="resize-manual-ref" onClick={() => topRef.current?.resize("20%")}>
        resize manual ref
      </button>
      <div style={BOX}>
        <Group id="h" groupRef={data.refKind === "group" ? groupRef : undefined} onLayoutChange={(layout) => resized.set(JSON.stringify(layout))}>
          <Panel
            id="left"
            defaultSize="30%"
            minSize="10%"
            collapsible
            collapsedSize="5%"
            panelRef={data.refKind === "callback" ? (handle) => (leftRef.current = handle) : data.refKind === "panel" ? leftRef : undefined}
          >
            left
          </Panel>
          <Separator id="sep-h" style={SEP} />
          <Panel id="right">
            <Group id="v" orientation="vertical">
              <Panel id="top" defaultSize="50%" panelRef={data.refKind === "manual" ? topRef : undefined}>
                top
              </Panel>
              <Separator id="sep-v" style={SEP_Y} />
              <Panel id="bottom">bottom</Panel>
            </Group>
          </Panel>
        </Group>
      </div>
      <div style={BOX}>
        <Group id="p" defaultLayout={defaultLayout} onLayoutChanged={onLayoutChanged}>
          <Panel id="pa">a</Panel>
          <Separator id="sep-p" style={SEP} />
          <Panel id="pb">b</Panel>
        </Group>
      </div>
      <div style={BOX}>
        <Group id="deferred">
          <Panel id="deferred-left">
            <Group id="deferred-nested" orientation="vertical">
              <Panel id="deferred-top">top</Panel>
              <Separator id="deferred-separator-v" style={SEP_Y} />
              <Panel id="deferred-bottom">bottom</Panel>
            </Group>
          </Panel>
          <Separator id="deferred-separator-h" style={SEP} />
          <Panel id="deferred-right">right</Panel>
        </Group>
      </div>
    </section>
  );
}
