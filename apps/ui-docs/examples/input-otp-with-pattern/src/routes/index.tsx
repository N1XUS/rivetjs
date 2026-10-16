// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/with-pattern.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { InputOTP, REGEXP_ONLY_CHARS } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: With Pattern" };

// #region demo
export function WithPattern() {
  return (
    <div class="flex w-[280px] flex-col gap-2">
      <Label>Enter code (letters only)</Label>
      <Description>Only alphabetic characters are allowed</Description>
      <InputOTP maxLength={6} pattern={REGEXP_ONLY_CHARS}>
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
      <WithPattern />
    </div>
  );
}
