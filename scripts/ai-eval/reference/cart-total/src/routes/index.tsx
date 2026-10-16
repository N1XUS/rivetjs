import { computed, signal } from "@rivetjs/reactivity";

export const head = { title: "Cart" };

const products = [
  { name: "Pen", price: 1.5 },
  { name: "Notebook", price: 4 },
  { name: "Bag", price: 25 },
];

export default function Home() {
  const quantities = signal<Record<string, number>>({ Pen: 1, Notebook: 1, Bag: 1 });
  const total = computed(() => products.reduce((sum, product) => sum + product.price * (quantities()[product.name] ?? 0), 0));
  // Formatting happens where it runs: an Intl.NumberFormat instance is not serializable.
  const euros = (value: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
  return (
    <main class="p-6">
      <table>
        <tbody>
          {products.map((product) => (
            <tr>
              <th scope="row">{product.name}</th>
              <td>{euros(product.price)}</td>
              <td>
                <input
                  id={`qty-${product.name.toLowerCase()}`}
                  type="number"
                  min="0"
                  aria-label={`${product.name} quantity`}
                  value={quantities()[product.name]}
                  onInput={(event) => {
                    const value = Math.max(0, Number(event.currentTarget.value) || 0);
                    quantities.update((all) => ({ ...all, [product.name]: value }));
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Total: <strong id="total">{euros(total())}</strong>
      </p>
    </main>
  );
}
