import { Footer } from "@/components/marketing/footer";
import { Navbar } from "@/components/marketing/navbar";
import {
  SchematicHome,
  SchematicHomeMobile,
} from "@/components/marketing/schematic-home";

export default function Home() {
  return (
    <div className="v2-brand schematic-bg min-h-screen bg-[var(--v2-bg)] text-[var(--v2-text)]">
      <div className="grain-overlay" />
      <Navbar />
      <main>
        <SchematicHome />
        <SchematicHomeMobile />
      </main>
      <Footer />
    </div>
  );
}
