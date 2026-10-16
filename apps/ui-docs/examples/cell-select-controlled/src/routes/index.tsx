// Rivet-authored CellSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "CellSelect: Controlled" };

// #region demo
export function Controlled() {
  const units = signal<string | number | null>("metric");
  return (
    <div class="flex w-80 flex-col gap-3">
      <CellSelect value={units}>
        <CellSelect.Trigger>
          <CellSelect.Label>Units</CellSelect.Label>
          <CellSelect.Value />
          <CellSelect.Indicator />
        </CellSelect.Trigger>
        <CellSelect.Popover>
          <ListBox>
            <ListBox.Item id="metric" textValue="Metric">
              Metric
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="imperial" textValue="Imperial">
              Imperial
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </CellSelect.Popover>
      </CellSelect>
      <div class="flex items-center justify-between text-sm text-muted">
        <span>
          Selected: <span id="units">{String(units())}</span>
        </span>
        <Button size="sm" variant="tertiary" onPress={() => units.set("metric")}>
          Reset
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
