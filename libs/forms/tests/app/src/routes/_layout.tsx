import type { LayoutProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

// Reads only a cookie (never the URL): the signup action sets it, so the redirect after an enhanced submit must rerun it.
export const loader = load((event) => ({ user: event.cookies.get("forms_user") ?? "" }));

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <main>
      <nav>
        <a href="/">Forms</a> <a href="/signup">Sign up</a> <a href="/wizard">Wizard</a> <a href="/order">Order</a>{" "}
        <span id="who">{data().user || "Guest"}</span>
      </nav>
      {children}
    </main>
  );
}
