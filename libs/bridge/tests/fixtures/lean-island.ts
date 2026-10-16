// An island chunk the lean boot imports by URL (T7b): the fake Counter + its client adapter.
import { Counter, fakeClient } from "../fake-client.ts";
export default Counter;
export const adapter = fakeClient;
