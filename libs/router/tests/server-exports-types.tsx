// Type tests for in-file server exports (checked by server-exports.test.ts with strict tsc).
import type { DataOf, PageProps, RequestEvent, Unchecked } from "../index.ts";

declare module "../index.ts" {
  interface RouteParams {
    "items/[id]": { id: string };
  }
}

export const serverLoad = async ({ params }: RequestEvent<"items/[id]">) => ({ id: params.id, at: new Date(), tags: new Set(["a"]) });
export function Page({ data }: PageProps<typeof serverLoad>) {
  const id: string = data.id;
  const at: Date = data.at;
  return <p>{id}{at.getTime()}{data.tags.size}</p>;
}
// Plain data types keep working.
export function Old({ data }: PageProps<{ n: number }>) {
  return <p>{data.n}</p>;
}

const withFunction = () => ({ n: 1, run: () => 1 });
class Model {
  n = 1;
  get(): number {
    return this.n;
  }
}
const withClass = async () => ({ model: new Model() });
export function Bad({ data }: PageProps<typeof withFunction>) {
  // @ts-expect-error functions in loader data are not serializable
  return <p>{data.n}</p>;
}
export function BadClass({ data }: PageProps<typeof withClass>) {
  // @ts-expect-error class instances in loader data are not serializable
  return <p>{data.model.n}</p>;
}
export function Escape({ data }: PageProps<Unchecked<typeof withFunction>>) {
  return <p>{data.run()}</p>;
}

// @ts-expect-error unknown param of the route id
export const wrongParam = ({ params }: RequestEvent<"items/[id]">) => params.slug;
export type Checked = DataOf<typeof serverLoad>["id"];
