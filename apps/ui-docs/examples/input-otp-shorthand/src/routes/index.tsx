// Rivet addition (no upstream demo): InputOTP shorthand, same parts as the compound form.
import { InputOTP } from "@rivetjs/ui/input-otp";

export const head = { title: "InputOTP: Shorthand" };

// #region demo
export function Shorthand() {
  return <InputOTP aria-label="Verification code" maxLength={4} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
