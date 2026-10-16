// An island chunk fetched over the network (resource timing shows when): hydrate-on-change test.
import { Counter, fakeClient } from "../fake-client.ts";
export default Counter;
export const adapter = fakeClient;
