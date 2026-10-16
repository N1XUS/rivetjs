// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "InputOTP: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex w-[280px] flex-col gap-2">
      <div class="flex flex-col gap-1">
        <Label>Verify account</Label>
        <p class="text-sm text-muted">We&apos;ve sent a code to a****@gmail.com</p>
      </div>
      <InputOTP maxLength={6}>
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
      <div class="flex items-center gap-[5px] px-1 pt-1">
        <p class="text-sm text-muted">Didn&apos;t receive a code?</p>
        <Link class="text-foreground underline" href="#">
          Resend
        </Link>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
