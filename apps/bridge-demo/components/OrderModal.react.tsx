/** @jsxImportSource react */
// Order detail dialog (Radix Dialog: portal, focus trap, Escape / overlay close), opened by a table row click.
import * as Dialog from "@radix-ui/react-dialog";
import type { Order } from "../data.ts";

export function OrderModal(props: { order: Order | null; onClose: () => void }) {
  const order = props.order;
  return (
    <Dialog.Root open={order !== null} onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="dialog" id="order-dialog">
          {order ? (
            <>
              <Dialog.Title>{order.id}</Dialog.Title>
              <Dialog.Description>
                {order.customer} &lt;{order.email}&gt;
              </Dialog.Description>
              <dl>
                <dt>Status</dt>
                <dd>{order.status}</dd>
                <dt>Items</dt>
                <dd>{order.items}</dd>
                <dt>Total</dt>
                <dd>${order.total.toFixed(2)}</dd>
                <dt>Date</dt>
                <dd>{order.date}</dd>
              </dl>
              <Dialog.Close className="close" id="dialog-close">
                Close
              </Dialog.Close>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
