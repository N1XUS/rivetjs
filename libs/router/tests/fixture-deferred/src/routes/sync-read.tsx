import { load, type PageProps } from "@rivetjs/router";

// Bug on purpose: reads deferred data synchronously (dev: DeferredDataError).
export const loader = load(() => ({ title: "x" }), { defer: true });

export default function SyncRead({ data }: PageProps<typeof loader>) {
  return <h1 id="sync-read">{(data as unknown as { title: string }).title}</h1>;
}
