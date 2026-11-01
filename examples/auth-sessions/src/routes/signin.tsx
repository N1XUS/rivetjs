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
import { LogIn } from "lucide";
import { signInForm } from "../forms/auth.ts";
import { signIn } from "../server/auth.server.ts";
import { authOf } from "../server/sessions.server.ts";

export const head = { title: "Sign in" };

/** `?next=` is user input: only a same-origin path survives `safeRedirect` (anything else → /account). */
const nextOf = (event: RequestEvent) => safeRedirect(event.url.searchParams.get("next"), "/account");

// Signed in already: the page sends you on. A POST still runs (it rotates the session), so a planted session cookie
// never survives a sign-in.
export const signedOut = guard((event) => {
  if (authOf(event) && event.request.method === "GET") throw redirect(nextOf(event), 303);
});
export const loader = load((event) => ({ next: nextOf(event) }));
export const forms = actions({ signin: action(signInForm, signIn) });

export default function SignIn({ data }: PageProps<typeof loader>) {
  const result = actionResult("signin");
  const store = createForm(signInForm, { result });
  // A failed POST without JavaScript renders this page for `/signin?/signin`: `next` comes back in the echo.
  const next = ((result?.result as FormReply | undefined)?.values?.next as string | undefined) ?? data.next;
  return (
    <Card class="mx-auto w-full max-w-sm">
      <Card.Header>
        <Card.Title>Sign in</Card.Title>
      </Card.Header>
      <Card.Content>
        <Form form={store} definition={signInForm} class="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <TextField id="signin-email" name="email" type="email" label="Email" autoComplete="username" variant="secondary" fullWidth />
          <TextField id="signin-password" name="password" type="password" label="Password" autoComplete="current-password" variant="secondary" fullWidth />
          <FormStatus of={store} pending="Signing in..." class="text-sm text-danger" />
          <Button id="signin-submit" type="submit" fullWidth>
            <Icon icon={LogIn} size={16} /> Sign in
          </Button>
        </Form>
      </Card.Content>
      <Card.Footer class="flex justify-between text-sm">
        <a href="/reset" class="text-accent underline">
          Forgot your password?
        </a>
        <a href={next === "/account" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} class="text-accent underline">
          Create an account
        </a>
      </Card.Footer>
    </Card>
  );
}
