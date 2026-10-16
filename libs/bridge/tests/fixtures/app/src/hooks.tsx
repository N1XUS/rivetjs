import { useThing } from "./Hooks.fake.js";

// A framework hook used in a browser handler of a Rivet module (RV2146).
export function Hooks() {
  return <button onClick={() => console.log(useThing())}>hook</button>;
}
