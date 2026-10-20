// A plain helper over the declared server-only `virtual:reach-data` (`tests/server-reach.test.ts`).
import data from "virtual:reach-data";

export const cardTitle = (): string => String(data);
