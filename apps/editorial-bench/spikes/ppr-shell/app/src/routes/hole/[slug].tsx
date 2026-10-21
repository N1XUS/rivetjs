import { type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { UserMenu } from "../../components/UserMenu.tsx";
import { session } from "../../session.ts";

// The hole alone (H-holes proxy): pipeline + session loader + the user menu, in an otherwise empty document.
export const loader = load((event: RequestEvent<{ slug: string }>) => ({ user: session(event) }));

export default function Page({ data }: PageProps<typeof loader, { slug: string }>) {
  return <UserMenu user={data.user} />;
}
