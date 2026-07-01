import styles from "../../portal/login/page.module.css";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function ProveedorLoginPage({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <h1 className={styles.title}>Acceso Proveedores</h1>
        <p className={styles.subtitle}>
          Introduce tu email y CIF/NIF para acceder a tu panel de servicios.
        </p>
        <form className={styles.form} method="post" action="/api/proveedor/login">
          {error && (
            <p className={styles.error}>{decodeURIComponent(error)}</p>
          )}
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="tu@empresa.com"
            className={styles.input}
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="cif_nif">
            CIF / NIF
          </label>
          <input
            id="cif_nif"
            name="cif_nif"
            type="text"
            placeholder="B12345678"
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
