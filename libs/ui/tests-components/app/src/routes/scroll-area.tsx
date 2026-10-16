// ScrollArea (Rivet addition) on a resumed page: `#sa-hover` default `variant="hover"` 240×120 px, vertical list of 40 rows
// (`#sa-hover-viewport`, scrollbar `#sa-hover-y` once active); `#sa-always` `variant="always" size="sm"` both axes
// (`#sa-always-y` / `#sa-always-x` / `#sa-always-corner`, 600 px wide content) far below the fold (1600 px top margin) so it stays
// inactive until scrolled into view; `#sa-shadow` `shadow` vertical fade (`#sa-shadow-viewport`).
import { ScrollArea } from "@rivetjs/ui/scroll-area";

const ROWS = Array.from({ length: 40 }, (_, i) => `Row ${i + 1}`);

export default function ScrollAreaStories() {
  return (
    <main>
      <ScrollArea id="sa-hover" style={{ height: "120px", width: "240px" }}>
        <ScrollArea.Viewport id="sa-hover-viewport" tabIndex={0}>
          {ROWS.map((row) => (
            <p>{row}</p>
          ))}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" id="sa-hover-y">
          <ScrollArea.Thumb id="sa-hover-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea>
      <ScrollArea id="sa-shadow" shadow style={{ height: "120px", width: "240px" }}>
        <ScrollArea.Viewport id="sa-shadow-viewport">
          {ROWS.map((row) => (
            <p>{row}</p>
          ))}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" />
      </ScrollArea>
      <div style={{ marginTop: "1600px" }}>
        <ScrollArea id="sa-always" variant="always" size="sm" style={{ height: "120px", width: "240px" }}>
          <ScrollArea.Viewport>
            <div style={{ width: "600px" }}>
              {ROWS.map((row) => (
                <p>{row} — wide content</p>
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" id="sa-always-y" />
          <ScrollArea.Scrollbar orientation="horizontal" id="sa-always-x" />
          <ScrollArea.Corner id="sa-always-corner" />
        </ScrollArea>
      </div>
    </main>
  );
}
