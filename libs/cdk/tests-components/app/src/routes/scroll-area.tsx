import { signal } from "@rivetjs/reactivity";
import { ScrollArea, ScrollAreaCorner, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, type ScrollAreaType } from "@rivetjs/cdk/scroll-area";

export const head = { title: "ScrollArea" };

const AREA = { width: "200px", height: "200px", border: "1px solid #888", overflow: "hidden", marginBlockEnd: "16px" };
const BAR_Y = { width: "10px", display: "flex", background: "#eee" };
const BAR_X = { height: "10px", display: "flex", flexDirection: "column", background: "#eee" } as const;
const THUMB = { flex: "1", background: "#666", borderRadius: "5px" };

// Stories for @radix-ui/react-scroll-area (Radix docs anatomy + its stories: types, RTL, corner).
export default function ScrollAreaStory() {
  const rows = signal(40);
  const scrolls = signal(0);
  return (
    <section>
      <h1>ScrollArea</h1>
      {(["always", "hover", "scroll", "auto"] as ScrollAreaType[]).map((type) => (
        <ScrollArea id={type} type={type} scrollHideDelay={200} style={AREA}>
          <ScrollAreaViewport id={type + "-viewport"} style={{ width: "100%", height: "100%" }}>
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
      <ScrollArea id="rtl" type="always" dir="rtl" style={AREA}>
        <ScrollAreaViewport id="rtl-viewport" style={{ width: "100%", height: "100%" }}>
          <div style={{ width: "1000px", height: "1000px" }}>RTL</div>
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="horizontal" id="rtl-x" style={BAR_X}>
          <ScrollAreaThumb id="rtl-thumb-x" style={THUMB} />
        </ScrollAreaScrollbar>
      </ScrollArea>
      <ScrollArea id="dynamic" type="always" style={AREA}>
        <ScrollAreaViewport id="dynamic-viewport" style={{ width: "100%", height: "100%" }} onScroll={() => scrolls.set(scrolls() + 1)}>
          {Array.from({ length: 200 }, (_, i) => (
            <p style={{ margin: "0", height: "25px", display: i < rows() ? "block" : "none" }}>row {i + 1}</p>
          ))}
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical" id="dynamic-y" style={BAR_Y}>
          <ScrollAreaThumb id="dynamic-thumb-y" style={THUMB} />
        </ScrollAreaScrollbar>
      </ScrollArea>
      <button id="more-rows" onClick={() => rows.set(rows() + 40)}>
        More rows
      </button>
      <output id="scrolls">{scrolls()}</output>
    </section>
  );
}
