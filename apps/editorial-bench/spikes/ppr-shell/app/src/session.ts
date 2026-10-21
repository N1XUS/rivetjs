// Session store of the T0 harness: 100 deterministic signed-in visitors, keyed by the `sid` cookie.
import type { RequestEvent } from "@rivetjs/router";

export type User = { name: string; slug: string; saved: number; unread: number; links: { href: string; label: string }[] };
const users = new Map<string, User>();
for (let i = 0; i < 100; i++)
  users.set("s" + i, {
    name: "Reader " + i,
    slug: "reader-" + i,
    saved: (i * 7) % 40,
    unread: (i * 3) % 9,
    links: [
      { href: "/account/", label: "Account" },
      { href: "/account/saved/", label: "Saved articles" },
      { href: "/account/newsletters/", label: "Newsletters" },
      { href: "/account/settings/", label: "Settings" },
      { href: "/logout/", label: "Sign out" },
    ],
  });
/** The signed-in visitor of the request (`sid` cookie), or null. */
export const session = ({ cookies }: RequestEvent): User | null => users.get(cookies.get("sid") ?? "") ?? null;
/** The shell's constant stand-in for the user menu (same markup shape, no request read). */
export const PLACEHOLDER: User = {
  name: "…",
  slug: "",
  saved: 0,
  unread: 0,
  links: users.get("s0")!.links.map((l) => ({ href: "#", label: l.label })),
};
