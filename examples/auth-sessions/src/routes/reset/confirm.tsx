import type { PageProps } from "@rivetjs/router";
import { actions, headers, load } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, type FormReply } from "@rivetjs/forms";
import { FormStatus } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { resetConfirmForm } from "../../forms/auth.ts";
import { confirmReset } from "../../server/auth.server.ts";
import { getDb } from "../../server/db.server.ts";
import { resetTokenValid } from "../../server/users.server.ts";

export const head = { title: "Choose a new password" };

// The token is in the URL: the root layout's `Referrer-Policy: same-origin` keeps it out of Referer headers to other
// sites (not `no-referrer`: then the browser sends `Origin: null` with the form POST and the CSRF check refuses it).
// The page is never stored.
export const privacy = headers(() => ({ "cache-control": "no-store" }));

export const loader = load(({ url }) => {
  const token = url.searchParams.get("token") ?? "";
  return { token, valid: resetTokenValid(getDb(), token) };
});
export const forms = actions({ reset: action(resetConfirmForm, confirmReset) });

export default function ResetConfirm({ data }: PageProps<typeof loader>) {
  const result = actionResult("reset");
  const store = createForm(resetConfirmForm, { result });
  // A failed POST renders this page without its query (`?/reset&token=…` is the action URL): the token comes back in
  // the echo then.
  const token = ((result?.result as FormReply | undefined)?.values?.token as string | undefined) ?? data.token;
  return (
    <Card class="mx-auto w-full max-w-sm">
      <Card.Header>
        <Card.Title>Choose a new password</Card.Title>
      </Card.Header>
      <Card.Content>
        {data.valid || result ? (
          // The action URL keeps the token in the address bar after a failed POST (a reload shows the form again).
          <Form form={store} definition={resetConfirmForm} action={`?/reset&token=${encodeURIComponent(token)}`} class="flex flex-col gap-3">
            <input type="hidden" name="token" value={token} />
            <TextField
              id="reset-password"
              name="password"
              type="password"
              label="New password"
              description="At least 10 characters. Every session is signed out."
              autoComplete="new-password"
              variant="secondary"
              fullWidth
            />
            <FormStatus of={store} pending="Saving..." class="text-sm text-danger" />
            <Button id="reset-confirm" type="submit" fullWidth>
              Set new password
            </Button>
          </Form>
        ) : (
          <p id="reset-invalid" role="alert" class="text-sm">
            This reset link is invalid, used or expired.{" "}
            <a href="/reset" class="text-accent underline">
              Ask for a new one
            </a>
            .
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
