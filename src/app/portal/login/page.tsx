import styles from "./page.module.css";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function PortalLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Acceso Clientes</h1>
        <p className={styles.subtitle}>
          Introduce tu email y DNI/NIF para acceder a tus expedientes.
        </p>
        <form className={styles.form} method="post" action="/api/portal/login">
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
          <label className={styles.label} htmlFor="dni">DNI / NIF</label>
          <input
            id="dni"
            name="dni"
            type="text"
            placeholder="12345678Z"
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
