import { redirect, type RequestEvent, guard } from "@rivetjs/router";

export const access = guard(({ cookies }: RequestEvent) => (cookies.get("session") ? undefined : redirect("/login?next=/private")));
