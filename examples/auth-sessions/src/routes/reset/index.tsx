import type { PageProps } from "@rivetjs/router";
import { actions, load } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm } from "@rivetjs/forms";
import { FormStatus } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { Mail } from "lucide";
import { resetRequestForm } from "../../forms/auth.ts";
import { requestReset } from "../../server/auth.server.ts";

export const head = { title: "Reset your password" };

export const loader = load(({ url }) => ({ sent: url.searchParams.has("sent") }));
export const forms = actions({ request: action(resetRequestForm, requestReset) });

export default function ResetRequest({ data }: PageProps<typeof loader>) {
  const store = createForm(resetRequestForm, { result: actionResult("request") });
  return (
    <Card class="mx-auto w-full max-w-sm">
      <Card.Header>
        <Card.Title>Reset your password</Card.Title>
        <Card.Description>We send a link that works once, for 30 minutes.</Card.Description>
      </Card.Header>
      <Card.Content>
        {data.sent ? (
          // The same answer whether an account exists or not: the form does not reveal who has one.
          <p id="reset-sent" role="status" class="text-sm">
            If an account uses that email, a reset link is on its way. In this example the mail is printed to the server console.
          </p>
        ) : (
          <Form form={store} definition={resetRequestForm} class="flex flex-col gap-3">
            <TextField id="reset-email" name="email" type="email" label="Email" autoComplete="username" variant="secondary" fullWidth />
            <FormStatus of={store} pending="Sending..." class="text-sm text-danger" />
            <Button id="reset-submit" type="submit" fullWidth>
              <Icon icon={Mail} size={16} /> Send reset link
            </Button>
          </Form>
        )}
      </Card.Content>
    </Card>
  );
}
