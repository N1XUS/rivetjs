// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/radio-group/validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "RadioGroup: Validation" };

// #region demo
export function Validation() {
  const message = signal<string | null>(null);

  return (
    <Form
      class="flex flex-col gap-4"
      onSubmit={(e: SubmitEvent) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const value = formData.get("plan-validation");

        message.set(`Your chosen plan is: ${value}`);
      }}
    >
      <RadioGroup isRequired name="plan-validation">
        <Label>Subscription plan</Label>
        <Radio value="starter">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Starter
          </Radio.Content>
          <Description>For side projects and small teams</Description>
        </Radio>
        <Radio value="pro">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Pro
          </Radio.Content>
          <Description>Advanced reporting and analytics</Description>
        </Radio>
        <Radio value="teams">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Teams
          </Radio.Content>
          <Description>Share access with up to 10 teammates</Description>
        </Radio>
        <FieldError>Choose a subscription before continuing.</FieldError>
      </RadioGroup>
      <Button class="mt-2 w-fit" type="submit">
        Submit
      </Button>
      {message() ? <p class="text-sm text-muted">{message()}</p> : null}
    </Form>
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
