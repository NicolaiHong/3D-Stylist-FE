import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { authApi } from "../../features/auth/auth.api";
import {
  getAuthIntentPath,
  rememberOAuthIntent,
} from "../../features/auth/auth.redirects";
import { useI18n } from "../../i18n/useI18n";
import { Button } from "../common/Button";

export function OAuthButtons() {
  const { t } = useI18n();
  const location = useLocation();
  const intendedPath = useMemo(
    () => getAuthIntentPath(location.state),
    [location.state],
  );

  const startGoogleOAuth = () => {
    rememberOAuthIntent(intendedPath);
    window.location.href = authApi.getOAuthUrl("google");
  };

  return (
    <div className="grid gap-3">
      <Button
        type="button"
        variant="authSecondary"
        className="w-full"
        aria-label={t("auth.oauth.continueWithGoogle")}
        icon={
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#1f2937]">
            G
          </span>
        }
        onClick={startGoogleOAuth}
      >
        {t("auth.oauth.google")}
      </Button>
    </div>
  );
}
