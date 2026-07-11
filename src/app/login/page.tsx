"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icons } from "@/lib/icons";
import styles from "./page.module.css";

const REDIRECT_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: REDIRECT_URL,
    });
    setForgotLoading(false);
    if (error) {
      setForgotError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      if (error.message === "Invalid login credentials") {
        setError("Email o contraseña incorrectos. Verifica también si has confirmado tu email.");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      // Login exitoso, verificar rol y agencia_id consultando nuestra API interna (evita problemas de RLS y bundler)
      let usuario = null;
      try {
        const res = await fetch(`/api/perfil?authUserId=${data.user.id}`);
        if (res.ok) {
          const resData = await res.json();
          usuario = resData.usuario;
        }
      } catch (fetchErr) {
        console.error("Error al obtener perfil desde la API:", fetchErr);
      }

      if (!usuario) {
        await supabase.auth.signOut();
        setError("Tu usuario no tiene un perfil en el sistema.");
        setLoading(false);
        return;
      }

      if (!usuario.agencia_id && usuario.rol !== "SuperAdmin") {
        await supabase.auth.signOut();
        setError("No tienes ninguna agencia asignada. Contacta con soporte.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      
      router.refresh();
    }
  };

  if (forgotMode) {
    return (
      <main className={styles.container}>
        <section className={styles.leftColumn}>
          <div className={styles.formBox}>
            <img src="/logo_alivia.png" alt="Alivia" className={styles.logo} />
            <h1 className={styles.title}>Recuperar contraseña</h1>
            {forgotSent ? (
              <div style={{ textAlign: "center", display: "grid", gap: "1rem" }}>
                <p style={{ color: "#fca5a5", background: "rgba(220, 38, 38, 0.2)", border: "1px solid rgba(220, 38, 38, 0.3)", borderRadius: "8px", padding: "0.75rem", fontSize: "0.875rem" }}>
                  Te hemos enviado un email con el enlace para restablecer tu contraseña.
                </p>
                <button className={styles.secondaryButton} onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                  Volver al inicio de sesión
                </button>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleForgot}>
                {forgotError && <p className={styles.error}>{forgotError}</p>}
                <label className={styles.label} htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="admin@agencia.com"
                  className={styles.input}
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
                <button type="submit" className={styles.button} disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Enviar enlace"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={() => setForgotMode(false)}>
                  Volver al inicio de sesión
                </button>
              </form>
            )}
          </div>
        </section>
        <section className={styles.rightColumn} />
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <section className={styles.leftColumn}>
        <div className={styles.formBox}>
          <img src="/logo_alivia.png" alt="Alivia" className={styles.logo} />
          <form className={styles.form} onSubmit={handleSubmit}>
            {error && <p className={styles.error}>{error}</p>}
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="admin@agencia.com"
              className={styles.input}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className={styles.label} htmlFor="password">
              Contraseña
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className={styles.input}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
              </button>
            </div>

            <button type="submit" className={styles.button} disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setForgotMode(true)}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </div>
      </section>
      <section className={styles.rightColumn} />
    </main>
  );
}
