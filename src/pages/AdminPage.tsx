import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { MainLayout } from "../layouts/MainLayout";
import { useAuthStore } from "../features/auth/auth.store";
import { adminApi } from "../features/admin/admin.api";
import type { AdminHealth, AdminUser } from "../features/admin/admin.types";
import { getApiErrorMessage } from "../services/apiClient";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(user: AdminUser) {
  const name = user.displayName || user.email || "User";
  return name.charAt(0).toUpperCase();
}

export function AdminPage() {
  const user = useAuthStore((state) => state.user);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadAdminData() {
      setIsLoading(true);
      setError(null);

      try {
        const [healthResult, usersResult] = await Promise.all([
          adminApi.getAdminHealth(),
          adminApi.getAdminUsers(),
        ]);

        if (!isActive) {
          return;
        }

        setHealth(healthResult);
        setUsers(usersResult);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setHealth(null);
        setUsers([]);
        setError(getApiErrorMessage(loadError));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      isActive = false;
    };
  }, []);

  const statusLabel = health?.status === "ok" ? "Operational" : "Unavailable";

  return (
    <MainLayout>
      <main className="min-h-[calc(100vh-73px)] bg-[#05070b] px-4 py-8 text-[#d7e5e2] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <section className="rounded-lg border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-[#2cebcf]/25 bg-[#2cebcf]/10 text-[#2cebcf]">
                  <ShieldCheck className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold uppercase tracking-wide text-[#2cebcf]">
                    Admin
                  </p>
                  <h1 className="mt-2 text-3xl font-bold leading-tight text-white">
                    Operations Console
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d7e5e2]/70">
                    Signed in as {user?.email ?? user?.displayName ?? "admin"}.
                    Backend authorization remains the source of truth for this
                    view.
                  </p>
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/24 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#d7e5e2]/54">
                  System Status
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#2cebcf]" />
                  ) : health?.status === "ok" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#2cebcf]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-[#ffb199]" />
                  )}
                  <span className="text-sm font-bold text-white">
                    {isLoading ? "Checking" : statusLabel}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <section
              className="rounded-lg border border-[#ffb199]/30 bg-[#ffb199]/10 p-5 text-[#ffe3d7]"
              role="alert"
            >
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold">Admin request failed</h2>
                  <p className="mt-1 text-sm leading-6 text-[#ffe3d7]/78">
                    {error}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f0b44c]/12 text-[#f0b44c]">
                  <UsersRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-white">Users</h2>
                  <p className="text-sm text-[#d7e5e2]/58">
                    Safe account fields returned by the admin API.
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#d7e5e2]/62">
                {isLoading ? "Loading users" : `${users.length} visible`}
              </p>
            </div>

            {isLoading ? (
              <div className="grid gap-3 p-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    className="h-16 animate-pulse rounded-md bg-white/[0.07]"
                    key={index}
                  />
                ))}
              </div>
            ) : users.length === 0 && !error ? (
              <div className="p-8 text-center">
                <p className="text-base font-bold text-white">No users found</p>
                <p className="mt-2 text-sm text-[#d7e5e2]/62">
                  The admin API returned an empty user list.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left">
                  <thead className="bg-black/22 text-xs uppercase tracking-wide text-[#d7e5e2]/54">
                    <tr>
                      <th className="px-5 py-3 font-bold">User</th>
                      <th className="px-5 py-3 font-bold">Role</th>
                      <th className="px-5 py-3 font-bold">Status</th>
                      <th className="px-5 py-3 font-bold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users.map((adminUser) => (
                      <tr className="hover:bg-white/[0.035]" key={adminUser.id}>
                        <td className="px-5 py-4">
                          <div className="flex min-w-[220px] items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#2cebcf]/12 text-sm font-bold text-[#2cebcf]">
                              {adminUser.avatarUrl ? (
                                <img
                                  alt=""
                                  className="h-full w-full object-cover"
                                  src={adminUser.avatarUrl}
                                />
                              ) : (
                                getInitials(adminUser)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-white">
                                {adminUser.displayName || "Unnamed user"}
                              </p>
                              <p className="truncate text-sm text-[#d7e5e2]/58">
                                {adminUser.email || "No email"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-md border border-[#2cebcf]/20 bg-[#2cebcf]/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#7df9df]">
                            {adminUser.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold text-[#d7e5e2]/78">
                            {adminUser.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#d7e5e2]/62">
                          {formatDate(adminUser.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </MainLayout>
  );
}
