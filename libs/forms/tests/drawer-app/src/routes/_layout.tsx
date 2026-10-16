import type { LayoutProps } from "@rivetjs/router";
import { list } from "../customers.server.js";

export const serverLoad = () => ({ total: list().length });

export default function Layout({ data, children }: LayoutProps<typeof serverLoad>) {
  return (
    <main>
      <header>
        <strong>Acme CRM</strong> <span id="total">{data().total}</span> customers
      </header>
      {children}
    </main>
  );
}
