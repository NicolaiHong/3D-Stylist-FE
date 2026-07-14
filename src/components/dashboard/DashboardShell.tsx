import { ReactNode, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Box,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Shirt,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../features/auth/auth.store";
import { AUTH_ROLES } from "../../features/auth/auth.types";
import { LanguageSwitch } from "../../i18n/LanguageSwitch";
import { useI18n } from "../../i18n/useI18n";

interface DashboardShellProps {
  children: ReactNode;
  planLabel?: string;
  variant?: "admin" | "user";
}

interface NavigationItem {
  labelKey: string;
  to?: string;
  icon: LucideIcon;
  disabled?: boolean;
  adminOnly?: boolean;
}

const adminNavigationItems: NavigationItem[] = [
  { labelKey: "shell.nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "shell.nav.outfits", icon: Shirt, disabled: true },
  { labelKey: "shell.nav.studio", to: "/studio", icon: Sparkles },
  { labelKey: "shell.nav.credits", to: "/credits", icon: Database },
  { labelKey: "shell.nav.profile", to: "/profile", icon: UserRound },
  {
    labelKey: "shell.nav.admin",
    to: "/admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

const userNavigationItems: NavigationItem[] = [
  { labelKey: "shell.nav.dashboard", to: "/dashboard", icon: LayoutDashboard },
  { labelKey: "shell.nav.studio", to: "/studio", icon: Sparkles },
  { labelKey: "shell.nav.credits", to: "/credits", icon: Database },
  { labelKey: "shell.nav.payments", to: "/payments", icon: ReceiptText },
  {
    labelKey: "shell.nav.printOrders",
    to: "/physical-print/orders",
    icon: PackageCheck,
  },
  { labelKey: "shell.nav.profile", to: "/profile", icon: UserRound },
  {
    labelKey: "shell.nav.admin",
    to: "/admin",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

const authenticatedLanguageSwitchClassName =
  "!h-12 !w-28 !basis-28 [&>button]:!h-11 [&>button]:!w-[54px] [&>button]:!basis-[54px]";

function SidebarNavItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  const { t } = useI18n();

  if (!item.to || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-[#849396]/70"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{t(item.labelKey)}</span>
        <span className="ml-auto shrink-0 rounded-sm border border-white/10 px-1.5 py-0.5 text-[0.7rem] font-semibold leading-4 text-[#bac9cc]/50">
          {t("shell.nav.soon")}
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
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{t(item.labelKey)}</span>
    </NavLink>
  );
}

function MobileNavItem({ item }: { item: NavigationItem }) {
  const Icon = item.icon;
  const { t } = useI18n();

  if (!item.to || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#849396]/70 sm:basis-auto"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{t(item.labelKey)}</span>
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
      <span className="truncate">{t(item.labelKey)}</span>
    </NavLink>
  );
}

function UserTopNavItem({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const { t } = useI18n();

  if (!item.to || item.disabled) {
    return (
      <span
        aria-disabled="true"
        className="app-top-nav-link app-top-nav-link-disabled inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-bold text-[#849396]/70"
      >
        <Icon className="h-4 w-4 shrink-0" />
        {t(item.labelKey)}
      </span>
    );
  }

  return (
    <NavLink
      className={({ isActive }) =>
        `app-top-nav-link inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 text-sm font-bold ${
          isActive ? "app-top-nav-link--active text-[#c3f5ff]" : "text-[#bac9cc]"
        }`
      }
      to={item.to}
      onClick={onNavigate}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

export function DashboardShell({
  children,
  planLabel,
  variant = "user",
}: DashboardShellProps) {
  const { t } = useI18n();
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === AUTH_ROLES.ADMIN;
  const visibleUserNavigation = userNavigationItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );
  const visibleAdminNavigation = adminNavigationItems.filter(
    (item) => !item.adminOnly || isAdmin,
  );
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  if (variant === "admin") {
    return (
      <div className="graphite-theme min-h-screen overflow-x-hidden bg-canvas text-text-primary">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border-soft bg-surface p-4 lg:flex">
          <Link
            className="mb-4 border-b border-border-subtle px-3 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus-ring"
            to="/dashboard"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
                <Box className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-xl font-bold text-white">
                  3D Stylist
                </span>
                <span className="mt-1 block truncate text-xs font-semibold tracking-[0.04em] text-[#bac9cc]">
                  {planLabel || t("shell.planFallback")}
                </span>
              </span>
            </span>
          </Link>

          <nav className="flex-1 space-y-2" aria-label={t("shell.nav.dashboardAria")}>
            {visibleAdminNavigation.map((item) => (
              <SidebarNavItem item={item} key={item.labelKey} />
            ))}
          </nav>

          <div className="flex flex-col items-center gap-2 border-t border-border-subtle pt-3">
            <LanguageSwitch className={authenticatedLanguageSwitchClassName} />
            <button
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="button"
              onClick={() => void logout()}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t("common.logout")}</span>
            </button>
          </div>
        </aside>

        <div className="relative min-h-screen lg:pl-64">
          <div
            aria-hidden="true"
            className="authenticated-app-surface pointer-events-none fixed inset-0 lg:left-64"
          />
          <header className="sticky top-0 z-30 border-b border-border-soft bg-canvas/[0.92] px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link
                className="flex min-h-11 min-w-0 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
                to="/dashboard"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
                  <Box className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-bold text-white">
                    3D Stylist
                  </span>
                  <span className="block truncate text-xs font-semibold tracking-[0.04em] text-[#bac9cc]">
                    {planLabel || t("shell.planFallback")}
                  </span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <LanguageSwitch
                  className={authenticatedLanguageSwitchClassName}
                />
                <button
                  aria-label={t("common.logout")}
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-white/[0.08] text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  type="button"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            <nav
              aria-label={t("shell.nav.dashboardMobileAria")}
              className="mt-3 flex flex-wrap gap-2"
            >
              {visibleAdminNavigation.map((item) => (
                <MobileNavItem item={item} key={item.labelKey} />
              ))}
            </nav>
          </header>

          <div className="relative z-10">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="graphite-theme min-h-screen overflow-x-hidden bg-canvas text-text-primary">
      <div className="relative min-h-screen">
        <div
          aria-hidden="true"
          className="authenticated-app-surface pointer-events-none fixed inset-0"
        />
        <header className="sticky top-0 z-30 border-b border-border-soft bg-canvas/[0.92] px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
            <Link
              className="flex min-h-11 min-w-0 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff]"
              to="/dashboard"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#00e5ff] text-[#001f24]">
                <Box className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-lg font-bold text-white">
                  3D Stylist
                </span>
              </span>
            </Link>

            <nav
              aria-label={t("shell.nav.mainAria")}
              className="hidden items-center gap-1 xl:flex"
            >
              {visibleUserNavigation.map((item) => (
                <UserTopNavItem item={item} key={item.labelKey} />
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitch className={authenticatedLanguageSwitchClassName} />
              <button
                aria-label={t("common.logout")}
                className="hidden h-11 w-11 items-center justify-center rounded-md border border-white/[0.08] text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
                disabled={isLoading}
                type="button"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
              </button>
              <button
                aria-expanded={isMobileNavOpen}
                aria-label={
                  isMobileNavOpen
                    ? t("shell.nav.closeMenu")
                    : t("shell.nav.openMenu")
                }
                className="flex h-11 w-11 items-center justify-center rounded-md border border-white/[0.08] text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] xl:hidden"
                type="button"
                onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
              >
                {isMobileNavOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          {isMobileNavOpen ? (
            <nav
              aria-label={t("shell.nav.dashboardMobileAria")}
              className="mx-auto mt-3 grid max-w-[1440px] gap-2 sm:grid-cols-2"
            >
              {visibleUserNavigation.map((item) => (
                <UserTopNavItem
                  item={item}
                  key={item.labelKey}
                  onNavigate={() => setIsMobileNavOpen(false)}
                />
              ))}
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.08] px-3 py-2 text-sm font-bold text-[#bac9cc] transition hover:border-[#00e5ff]/35 hover:bg-[#00e5ff]/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00e5ff] disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
                disabled={isLoading}
                type="button"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" />
                {t("common.logout")}
              </button>
            </nav>
          ) : null}
        </header>

        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}
