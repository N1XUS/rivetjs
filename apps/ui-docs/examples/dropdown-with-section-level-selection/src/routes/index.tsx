// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-section-level-selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Header } from "@rivetjs/ui/header";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import type { Selection } from "@rivetjs/cdk/menu";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Dropdown: With Section Level Selection" };

// #region demo
export function WithSectionLevelSelection() {
  const textStyles = signal<Selection>(new Set(["bold", "italic"]));
  const textAlignment = signal<Selection>(new Set(["left"]));

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Styles
      </Button>
      <Dropdown.Popover class="min-w-[256px]">
        <Dropdown.Menu>
          <Dropdown.Section>
            <Header>Actions</Header>
            <Dropdown.Item id="cut" shortcut="command+X">
              Cut
            </Dropdown.Item>
            <Dropdown.Item id="copy" shortcut="command+C">
              Copy
            </Dropdown.Item>
            <Dropdown.Item id="paste" shortcut="command+U">
              Paste
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section selectedKeys={textStyles} selectionMode="multiple">
            <Header>Text Style</Header>
            <Dropdown.Item id="bold" textValue="Bold">
              <Dropdown.ItemIndicator />
              <Label>Bold</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>B</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="italic" textValue="Italic">
              <Dropdown.ItemIndicator />
              <Label>Italic</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>I</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="underline" textValue="Underline">
              <Dropdown.ItemIndicator />
              <Label>Underline</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="command" />
                <Kbd.Content>U</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
          <Separator />
          <Dropdown.Section selectedKeys={textAlignment} selectionMode="single">
            <Header>Text Alignment</Header>
            <Dropdown.Item id="left" textValue="Left">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Left</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>A</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="center" textValue="Center">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Center</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>H</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
            <Dropdown.Item id="right" textValue="Right">
              <Dropdown.ItemIndicator type="dot" />
              <Label>Right</Label>
              <Kbd class="ms-auto" slot="keyboard" variant="light">
                <Kbd.Abbr keyValue="alt" />
                <Kbd.Content>D</Kbd.Content>
              </Kbd>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSectionLevelSelection />
    </div>
  );
}
