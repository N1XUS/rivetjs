import { load, type RequestEvent, type PageProps } from "@rivetjs/router";
export const loader = load(async ({ url }: RequestEvent) => {
  const user = url.searchParams.get("user") ?? "anonymous";
  await new Promise((r) => setTimeout(r, user.length % 5));
  return { user };
});
export default function Identity({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>Request identity</h1>
      <p>{data.user}</p>
    </main>
  );
}
