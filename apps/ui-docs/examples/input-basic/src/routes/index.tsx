// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Input: Usage" };

// #region demo
export function Basic() {
  return <Input aria-label="Name" class="w-64" placeholder="Enter your name" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
