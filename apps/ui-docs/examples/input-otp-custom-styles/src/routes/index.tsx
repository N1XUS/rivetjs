// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "InputOTP: Tailwind CSS" };

// #region demo
const slotClass = "rounded-lg border-border/80 bg-default data-[active=true]:border-accent/40 data-[active=true]:bg-accent-soft";

export function CustomStyles() {
  return (
    <div class="flex w-72 flex-col gap-2">
      <Label>Verify account</Label>
      <InputOTP maxLength={6}>
        <InputOTP.Group>
          <InputOTP.Slot class={slotClass} index={0} />
          <InputOTP.Slot class={slotClass} index={1} />
          <InputOTP.Slot class={slotClass} index={2} />
        </InputOTP.Group>
        <InputOTP.Separator class="bg-border" />
        <InputOTP.Group>
          <InputOTP.Slot class={slotClass} index={3} />
          <InputOTP.Slot class={slotClass} index={4} />
          <InputOTP.Slot class={slotClass} index={5} />
        </InputOTP.Group>
      </InputOTP>
      <Link class="text-sm text-link" href="#">
        Resend code
      </Link>
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
