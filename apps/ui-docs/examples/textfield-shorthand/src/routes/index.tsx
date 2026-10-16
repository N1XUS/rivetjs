// Rivet addition (no upstream demo): TextField shorthand props, same parts as the compound form.
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <TextField name="email" type="email" label="Email" placeholder="you@example.com" description="We never share it" />
      <TextField isInvalid name="username" label="Username" defaultValue="a" errorMessage="At least 3 characters" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
