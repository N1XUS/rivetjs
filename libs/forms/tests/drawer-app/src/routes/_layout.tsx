import type { LayoutProps } from "@rivetjs/router";
import { list } from "../customers.server.js";
import { load } from "@rivetjs/router";

export const loader = load(() => ({ total: list().length }));

export default function Layout({ data, children }: LayoutProps<typeof loader>) {
  return (
    <main>
      <header>
        <strong>Acme CRM</strong> <span id="total">{data().total}</span> customers
      </header>
      {children}
    </main>
  );
}
