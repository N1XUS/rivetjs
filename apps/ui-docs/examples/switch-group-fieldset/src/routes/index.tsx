// Rivet-authored SwitchGroup demo (own content): a labelled group in a Fieldset, and a horizontal row.
import { Description } from "@rivetjs/ui/description";
import { Fieldset } from "@rivetjs/ui/fieldset";
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

export const head = { title: "SwitchGroup: In a Fieldset" };

// #region demo
export function InFieldset() {
  return (
    <div class="flex w-full max-w-sm flex-col gap-8">
      {/* Fieldset + Legend name the group; SwitchGroup only lays the switches out. */}
      <Fieldset id="sg-email">
        <Fieldset.Legend>Email notifications</Fieldset.Legend>
        <Description>Choose which emails you receive.</Description>
        <SwitchGroup>
          <Switch name="digest" label="Weekly digest" description="A summary every Monday" defaultSelected />
          <Switch name="mentions" label="Mentions" description="When someone mentions you" />
          <Switch name="billing" label="Billing" description="Receipts are always sent" defaultSelected isDisabled />
        </SwitchGroup>
      </Fieldset>

      <SwitchGroup id="sg-row" orientation="horizontal" aria-label="Editor options" role="group">
        <Switch name="spellcheck" label="Spellcheck" defaultSelected />
        <Switch name="autosave" label="Autosave" />
        <Switch name="wrap" label="Wrap lines" />
      </SwitchGroup>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InFieldset />
    </div>
  );
}
