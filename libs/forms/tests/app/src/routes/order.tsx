import { For } from "@rivetjs/runtime/dom";
import { redirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, defaultValue, formId, isInvalid, issueText, onBlur, onInput, onSubmit } from "@rivetjs/forms";
import { keys, insertIntent, removeIntent } from "@rivetjs/forms/array";
import { ErrorSummary } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { orderForm } from "../forms/definitions.js";

export const head = { title: "Order" };

export const serverActions = {
  order: action(orderForm, () => redirect("/welcome")),
};

/** Field array: rows keyed for `For`; add/remove are intent buttons (browser-applied, server-applied without JS). */
export default function OrderPage() {
  const form = createForm(orderForm, { result: actionResult(), initial: { items: [{ sku: "", qty: 1 }] } });
  return (
    <section>
      <h1>Order</h1>
      <form
        id={formId(form)}
        method="post"
        action="?/order"
        class="stack"
        onInput={(e) => onInput(orderForm, form, e)}
        onFocusOut={(e) => onBlur(orderForm, form, e)}
        onSubmit={(e) => onSubmit(orderForm, form, e)}
      >
        <ErrorSummary of={form} class="summary" />
        {/* Defaults by row key (server rows are keyed by their index; new rows have none), so a
            row that moves keeps what the user typed. */}
        <ol id="order-rows">
          <For each={() => keys(form, "items")} by={(key) => key}>
            {(key, index) => (
              <li class="row">
                <input name={`items.${index()}.sku`} aria-label={`Product code ${index() + 1}`} class="input" value={defaultValue(form, `items.${key()}.sku` as never)} aria-invalid={isInvalid(form, `items.${index()}.sku` as never)} />
                <input name={`items.${index()}.qty`} aria-label={`Quantity ${index() + 1}`} type="number" class="input" value={defaultValue(form, `items.${key()}.qty` as never) ?? "1"} aria-invalid={isInvalid(form, `items.${index()}.qty` as never)} />
                <button type="submit" name="_intent" value={removeIntent("items", index())} formNoValidate>
                  Remove {index() + 1}
                </button>
                <p class="error">{issueText(form, `items.${index()}.sku` as never) ?? issueText(form, `items.${index()}.qty` as never) ?? ""}</p>
              </li>
            )}
          </For>
        </ol>
        <button id="order-add" type="submit" name="_intent" value={insertIntent("items")} formNoValidate>
          Add line
        </button>
        <button id="order-submit" type="submit" class="button">
          Place order
        </button>
      </form>
    </section>
  );
}
