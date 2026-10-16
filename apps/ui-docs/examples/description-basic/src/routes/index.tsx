// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/description/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Description: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex flex-col gap-1">
      <Label for="email">Email</Label>
      <Input aria-describedby="email-description" class="w-64" id="email" placeholder="you@example.com" type="email" />
      <Description id="email-description">We'll never share your email with anyone else.</Description>
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
