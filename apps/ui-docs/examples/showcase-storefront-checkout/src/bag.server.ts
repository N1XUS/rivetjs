// In-memory shop state for the example (one server process). Server-only: `.server.ts` never reaches the browser.
export type Line = { id: string; name: string; price: number; qty: number };

export const shop = {
  lines: [
    { id: "linen-shirt", name: "Tidewater linen shirt", price: 68, qty: 1 },
    { id: "kiln-mug", name: "Kiln stoneware mug", price: 24, qty: 2 },
  ] as Line[],
  lastOrder: "",
  nextOrder: 20431,
};

/** Postcode areas the (fictional) courier does not serve yet: a check only the server can make. */
export const UNSERVED = ["00000", "99999"];
