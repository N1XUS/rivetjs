import { Disclosure } from "../components/Disclosure.tsx";

export const head = { title: "FAQ" };

export default function Home() {
  return (
    <main class="p-6">
      <Disclosure id="shipping" title="Shipping">
        <p>Ships in 2 days</p>
      </Disclosure>
      <Disclosure id="returns" title="Returns">
        <p>30 days to return</p>
      </Disclosure>
    </main>
  );
}
