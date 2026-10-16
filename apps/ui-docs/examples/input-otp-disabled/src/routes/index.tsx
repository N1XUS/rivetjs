// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex w-[280px] flex-col gap-2">
      <Label isDisabled>Verify account</Label>
      <Description>Code verification is currently disabled</Description>
      <InputOTP isDisabled maxLength={6}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot index={3} />
          <InputOTP.Slot index={4} />
          <InputOTP.Slot index={5} />
        </InputOTP.Group>
      </InputOTP>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
