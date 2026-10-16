// Orders: the data table (TanStack Table) + its detail dialog as one client component.
import { orders } from "../../../data.ts";
import { OrdersTable } from "../_client/orders-table.jsx";

export const metadata = { title: "Orders" };

export default function Orders() {
  return (
    <main>
      <h1>Orders</h1>
      <OrdersTable orders={orders} />
    </main>
  );
}
