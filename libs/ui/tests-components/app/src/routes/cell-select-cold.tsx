// UI-COLD: one CellSelect alone on a resumed page (cold-path bench target `cell-select`): `#csc` wrapper, two-way value → `#csc-value`.
import { signal } from "@rivetjs/reactivity";
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ListBox } from "@rivetjs/ui/list-box";

export default function CellSelectCold() {
  const theme = signal<string | number | null>("light");
  return (
    <section class="flex w-[360px] flex-col gap-8 p-10">
      <div id="csc">
        <CellSelect value={theme}>
          <CellSelect.Trigger>
            <CellSelect.Label>Theme</CellSelect.Label>
            <CellSelect.Value />
            <CellSelect.Indicator />
          </CellSelect.Trigger>
          <CellSelect.Popover>
            <ListBox>
              <ListBox.Item id="light" textValue="Light">
                Light
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dark" textValue="Dark">
                Dark
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </CellSelect.Popover>
        </CellSelect>
      </div>
      <output id="csc-value">{String(theme())}</output>
    </section>
  );
}
