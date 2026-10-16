// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-2">
        <Label>Primary variant</Label>
        <InputOTP maxLength={6} variant="primary">
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
      <div class="flex flex-col gap-2">
        <Label>Secondary variant</Label>
        <InputOTP maxLength={6} variant="secondary">
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
