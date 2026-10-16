import { redirect, type RequestEvent } from "@rivetjs/router";

export const guard = ({ cookies }: RequestEvent) => (cookies.get("session") ? undefined : redirect("/login?next=/private"));
