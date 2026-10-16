// Port of the Angular CDK docs example "copy-list" (angular/angular adev/src/content/examples/drag-drop/src/copy-list), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { copyArrayItem, Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Copying items between lists" };

// #region demo
const PRODUCTS = ["Bananas", "Oranges", "Bread", "Butter", "Soda", "Eggs"];

export default function DragDropCopyList() {
  const cart = signal(["Tomatoes"]);
  return (
    <>
      <div class="example-container">
        <h2>Products</h2>
        <DropList id="products" data="products" connectedTo={["cart"]} sortingDisabled hasAnchor class="example-list">
          {PRODUCTS.map((product) => (
            <Drag id={product.toLowerCase()} class="example-box" data={product}>
              {product}
            </Drag>
          ))}
        </DropList>
      </div>
      <div class="example-container">
        <h2>Shopping cart</h2>
        <DropList
          id="cart"
          data="cart"
          class="example-list"
          onDropped={(event) => {
            const next = cart().slice();
            if (event.previousContainer === event.container) moveItemInArray(next, event.previousIndex, event.currentIndex);
            else copyArrayItem(PRODUCTS, next, event.previousIndex, event.currentIndex);
            cart.set(next);
          }}
        >
          <For each={cart} by={(_, index) => index}>
            {(product) => <Drag class="example-box">{product()}</Drag>}
          </For>
        </DropList>
      </div>
    </>
  );
}
// #endregion
