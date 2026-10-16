import { signal } from "@rivetjs/reactivity";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import type { Key } from "@rivetjs/cdk/types";

export const head = { title: "ToggleButtonGroup" };

export default function ToggleButtonGroupStory() {
  const formats = signal<Iterable<Key>>(new Set<Key>(["bold"]));
  const last = signal("none");
  return (
    <section>
      <h1>ToggleButtonGroup</h1>
      <ToggleButtonGroup id="tbg-align" aria-label="Alignment" defaultSelectedKeys={["left"]} disallowEmptySelection onSelectionChange={(keys) => last.set([...keys].join(","))}>
        <ToggleButton id="left">Left</ToggleButton>
        <ToggleButton id="center">Center</ToggleButton>
        <ToggleButton id="right">Right</ToggleButton>
      </ToggleButtonGroup>
      <output id="tbg-align-last">{last()}</output>
      <ToggleButtonGroup id="tbg-format" aria-label="Text style" selectionMode="multiple" selectedKeys={formats}>
        <ToggleButton id="bold">Bold</ToggleButton>
        <ToggleButton id="italic">Italic</ToggleButton>
        <ToggleButton id="underline" isDisabled>
          Underline
        </ToggleButton>
      </ToggleButtonGroup>
      <output id="tbg-format-value">{[...formats()].join(",")}</output>
      <ToggleButtonGroup id="tbg-vertical" aria-label="Vertical" orientation="vertical" isDisabled>
        <ToggleButton id="a">A</ToggleButton>
        <ToggleButton id="b">B</ToggleButton>
      </ToggleButtonGroup>
    </section>
  );
}
