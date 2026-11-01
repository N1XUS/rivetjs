import type { PageProps, RequestEvent } from "@rivetjs/router";
import { actions, guard, load, redirect, safeRedirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, type FormReply } from "@rivetjs/forms";
import { FormStatus } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { UserPlus } from "lucide";
import { signUpForm } from "../forms/auth.ts";
import { signUp } from "../server/auth.server.ts";
import { authOf } from "../server/sessions.server.ts";

export const head = { title: "Sign up" };

const nextOf = (event: RequestEvent) => safeRedirect(event.url.searchParams.get("next"), "/account?done=welcome");

// Signed in already: the page sends you on. A POST still runs (it rotates the session), so a planted session cookie
// never survives a sign-in.
export const signedOut = guard((event) => {
  if (authOf(event) && event.request.method === "GET") throw redirect(nextOf(event), 303);
});
export const loader = load((event) => ({ next: nextOf(event) }));
export const forms = actions({ signup: action(signUpForm, signUp) });

export default function SignUp({ data }: PageProps<typeof loader>) {
  const result = actionResult("signup");
  const store = createForm(signUpForm, { result });
  const next = ((result?.result as FormReply | undefined)?.values?.next as string | undefined) ?? data.next;
  return (
    <Card class="mx-auto w-full max-w-sm">
      <Card.Header>
        <Card.Title>Create an account</Card.Title>
      </Card.Header>
      <Card.Content>
        <Form form={store} definition={signUpForm} class="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <TextField id="signup-name" name="name" label="Name" autoComplete="name" variant="secondary" fullWidth />
          <TextField id="signup-email" name="email" type="email" label="Email" autoComplete="username" variant="secondary" fullWidth />
          <TextField
            id="signup-password"
            name="password"
            type="password"
            label="Password"
            description="At least 10 characters."
            autoComplete="new-password"
            variant="secondary"
            fullWidth
          />
          <FormStatus of={store} pending="Creating your account..." class="text-sm text-danger" />
          <Button id="signup-submit" type="submit" fullWidth>
            <Icon icon={UserPlus} size={16} /> Create account
          </Button>
        </Form>
      </Card.Content>
      <Card.Footer class="text-sm">
        <a href="/signin" class="text-accent underline">
          Already have an account? Sign in
        </a>
      </Card.Footer>
    </Card>
  );
}
