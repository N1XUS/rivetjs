import { cardTitle } from "../lib/data.ts";

// A component reaching a server-only module: RV3011 for every client-navigated page rendering it.
export function Card() {
  return <p class="card">{cardTitle()}</p>;
}
