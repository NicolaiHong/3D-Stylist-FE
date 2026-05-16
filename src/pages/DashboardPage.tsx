import { Calendar, Mail, Shield, Sparkles, UserRound } from "lucide-react";
import { MainLayout } from "../layouts/MainLayout";
import { useAuthStore } from "../features/auth/auth.store";

function formatDate(value?: string) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const displayName = user?.displayName || user?.fullName || "Stylist";

  return (
    <MainLayout>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-jade">
              Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight text-ink">
              Welcome, {displayName}
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-ink/65">
              Your account is connected to the backend API and ready for the
              next 3D styling workflows.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-ink/10 bg-mist p-4">
                <Sparkles className="h-5 w-5 text-clay" />
                <p className="mt-3 text-2xl font-bold">0</p>
                <p className="text-sm text-ink/58">draft looks</p>
              </div>
              <div className="rounded-md border border-ink/10 bg-mist p-4">
                <UserRound className="h-5 w-5 text-jade" />
                <p className="mt-3 text-2xl font-bold">0</p>
                <p className="text-sm text-ink/58">figures</p>
              </div>
              <div className="rounded-md border border-ink/10 bg-mist p-4">
                <Shield className="h-5 w-5 text-moss" />
                <p className="mt-3 text-2xl font-bold">{user?.role ?? "user"}</p>
                <p className="text-sm text-ink/58">role</p>
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-jade/12 text-xl font-bold text-jade">
                {user?.avatarUrl ? (
                  <img
                    className="h-full w-full object-cover"
                    src={user.avatarUrl}
                    alt=""
                  />
                ) : (
                  displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-ink">
                  {displayName}
                </h2>
                <p className="truncate text-sm text-ink/58">{user?.status}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-4">
              <div className="flex gap-3 rounded-md border border-ink/10 bg-mist p-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-jade" />
                <div className="min-w-0">
                  <dt className="text-sm font-semibold text-ink">Email</dt>
                  <dd className="truncate text-sm text-ink/62">
                    {user?.email || "Not provided"}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3 rounded-md border border-ink/10 bg-mist p-4">
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-clay" />
                <div>
                  <dt className="text-sm font-semibold text-ink">Joined</dt>
                  <dd className="text-sm text-ink/62">
                    {formatDate(user?.createdAt)}
                  </dd>
                </div>
              </div>
            </dl>
          </aside>
        </section>
      </main>
    </MainLayout>
  );
}
