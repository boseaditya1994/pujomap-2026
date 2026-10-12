import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { adminLoginMode, getAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  const mode = adminLoginMode();
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-3xl">Admin sign in</h1>
      {mode === "disabled" ? (
        <p className="bg-card mt-4 rounded-lg border p-4 text-sm" data-testid="login-disabled">
          Admin sign-in is not configured. Connect Supabase (see docs/supabase-setup.md), or for local development set
          <code className="bg-muted mx-1 rounded px-1">PUJOMAP_DEV_ADMIN_TOKEN</code>
          to a random value of at least 16 characters and restart the server.
        </p>
      ) : (
        <LoginForm mode={mode} />
      )}
    </div>
  );
}
