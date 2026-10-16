import { createVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf } from "@rivetjs/cdk/scrolling";
import "@rivetjs/cdk/scrolling.css";

export const head = { title: "Virtual scroll: table rows" };

const orders = Array.from({ length: 2000 }, (_, i) => ({ id: `o-${i}`, number: i, customer: `Customer ${(i * 7) % 97}`, total: ((i * 37) % 500) + 0.99 }));

// #region demo
export default function Orders() {
  const state = createVirtualScroll({ id: "orders", items: orders, itemSize: 36, initialViewportSize: 240 });
  return (
    <CdkVirtualScrollViewport state={state} class="viewport" label="Orders">
      <table>
        <tbody>
          <CdkVirtualForOf state={state} trackBy={(_, order) => order.id}>
            {(order) => (
              <tr data-id={order().id}>
                <td class="num">{order().number}</td>
                <td>{order().customer}</td>
                <td class="num">{order().total.toFixed(2)}</td>
              </tr>
            )}
          </CdkVirtualForOf>
        </tbody>
      </table>
    </CdkVirtualScrollViewport>
  );
}
// #endregion
