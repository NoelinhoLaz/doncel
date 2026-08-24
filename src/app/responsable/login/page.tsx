import styles from "./page.module.css";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function ResponsableLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Portal del responsable</h1>
        <p className={styles.subtitle}>
          Introduce tu email y el código de acceso de tu expediente para gestionar a los viajeros de tu grupo.
        </p>
        <form className={styles.form} method="post" action="/api/responsable/login">
          {error && <p className={styles.error}>{decodeURIComponent(error)}</p>}
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            className={styles.input}
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="codigo_acceso">Código de acceso</label>
          <input
            id="codigo_acceso"
            name="codigo_acceso"
            type="text"
            placeholder="XK7P-QM2R-9J"
            className={styles.input}
            autoComplete="off"
            required
          />
          <button type="submit" className={styles.button}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
