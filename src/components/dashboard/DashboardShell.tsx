import { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Box,
  Database,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Shirt,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../features/auth/auth.store";
import { AUTH_ROLES } from "../../features/auth/auth.types";

interface DashboardShellProps {
  children: ReactNode;
  planLabel?: string;
}

interface NavigationItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean;
}

const navigationItems: NavigationItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Outfits", icon: Shirt, disabled: true },
  { label: "Studio", icon: Sparkles, disabled: true },
  { label: "Credits", to: "/credits", icon: Database },
  { label: "Profile", to: "/profile", icon: UserRound },
  { label: "Admin", to: "/admin", icon: ShieldCheck, adminOnly: true },
];

function SidebarNavItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  if (!item.to || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-[#849396]/70"
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        <span className="ml-auto rounded-sm border border-white/10 px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-[#bac9cc]/50">
          Soon
        </span>
      </span>
    );
  }

  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] ${
          isActive
            ? "border border-[#00e5ff]/25 bg-[#454747] text-white"
            : "text-[#bac9cc] hover:bg-[#2a2a2a] hover:text-white"
        }`
      }
      to={item.to}
    >
      <Icon className="h-4 w-4" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function MobileNavItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon;

  if (!item.to || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#849396]/70 sm:basis-auto"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
    );
  }

  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] sm:basis-auto ${
          isActive
            ? "border-[#00e5ff]/35 bg-[#00e5ff]/12 text-[#9cf0ff]"
            : "border-white/[0.08] text-[#bac9cc] hover:border-[#00e5ff]/35 hover:text-white"
        }`
      }
      to={item.to}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function DashboardShell({ children, planLabel }: DashboardShellProps) {
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === AUTH_ROLES.ADMIN;
  const visibleNavigation = navigationItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-[#e5e2e1]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#3b494c] bg-[#1c1b1b] p-4 lg:flex">
        <Link
          className="mb-4 border-b border-[#3b494c]/60 px-3 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
          to="/dashboard"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
              <Box className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-xl font-bold text-white">
                3D Stylist
              </span>
              <span className="mt-1 block text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                {planLabel || "Studio OS"}
              </span>
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-2" aria-label="Dashboard">
          {visibleNavigation.map((item) => (
            <SidebarNavItem item={item} key={item.label} />
          ))}
        </nav>

        <div className="border-t border-[#3b494c]/60 pt-4">
          <button
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2.5 text-sm font-bold text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            type="button"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#3b494c] bg-[#0a0a0a]/92 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/dashboard"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
                <Box className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-bold text-white">
                  3D Stylist
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#bac9cc]">
                  {planLabel || "Studio OS"}
                </span>
              </span>
            </Link>
            <button
              aria-label="Logout"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 text-[#e5e2e1] transition hover:border-[#00e5ff]/45 hover:bg-[#00e5ff]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="button"
              onClick={() => void logout()}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav
            aria-label="Dashboard mobile"
            className="mt-3 flex flex-wrap gap-2"
          >
            {visibleNavigation.map((item) => (
              <MobileNavItem item={item} key={item.label} />
            ))}
          </nav>
        </header>

        {children}
      </div>
    </div>
  );
}
