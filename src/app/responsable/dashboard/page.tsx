import { redirect } from "next/navigation";
import { getResponsableSession, getResponsableExpediente, getResponsableViajeros } from "@/actions/responsable";
import DashboardClient from "./DashboardClient";

export default async function ResponsableDashboardPage() {
  const session = await getResponsableSession();
  if (!session) {
    redirect("/responsable/login");
  }

  const [expediente, viajeros] = await Promise.all([
    getResponsableExpediente(),
    getResponsableViajeros(),
  ]);

  if (!expediente) {
    redirect("/responsable/login");
  }

  return <DashboardClient expediente={expediente} initialViajeros={viajeros} />;
}
