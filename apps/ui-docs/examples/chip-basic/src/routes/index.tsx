// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/chip/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Chip: Usage" };

// #region demo
export function ChipBasic() {
  return (
    <div class="flex flex-wrap items-center gap-3">
      <Chip>Default</Chip>
      <Chip color="accent">Accent</Chip>
      <Chip color="success">Success</Chip>
      <Chip color="warning">Warning</Chip>
      <Chip color="danger">Danger</Chip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ChipBasic />
    </div>
  );
}
