// Rivet-authored InlineSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: Placements" };

// #region demo
const OPTIONS = ["Daily", "Weekly", "Monthly"];

export function Placements() {
  return (
    <div class="flex flex-wrap items-center gap-8 text-sm">
      {(["bottom end", "bottom start", "top"] as const).map((placement) => (
        <InlineSelect defaultValue="Weekly" aria-label={placement}>
          <InlineSelect.Trigger>
            <InlineSelect.Value />
            <InlineSelect.Indicator />
          </InlineSelect.Trigger>
          <InlineSelect.Popover placement={placement}>
            <ListBox>
              {OPTIONS.map((option) => (
                <ListBox.Item id={option} textValue={option}>
                  {option}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </InlineSelect.Popover>
        </InlineSelect>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placements />
    </div>
  );
}
