import { signal } from "@rivetjs/reactivity";
import {
  coerceAccessor,
  coerceArray,
  coerceBooleanProperty,
  coerceCssPixelValue,
  coerceElement,
  coerceNumberProperty,
  coerceStringArray,
} from "@rivetjs/cdk/coercion";

export const head = { title: "Coercion" };

// #region demo
export default function Coercion() {
  const raw = signal("false");
  // Pure and server-safe: the same results in server HTML and in the browser.
  const rows = (): [string, string][] => {
    const value = raw();
    const asNumber = Number(value);
    return [
      ["coerceBooleanProperty(value)", JSON.stringify(coerceBooleanProperty(value))],
      ["coerceNumberProperty(value)", JSON.stringify(coerceNumberProperty(value))],
      ['coerceNumberProperty(value, "n/a")', JSON.stringify(coerceNumberProperty(value, "n/a"))],
      ["coerceCssPixelValue(value)", JSON.stringify(coerceCssPixelValue(value))],
      ["coerceCssPixelValue(Number(value))", JSON.stringify(coerceCssPixelValue(Number.isNaN(asNumber) ? null : asNumber))],
      ["coerceStringArray(value)", JSON.stringify(coerceStringArray(value))],
      ['coerceStringArray(value, ",")', JSON.stringify(coerceStringArray(value, ","))],
      ["coerceArray(value)", JSON.stringify(coerceArray(value))],
      ["coerceAccessor(value)()", JSON.stringify(coerceAccessor(value)())],
      ["coerceElement(() => value)", JSON.stringify(coerceElement(() => value))],
    ];
  };
  return (
    <section class="m-4 grid max-w-xl gap-2 text-sm">
      <label class="grid gap-1">
        Value (a string, as from an attribute)
        <input id="value" class="rounded border border-slate-300 px-2 py-1 font-mono" value={raw()} onInput={(event) => raw.set(event.currentTarget.value)} />
      </label>
      <table class="text-left font-mono text-xs">
        <tbody>
          {rows().map(([call, result], i) => (
            <tr id={`row-${i}`}>
              <th scope="row" class="py-0.5 pe-4 font-normal text-slate-600">
                {call}
              </th>
              <td>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
// #endregion
