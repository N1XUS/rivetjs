// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/kbd/special.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Kbd } from "@rivetjs/ui/kbd";

export const head = { title: "Kbd: Special Keys" };

// #region demo
export function SpecialKeys() {
  return (
    <div class="space-y-3">
      <p class="text-sm">
        Press{" "}
        <Kbd>
          <Kbd.Abbr keyValue="enter" />
        </Kbd>{" "}
        to confirm or{" "}
        <Kbd>
          <Kbd.Abbr keyValue="escape" />
        </Kbd>{" "}
        to cancel.
      </p>
      <p class="text-sm">
        Use{" "}
        <Kbd>
          <Kbd.Abbr keyValue="tab" />
        </Kbd>{" "}
        to navigate between form fields and{" "}
        <Kbd>
          <Kbd.Abbr keyValue="shift" />
          <Kbd.Abbr keyValue="tab" />
        </Kbd>{" "}
        to go back.
      </p>
      <p class="text-sm">
        Hold{" "}
        <Kbd>
          <Kbd.Abbr keyValue="space" />
        </Kbd>{" "}
        to temporarily enable panning mode.
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SpecialKeys />
    </div>
  );
}
