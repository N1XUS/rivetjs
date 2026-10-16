// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Validation" };

// #region demo
export function Validation() {
  const username = signal("");
  const bio = signal("");

  const isUsernameInvalid = () => username().length > 0 && username().length < 3;
  const isBioInvalid = () => bio().length > 0 && bio().length < 20;

  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <TextField isRequired isInvalid={isUsernameInvalid} name="username" value={username}>
        <Label>Username</Label>
        <Input placeholder="jane_doe" />
        {isUsernameInvalid() ? (
          <FieldError>Username must be at least 3 characters.</FieldError>
        ) : (
          <Description>Choose a unique username for your profile.</Description>
        )}
      </TextField>

      <TextField isRequired isInvalid={isBioInvalid} name="bio" value={bio}>
        <Label>Bio</Label>
        <TextArea placeholder="Tell us about yourself..." />
        {isBioInvalid() ? (
          <FieldError>Bio must contain at least 20 characters.</FieldError>
        ) : (
          <Description>Minimum 20 characters ({bio().length}/20).</Description>
        )}
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Validation />
    </div>
  );
}
