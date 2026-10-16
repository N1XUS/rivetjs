// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/switch/form.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

export const head = { title: "Switch: Form Integration" };

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
      <SwitchGroup>
        <Switch name="notifications" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Enable notifications
          </Switch.Content>
        </Switch>
        <Switch defaultSelected name="newsletter" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Subscribe to newsletter
          </Switch.Content>
        </Switch>
        <Switch name="marketing" value="on">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Receive marketing updates
          </Switch.Content>
        </Switch>
      </SwitchGroup>
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
