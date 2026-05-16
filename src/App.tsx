import { useEffect } from "react";
import { AppRoutes } from "./routes/AppRoutes";
import { useAuthStore } from "./features/auth/auth.store";
import { LoadingScreen } from "./components/common/LoadingScreen";

export default function App() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  return <AppRoutes />;
}
