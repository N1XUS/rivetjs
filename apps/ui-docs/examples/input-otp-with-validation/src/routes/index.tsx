// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/with-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Form } from "@rivetjs/ui/form";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "InputOTP: With Validation" };

// #region demo
export function WithValidation() {
  const value = signal("");
  const isInvalid = signal(false);

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const code = formData.get("code");

    if (code !== "123456") {
      isInvalid.set(true);

      return;
    }

    isInvalid.set(false);
    value.set("");

    alert("Code verified successfully!");
  };

  return (
    <div class="flex w-[280px] flex-col gap-2">
      <Form class="flex flex-col gap-2" onSubmit={onSubmit}>
        <Label>Verify account</Label>
        <Description>Hint: The code is 123456</Description>
        <InputOTP
          aria-describedby={isInvalid() ? "code-error" : undefined}
          isInvalid={isInvalid()}
          maxLength={6}
          name="code"
          value={value}
          onChange={() => isInvalid.set(false)}
        >
          <InputOTP.Group>
            <InputOTP.Slot index={0} />
            <InputOTP.Slot index={1} />
            <InputOTP.Slot index={2} />
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            <InputOTP.Slot index={3} />
            <InputOTP.Slot index={4} />
            <InputOTP.Slot index={5} />
          </InputOTP.Group>
        </InputOTP>
        <span class="field-error" data-visible={isInvalid() ? "true" : "false"} id="code-error">
          Invalid code. Please try again.
        </span>
        <Button isDisabled={() => value().length !== 6} type="submit">
          Submit
        </Button>
      </Form>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithValidation />
    </div>
  );
}
