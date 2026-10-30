const gates = new Map<string, () => void>();
export const wait = (key: string) => new Promise<void>((done) => gates.set(key, done));
export const release = (key: string) => {
  gates.get(key)?.();
  gates.delete(key);
};
