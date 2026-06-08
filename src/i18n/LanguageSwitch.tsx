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
      className={`language-switch ${className}`.trim()}
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
            className={`language-switch__button ${
              isActive ? "language-switch__button--active" : ""
            }`.trim()}
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
