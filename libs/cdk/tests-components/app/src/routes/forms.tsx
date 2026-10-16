import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Switch } from "@rivetjs/cdk/switch";
import { RadioGroup } from "@rivetjs/cdk/radio-group";
import { TextField } from "@rivetjs/cdk/text-field";
import { Label } from "@rivetjs/cdk/label";
import { Input } from "@rivetjs/cdk/input";
import { TextArea } from "@rivetjs/cdk/text-area";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";
import { DetailsDisclosure } from "@rivetjs/cdk/disclosure";

export const head = { title: "Form fields" };

const sizes = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
];

export default function FormsStory() {
  const terms = signal(false);
  const wifi = signal(true);
  const size = signal<string | null>("m");
  const name = signal("");
  return (
    <section>
      <h1>Form fields</h1>
      <form method="get" action="/forms">
        <Checkbox id="terms" name="terms" isSelected={terms}>
          Accept terms
        </Checkbox>
        <Switch id="wifi" name="wifi" isSelected={wifi}>
          Wi-Fi
        </Switch>
        <RadioGroup label="Size" name="size" items={sizes} value={size} />
        <TextField id="name" name="name" value={name} isRequired>
          <Label>Name</Label>
          <Input />
          <Text slot="description">As on your passport</Text>
        </TextField>
        <TextField id="email" name="email" type="email" isInvalid>
          <Label>Email</Label>
          <Input />
          <FieldError>Enter an email address</FieldError>
        </TextField>
        <TextField id="bio" name="bio">
          <Label>Bio</Label>
          <TextArea rows={3} />
        </TextField>
        <button type="submit">Send</button>
      </form>
      <p id="forms-value">
        terms={terms() ? "yes" : "no"} wifi={wifi() ? "on" : "off"} size={size() ?? "-"} name={name()}
      </p>
      <DetailsDisclosure id="faq-1" group="faq" title="What is Rivet?" defaultExpanded>
        <p>A compiled, resumable UI framework.</p>
      </DetailsDisclosure>
      <DetailsDisclosure id="faq-2" group="faq" title="Does it need JavaScript?">
        <p>Not for this accordion.</p>
      </DetailsDisclosure>
    </section>
  );
}
