// Type tests for route server exports (wrapper calls; checked by server-exports.test.ts with strict tsc).
import { actions, entries, guard, headers, load, onGet, type ActionResultOf, type DataOf, type ModuleActions, type ModuleData, type PageProps, type RequestEvent, type Unchecked } from "../index.ts";
import { fail } from "../shared/actions.ts";

declare module "../index.ts" {
  interface RouteParams {
    "items/[id]": { id: string };
  }
}

export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => ({ id: params.id, at: new Date(), tags: new Set(["a"]) }));
export function Page({ data }: PageProps<typeof loader>) {
  const id: string = data.id;
  const at: Date = data.at;
  return <p>{id}{at.getTime()}{data.tags.size}</p>;
}
// Plain data types keep working.
export function Old({ data }: PageProps<{ n: number }>) {
  return <p>{data.n}</p>;
}

// Unannotated events are `RequestEvent` (params `Record<string, string>`).
export const access = guard(({ params, locals }) => (params.anything && locals.user ? undefined : new Response(null, { status: 401 })));
export const GET = onGet(({ url }) => (url.searchParams.has("json") ? Response.json({ ok: true }) : undefined));
export const paths = entries(() => [{ id: "1" }]);
export const responseHeaders = headers(() => ({ "cache-control": "no-store" }));
export const forms = actions({
  save: async ({ params }: RequestEvent<"items/[id]">) => ({ saved: params.id }),
  reject: () => fail(400, { error: "nope" }),
});
export type Saved = ActionResultOf<typeof forms, "save">["result"]["saved"];
export const saved: Saved = "x";

// Generated route types find exports by tag, any name.
type Module = { default: unknown; anything: typeof loader; other: number; forms: typeof forms };
export const moduleData: ModuleData<Module>["id"] = "x";
export type ModuleSave = keyof ModuleActions<Module> & string;
export const name: ModuleSave = "save";
export const noData: ModuleData<{ x: number }> = "unknown is anything";

// A tagged loader is still callable as written.
export const called: Promise<{ id: string }> = loader({} as RequestEvent<"items/[id]">);

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
export const wrongParam = load(({ params }: RequestEvent<"items/[id]">) => params.slug);
// @ts-expect-error actions are functions
export const notActions = actions({ save: 1 });
export type Checked = DataOf<typeof loader>["id"];
