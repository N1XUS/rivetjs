// Rivet-authored ListBoxItem demo (own content): item states, the danger variant and a render function.
import type { ListBoxItemRenderProps, Selection } from "@rivetjs/cdk/listbox";
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { ListBoxItem } from "@rivetjs/ui/list-box-item";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "ListBoxItem: Variants and States" };

// #region demo
export function Variants() {
  const selected = signal<Selection>(new Set(["email"]));
  const count = () => {
    const keys = selected();
    return keys === "all" ? 4 : keys.size;
  };

  return (
    <div class="flex flex-col items-center gap-3">
      <Surface class="w-72 rounded-3xl shadow-surface">
        <ListBox id="lbi-channels" aria-label="Notification channels" class="w-full p-2" selectionMode="multiple" selectedKeys={selected}>
          <ListBoxItem id="email" textValue="Email">
            {(state: ListBoxItemRenderProps) => (
              <>
                <div class="flex flex-col">
                  <Label>Email</Label>
                  <Description>{state.isSelected() ? "On: daily digest" : "Off"}</Description>
                </div>
                <ListBoxItem.Indicator />
              </>
            )}
          </ListBoxItem>
          <ListBoxItem id="push" textValue="Push">
            <div class="flex flex-col">
              <Label>Push</Label>
              <Description>On this device</Description>
            </div>
            <ListBoxItem.Indicator />
          </ListBoxItem>
          <ListBoxItem id="sms" textValue="SMS" isDisabled>
            <div class="flex flex-col">
              <Label>SMS</Label>
              <Description>Add a phone number first</Description>
            </div>
            <ListBoxItem.Indicator />
          </ListBoxItem>
          <ListBoxItem id="all-off" textValue="Pause everything" variant="danger">
            <div class="flex flex-col">
              <Label>Pause everything</Label>
              <Description>Stops all channels for 24 hours</Description>
            </div>
            <ListBoxItem.Indicator />
          </ListBoxItem>
        </ListBox>
      </Surface>
      <p id="lbi-count" class="text-sm text-muted">
        {count()} selected
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
