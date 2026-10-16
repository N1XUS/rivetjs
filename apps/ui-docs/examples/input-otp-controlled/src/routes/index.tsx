// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: Controlled" };

// #region demo
export function Controlled() {
  const value = signal("");

  return (
    <div class="flex w-[280px] flex-col gap-2">
      <Label>Verify account</Label>
      <InputOTP maxLength={6} value={value}>
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
      <Description>
        {value().length > 0 ? (
          <>
            Value: {value()} ({value().length}/6) •{" "}
            <button class="font-medium text-foreground underline" onClick={() => value.set("")}>
              Clear
            </button>
          </>
        ) : (
          "Enter a 6-digit code"
        )}
      </Description>
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
