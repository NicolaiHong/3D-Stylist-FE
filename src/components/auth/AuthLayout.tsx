import { ReactNode } from "react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="atelier-grid relative min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.04fr_0.86fr]">
        <section className="preview-stage hidden min-h-[640px] py-8 pr-4 md:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#2cebcf]">
                3D Stylist
              </p>
              <h1 className="mt-5 max-w-lg text-4xl font-bold leading-tight text-white lg:text-5xl">
                AI fashion-tech for sharper outfit concepts.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
                A focused studio layer for personal styling, fit signals, and
                production-ready wardrobe direction.
              </p>
            </div>

            <div className="relative mx-auto my-10 h-[360px] w-full max-w-[430px]">
              <div className="look-panel absolute inset-x-4 bottom-3 top-0 rounded-lg border border-white/10 bg-[#0c111a] shadow-[0_28px_90px_rgba(0,0,0,0.36)]">
                <div className="absolute left-6 top-6 h-16 w-16 rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10" />
                <div className="absolute right-7 top-7 flex gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#ff8a65]" />
                  <span className="h-6 w-6 rounded-full bg-[#f0b44c]" />
                  <span className="h-6 w-6 rounded-full bg-[#2cebcf]" />
                </div>
                <div className="garment-shape absolute bottom-10 left-1/2 h-56 w-36 -translate-x-1/2" />
                <div className="absolute bottom-8 left-10 h-20 w-24 rounded-md border border-white/10 bg-white/[0.05]" />
                <div className="absolute bottom-8 right-10 h-28 w-20 rounded-md border border-white/10 bg-white/[0.07]" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <span className="block text-lg font-bold text-white">12k</span>
                <span className="text-slate-400">figure previews</span>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <span className="block text-lg font-bold text-white">42</span>
                <span className="text-slate-400">style presets</span>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <span className="block text-lg font-bold text-white">3D</span>
                <span className="text-slate-400">ready assets</span>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full justify-self-center rounded-lg border border-white/10 bg-[#0b111a] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.42)] ring-1 ring-[#2cebcf]/10 sm:p-8 lg:p-9">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between md:hidden">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#2cebcf]">
                3D Stylist
              </p>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                AI atelier
              </span>
            </div>
            <div className="mb-7">
              <h2 className="text-3xl font-bold leading-tight text-white">
                {title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-400">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
