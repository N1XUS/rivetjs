/** Plain doc-comment text with `inline code` spans (API pages and cards). */
export function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part) => (part.length > 1 && part.startsWith("`") && part.endsWith("`") ? <code>{part.slice(1, -1)}</code> : part))}</>;
}
