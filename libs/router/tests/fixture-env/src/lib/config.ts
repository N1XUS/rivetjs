// Reads the environment through `@rivetjs/router/env` (server-only): `tests/env.test.ts`.
import { defineEnv } from "@rivetjs/router/env";

const required = {
  "~standard": { version: 1, vendor: "test", validate: (value: unknown) => (typeof value === "string" ? { value } : { issues: [{ message: "Required" }] }) },
} as const;
export const env = defineEnv({ SITE_NAME: required }, { SITE_NAME: "Fixture" });
