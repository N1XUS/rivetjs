import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { FieldError } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@rivetjs/cdk/native-select";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "NativeSelect in a TextField" };

// #region demo
export default function Shipping() {
  const country = signal("de");
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      {/* TextField + NativeSelect part: the field gives the select its id, label, name, validation and value. */}
      <TextField id="country" name="country" value={country} isRequired class="grid gap-1">
        <Label class="font-medium">Country</Label>
        <NativeSelect class="rounded-md border border-slate-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-blue-600 data-invalid:border-red-600">
          <NativeSelectOption value="">Choose a country</NativeSelectOption>
          <NativeSelectOptGroup label="Europe">
            <NativeSelectOption value="fr">France</NativeSelectOption>
            <NativeSelectOption value="de">Germany</NativeSelectOption>
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Asia">
            <NativeSelectOption value="jp">Japan</NativeSelectOption>
          </NativeSelectOptGroup>
        </NativeSelect>
        <Text slot="description" class="text-slate-500">
          We ship to these countries.
        </Text>
        <FieldError class="text-red-600" />
      </TextField>
      <p class="flex items-center gap-3">
        <span>
          Value: <output id="country-value">{country()}</output>
        </span>
        <Button id="ship-fr" class="rounded-md border border-slate-300 px-3 py-1" onPress={() => country.set("fr")}>
          Ship to France
        </Button>
      </p>
    </section>
  );
}
// #endregion
