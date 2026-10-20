import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
import { createServerServices } from "../services/server.js";
import { load } from "@rivetjs/router";

export const head = { title: "Rivet playground" };

/** Example list; the filter runs in the browser once the page resumes. */
export const loader = load(({ signal }: RequestEvent) => createServerServices().list(signal));

export default function Home({ data }: PageProps<typeof loader>) {
  const items = data;
  const query = signal("");
  return (
    <section aria-labelledby="examples-title">
      <h1 id="examples-title" class="text-2xl font-semibold">
        Explore the examples
      </h1>
      <label for="filter" class="mt-5 block text-sm font-medium">
        Filter examples
      </label>
      <input
        id="filter"
        class="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        type="search"
        model:value={query}
        placeholder="Search by title"
      />
      <ul id="examples" class="mt-5 grid gap-3">
        <For each={() => items.filter((item) => item.title.toLowerCase().includes(query().toLowerCase()))} by={(item) => item.id}>
          {(item) => (
            <li class="rounded-xl border border-slate-200 bg-white p-5">
              <Link class="font-semibold text-teal-700 underline underline-offset-4" to={`/items/${encodeURIComponent(item().id)}`}>
                {/* Shared element: morphs into the item page title. */}
                <span data-vt-name={"item-" + item().id}>{item().title}</span>
              </Link>
              <p class="mt-2 text-sm leading-6 text-slate-600">{item().description}</p>
            </li>
          )}
        </For>
      </ul>
      <p class="mt-6 text-sm">
        <Link class="text-teal-700 underline underline-offset-4" to="/resume">
          Resumed demo page
        </Link>
      </p>
    </section>
  );
}
