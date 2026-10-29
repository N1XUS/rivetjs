// Rivet-authored TextShimmer demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { TextShimmer } from "@rivetjs/ui/text-shimmer";

export const head = { title: "TextShimmer: Usage" };

// #region demo
export function Basic() {
  return <TextShimmer class="text-sm">Thinking…</TextShimmer>;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
