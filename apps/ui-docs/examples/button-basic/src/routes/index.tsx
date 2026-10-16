// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Usage" };

// #region demo
export function Basic() {
  return <Button onPress={() => console.log("Button pressed")}>Click me</Button>;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
