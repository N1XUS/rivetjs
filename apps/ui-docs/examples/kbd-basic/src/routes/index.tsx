// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/kbd/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Kbd } from "@rivetjs/ui/kbd";

export const head = { title: "Kbd: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex items-center gap-4">
      <Kbd>
        <Kbd.Abbr keyValue="command" />
        <Kbd.Content>K</Kbd.Content>
      </Kbd>
      <Kbd>
        <Kbd.Abbr keyValue="shift" />
        <Kbd.Content>P</Kbd.Content>
      </Kbd>
      <Kbd>
        <Kbd.Abbr keyValue="ctrl" />
        <Kbd.Content>C</Kbd.Content>
      </Kbd>
      <Kbd>
        <Kbd.Abbr keyValue="option" />
        <Kbd.Content>D</Kbd.Content>
      </Kbd>
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
