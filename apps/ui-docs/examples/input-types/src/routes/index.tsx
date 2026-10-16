// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/types.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Input: Input Types" };

// #region demo
export function Types() {
  return (
    <div class="flex w-80 flex-col gap-4">
      <div class="flex flex-col gap-1">
        <Label for="input-type-email">Email</Label>
        <Input id="input-type-email" placeholder="jane@example.com" type="email" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="input-type-number">Age</Label>
        <Input id="input-type-number" min={0} placeholder="30" type="number" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="input-type-password">Password</Label>
        <Input id="input-type-password" placeholder="••••••••" type="password" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Types />
    </div>
  );
}
