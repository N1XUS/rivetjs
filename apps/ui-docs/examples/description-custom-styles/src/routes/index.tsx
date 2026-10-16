// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/description/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Description: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex w-64 flex-col gap-1">
      <Label for="workspace-slug">Workspace URL</Label>
      <Input id="workspace-slug" placeholder="acme" type="text" />
      <Description class="leading-relaxed tracking-wide" id="workspace-slug-hint">
        Lowercase letters and hyphens only. Used in app.acme.com/acme
      </Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
