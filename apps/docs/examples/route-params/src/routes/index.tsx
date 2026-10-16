export const head = { title: "Route params" };

export default function Home() {
  return (
    <section class="p-4">
      <h1 class="text-xl font-semibold">Route params</h1>
      <ul class="mt-2 list-disc pl-5">
        <li>
          <a class="text-teal-700 underline" href="/items/1">
            /items/1
          </a>
        </li>
        <li>
          <a class="text-teal-700 underline" href="/items/hello%20world">
            /items/hello%20world
          </a>
        </li>
        <li>
          <a class="text-teal-700 underline" href="/docs/guide/intro">
            /docs/guide/intro
          </a>
        </li>
      </ul>
    </section>
  );
}
