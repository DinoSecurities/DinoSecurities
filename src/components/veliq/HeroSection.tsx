import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, ArrowRight } from "lucide-react";

const HeroSection = () => {
  const bgRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const container = bgRef.current;
    if (!container) return;

    const numBars = window.innerWidth > 768 ? 41 : 21;
    const centerIndex = Math.floor(numBars / 2);

    interface Bar {
      element: HTMLDivElement;
      baseTop: number;
      phase: number;
    }

    const bars: Bar[] = [];
    container.innerHTML = "";

    for (let i = 0; i < numBars; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "flex-1 h-full relative border-r border-foreground/5 last:border-0 overflow-hidden";

      const distance = Math.abs(i - centerIndex);
      const baseTop = 30 + distance * (window.innerWidth > 768 ? 2.5 : 4);

      const glow = document.createElement("div");
      glow.className = "absolute w-full left-0 right-0";
      glow.style.height = "1200px";
      glow.style.top = `${baseTop}%`;
      glow.style.background =
        "linear-gradient(to bottom, hsl(0 0% 1.2%) 0%, rgba(139,92,246,0.7) 10%, rgba(255,255,255,0.9) 15%, rgba(99,102,241,0.8) 25%, hsl(0 0% 1.2%) 45%)";
      glow.style.filter = "blur(4px)";

      wrapper.appendChild(glow);
      container.appendChild(wrapper);
      bars.push({ element: glow, baseTop: baseTop, phase: distance * 0.2 });
    }

    let time = 0;
    let raf: number;
    const animate = () => {
      time += 0.02;
      bars.forEach((bar) => {
        const wave = Math.sin(time + bar.phase) * 3;
        bar.element.style.top = `${bar.baseTop + wave}%`;
      });
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="flex flex-col w-full h-[800px] max-w-7xl border-border border-t border-b mx-auto pt-40 pb-12 relative items-center justify-start">
      <div
        ref={bgRef}
        className="absolute inset-0 z-0 flex w-full h-full overflow-hidden opacity-90 pointer-events-none"
        style={{
          maskImage: "linear-gradient(transparent 10%, black 50%, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(transparent 10%, black 50%, black 90%, transparent 100%)",
        }}
      />

      <div className="relative z-20 flex w-full max-w-3xl flex-col items-center mx-auto mt-12 py-12 px-6">
        {/* Corner brackets */}
        <div className="pointer-events-none absolute top-0 left-0 h-6 w-6 border-l border-t border-foreground/20" />
        <div className="pointer-events-none absolute top-0 right-0 h-6 w-6 border-r border-t border-foreground/20" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-6 w-6 border-b border-l border-foreground/20" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-6 w-6 border-b border-r border-foreground/20" />

        <motion.h1
          className="mb-6 text-center text-5xl font-light leading-[1.1] tracking-tighter drop-shadow-2xl md:text-6xl lg:text-7xl"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="font-medium text-transparent bg-clip-text bg-gradient-to-br from-foreground to-muted-foreground">
            Tokenized
          </span>
          <br className="hidden sm:block" />
          <span className="text-foreground"> Securities.</span>
          <br />
          <span className="text-muted-foreground">On Solana.</span>
        </motion.h1>

        <motion.p
          className="mb-10 max-w-2xl text-center text-base leading-relaxed text-muted-foreground md:text-lg text-balance"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          Issue, manage, trade, and govern legally enforceable security tokens with on-chain compliance,
          atomic settlement, and full DeFi composability.
        </motion.p>

        <motion.div
          className="flex gap-x-4 gap-y-4 items-center flex-wrap justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <button
            className="inline-flex transition-all duration-300 text-sm text-foreground rounded-full py-3 px-6 relative gap-x-2 items-center backdrop-blur-xl font-medium tracking-wide"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.2)",
            }}
          >
            <CheckCheck size={18} />
            Launch App
          </button>

          <button className="inline-flex transition-all duration-300 text-sm text-muted-foreground rounded-full py-3 px-6 relative gap-x-2 items-center border border-border hover:text-foreground hover:border-foreground/30">
            <ArrowRight size={16} />
            Read Documentation
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
