// Type-level tests, checked by `tsc -p libs/ui`: ToggleButton / ButtonGroup / ToggleButtonGroup take the cdk part props + HeroUI
// variants; the generic separators take an element.
import { signal } from "@rivetjs/reactivity";
import { Button } from "../src/components/button/index.ts";
import { ButtonGroup } from "../src/components/button-group/index.ts";
import type { ButtonGroup as ButtonGroupTypes } from "../src/components/button-group/index.ts";
import { ToggleButton } from "../src/components/toggle-button/index.ts";
import { ToggleButtonGroup } from "../src/components/toggle-button-group/index.ts";

const selected = signal(false);

export const Groups = () => (
  <>
    <ToggleButton isSelected={selected} size="sm" variant="ghost" isIconOnly onChange={(v) => void (v satisfies boolean)}>
      {({ isSelected }) => (isSelected() ? "on" : "off")}
    </ToggleButton>
    <ToggleButton class={({ isHovered }) => (isHovered() ? "h" : "")} id="k">
      k
    </ToggleButton>
    <ButtonGroup size="sm" variant="secondary" isDisabled fullWidth orientation="vertical" aria-label="g">
      <Button>a</Button>
      <ButtonGroup.Separator class="s" />
      <ButtonGroup.Separator<"div"> render={(props) => <div {...(props as {})} />} />
    </ButtonGroup>
    <ToggleButtonGroup selectionMode="single" defaultSelectedKeys={["a"]} size="lg" isDetached fullWidth orientation="horizontal">
      <ToggleButton id="a">a</ToggleButton>
      <ToggleButtonGroup.Separator />
    </ToggleButtonGroup>
  </>
);

export const separatorProps: ButtonGroupTypes["SeparatorProps"] = { class: "x", id: "y" };

// @ts-expect-error bad toggle-button variant
export const BadVariant = () => <ToggleButton variant="primary">x</ToggleButton>;
// @ts-expect-error bad group orientation
export const BadOrientation = () => <ButtonGroup orientation="diagonal">x</ButtonGroup>;
// @ts-expect-error bad toggle group size
export const BadSize = () => <ToggleButtonGroup size="xl">x</ToggleButtonGroup>;
