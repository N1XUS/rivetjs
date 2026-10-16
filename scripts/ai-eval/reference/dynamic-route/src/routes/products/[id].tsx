import { notFound, type PageProps, type RequestEvent } from "@rivetjs/router";

// Server-only: used by serverLoad alone, so it is removed from the browser build.
const products = [
  { id: "1", name: "Chair", price: 49 },
  { id: "2", name: "Lamp", price: 19 },
];

export const serverLoad = ({ params }: RequestEvent<"products/[id]">) => {
  const product = products.find((p) => p.id === params.id);
  if (!product) throw notFound();
  return { product };
};

export const head = ({ data }: { data: { product: { name: string } } }) => ({ title: data.product.name });

export default function Product({ data }: PageProps<"products/[id]">) {
  return (
    <main class="p-6">
      <h1 class="text-2xl font-bold">{data.product.name}</h1>
      <p id="price">${data.product.price}</p>
    </main>
  );
}
