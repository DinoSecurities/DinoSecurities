import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav
      className="fixed z-50 flex w-[calc(100%-2rem)] -translate-x-1/2 max-w-4xl rounded-full p-2 top-8 left-1/2 shadow-2xl backdrop-blur-xl items-center justify-between"
      style={{
        background:
          "linear-gradient(rgba(10,10,10,0.8), rgba(10,10,10,0.8)) padding-box, linear-gradient(90deg, rgba(255,255,255,0.05), rgba(139,92,246,0.3), rgba(99,102,241,0.3), rgba(255,255,255,0.05)) border-box",
        border: "1px solid transparent",
      }}
    >
      <a href="/" className="flex items-center gap-2 pl-4 pr-2 text-foreground rounded-full">
        <span className="text-sm font-bold tracking-wide">DinoSecurities</span>
      </a>

      <ul className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
        {["Platform", "Securities", "Roadmap", "Docs"].map((item) => {
          const isDocs = item === "Docs";
          const href = isDocs
            ? "https://github.com/DinoSecurities/DinoSecurities"
            : `#${item.toLowerCase()}`;
          return (
            <li key={item}>
              <a
                href={href}
                {...(isDocs ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block rounded-full px-4 py-1.5 transition-colors duration-300 hover:text-foreground hover:bg-foreground/5"
              >
                {item}
              </a>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2 pr-1">
        <button
          onClick={() => navigate("/app")}
          className="hidden sm:block rounded-full bg-foreground px-5 py-1.5 text-sm font-semibold text-background transition-all hover:opacity-90 cursor-pointer"
          style={{ boxShadow: "0 0 15px rgba(255,255,255,0.1)" }}
        >
          Launch App
        </button>
        <button
          className="md:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl p-4 backdrop-blur-xl bg-background/90 border border-border md:hidden">
          {["Platform", "Securities", "Roadmap", "Docs"].map((item) => {
            const isDocs = item === "Docs";
            const href = isDocs
              ? "https://github.com/DinoSecurities/DinoSecurities"
              : `#${item.toLowerCase()}`;
            return (
              <a
                key={item}
                href={href}
                {...(isDocs ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {item}
              </a>
            );
          })}
          <div className="flex gap-2 mt-2 pt-2 border-t border-border">
            <a href="/app" className="flex-1 text-center py-2 text-sm font-semibold bg-foreground text-background rounded-full">Launch App</a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
