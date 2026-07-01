import { redirect } from "next/navigation";
import { getProveedorSession, getProveedorDashboard } from "@/actions/proveedor";
import ProveedorDashboardClient from "./DashboardClient";

export default async function ProveedorDashboardPage() {
  const session = await getProveedorSession();
  if (!session) {
    redirect("/proveedor/login");
  }

  const servicios = await getProveedorDashboard();

  return (
    <ProveedorDashboardClient
      nombre={session.nombre}
      cifNif={session.cifNif}
      servicios={servicios}
    />
  );
}
