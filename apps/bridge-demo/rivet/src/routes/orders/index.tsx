// Orders: the data table (TanStack Table) + its detail dialog as one React island hydrated on load.
import "@rivetjs/bridge-react/types";
import type { PageProps } from "@rivetjs/router";
import { orders } from "../../../../data.ts";
import { OrdersTable } from "../../../../components/OrdersTable.react.tsx";

export const head = { title: "Orders" };

// Server-only (stands in for a database query): the island's `orders` prop is serialized into the page, as in Next.
export const serverLoad = () => ({ orders });

export default function Orders({ data }: PageProps<typeof serverLoad>) {
  return (
    <main>
      <h1>Orders</h1>
      <OrdersTable client="load" orders={data.orders} />
    </main>
  );
}
