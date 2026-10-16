export const Both = ({ props, explicit }: { props: Record<string, unknown>; explicit: () => void }) => <a {...props} ref={explicit} />;
