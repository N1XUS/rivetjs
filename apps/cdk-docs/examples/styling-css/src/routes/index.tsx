import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ListBox, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "Styling with CSS" };

const sizes = [
  { key: "s", label: "Small" },
  { key: "m", label: "Medium" },
  { key: "l", label: "Large", disabled: true },
  { key: "xl", label: "Extra large" },
];

// #region demo
export default function Toolbar() {
  const saves = signal(0);
  const size = signal<Selection>(new Set(["m"]));
  // No class props: every part keeps its default rv-* class.
  return (
    <section class="demo">
      <div class="row">
        <ToggleButton id="bold">Bold</ToggleButton>
        <Button id="save" onPress={() => saves.update((n) => n + 1)}>
          Save
        </Button>
        <Button id="archive" isDisabled>
          Archive
        </Button>
      </div>
      <ListBox id="size" aria-label="Size" items={sizes} selectionMode="single" selectedKeys={size} />
      <p id="value" class="value">
        Saved {saves()} time(s), size {[...(size() as Set<string>)].join(", ")}
      </p>
    </section>
  );
}
// #endregion
