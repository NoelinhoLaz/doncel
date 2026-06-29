"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icons } from "@/lib/icons";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Iniciar sesión</h1>
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
        </form>
      </section>
    </main>
  );
}
