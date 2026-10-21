import { guard, load, redirect, type PageProps, type RequestEvent } from "@rivetjs/router";

// Guards run on shell hits too: anonymous visitors are redirected before the stored shell goes out.
export const access = guard(({ locals }: RequestEvent) => (locals.user ? undefined : redirect("/other")));
export const loader = load(() => ({ note: "members only" }));

export default function Private({ data }: PageProps<typeof loader>) {
  return <p id="note">{data.note}</p>;
}
