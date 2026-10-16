// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/with-form.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Link } from "@rivetjs/ui/link";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Card: With Form" };

// #region demo
export function WithForm() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <Card class="w-full max-w-md">
      <Card.Header>
        <Card.Title>Login</Card.Title>
        <Card.Description>Enter your credentials to access your account</Card.Description>
      </Card.Header>
      <Form onSubmit={onSubmit}>
        <Card.Content>
          <div class="flex flex-col gap-4">
            <TextField name="email" type="email">
              <Label>Email</Label>
              <Input placeholder="email@example.com" variant="secondary" />
            </TextField>
            <TextField name="password" type="password">
              <Label>Password</Label>
              <Input placeholder="••••••••" variant="secondary" />
            </TextField>
          </div>
        </Card.Content>
        <Card.Footer class="mt-4 flex flex-col gap-2">
          <Button class="w-full" type="submit">
            Sign In
          </Button>
          <Link class="text-center text-sm" href="#">
            Forgot password?
          </Link>
        </Card.Footer>
      </Form>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithForm />
    </div>
  );
}
