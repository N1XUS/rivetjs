import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, type ScrollAreaType } from "@rivetjs/cdk/scroll-area";

export const head = { title: "ScrollArea types" };

const TYPES: ScrollAreaType[] = ["auto", "always", "scroll", "hover"];
const LINES = Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`);

// #region demo
export default function ScrollAreaTypes() {
  return (
    <div class="grid">
      {TYPES.map((type) => (
        <figure>
          <figcaption>type="{type}"</figcaption>
          <ScrollArea id={type} type={type} scrollHideDelay={300} class="area">
            <ScrollAreaViewport id={type + "-viewport"} class="viewport">
              {LINES.map((line) => (
                <p>{line}</p>
              ))}
            </ScrollAreaViewport>
            <ScrollAreaScrollbar id={type + "-scrollbar"} orientation="vertical" class="scrollbar">
              <ScrollAreaThumb class="thumb" />
            </ScrollAreaScrollbar>
          </ScrollArea>
        </figure>
      ))}
    </div>
  );
}
// #endregion
