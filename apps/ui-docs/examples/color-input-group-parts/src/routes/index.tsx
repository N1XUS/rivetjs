// Rivet-authored ColorInputGroup demo (own content): the group parts used directly inside ColorField.
import { parseColor } from "@rivetjs/cdk/color";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorInputGroup } from "@rivetjs/ui/color-input-group";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Pipette } from "lucide";

export const head = { title: "ColorInputGroup: Parts" };

// #region demo
export function Parts() {
  const brand = signal<string | null>("#7C3AED");
  const hex = () => (brand() ? parseColor(brand()!).toString("hex") : "(empty)");

  return (
    <div class="flex w-full max-w-xs flex-col gap-6">
      {/* Primary (default): prefix swatch, input, suffix icon. */}
      <ColorField name="brand" value={brand}>
        <Label>Brand color</Label>
        <ColorInputGroup>
          <ColorInputGroup.Prefix>
            <ColorSwatch color={() => brand() ?? undefined} size="xs" />
          </ColorInputGroup.Prefix>
          <ColorInputGroup.Input />
          <ColorInputGroup.Suffix>
            <Icon icon={Pipette} size={16} class="text-muted" />
          </ColorInputGroup.Suffix>
        </ColorInputGroup>
        <Description id="cig-brand-value">Value: {hex()}</Description>
      </ColorField>

      {/* Secondary, full width: for fields on a surface. */}
      <ColorField name="accent" defaultValue="#0485F7">
        <Label>Accent color</Label>
        <ColorInputGroup variant="secondary" fullWidth>
          <ColorInputGroup.Input />
          <ColorInputGroup.Suffix>
            <span class="text-xs text-muted">HEX</span>
          </ColorInputGroup.Suffix>
        </ColorInputGroup>
      </ColorField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Parts />
    </div>
  );
}
