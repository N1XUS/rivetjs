// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/chip/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleDashed } from "lucide";
import { Chip } from "@rivetjs/ui/chip";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Chip: Variants" };

// #region demo
export function ChipVariants() {
  const sizes = ["lg", "md", "sm"] as const;
  const variants = ["primary", "secondary", "tertiary", "soft"] as const;
  const colors = ["accent", "default", "success", "warning", "danger"] as const;

  return (
    <div class="flex flex-col gap-8 overflow-x-auto">
      {sizes.map((size, index) => (
        <>
          <div class="flex flex-col gap-4">
            <h3 class="text-sm font-semibold text-muted capitalize">{size}</h3>
            {/* Color labels header */}
            <div class="flex items-center gap-3">
              <div class="w-24 shrink-0" />
              {colors.map((color) => (
                <div class="flex shrink-0 items-center justify-center" style={{ width: "130px" }}>
                  <span class="text-xs text-muted capitalize">{color}</span>
                </div>
              ))}
            </div>
            <div class="flex flex-col gap-3">
              {variants.map((variant) => (
                <div class="flex items-center gap-3">
                  <div class="w-24 shrink-0 text-sm text-muted capitalize">{variant}</div>
                  {colors.map((color) => (
                    <div class="flex shrink-0 items-center justify-center" style={{ width: "130px" }}>
                      <Chip color={color} size={size} variant={variant}>
                        <Icon icon={CircleDashed} size={16} />
                        <Chip.Label>Label</Chip.Label>
                        <Icon icon={CircleDashed} size={16} />
                      </Chip>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {index < sizes.length - 1 && <Separator />}
        </>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ChipVariants />
    </div>
  );
}
