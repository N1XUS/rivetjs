// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textarea/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "TextArea: Controlled" };

// #region demo
export function Controlled() {
  const value = signal("");

  return (
    <div class="flex w-96 flex-col gap-2">
      <TextArea
        aria-describedby="textarea-controlled-description"
        aria-label="Announcement"
        placeholder="Compose an announcement..."
        value={value()}
        onInput={(event) => value.set((event.target as HTMLTextAreaElement).value)}
      />
      <Description id="textarea-controlled-description">Characters: {value().length} / 280</Description>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
