// Type-level suite (`tsc -p libs/ui` only): Input / TextArea / TextField / Form / Fieldset props.
import { Fieldset } from "../src/components/fieldset/index.ts";
import { Form } from "../src/components/form/index.ts";
import { Input } from "../src/components/input/index.ts";
import type { InputProps } from "../src/components/input/index.ts";
import { TextArea } from "../src/components/textarea/index.ts";
import { TextField } from "../src/components/textfield/index.ts";
import type { TextField as TextFieldType } from "../src/components/textfield/index.ts";

export const ok = () => (
  <Form aria-label="x" validationBehavior="aria" onSubmit={(e: Event) => e.preventDefault()}>
    <Fieldset disabled>
      <Fieldset.Legend>Legend</Fieldset.Legend>
      <Fieldset.Group class="g">
        <TextField name="n" variant="secondary" fullWidth isRequired>
          <Input placeholder="p" variant="primary" fullWidth />
          <TextArea rows={4} variant="secondary" />
        </TextField>
      </Fieldset.Group>
      <Fieldset.Actions />
      <Fieldset<"div"> render={(props) => <div {...props} />} />
    </Fieldset>
  </Form>
);

export const props: InputProps = { variant: "secondary" };
export const fieldProps: TextFieldType["Props"] = { variant: "primary" };

// @ts-expect-error bad variant
export const badInput = () => <Input variant="tertiary" />;
// @ts-expect-error bad variant
export const badField = () => <TextField variant="tertiary" />;
