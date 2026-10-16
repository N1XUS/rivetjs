import { ScrollArea, ScrollAreaScrollbar, ScrollAreaThumb, ScrollAreaViewport, ScrollAreaCorner } from "@rivetjs/cdk/scroll-area";

export const head = { title: "ScrollArea" };

const TAGS = Array.from({ length: 50 }, (_, i) => `v1.2.0-beta.${50 - i}`);

// #region demo
export default function ScrollAreaBasic() {
  return (
    <ScrollArea id="tags" class="ScrollAreaRoot">
      <ScrollAreaViewport id="tags-viewport" class="ScrollAreaViewport">
        <div class="Tags">
          <div class="Text">Tags</div>
          {TAGS.map((tag) => (
            <div class="Tag">{tag}</div>
          ))}
        </div>
      </ScrollAreaViewport>
      <ScrollAreaScrollbar id="tags-scrollbar" class="ScrollAreaScrollbar" orientation="vertical">
        <ScrollAreaThumb id="tags-thumb" class="ScrollAreaThumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaScrollbar class="ScrollAreaScrollbar" orientation="horizontal">
        <ScrollAreaThumb class="ScrollAreaThumb" />
      </ScrollAreaScrollbar>
      <ScrollAreaCorner class="ScrollAreaCorner" />
    </ScrollArea>
  );
}
// #endregion
