import { useI18n } from "./useI18n";
import { SUPPORTED_LANGUAGES, type Language } from "./types";

const languageLabel: Record<Language, string> = {
  en: "EN",
  vi: "VI",
};

export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      className={`inline-flex h-[34px] items-center rounded-full border border-white/[0.12] bg-[#0e0e0e]/80 p-0.5 ${className}`}
      role="group"
      aria-label={t("language.groupLabel")}
    >
      {SUPPORTED_LANGUAGES.map((option) => {
        const isActive = option === language;
        const ariaLabel =
          option === "en"
            ? t("language.switchToEnglish")
            : t("language.switchToVietnamese");

        return (
          <button
            aria-label={ariaLabel}
            aria-pressed={isActive}
            className={`h-[30px] min-w-9 rounded-full px-2.5 text-xs font-semibold leading-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
              isActive
                ? "bg-[#00e5ff]/12 text-[#c3f5ff] ring-1 ring-[#00e5ff]/20"
                : "text-[#9daeb2] hover:bg-white/[0.06] hover:text-white"
            }`}
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
          >
            {languageLabel[option]}
          </button>
        );
      })}
    </div>
  );
}
