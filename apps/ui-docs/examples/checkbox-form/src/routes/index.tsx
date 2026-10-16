// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/form.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Form Integration" };

// #region demo
export function Form() {
  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    alert(
      `Form submitted with:\n${Array.from(formData.entries())
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")}`,
    );
  };

  return (
    <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div class="flex flex-col gap-3">
        <Checkbox name="notifications" value="on">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Enable notifications
          </Checkbox.Content>
        </Checkbox>
        <Checkbox defaultSelected name="newsletter" value="on">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Subscribe to newsletter
          </Checkbox.Content>
        </Checkbox>
        <Checkbox name="marketing" value="on">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Receive marketing updates
          </Checkbox.Content>
        </Checkbox>
      </div>
      <Button class="mt-4" size="sm" type="submit" variant="primary">
        Submit
      </Button>
    </form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Form />
    </div>
  );
}
