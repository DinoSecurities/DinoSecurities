import { ReactNode } from "react";
import BeamLines from "./BeamLines";

const SectionWrapper = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`z-10 bg-background/80 w-full max-w-7xl border-border border mx-auto py-32 px-8 relative backdrop-blur-sm ${className}`}>
    <BeamLines />
    <div className="relative z-10">{children}</div>
  </section>
);

export default SectionWrapper;
