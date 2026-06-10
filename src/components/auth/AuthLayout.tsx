import { ReactNode } from "react";
import { LanguageSwitch } from "../../i18n/LanguageSwitch";
import { useI18n } from "../../i18n/useI18n";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const { t } = useI18n();

  return (
    <main className="atelier-grid graphite-theme relative min-h-screen overflow-hidden px-4 py-5 text-text-primary sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute right-4 top-4 z-20 sm:right-6 lg:right-8">
        <LanguageSwitch />
      </div>
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 xl:grid-cols-[1.04fr_0.86fr] xl:gap-8">
        <section className="preview-stage hidden min-h-[560px] py-6 pr-4 xl:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#2cebcf]">
                {t("auth.hero.eyebrow")}
              </p>
              <h1 className="mt-5 max-w-lg text-4xl font-bold leading-tight text-white lg:text-5xl">
                {t("auth.hero.title")}
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-slate-400">
                {t("auth.hero.subtitle")}
              </p>
            </div>

            <div className="relative mx-auto my-8 h-[320px] w-full max-w-[400px]">
              <div className="look-panel absolute inset-x-4 bottom-3 top-0 rounded-lg border border-border-subtle bg-surface-muted shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
                <div className="absolute left-6 top-6 h-16 w-16 rounded-md border border-accent-cyan/[0.15] bg-accent-cyan/[0.08]" />
                <div className="absolute right-7 top-7 flex gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#ff8a65]" />
                  <span className="h-6 w-6 rounded-full bg-[#f0b44c]" />
                  <span className="h-6 w-6 rounded-full bg-accent-cyan" />
                </div>
                <div className="garment-shape absolute bottom-10 left-1/2 h-52 w-36 -translate-x-1/2" />
                <div className="absolute bottom-8 left-10 h-20 w-24 rounded-md border border-white/10 bg-white/[0.05]" />
                <div className="absolute bottom-8 right-10 h-28 w-20 rounded-md border border-white/10 bg-white/[0.07]" />
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/[0.08] py-3 text-sm">
              <div className="px-4 first:pl-0">
                <span className="block text-lg font-bold text-white">12k</span>
                <span className="text-slate-400">
                  {t("auth.hero.metricPreviews")}
                </span>
              </div>
              <div className="px-4">
                <span className="block text-lg font-bold text-white">42</span>
                <span className="text-slate-400">
                  {t("auth.hero.metricPresets")}
                </span>
              </div>
              <div className="px-4">
                <span className="block text-lg font-bold text-white">3D</span>
                <span className="text-slate-400">
                  {t("auth.hero.metricAssets")}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full max-w-[30rem] justify-self-center rounded-lg border border-border-soft bg-surface-raised p-5 shadow-[0_18px_46px_rgba(0,0,0,0.20)] sm:p-7 xl:max-w-none xl:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between xl:hidden">
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-[#2cebcf]">
                {t("auth.hero.eyebrow")}
              </p>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                {t("auth.hero.mobileBadge")}
              </span>
            </div>
            <div className="mb-6">
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
