// Resume symbol registry (ROUTE-CHUNKS placed parts, 2026-10-18): a symbol module the bundler places into a shared
// chunk (route mode: a component module several routes reach) registers its symbols by module id when it evaluates,
// so the runtime resolves `<module>#<symbol>` without depending on the chunk's export names (the bundler minifies the
// exports of non-entry chunks). Route chunks import their part modules for this side effect only.
/** module id → symbol name (the id after `#`) → symbol. */
export const _rSyms: Record<string, Record<string, unknown>> = {};

/** Called by a placed symbol module at evaluation: registers its symbols under its module id. */
export const _rSym = (mod: string, table: Record<string, unknown>): void => {
  _rSyms[mod] = table;
};
