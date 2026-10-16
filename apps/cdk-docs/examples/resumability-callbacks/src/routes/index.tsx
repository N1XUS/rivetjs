import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ListBox, ListBoxItem, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "Resumable callbacks" };

const colors = [
  { key: "red", label: "Red" },
  { key: "green", label: "Green" },
  { key: "blue", label: "Blue" },
];

// #region demo
export default function Log() {
  const log = signal("nothing yet");
  // A local constant: compiled with the component, so the browser resumes it.
  const onChange = (isSelected: boolean) => log.set(`ToggleButton onChange(${isSelected})`);
  const onSelectionChange = (keys: Selection) => log.set(`ListBox onSelectionChange(${[...(keys as Set<string>)].join(", ")})`);
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <div class="flex gap-2">
        {/* An inline arrow: also compiled with the component. */}
        <Button id="ping" class="rounded-md border border-slate-300 px-3 py-1.5" onPress={(event) => log.set(`Button onPress(${event.pointerType})`)}>
          Ping
        </Button>
        <ToggleButton id="mute" class="rounded-md border border-slate-300 px-3 py-1.5 aria-pressed:bg-slate-900 aria-pressed:text-white" onChange={onChange}>
          Mute
        </ToggleButton>
      </div>
      <ListBox
        id="color"
        aria-label="Color"
        items={colors}
        selectionMode="single"
        onSelectionChange={onSelectionChange}
        class="grid gap-0.5 rounded-lg border border-slate-200 p-1"
      >
        {(item: (typeof colors)[number]) => (
          <ListBoxItem id={item.key} class="rounded px-2 py-1 aria-selected:bg-teal-100">
            {item.label}
          </ListBoxItem>
        )}
      </ListBox>
      <output id="log" class="text-slate-600">
        Last callback: {log()}
      </output>
    </section>
  );
}
// #endregion
