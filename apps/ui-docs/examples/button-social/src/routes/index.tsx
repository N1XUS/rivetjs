// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/social.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import Google from "virtual:brand-icons/google.svg?svg";
import GitHub from "virtual:brand-icons/github.svg?svg";
import Apple from "virtual:brand-icons/apple.svg?svg";

export const head = { title: "Button: Social Buttons" };

// #region demo
// Brand SVGs from @thesvg/icons are compiled at build time by ui-docs/brand-icons.ts.
export function Social() {
  return (
    <div class="flex w-full max-w-xs flex-col gap-3">
      <Button class="w-full" variant="tertiary">
        <Google class="size-4" aria-hidden="true" />
        Sign in with Google
      </Button>
      <Button class="w-full" variant="tertiary">
        <GitHub class="size-4" aria-hidden="true" />
        Sign in with GitHub
      </Button>
      <Button class="w-full" variant="tertiary">
        <Apple class="size-4" aria-hidden="true" />
        Sign in with Apple
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Social />
    </div>
  );
}
