import MarketingHeader from "@/components/landing/MarketingHeader";
import MarketingFooter from "@/components/landing/MarketingFooter";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingHeader />
      <main className="w-full bg-background flex flex-col flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}