import FeatureCards from "@/components/auth/FeatureCards";
import SignUpProviders from "@/components/auth/SignUpProviders";
import SignUpForm from "@/components/auth/SignUpForm";

export default function Page() {
  return (
    <>
      <div className="flex flex-col w-full">
        <div className="w-full max-w-6xl mx-auto my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-10 rounded-xl bg-surface-container-high relative overflow-hidden shadow-sm">
              <div className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-surface-variant/40 blur-2xl pointer-events-none"></div>
              <div>
                <span className="font-label-caps text-label-caps text-primary uppercase tracking-widest block mb-2">
                  Autonomous Studio Engine
                </span>
                <h1 className="font-display-2xl text-display-2xl text-on-surface mb-4 tracking-tight leading-tight">
                  Publish consistently without the busywork.
                </h1>
                <p className="font-body-base text-body-base text-on-surface-variant mb-8">
                  VervAI turns your research and ideas into on-brand content across every channel you already publish to.
                </p>
                <FeatureCards />
              </div>
            </div>
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-8 sm:p-10 shadow-md flex flex-col justify-between">
              <div className="w-full max-w-md mx-auto">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-label-caps text-label-caps tracking-widest text-primary uppercase">
                    Workspace Enrollment
                  </span>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    Create your VervAI account
                  </h2>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  One account for research, drafting, and distribution. No credit card required.
                </p>
                <SignUpProviders />
                <div className="relative flex items-center justify-center my-6">
                  <div className="w-full h-px bg-surface-variant"></div>
                  <span className="absolute px-3 bg-surface-container-lowest font-caption-bold text-caption-bold text-outline uppercase tracking-wider">
                    or register with email
                  </span>
                </div>
                <SignUpForm />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}