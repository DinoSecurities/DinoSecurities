import BeamLines from "./BeamLines";

const FramingLines = () => (
  <div className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-7xl border-x border-border pointer-events-none z-0 flex justify-evenly">
    {[0, 1, 2].map((i) => (
      <div key={i} className="w-px h-full bg-foreground/[0.03] relative overflow-hidden">
        <div
          className="beam-line"
          style={{
            animationDuration: `${3 + i * 1.5}s`,
            animationDelay: `${i * 0.7}s`,
          }}
        />
      </div>
    ))}
    {/* Corner dots */}
    {["top-0 left-0 -translate-x-1/2 -translate-y-1/2", "top-0 right-0 translate-x-1/2 -translate-y-1/2", "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", "bottom-0 right-0 translate-x-1/2 translate-y-1/2"].map((pos) => (
      <div key={pos} className={`absolute ${pos} w-1.5 h-1.5 bg-background`} style={{ border: "1px solid rgba(255,255,255,0.2)" }} />
    ))}
  </div>
);

export default FramingLines;
