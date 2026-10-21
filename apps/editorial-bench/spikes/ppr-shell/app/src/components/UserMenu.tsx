import type { User } from "../session.ts";

/** Personalized header part (~0.5 KB): the would-be hole of a shell route. */
export function UserMenu({ user }: { user: User | null }) {
  if (!user)
    return (
      <a class="signin" href="/login/">
        Sign in
      </a>
    );
  return (
    <div class="user" data-user={user.slug}>
      <span class="who">Signed in as {user.name}</span>
      <a class="saved" href="/account/saved/">
        {user.saved} saved
      </a>
      <span class="unread">{user.unread} unread</span>
      <ul class="menu">
        {user.links.map((l) => (
          <li>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
