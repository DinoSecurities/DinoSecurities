import { useState } from "react";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      className="fixed z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 max-w-4xl rounded-full p-2 top-8 left-1/2 shadow-2xl backdrop-blur-xl items-center justify-between"
      style={{
        background:
          "linear-gradient(rgba(10,10,10,0.8), rgba(10,10,10,0.8)) padding-box, linear-gradient(90deg, rgba(255,255,255,0.05), rgba(16,185,129,0.3), rgba(6,182,212,0.3), rgba(255,255,255,0.05)) border-box",
        border: "1px solid transparent",
      }}
    >
      <a href="/" className="flex items-center gap-2 pl-4 pr-2 text-foreground rounded-full">
        <span className="text-sm font-bold tracking-wide">Veliq</span>
      </a>

      <ul className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
        {["Platform", "Ecosystem", "Docs"].map((item) => (
          <li key={item}>
            <a
              href={`#${item.toLowerCase()}`}
              className="block rounded-full px-4 py-1.5 transition-colors duration-300 hover:text-foreground hover:bg-foreground/5"
            >
              {item}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 pr-1">
        <a
          href="#login"
          className="hidden sm:block rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground hover:bg-foreground/5"
        >
          Log in
        </a>
        <a
          href="#start"
          className="hidden sm:block rounded-full bg-foreground px-5 py-1.5 text-sm font-semibold text-background transition-all hover:opacity-90"
          style={{ boxShadow: "0 0 15px rgba(255,255,255,0.1)" }}
        >
          Get Started
        </a>
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl p-4 backdrop-blur-xl bg-background/90 border border-border md:hidden">
          {["Platform", "Ecosystem", "Docs"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <a href="#login" className="flex-1 text-center py-2 text-sm text-muted-foreground">Log in</a>
            <a href="#start" className="flex-1 text-center py-2 text-sm font-semibold bg-foreground text-background rounded-full">Get Started</a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
