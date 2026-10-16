// A class with a true `#private` field and no reviver, captured by a handler: the compiler refuses the module (D-priv;
// tests/serialize-and-revive.test.ts failure case — `importResume` rejects with the compile diagnostic).
export class Secret {
  #c: number;
  constructor(c: number) {
    this.#c = c;
  }
  cents() {
    return this.#c;
  }
}
export function Page() {
  const secret = new Secret(1);
  return <button onClick={() => secret.cents()}>x</button>;
}
