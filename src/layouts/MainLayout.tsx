import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Box, LogOut, UserRound } from "lucide-react";
import { Button } from "../components/common/Button";
import { useAuthStore } from "../features/auth/auth.store";
import { AUTH_ROLES } from "../features/auth/auth.types";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === AUTH_ROLES.ADMIN;

  return (
    <div className="min-h-screen bg-mist text-ink">
      <header className="border-b border-ink/10 bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-white">
              <Box className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold leading-tight">3D Stylist</p>
              <p className="text-sm text-ink/58">Studio dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
              <NavLink
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-ink text-white"
                      : "text-ink/64 hover:bg-ink/5 hover:text-ink"
                  }`
                }
                to="/dashboard"
              >
                Dashboard
              </NavLink>
              <NavLink
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-ink text-white"
                      : "text-ink/64 hover:bg-ink/5 hover:text-ink"
                  }`
                }
                to="/profile"
              >
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4" />
                  Profile
                </span>
              </NavLink>
              {isAdmin ? (
                <NavLink
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-ink text-white"
                        : "text-ink/64 hover:bg-ink/5 hover:text-ink"
                    }`
                  }
                  to="/admin"
                >
                  Admin
                </NavLink>
              ) : null}
            </nav>
            <Button
              type="button"
              variant="ghost"
              icon={<LogOut className="h-4 w-4" />}
              isLoading={isLoading}
              onClick={() => void logout()}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
