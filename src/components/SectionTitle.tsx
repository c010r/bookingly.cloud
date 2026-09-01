export default function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="my-9 flex items-center gap-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-faint">
      <span className="text-neon">##</span>
      <span className="caret">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
    </h2>
  );
}
