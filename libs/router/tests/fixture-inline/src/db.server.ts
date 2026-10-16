// Server-only module: never part of a browser bundle (the e2e test scans the client output for this).
export const SECRET = "inline-fixture-secret-token";
export const items: Record<string, { title: string }> = { a: { title: "Alpha" }, b: { title: "Beta" } };
