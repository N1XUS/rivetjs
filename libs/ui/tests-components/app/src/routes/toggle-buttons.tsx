// ToggleButton / ButtonGroup / ToggleButtonGroup on a resumed page: live group `isDisabled` fanned out to every Button, two-way
// `isSelected` signal, hover / press / focus-visible / keyboard toggling, disabled ToggleButton, group selection modes, live
// ToggleButtonGroup `isDisabled` / `orientation` (`#tg-live`, toggled by native `#tg-live-dis` / `#tg-live-orient`).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ButtonGroup } from "@rivetjs/ui/button-group";
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

export default function ToggleButtonStories() {
  const groupDisabled = signal(false);
  const groupSize = signal<"sm" | "lg">("sm");
  const bold = signal(false);
  const plain = signal("none");
  const multi = signal("");
  const single = signal("left");
  const liveDisabled = signal(false);
  const liveOrientation = signal<"horizontal" | "vertical">("horizontal");
  const liveKeys = signal("");
  return (
    <main>
      <ButtonGroup id="bg" variant="secondary" isDisabled={groupDisabled()} size={groupSize()}>
        <Button id="bg-a">A</Button>
        <ButtonGroup.Separator />
        <Button id="bg-b">B</Button>
        <Button id="bg-c">C</Button>
      </ButtonGroup>
      <button id="bg-toggle" type="button" onClick={() => groupDisabled.set(!groupDisabled())}>
        toggle disabled
      </button>
      <button id="bg-size" type="button" onClick={() => groupSize.set(groupSize() === "sm" ? "lg" : "sm")}>
        toggle size
      </button>

      <ToggleButton id="t-bold" isSelected={bold}>
        Bold
      </ToggleButton>
      <output id="t-bold-state">{bold() ? "on" : "off"}</output>
      <button id="t-bold-ext" type="button" onClick={() => bold.set(!bold())}>
        external
      </button>

      <ToggleButton id="t-plain" onChange={(v: boolean) => plain.set(String(v))}>
        Plain
      </ToggleButton>
      <output id="t-plain-state">{plain()}</output>
      <ToggleButton id="t-dis" isDisabled>
        Disabled
      </ToggleButton>

      <ToggleButtonGroup id="tg-multi" selectionMode="multiple" size="lg" onSelectionChange={(s: Set<unknown>) => multi.set([...s].sort().join(","))}>
        <ToggleButton id="bold">Bold</ToggleButton>
        <ToggleButton id="italic">
          <ToggleButtonGroup.Separator />
          Italic
        </ToggleButton>
      </ToggleButtonGroup>
      <output id="tg-multi-keys">{multi()}</output>

      <ToggleButtonGroup
        id="tg-single"
        selectionMode="single"
        disallowEmptySelection
        defaultSelectedKeys={["left"]}
        onSelectionChange={(s: Set<unknown>) => single.set([...s].join(","))}
      >
        <ToggleButton id="left">Left</ToggleButton>
        <ToggleButton id="center">Center</ToggleButton>
      </ToggleButtonGroup>
      <output id="tg-single-keys">{single()}</output>

      <ToggleButtonGroup
        id="tg-live"
        selectionMode="multiple"
        isDisabled={liveDisabled()}
        orientation={liveOrientation()}
        onSelectionChange={(s: Set<unknown>) => liveKeys.set([...s].sort().join(","))}
      >
        <ToggleButton id="x">X</ToggleButton>
        <ToggleButton id="y">Y</ToggleButton>
      </ToggleButtonGroup>
      <output id="tg-live-keys">{liveKeys()}</output>
      <button id="tg-live-dis" type="button" onClick={() => liveDisabled.set(!liveDisabled())}>
        toggle group disabled
      </button>
      <button id="tg-live-orient" type="button" onClick={() => liveOrientation.set(liveOrientation() === "horizontal" ? "vertical" : "horizontal")}>
        toggle group orientation
      </button>
    </main>
  );
}
