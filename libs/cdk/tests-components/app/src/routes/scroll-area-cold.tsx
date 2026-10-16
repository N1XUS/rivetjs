import { ScrollArea, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, type ScrollAreaType } from "@rivetjs/cdk/scroll-area";

export const head = { title: "ScrollArea (cold)" };

const AREA = { width: "200px", height: "200px", border: "1px solid #888", overflow: "hidden", marginBlockEnd: "16px" };
const BAR_Y = { width: "10px", display: "flex", background: "#eee" };
const BAR_X = { height: "10px", display: "flex", flexDirection: "column", background: "#eee" } as const;
const THUMB = { flex: "1", background: "#666", borderRadius: "5px" };

// Interaction-activated types only (`hover` default, `scroll`): the page loads no JS until the pointer enters an
// area, a wheel / scroll / focus reaches it.
export default function ScrollAreaColdStory() {
  return (
    <section>
      <h1>ScrollArea (cold)</h1>
      {(["hover", "scroll"] as ScrollAreaType[]).map((type) => (
        <ScrollArea id={type} type={type} scrollHideDelay={200} style={AREA}>
          <ScrollAreaViewport id={type + "-viewport"} tabIndex={0} style={{ width: "100%", height: "100%" }}>
            <div style={{ width: "600px" }}>
              {Array.from({ length: 40 }, (_, i) => (
                <p style={{ margin: "0", height: "25px" }}>
                  {type} row {i + 1}
                </p>
              ))}
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical" id={type + "-y"} style={BAR_Y}>
            <ScrollAreaThumb id={type + "-thumb-y"} style={THUMB} />
          </ScrollAreaScrollbar>
          <ScrollAreaScrollbar orientation="horizontal" id={type + "-x"} style={BAR_X}>
            <ScrollAreaThumb id={type + "-thumb-x"} style={THUMB} />
          </ScrollAreaScrollbar>
          <ScrollAreaCorner id={type + "-corner"} style={{ background: "#ccc" }} />
        </ScrollArea>
      ))}
    </section>
  );
}
