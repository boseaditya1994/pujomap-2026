import { cn } from "@/lib/utils";

/** Decorative alpona-style rosette drawn in gold line work. */
export function Alpona({ className }: { className?: string }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden focusable="false" fill="none" stroke="currentColor">
      <circle cx="100" cy="100" r="96" strokeWidth="1" />
      <circle cx="100" cy="100" r="88" strokeWidth="0.75" strokeDasharray="2 5" />
      {petals.map((deg) => (
        <path
          key={deg}
          d="M100 100 C 84 70, 88 36, 100 16 C 112 36, 116 70, 100 100 Z"
          strokeWidth="1"
          transform={`rotate(${deg} 100 100)`}
        />
      ))}
      {petals.map((deg) => (
        <circle
          key={`d${deg}`}
          cx="100"
          cy="30"
          r="2.2"
          fill="currentColor"
          stroke="none"
          transform={`rotate(${deg + 15} 100 100)`}
        />
      ))}
      <circle cx="100" cy="100" r="22" strokeWidth="1" />
      <circle cx="100" cy="100" r="6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EmptyState({
  title,
  body,
  children,
  className,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-input bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      <Alpona className="text-gold mb-4 size-16" />
      <h2 className="text-xl">{title}</h2>
      {body ? <p className="text-muted-foreground mt-1 max-w-sm text-sm">{body}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Inline notice. `tone="error"` is announced assertively to screen readers. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error" && "border-destructive/40 bg-destructive/5 text-destructive",
        tone === "info" && "border-gold/50 bg-caution-soft text-caution",
        tone === "success" && "border-verified/30 bg-verified-soft text-verified",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-card animate-pulse rounded-2xl border p-4" aria-hidden>
      <div className="bg-muted h-5 w-2/3 rounded" />
      <div className="bg-muted mt-2 h-4 w-1/2 rounded" />
      <div className="bg-muted mt-4 h-4 w-3/4 rounded" />
      <div className="mt-4 flex gap-2">
        <div className="bg-muted h-9 w-24 rounded-lg" />
        <div className="bg-muted h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

export function PageSkeleton({ label }: { label: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="bg-muted h-8 w-56 animate-pulse rounded" aria-hidden />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
