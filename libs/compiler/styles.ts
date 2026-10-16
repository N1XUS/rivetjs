// Scoped class naming shared by css`` blocks (compiled in Rust, `styles.rs`) and `*.module.<ext>`
// stylesheets (Vite CSS modules): FNV-1a 64 over `scope \0 local`, base36.

export type ClassNames = "readable" | "short";

const encoder = new TextEncoder();
const MASK = (1n << 64n) - 1n;

/** FNV-1a 64 of `scope`, NUL, `local` (UTF-8): same value as the compiler's `styles::hash`. */
export function scopeHash(scope: string, local: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (const byte of [...encoder.encode(scope), 0, ...encoder.encode(local)]) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & MASK;
  }
  return h;
}

const base36 = (n: bigint, length: number) => {
  let out = "";
  for (let i = 0; i < length; i++) {
    out = "0123456789abcdefghijklmnopqrstuvwxyz"[Number(n % 36n)] + out;
    n /= 36n;
  }
  return out;
};

/** Scoped class name: `r<hash6>` (short) or `<local>_<hash5>` (readable). */
export function scopedName(scope: string, local: string, names: ClassNames): string {
  const h = scopeHash(scope, local);
  if (names === "short") return "r" + base36(h, 6);
  let readable = [...local].map((c) => (/[A-Za-z0-9_-]/.test(c) || c.charCodeAt(0) > 0x7f ? c : "_")).join("");
  if (!/^[A-Za-z_\u0080-￿]/.test(readable)) readable = "_" + readable;
  return `${readable}_${base36(h, 5)}`;
}

/** Build-wide registry: a scoped name must map to one (scope, local) pair. */
export function nameRegistry() {
  const owners = new Map<string, string>();
  return {
    /** Record a module's names; returns a collision message, if any. */
    add(scope: string, classes: Readonly<Record<string, string>>): string | undefined {
      for (const [local, name] of Object.entries(classes)) {
        const owner = scope + "\0" + local;
        const existing = owners.get(name);
        if (existing === undefined) owners.set(name, owner);
        else if (existing !== owner) {
          const [otherScope, otherLocal] = existing.split("\0");
          return `scoped class name collision: "${name}" for ${scope} .${local} and ${otherScope} .${otherLocal}; rename one class`;
        }
      }
      return undefined;
    },
    clear: () => owners.clear(),
  };
}
