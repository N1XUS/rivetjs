// Server HTML of the form-field components (RAC FieldError / Text slots, native validation attributes).
// Resumed behaviour is covered by the docs examples (apps/cdk-docs/examples/*-validation) and tests-components.
import { test } from "vitest";
import assert from "node:assert/strict";
import { importModule, renderHtml } from "./server.ts";

/** The page markup without the resume state / loader scripts (short assertion messages). */
const body = (html: string) => html.replace(/<script[\s\S]*$/, "");
const has = (html: string, re: RegExp) => assert.ok(re.test(body(html)), `${re} not in ${body(html)}`);

const page = (name: string, imports: string, body: string) =>
  importModule<{ Page: () => unknown }>(name, `${imports}\nexport function Page() { return ${body}; }`);

test("RadioGroup renders its FieldError while invalid (validate / isInvalid)", async () => {
  const { Page } = await page(
    "fields-ssr-radio.tsx",
    `import { RadioGroup } from "@rivetjs/cdk/radio-group";`,
    `<div>
      <RadioGroup id="meal" name="meal" label="Meal" validationBehavior="aria" defaultValue="fish"
        validate={(value) => (value === "fish" ? "Fish is sold out." : null)}
        items={[{ value: "fish", label: "Fish" }, { value: "pasta", label: "Pasta" }]} />
      <RadioGroup id="plan" name="plan" label="Plan" isInvalid errorMessage="Choose a plan."
        items={[{ value: "free", label: "Free" }]} />
    </div>`,
  );
  const html = await renderHtml(() => Page());
  has(html, /<span[^>]* id="meal-error"[^>]*>Fish is sold out\.<\/span>/);
  has(html, /<span[^>]* id="plan-error"[^>]*>Choose a plan\.<\/span>/);
});

test("CheckboxGroup item: its own isRequired sets native required (RA props.isRequired ?? state.isRequired)", async () => {
  const { Page } = await page(
    "fields-ssr-checkbox.tsx",
    `import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";\nimport { Label } from "@rivetjs/cdk/label";`,
    `<CheckboxGroup id="agree" name="agree" validationBehavior="native">
      <Label>Agree</Label>
      <CheckboxField value="terms" isRequired><CheckboxButton>Terms</CheckboxButton></CheckboxField>
      <CheckboxField value="news"><CheckboxButton>News</CheckboxButton></CheckboxField>
    </CheckboxGroup>`,
  );
  const html = body(await renderHtml(() => Page()));
  const inputs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
  assert.equal(inputs.length, 2, html);
  const terms = inputs.find((i) => i.includes('value="terms"'))!;
  const news = inputs.find((i) => i.includes('value="news"'))!;
  assert.match(terms, / required[ >=]/, terms);
  assert.doesNotMatch(news, / required[ >=]/, news);
});

test("ToggleButton standalone SSR: isSelected signal + isDisabled", async () => {
  const { Page } = await page(
    "fields-ssr-toggle.tsx",
    `import { signal } from "@rivetjs/reactivity";\nimport { ToggleButton } from "@rivetjs/cdk/toggle-button";`,
    `<div><ToggleButton id="a" isSelected={signal(true)}>A</ToggleButton><ToggleButton id="b" isDisabled>B</ToggleButton></div>`,
  );
  const html = body(await renderHtml(() => Page()));
  const button = (id: string) => new RegExp(`<button[^>]* id="${id}"[^>]*>`).exec(html)?.[0] ?? html;
  assert.match(button("a"), /aria-pressed="true"/, button("a"));
  assert.match(button("b"), / disabled[ >=]/, button("b"));
});

test("autosizeProps({ native, minRows, maxRows }) spreads onto the TextArea part", async () => {
  const { Page } = await page(
    "fields-ssr-autosize.tsx",
    `import { TextArea } from "@rivetjs/cdk/text-area";\nimport { TextField, autosizeProps } from "@rivetjs/cdk/text-field";\nimport { Label } from "@rivetjs/cdk/label";`,
    `<TextField id="grow"><Label>Comment</Label><TextArea {...autosizeProps({ native: true, minRows: 2, maxRows: 6 })} /></TextField>`,
  );
  const html = body(await renderHtml(() => Page()));
  const textarea = /<textarea[^>]*>/.exec(html)?.[0] ?? html;
  assert.match(textarea, /class="cdk-textarea-autosize cdk-textarea-autosize-native"/, textarea);
  assert.match(textarea, /rows="1"/, textarea);
  assert.match(textarea, /style="--cdk-autosize-min-rows:\s?2;\s?--cdk-autosize-max-rows:\s?6;?"/, textarea);
});

// RA useSliderThumb + RAC SliderThumb useSlot: the thumb input names its own label id only while a thumb
// `<Label>` renders (RA re-renders with `label: false`); a slider `<Label>` alone labels every thumb.
test("Slider thumb aria-labelledby points only at rendered labels", async () => {
  const { Page } = await page(
    "fields-ssr-slider.tsx",
    `import { Slider, SliderTrack, SliderThumb } from "@rivetjs/cdk/slider";\nimport { Label } from "@rivetjs/cdk/label";`,
    `<div>
      <Slider id="vol" defaultValue={30}><Label>Volume</Label><SliderTrack><SliderThumb /></SliderTrack></Slider>
      <Slider id="range" defaultValue={[20, 80]}><Label>Range</Label><SliderTrack>
        <SliderThumb index={0}><Label>Min</Label></SliderThumb><SliderThumb index={1}><Label>Max</Label></SliderThumb>
      </SliderTrack></Slider>
    </div>`,
  );
  const html = body(await renderHtml(() => Page()));
  const inputs = [...html.matchAll(/<input[^>]*>/g)].map(([tag]) => tag);
  assert.equal(inputs.length, 3);
  const labelledBy = inputs.map((tag) => /aria-labelledby="([^"]*)"/.exec(tag)?.[1]);
  assert.deepEqual(labelledBy, ["vol-label", "range-label-0-label range-label", "range-label-1-label range-label"]);
  for (const id of labelledBy.flatMap((ids) => ids!.split(" "))) has(html, new RegExp(`<label[^>]* id="${id}"`));
});
