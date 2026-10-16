// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Surface } from "@rivetjs/ui/surface";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex w-full min-w-[340px] flex-col gap-4 rounded-3xl p-6">
      <TextField name="name" variant="secondary">
        <Label>Your name</Label>
        <Input class="w-full" placeholder="John" />
        <Description>We'll never share this with anyone else</Description>
      </TextField>
      <TextField name="email" type="email" variant="secondary">
        <Label>Email</Label>
        <Input class="w-full" placeholder="john@example.com" />
      </TextField>
      <TextField name="bio" variant="secondary">
        <Label>Bio</Label>
        <TextArea class="w-full" placeholder="Tell us about yourself..." rows={4} />
        <Description>Minimum 4 rows</Description>
      </TextField>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
