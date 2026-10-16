let count = 0;
export const load = () => ({ count });
export const actions = { inc: () => ({ count: ++count }) };
