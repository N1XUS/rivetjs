// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Form } from "@rivetjs/ui/form";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "InputOTP: Form Example" };

// #region demo
export function FormExample() {
  const value = signal("");
  const error = signal("");
  const isSubmitting = signal(false);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    error.set("");

    if (value().length !== 6) {
      error.set("Please enter all 6 digits");

      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      if (value() === "123456") {
        console.log("Code verified successfully!");
        value.set("");
      } else {
        error.set("Invalid code. Please try again.");
      }
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <div class="flex flex-col gap-2">
        <Label>Two-factor authentication</Label>
        <Description>Enter the 6-digit code from your authenticator app</Description>
        <InputOTP isInvalid={!!error()} maxLength={6} value={value} onChange={() => error.set("")}>
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
        <span class="field-error" data-visible={error() ? "true" : "false"} id="code-error">
          {error()}
        </span>
      </div>
      <Button class="w-full" isDisabled={() => value().length !== 6} isPending={isSubmitting} type="submit" variant="primary">
        {isSubmitting() ? (
          <>
            <Spinner color="current" size="sm" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </Button>
      <div class="flex items-center justify-center gap-1">
        <p class="text-sm text-muted">Having trouble?</p>
        <Link class="text-sm text-foreground underline" href="#">
          Use backup code
        </Link>
      </div>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormExample />
    </div>
  );
}
