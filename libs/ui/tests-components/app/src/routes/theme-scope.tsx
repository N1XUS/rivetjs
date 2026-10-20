// UI-THEME-PORTAL: portaled overlays inside a scoped theme (`data-ui-theme="rivet"`, `styles/themes/scoped.css`) on a resumed
// page; theme-scope.test.ts clears every Rivet token on `:root`, so only the scope (and a stamped overlay host) has them.
// Scope `#ts-scope`: Select `#ts-select`, Popover `#ts-po`, Tooltip `#ts-tt`, Modal `#ts-mo` with a nested Select `#ts-nested`,
// Open at load: route theme-scope-open. Dark scope `#ts-dark` (`data-theme="dark"` on the scope):
// Popover `#ts-dpo`. Outside any scope: Popover `#ts-out` (no attribute stamped).
import { Button } from "@rivetjs/ui/button";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Modal } from "@rivetjs/ui/modal";
import { Popover } from "@rivetjs/ui/popover";
import { Select } from "@rivetjs/ui/select";
import { Tooltip } from "@rivetjs/ui/tooltip";

function Options() {
  return (
    <ListBox>
      <ListBox.Item id="eu" textValue="Europe">
        Europe
        <ListBox.ItemIndicator />
      </ListBox.Item>
      <ListBox.Item id="us" textValue="United States">
        United States
        <ListBox.ItemIndicator />
      </ListBox.Item>
    </ListBox>
  );
}

export default function ThemeScopeStories() {
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="ts-scope" data-ui-theme="rivet" class="flex flex-wrap gap-6 bg-background p-6 text-foreground">
        <Select class="w-[220px]" defaultValue="eu">
          <Label>Region</Label>
          <Select.Trigger id="ts-select">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <Options />
          </Select.Popover>
        </Select>
        <Popover>
          <Button id="ts-po">Open popover</Button>
          <Popover.Content title="Scoped popover">
            <p id="ts-po-body">Scoped popover body</p>
          </Popover.Content>
        </Popover>
        <Tooltip delay={0}>
          <Button id="ts-tt">Hover me</Button>
          <Tooltip.Content id="ts-tt-tip">Scoped tip</Tooltip.Content>
        </Tooltip>
        <Modal>
          <Button id="ts-mo">Open modal</Button>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog id="ts-mo-dialog">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Scoped modal</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <Select class="w-[220px]" defaultValue="us">
                    <Label>Nested region</Label>
                    <Select.Trigger id="ts-nested">
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <Options />
                    </Select.Popover>
                  </Select>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </div>
      <div id="ts-dark" data-ui-theme="rivet" data-theme="dark" class="bg-background p-6 text-foreground">
        <Popover>
          <Button id="ts-dpo">Dark popover</Button>
          <Popover.Content title="Dark scoped popover">
            <p id="ts-dpo-body">Dark scoped body</p>
          </Popover.Content>
        </Popover>
      </div>
      <div class="p-6">
        <Popover>
          <Button id="ts-out">Unscoped popover</Button>
          <Popover.Content title="Unscoped popover">
            <p id="ts-out-body">Unscoped body</p>
          </Popover.Content>
        </Popover>
      </div>
    </section>
  );
}
