// Rivet-authored Separator demo (Rivet addition: labelled divider, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: With Label" };

// #region demo
export function WithLabel() {
  return (
    <div class="flex w-full max-w-xs flex-col gap-4">
      <Button fullWidth>Sign in</Button>
      <Separator id="or-separator">or</Separator>
      <Button variant="secondary" fullWidth>
        Continue with a passkey
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithLabel />
    </div>
  );
}
