// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-otp/on-complete.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "InputOTP: On Complete" };

// #region demo
export function OnComplete() {
  const value = signal("");
  const isComplete = signal(false);
  const isSubmitting = signal(false);

  const handleComplete = (code: string) => {
    isComplete.set(true);

    console.log("Code complete:", code);
  };

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    isSubmitting.set(true);
    // Simulate API call
    setTimeout(() => {
      isSubmitting.set(false);
      value.set("");
      isComplete.set(false);
    }, 2000);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-2" onSubmit={handleSubmit}>
      <Label>Verify account</Label>
      <InputOTP maxLength={6} value={value} onComplete={handleComplete} onChange={() => isComplete.set(false)}>
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
      <Button class="mt-2 w-full" isDisabled={() => !isComplete()} isPending={isSubmitting} type="submit" variant="primary">
        {isSubmitting() ? (
          <>
            <Spinner color="current" size="sm" />
            Verifying...
          </>
        ) : (
          "Verify Code"
        )}
      </Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnComplete />
    </div>
  );
}
