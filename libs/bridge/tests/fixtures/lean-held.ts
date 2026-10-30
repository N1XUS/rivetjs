import { Counter, fakeClient } from "../fake-client.ts";
export default Counter;
export const pending = { release: undefined as (() => void) | undefined };
export const adapter = {
  ...fakeClient,
  async hydrate(...args: Parameters<typeof fakeClient.hydrate>) {
    const handle = fakeClient.hydrate(...args);
    await new Promise<void>((resolve) => {
      pending.release = resolve;
    });
    return handle;
  },
};
