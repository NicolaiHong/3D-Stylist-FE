import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../components/common/Button";
import { useI18n } from "../i18n/useI18n";

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <main className="flex min-h-screen items-center justify-center bg-mist px-4 text-ink">
      <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-jade">404</p>
        <h1 className="mt-3 text-3xl font-bold">{t("notFound.title")}</h1>
        <p className="mt-3 text-ink/62">
          {t("notFound.body")}
        </p>
        <Button
          type="button"
          className="mt-6 w-full"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => {
            window.location.href = "/dashboard";
          }}
        >
          {t("notFound.backToDashboard")}
        </Button>
        <Link className="sr-only" to="/dashboard">
          {t("shell.nav.dashboard")}
        </Link>
      </section>
    </main>
  );
}
