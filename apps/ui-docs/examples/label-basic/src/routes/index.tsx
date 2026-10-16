// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/label/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Label: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex flex-col gap-1">
      <Label for="name">Name</Label>
      <Input class="w-64" id="name" placeholder="Enter your name" type="text" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
