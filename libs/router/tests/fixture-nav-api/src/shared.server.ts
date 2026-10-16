// Server-only module: pages may import its types (type-only imports never reach the browser).
export type Secret = { token: string };
export interface Other {
  n: number;
}
export const secret = "nav-api-server-secret";
