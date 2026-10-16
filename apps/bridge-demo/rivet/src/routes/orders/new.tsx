// New order: the react-hook-form + zod form as a React island hydrated on load.
import "@rivetjs/bridge-react/types";
import { OrderForm } from "../../../../components/OrderForm.react.tsx";

export const head = { title: "New order" };

export default function NewOrder() {
  return (
    <main>
      <h1>New order</h1>
      <OrderForm client="load" />
    </main>
  );
}
