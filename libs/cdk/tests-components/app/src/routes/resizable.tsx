import { Group, Panel, Separator, cookieStorage, useDefaultLayout, usePanelRef } from "@rivetjs/cdk/resizable";
import type { PageProps } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Resizable" };

const BOX = { width: "800px", height: "240px", border: "1px solid #888", marginBlockEnd: "16px" };
const SEP = { width: "8px", background: "#ccc" };
const SEP_Y = { height: "8px", background: "#ccc" };

// Story for `@rivetjs/cdk/resizable` on a resumed page: a horizontal group (collapsible left panel with an
// imperative ref), a nested vertical group, and a cookie-persisted group (`useDefaultLayout` + `cookieStorage`,
// server-rendered from the request cookie: resizable.server.ts).
export default function ResizableStory({ data }: PageProps<{ cookie: string }, {}>) {
  const resized = signal("");
  const leftRef = usePanelRef();
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: "story", storage: cookieStorage(data.cookie), debounceSaveMs: 0 });
  return (
    <section>
      <h1>Resizable</h1>
      <output id="resized">{resized()}</output>
      <button id="collapse" onClick={() => leftRef.current?.collapse()}>
        collapse
      </button>
      <div style={BOX}>
        <Group id="h" onLayoutChange={(layout) => resized.set(JSON.stringify(layout))}>
          <Panel id="left" defaultSize="30%" minSize="10%" collapsible collapsedSize="5%" panelRef={leftRef}>
            left
          </Panel>
          <Separator id="sep-h" style={SEP} />
          <Panel id="right">
            <Group id="v" orientation="vertical">
              <Panel id="top" defaultSize="50%">
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
    </section>
  );
}
