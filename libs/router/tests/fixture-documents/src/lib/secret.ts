// A plain helper over a declared server-only virtual module (`rivetRouter({ serverOnly })` in vite.config.ts).
import secret from "virtual:fixture-secret";

export const secretText = (): string => String(secret);
