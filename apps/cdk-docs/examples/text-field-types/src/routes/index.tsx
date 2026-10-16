import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField input options" };

const input = "rounded-md border border-slate-300 px-3 py-1.5";

// #region demo
export default function Inputs() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField id="tf-email" type="email" autoComplete="email" class="grid gap-1">
        <Label>Email</Label>
        <Input class={input} />
      </TextField>
      <TextField id="tf-search" type="search" enterKeyHint="search" class="grid gap-1">
        <Label>Search</Label>
        <Input class={input} />
      </TextField>
      <TextField id="tf-pin" inputMode="numeric" maxLength={4} minLength={4} pattern="[0-9]{4}" class="grid gap-1">
        <Label>PIN</Label>
        <Input class={input} />
      </TextField>
      <TextField id="tf-pass" type="password" autoComplete="current-password" class="grid gap-1">
        <Label>Password</Label>
        <Input class={input} />
      </TextField>
      {/* placeholder is a prop of the Input part. */}
      <TextField id="tf-handle" spellCheck={false} autoCapitalize="none" class="grid gap-1">
        <Label>Handle</Label>
        <Input class={input} placeholder="@ada" />
      </TextField>
    </section>
  );
}
// #endregion
