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
      className={`inline-flex rounded-md border border-white/10 bg-white/[0.04] p-1 ${className}`}
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
            className={`min-h-9 rounded px-2.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
              isActive
                ? "bg-[#00e5ff] text-[#001f24]"
                : "text-[#bac9cc] hover:bg-white/[0.08] hover:text-white"
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
