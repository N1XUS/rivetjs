// Rivet-authored CellSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { selectedKeys } from "@rivetjs/cdk/select";
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Custom Value" };

// #region demo
const COLORS: Record<string, string> = { blue: "#0485F7", violet: "#7C3AED", green: "#17C964", orange: "#F5A524" };

export function CustomValue() {
  return (
    <div class="w-80">
      <CellSelect defaultValue="violet">
        <CellSelect.Trigger>
          <CellSelect.Label>Accent</CellSelect.Label>
          <CellSelect.Value>
            {({ selectedText, state }) => (
              <span class="inline-flex items-center gap-2">
                <span class="size-3 rounded-full" style={{ background: COLORS[String(selectedKeys(state)[0])] }} />
                {selectedText()}
              </span>
            )}
          </CellSelect.Value>
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="blue" textValue="Blue">
              Blue
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="violet" textValue="Violet">
              Violet
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="green" textValue="Green">
              Green
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="orange" textValue="Orange">
              Orange
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValue />
    </div>
  );
}
