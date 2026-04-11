const BeamLines = () => (
  <div className="absolute inset-0 pointer-events-none z-0 flex justify-evenly">
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
  </div>
);

export default BeamLines;
