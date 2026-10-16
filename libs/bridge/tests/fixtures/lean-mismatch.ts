// An island chunk whose component always mismatches on hydrate (lean boot recovery test).
import { Mismatch, fakeClient } from "../fake-client.ts";
export default Mismatch;
export const adapter = fakeClient;
