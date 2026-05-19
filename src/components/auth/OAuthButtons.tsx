import { Facebook } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { authApi } from "../../features/auth/auth.api";
import {
  getAuthIntentPath,
  rememberOAuthIntent,
} from "../../features/auth/auth.redirects";
import { Button } from "../common/Button";

export function OAuthButtons() {
  const location = useLocation();
  const intendedPath = useMemo(
    () => getAuthIntentPath(location.state),
    [location.state],
  );

  const startOAuth = (provider: "google" | "facebook") => {
    rememberOAuthIntent(intendedPath);
    window.location.href = authApi.getOAuthUrl(provider);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        type="button"
        variant="authSecondary"
        className="w-full"
        aria-label="Continue with Google"
        icon={
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-[#1f2937]">
            G
          </span>
        }
        onClick={() => startOAuth("google")}
      >
        Google
      </Button>
      <Button
        type="button"
        variant="authSecondary"
        className="w-full"
        aria-label="Continue with Facebook"
        icon={<Facebook className="h-4 w-4 text-[#1877F2]" />}
        onClick={() => startOAuth("facebook")}
      >
        Facebook
      </Button>
    </div>
  );
}
