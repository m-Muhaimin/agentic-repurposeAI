import AuthHeader from "@/components/auth/AuthHeader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-background">
      <AuthHeader />
      <main className="w-full flex-1 flex items-center justify-center px-4 py-8 bg-background">
        {children}
      </main>
      <footer className="w-full py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
        <div className="max-w-7xl mx-auto px-6">
          <span className="font-caption-bold text-caption-bold text-outline">© VervAI</span>
        </div>
      </footer>
    </div>
  );
}