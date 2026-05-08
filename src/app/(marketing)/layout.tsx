import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="v2-brand flex min-h-screen flex-col bg-[var(--v2-bg)] text-[var(--v2-text)] font-[family-name:var(--font-geist-sans)]">
      <div className="grain-overlay" />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
