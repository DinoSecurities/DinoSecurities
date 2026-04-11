import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  variant?: "default" | "primary";
}

const StatCard = ({ label, value, subtitle, icon: Icon, trend, variant = "default" }: StatCardProps) => (
  <div
    className={`p-6 border border-border relative group transition-all duration-300 hover:-translate-y-0.5 ${
      variant === "primary"
        ? "bg-gradient-to-b from-primary to-primary/90"
        : "bg-gradient-to-b from-foreground/[0.06] to-foreground/[0.02]"
    }`}
    style={{
      boxShadow:
        variant === "primary"
          ? "inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 20px rgba(139,92,246,0.12)"
          : "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.2)",
    }}
  >
    <div className="flex items-start justify-between mb-4">
      <span
        className={`text-[10px] uppercase tracking-widest font-semibold ${
          variant === "primary" ? "text-primary-foreground/60" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <Icon
        size={18}
        className={variant === "primary" ? "text-primary-foreground/40" : "text-muted-foreground/40"}
      />
    </div>
    <div
      className={`text-3xl font-semibold tracking-tight mb-1 ${
        variant === "primary" ? "text-primary-foreground" : "text-foreground"
      }`}
    >
      {value}
    </div>
    <div className="flex items-center gap-2">
      {trend && (
        <span
          className={`text-xs font-semibold ${
            trend.positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {trend.positive ? "↑" : "↓"} {trend.value}
        </span>
      )}
      {subtitle && (
        <span
          className={`text-xs ${
            variant === "primary" ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {subtitle}
        </span>
      )}
    </div>
  </div>
);

export default StatCard;
