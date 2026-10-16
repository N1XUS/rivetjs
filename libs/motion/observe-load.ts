// Loads `observe.ts` (Motion's `inView`) for a `whileInView` element (element.tsx): the dynamic import sits in this
// module, so it resolves next to it wherever the calling handler's code is emitted (resume symbol chunks).
export const loadInView = (): Promise<typeof import("./observe.ts")> => import("./observe.ts");
