// New order: the react-hook-form + zod form as a client component.
import { OrderForm } from "../../_client/order-form.jsx";

export const metadata = { title: "New order" };

export default function NewOrder() {
  return (
    <main>
      <h1>New order</h1>
      <OrderForm />
    </main>
  );
}
