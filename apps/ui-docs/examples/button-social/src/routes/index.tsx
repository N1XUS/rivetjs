// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/social.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Social Buttons" };

// #region demo
// Not yet ported: upstream shows the Google, GitHub and Apple brand logos (Iconify `devicon:google`, `mdi:github`,
// `ion:logo-apple`). lucide has no brand logos and icons come from lucide only, so the buttons render without them.
export function Social() {
  return (
    <div class="flex w-full max-w-xs flex-col gap-3">
      <Button class="w-full" variant="tertiary">
        Sign in with Google
      </Button>
      <Button class="w-full" variant="tertiary">
        Sign in with GitHub
      </Button>
      <Button class="w-full" variant="tertiary">
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
