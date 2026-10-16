import { signal } from "@rivetjs/reactivity";
import { FieldError } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField label, description and error content" };

// #region demo
export default function Bio() {
  const bio = signal("");
  return (
    <TextField
      id="bio"
      class="m-4 grid max-w-sm gap-1 text-sm"
      value={bio}
      validationBehavior="aria"
      validate={(value) => (value.length > 20 ? "Keep it under 20 characters." : null)}
    >
      <Label class="font-medium">
        Short bio <small class="text-slate-500">(optional)</small>
      </Label>
      <Input class="rounded-md border border-slate-300 px-3 py-1.5 data-[invalid]:border-red-600" />
      {/* Content reading signals stays live. */}
      <Text slot="description" class="text-xs text-slate-500">
        {bio().length} / 20
      </Text>
      {/* Render-prop children receive the validation as accessors. */}
      <FieldError class="text-xs text-red-700">{({ validationErrors }) => "Error: " + validationErrors().join(" ")}</FieldError>
    </TextField>
  );
}
// #endregion
