// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Controlled" };

// #region demo
export function Controlled() {
  const name = signal("");
  const bio = signal("");

  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <TextField name="name" value={name}>
        <Label>Display name</Label>
        <Input placeholder="Jane" />
        <Description>Characters: {name().length}</Description>
      </TextField>
      <TextField name="bio" value={bio}>
        <Label>Bio</Label>
        <TextArea placeholder="Tell us about yourself..." />
        <Description>Characters: {bio().length} / 200</Description>
      </TextField>
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
