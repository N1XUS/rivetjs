// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/textarea.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: TextArea" };

// #region demo
export function TextAreaExample() {
  return (
    <TextField class="w-full max-w-64" name="message">
      <Label>Message</Label>
      <TextArea placeholder="Write your message here..." rows={4} />
      <Description>Maximum 500 characters</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TextAreaExample />
    </div>
  );
}
