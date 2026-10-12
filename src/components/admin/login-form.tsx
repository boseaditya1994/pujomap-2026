"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/(admin)/admin/actions";
import { Notice } from "@/components/states";

export function LoginForm({ mode }: { mode: "supabase" | "dev-token" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {
    ok: true,
  });
  return (
    <form action={action} className="mt-6 space-y-4" data-testid="login-form">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      {mode === "dev-token" ? (
        <div>
          <label htmlFor="token" className="field-label">
            Development admin token
          </label>
          <input id="token" name="token" type="password" autoComplete="off" required className="field" />
          <p className="field-hint">The value of PUJOMAP_DEV_ADMIN_TOKEN in your local environment.</p>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input id="email" name="email" type="email" autoComplete="username" required className="field" />
          </div>
          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field"
            />
          </div>
        </>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
