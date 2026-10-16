// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/kbd/inline.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Kbd } from "@rivetjs/ui/kbd";

export const head = { title: "Kbd: Inline Usage" };

// #region demo
export function InlineUsage() {
  return (
    <div class="space-y-4">
      <p class="text-sm">
        Press{" "}
        <Kbd>
          <Kbd.Content>Esc</Kbd.Content>
        </Kbd>{" "}
        to close the dialog.
      </p>
      <p class="text-sm">
        Use{" "}
        <Kbd>
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>{" "}
        to open the command palette.
      </p>
      <p class="text-sm">
        Navigate with{" "}
        <Kbd>
          <Kbd.Abbr keyValue="up" />
        </Kbd>{" "}
        and{" "}
        <Kbd>
          <Kbd.Abbr keyValue="down" />
        </Kbd>{" "}
        arrow keys.
      </p>
      <p class="text-sm">
        Save your work with{" "}
        <Kbd>
          <Kbd.Abbr keyValue="command" />
          <Kbd.Content>S</Kbd.Content>
        </Kbd>{" "}
        regularly.
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InlineUsage />
    </div>
  );
}
