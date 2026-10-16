// Server rendering of `@rivetjs/cdk/native-select` (Rivet addition): the selected `<option>` carries `selected` (HTML has no
// `<select value>`), the TextField wiring (label `for` = select id, `name`, `required`, description id in
// `aria-describedby`), optgroups.
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { NativeSelect, NativeSelectOption, NativeSelectOptGroup } from "@rivetjs/cdk/native-select";
import { TextField } from "@rivetjs/cdk/text-field";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";

export function Field() {
  return (
    <TextField defaultValue="de" name="country" isRequired>
      <Label>Country</Label>
      <NativeSelect>
        <NativeSelectOptGroup label="Europe">
          <NativeSelectOption value="fr">France</NativeSelectOption>
          <NativeSelectOption value="de">Germany</NativeSelectOption>
        </NativeSelectOptGroup>
      </NativeSelect>
      <Text slot="description">Shipping country</Text>
    </TextField>
  );
}
`;

type Fixture = { Field(): unknown };
const load = () => importModule<Fixture>("native-select-ssr-fixture.tsx", source);

describe("NativeSelect SSR", () => {
  it("marks the selected option and wires the field", async () => {
    const { Field } = await load();
    const html = await renderHtml(() => Field());
    const select = /<select[^>]*>/.exec(html)?.[0] ?? "";
    expect(select).toMatch(/class="rv-NativeSelect"/);
    expect(select).toMatch(/name="country"/);
    expect(select).toMatch(/required/);
    const id = /id="([^"]+)"/.exec(select)?.[1];
    expect(html).toContain(`for="${id}"`);
    expect(select).toMatch(/aria-describedby="[^"]+"/);
    expect(html).toMatch(/<option value="de" selected[^>]*>Germany<\/option>/);
    expect(html).toMatch(/<option value="fr"(?! selected)[^>]*>France<\/option>/);
    expect(html).toMatch(/<optgroup label="Europe">/);
  });
});
