import type { LayoutProps } from "@rivetjs/router";
import { customers } from "../customers.server.ts";

// The layout's loader reruns after the submit too: its count updates in place.
export const serverLoad = () => ({ total: customers.length });

export default function Layout({ data, children }: LayoutProps<typeof serverLoad>) {
  return (
    <div class="mx-auto max-w-lg p-4">
      <header class="mb-4 text-sm text-slate-600">
        Acme CRM · <span id="total">{data().total}</span> customers
      </header>
      {children}
    </div>
  );
}
