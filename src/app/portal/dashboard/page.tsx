import { redirect } from "next/navigation";
import {
  getPortalSession,
  getPortalExpedientes,
  getPortalPagos,
  getPortalFacturas,
} from "@/actions/portal";
import DashboardClient from "./DashboardClient";

const VALID_TABS = ["home", "itinerario", "pagos", "docs", "user"] as const;
type Tab = (typeof VALID_TABS)[number];

interface Props {
  searchParams: Promise<{ tab?: string; firmado?: string }>;
}

export default async function PortalDashboardPage({ searchParams }: Props) {
  const session = await getPortalSession();
  if (!session) {
    redirect("/portal/login");
  }

  const { tab, firmado } = await searchParams;
  const initialTab: Tab = VALID_TABS.includes(tab as Tab) ? (tab as Tab) : "home";

  const [expedientes, pagosData, facturas] = await Promise.all([
    getPortalExpedientes(),
    getPortalPagos(),
    getPortalFacturas(),
  ]);

  return (
    <DashboardClient
      session={session}
      initialExpedientes={expedientes}
      initialPagos={pagosData.pagos}
      initialResumen={pagosData.resumen}
      colorPrimario={pagosData.colorPrimario || "#2563eb"}
      initialFacturas={facturas}
      initialTab={initialTab}
      firmadoExito={firmado === "1"}
    />
  );
}
