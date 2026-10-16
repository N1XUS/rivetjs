import { signal } from "@rivetjs/reactivity";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButtonGroup events and DOM attributes" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (line: string) => log.set([...log(), line].slice(-4));
  return (
    <div class="demo">
      <ToggleButtonGroup
        id="filters"
        aria-label="Filters"
        selectionMode="multiple"
        data-analytics="filters"
        onSelectionChange={(keys) => add(`selection: ${[...keys].join(",") || "none"}`)}
        onPointerEnter={() => add("group pointerenter")}
      >
        <ToggleButton id="open" onPress={(e) => add(`press open (${e.pointerType})`)}>
          Open
        </ToggleButton>
        <ToggleButton id="closed">Closed</ToggleButton>
      </ToggleButtonGroup>
      <ol id="filters-log">
        {log().map((line) => (
          <li>{line}</li>
        ))}
      </ol>
    </div>
  );
}
// #endregion
