import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Accent = "cyan" | "lime" | "coral" | "iris";

const accentClass: Record<Accent, string> = {
  cyan: "text-[var(--v2-accent)] border-[var(--v2-border)]",
  lime: "text-[var(--v2-accent-2)] border-[rgba(182,244,74,.32)]",
  coral: "text-[var(--v2-accent-3)] border-[rgba(255,107,107,.36)]",
  iris: "text-[var(--v2-accent-4)] border-[rgba(155,140,255,.36)]",
};

export function SchematicPin({
  id,
  path,
  color = "cyan",
  className,
}: {
  id: string;
  path?: string;
  color?: Accent;
  className?: string;
}) {
  return (
    <div className={cn("schematic-pin", className)} data-color={color}>
      <b>{id}</b>
      {path ? <span aria-hidden="true">{path}</span> : null}
    </div>
  );
}

export function SchematicNode({
  id,
  path,
  color = "cyan",
  children,
  className,
  contentClassName,
}: {
  id?: string;
  path?: string;
  color?: Accent;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn("schematic-node text-[var(--v2-text)]", accentClass[color], className)}
    >
      {id ? (
        <div className="absolute left-3 top-[-11px] z-10">
          <SchematicPin id={id} path={path} color={color} />
        </div>
      ) : null}
      <div className={cn("relative", id ? "pt-5" : "", contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export function TerminalPanel({
  title = "agent@swarm",
  meta = "tty/01 · live",
  children,
  className,
}: {
  title?: string;
  meta?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("schematic-terminal", className)}>
      <div className="schematic-terminal-bar">
        <span className="schematic-terminal-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>{title}</span>
        <span className="ml-auto text-[var(--v2-accent)]">{meta}</span>
      </div>
      {children}
    </div>
  );
}

export function MonoTag({
  children,
  color = "cyan",
  className,
}: {
  children: ReactNode;
  color?: Accent;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[2px] border px-2 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.12em]",
        accentClass[color],
        className
      )}
    >
      {children}
    </span>
  );
}
