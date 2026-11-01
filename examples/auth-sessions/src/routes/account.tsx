import type { PageProps, RequestEvent } from "@rivetjs/router";
import { actions, guard, load, redirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm } from "@rivetjs/forms";
import { FormStatus } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { LogOut, Monitor, X } from "lucide";
import { changePasswordForm } from "../forms/auth.ts";
import { changePassword } from "../server/auth.server.ts";
import { getDb } from "../server/db.server.ts";
import { authOf, deleteSession, deleteUserSessions, endSession, listSessions } from "../server/sessions.server.ts";

export const head = { title: "Your account" };

// Signed-out visitors go to the sign-in page and come back here after it (`next`, checked there by `safeRedirect`).
export const signedIn = guard((event) => {
  if (authOf(event)) return;
  // Signing out of nothing is fine: back to the home page.
  if (event.request.method === "POST" && event.url.search === "?/signout") throw redirect("/", 303);
  throw redirect(`/signin?next=${encodeURIComponent(event.url.pathname + event.url.search)}`, 303);
});

/** Fixed notices by key (`?done=`): a query parameter never reaches the page as text. */
const NOTICES: Record<string, string> = {
  welcome: "Your account is ready. You are signed in.",
  password: "Password changed. Every other session was signed out.",
  others: "Every other session was signed out.",
  revoked: "That session was signed out.",
  reset: "Your new password is set. Every other session was signed out.",
};
/** Server-side formatting (UTC): the same text in the server HTML and the browser. */
const when = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

export const loader = load((event) => {
  const { user, session } = authOf(event)!;
  return {
    user: { name: user.name, email: user.email },
    notice: NOTICES[event.url.searchParams.get("done") ?? ""] ?? null,
    sessions: listSessions(getDb(), user.id).map((s) => ({
      id: s.id,
      current: s.id === session.id,
      device: s.userAgent || "Unknown device",
      ip: s.ip,
      created: when(s.createdAt),
      seen: when(s.lastSeenAt),
    })),
  };
});

const idOf = async (event: RequestEvent) => {
  const raw = (await event.request.formData()).get("id");
  return typeof raw === "string" && /^\d{1,15}$/.test(raw) ? Number(raw) : 0;
};

export const forms = actions({
  signout: (event: RequestEvent) => {
    endSession(event);
    return redirect("/", 303);
  },
  // Only the signed-in user's own sessions: `deleteSession` matches the id AND the user.
  revoke: async (event: RequestEvent) => {
    const { session, user } = authOf(event)!;
    const id = await idOf(event);
    if (id === session.id) {
      endSession(event);
      return redirect("/signin", 303);
    }
    deleteSession(getDb(), user.id, id);
    return redirect("/account?done=revoked", 303);
  },
  others: (event: RequestEvent) => {
    const { session, user } = authOf(event)!;
    deleteUserSessions(getDb(), user.id, session.id);
    return redirect("/account?done=others", 303);
  },
  password: action(changePasswordForm, changePassword),
});

export default function Account({ data }: PageProps<typeof loader>) {
  const store = createForm(changePasswordForm, { result: actionResult("password") });
  return (
    <main class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl font-semibold">{data.user.name}</h1>
        <p class="text-muted">{data.user.email}</p>
      </div>
      {data.notice ? (
        <p id="notice" role="status" class="rounded-xl bg-success-soft px-4 py-3 text-sm text-success-soft-foreground">
          {data.notice}
        </p>
      ) : null}

      <Card>
        <Card.Header>
          <Card.Title>Sessions</Card.Title>
          <Card.Description>Every browser where you are signed in. Sessions end after 30 days without use.</Card.Description>
        </Card.Header>
        <Card.Content>
          <ul id="sessions" class="flex flex-col divide-y divide-separator">
            {data.sessions.map((s) => (
              <li class="flex items-center gap-3 py-3" data-session={String(s.id)} data-current={s.current ? "" : undefined}>
                <Icon icon={Monitor} size={18} />
                <div class="me-auto min-w-0 text-sm">
                  <p class="truncate font-medium">
                    {s.device}
                    {s.current ? <span class="ms-2 text-success">This browser</span> : null}
                  </p>
                  <p class="text-muted">
                    {s.ip || "unknown address"} · signed in {s.created} · last seen {s.seen}
                  </p>
                </div>
                <form method="post" action="?/revoke">
                  <input type="hidden" name="id" value={String(s.id)} />
                  <button
                    class="inline-flex items-center rounded-lg p-1.5 hover:bg-default"
                    aria-label={s.current ? "Sign out this browser" : "Sign out this session"}
                  >
                    <Icon icon={X} size={16} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card.Content>
        <Card.Footer>
          <form method="post" action="?/others">
            <button id="signout-others" class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-danger hover:bg-danger-soft">
              <Icon icon={LogOut} size={16} /> Sign out other sessions
            </button>
          </form>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Change password</Card.Title>
          <Card.Description>Signs out every other session.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Form form={store} definition={changePasswordForm} class="flex flex-col gap-3">
            {/* Lets password managers attach the new password to the right account. */}
            <input type="hidden" name="username" autoComplete="username" value={data.user.email} />
            <TextField
              id="password-current"
              name="current"
              type="password"
              label="Current password"
              autoComplete="current-password"
              variant="secondary"
              fullWidth
            />
            <TextField
              id="password-new"
              name="password"
              type="password"
              label="New password"
              description="At least 10 characters."
              autoComplete="new-password"
              variant="secondary"
              fullWidth
            />
            <FormStatus of={store} pending="Saving..." class="text-sm text-danger" />
            <Button id="password-submit" type="submit">
              Change password
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </main>
  );
}
