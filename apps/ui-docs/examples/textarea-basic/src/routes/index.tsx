// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textarea/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "TextArea: Usage" };

// #region demo
export function Basic() {
  return <TextArea aria-label="Quick project update" class="h-32 w-96" placeholder="Share a quick project update..." />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
