import type { LayoutProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";
import { listContacts } from "../server/contacts.server.ts";

// The layout's loader reruns after every successful submit too: the count updates in place.
export const loader = load(() => ({ total: listContacts().length }));

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <header class="text-sm text-muted">
        Acme CRM · <span id="total">{data().total}</span> contacts
      </header>
      {children}
    </div>
  );
}
