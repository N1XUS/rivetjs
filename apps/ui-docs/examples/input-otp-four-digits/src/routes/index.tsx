// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/four-digits.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: Four Digits" };

// #region demo
export function FourDigits() {
  return (
    <div class="flex w-[280px] flex-col gap-2">
      <Label>Enter PIN</Label>
      <InputOTP maxLength={4}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
          <InputOTP.Slot index={3} />
        </InputOTP.Group>
      </InputOTP>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FourDigits />
    </div>
  );
}
