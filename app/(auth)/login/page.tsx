"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Suspense, useState } from "react";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { signInEmail, signInGoogle, sendReset } from "@/lib/auth/actions";
import { authErrorToMessage } from "@/lib/auth/errors";
import { routeAfterLogin } from "@/lib/auth/routeAfterLogin";
import { useSearchParams } from "next/navigation";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormValues = z.infer<typeof Schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card auth-card"><p className="muted-text">Loading…</p></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState, getValues } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { email: "", password: "" },
  });

  async function routeTo(uid: string) {
    const fallback = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";
    const dest = await routeAfterLogin(uid, fallback);
    router.push(dest);
  }

  async function onSubmit(values: FormValues) {
    setBusy(true);
    try {
      const cred = await signInEmail(values.email, values.password);
      toast.success("Signed in");
      await routeTo(cred.user.uid);
    } catch (err) {
      toast.error(authErrorToMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const cred = await signInGoogle();
      toast.success("Signed in");
      await routeTo(cred.user.uid);
    } catch (err) {
      toast.error(authErrorToMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    const email = getValues("email");
    if (!email) {
      toast.info("Enter your email first, then click Forgot password");
      return;
    }
    try {
      await sendReset(email);
      toast.success("Reset email sent");
    } catch (err) {
      toast.error(authErrorToMessage(err));
    }
  }

  return (
    <div className="auth-card stack animate-fade-in-up">
      <header className="stack-sm animate-fade-in-up delay-100">
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700 }}>
          Welcome back
        </h1>
        <p className="muted-text" style={{ lineHeight: 1.6 }}>
          Sign in to your Nexus organization.
        </p>
      </header>

      <div className="animate-fade-in-up delay-200">
        <GoogleButton onClick={onGoogle} disabled={busy} />
      </div>
      <div className="divider-with-text animate-fade-in-up delay-200">or</div>

      <form onSubmit={handleSubmit(onSubmit)} className="stack animate-fade-in-up delay-300">
        <div className="form-row">
          <label htmlFor="email" className="label">Work email</label>
          <input id="email" type="email" autoComplete="email" className="input"
                 {...register("email")} />
          {formState.errors.email && (
            <span className="error-text">{formState.errors.email.message}</span>
          )}
        </div>

        <div className="form-row">
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input"
                 {...register("password")} />
          {formState.errors.password && (
            <span className="error-text">{formState.errors.password.message}</span>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="row animate-fade-in-up delay-400" style={{ justifyContent: "space-between", marginTop: "12px" }}>
        <button type="button" onClick={onReset}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-muted)", fontWeight: 500 }}>
          Forgot password?
        </button>
        <Link href="/signup" style={{ fontWeight: 600, color: "var(--color-primary)" }}>Create account</Link>
      </div>
    </div>
  );
}
