import { load, type PageProps } from "@rivetjs/router";
import { Async } from "@rivetjs/runtime/dom";

// Deferred loaders cannot set headers or cookies (the head is out): TypeError at the call.
export const loader = load(
  ({ setHeader, cookies }) => {
    const errors: string[] = [];
    for (const write of [() => setHeader("x-late", "1"), () => cookies.set("late", "1")])
      try {
        write();
      } catch (error) {
        errors.push((error as Error).name + ": " + (error as Error).message);
      }
    return { errors, user: cookies.get("user") ?? "none" };
  },
  { defer: true },
);

export default function Late({ data }: PageProps<typeof loader>) {
  return (
    <Async load={() => data} fallback={() => <p>…</p>}>
      {(value) => (
        <ul id="late">
          <li id="late-user">{value.user}</li>
          {value.errors.map((e) => (
            <li class="late-error">{e}</li>
          ))}
        </ul>
      )}
    </Async>
  );
}
