import { type ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-brand flex min-h-screen items-center justify-center px-4 py-12 bg-[#0F0D0A]">
      {children}
    </div>
  );
}
