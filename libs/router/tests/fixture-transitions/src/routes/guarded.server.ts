import { redirect, guard } from "@rivetjs/router";

export const access = guard(() => redirect("/plain"));
