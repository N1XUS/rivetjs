// Rivet-authored InlineSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: In a Sentence" };

// #region demo
export function Sentence() {
  return (
    <p class="max-w-md text-base leading-7">
      Show me{" "}
      <InlineSelect defaultValue="open" aria-label="Status">
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator />
        </InlineSelect.Trigger>
        <InlineSelect.Popover>
          <ListBox>
            <ListBox.Item id="open" textValue="open">
              open
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="closed" textValue="closed">
              closed
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="all" textValue="all">
              all
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </InlineSelect.Popover>
      </InlineSelect>{" "}
      issues assigned to{" "}
      <InlineSelect defaultValue="me" aria-label="Assignee">
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator />
        </InlineSelect.Trigger>
        <InlineSelect.Popover>
          <ListBox>
            <ListBox.Item id="me" textValue="me">
              me
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="team" textValue="my team">
              my team
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="anyone" textValue="anyone">
              anyone
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </InlineSelect.Popover>
      </InlineSelect>
      , newest first.
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sentence />
    </div>
  );
}
