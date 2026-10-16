// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Tailwind CSS" };

// #region demo
const options = [
  { description: "$12 billed every month", label: "Monthly", value: "monthly" },
  { description: "$120 billed once a year", label: "Yearly", value: "yearly" },
] as const;

const contentClassName =
  "group flex w-full items-start gap-3 rounded-xl border border-success/10 bg-success-soft/30 px-4 py-3 transition-colors data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-success/15 data-[hovered=true]:bg-success-soft-hover data-[selected=true]:border-success/30 data-[selected=true]:bg-success-soft data-[selected=true]:data-[hovered=true]:bg-success-soft-hover";

const controlClassName =
  "mt-0.5 size-5 shrink-0 rounded-full border border-border bg-default shadow-none group-data-[pressed=true]:scale-95 group-data-[selected=true]:border-transparent group-data-[selected=true]:bg-success group-data-[selected=true]:group-data-[pressed=true]:bg-success-hover";

const indicatorClassName =
  "before:rounded-full before:bg-default group-data-[selected=true]:before:scale-50 group-data-[selected=true]:before:bg-success-foreground group-data-[selected=true]:group-data-[pressed=true]:before:scale-[0.57]";

export function CustomStyles() {
  return (
    <RadioGroup class="w-full max-w-sm gap-3 **:data-[slot=radio]:mt-0" defaultValue="yearly" name="billing" variant="secondary">
      <Label class="font-medium text-foreground">Billing cycle</Label>
      <Description>Choose how often you are charged.</Description>
      {options.map(({ description, label, value }) => (
        <Radio value={value}>
          <Radio.Content class={contentClassName}>
            <Radio.Control class={controlClassName}>
              <Radio.Indicator class={indicatorClassName} />
            </Radio.Control>
            <div class="flex flex-col gap-0.5">
              <span class="font-medium text-foreground group-data-[selected=true]:text-success-soft-foreground">{label}</span>
              <Description class="group-data-[selected=true]:text-success-soft-foreground/80">{description}</Description>
            </div>
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
