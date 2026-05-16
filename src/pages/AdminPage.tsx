import { ShieldCheck } from "lucide-react";
import { MainLayout } from "../layouts/MainLayout";
import { useAuthStore } from "../features/auth/auth.store";

export function AdminPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <MainLayout>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-jade/12 text-jade">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-wide text-jade">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-ink">
                Admin Access
              </h1>
              <p className="mt-3 text-sm text-ink/62">
                Signed in as {user?.email ?? user?.displayName ?? "admin"}.
              </p>
            </div>
          </div>
        </section>
      </main>
    </MainLayout>
  );
}
