import { type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-brand flex min-h-screen items-center justify-center bg-[var(--v2-bg)] px-4 py-12">
      {children}
    </div>
  );
}
