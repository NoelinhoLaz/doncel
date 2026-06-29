import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { createAdminServerClient, createAdminServiceClient } from "@/lib/supabaseServer";

async function getAgenciaId(): Promise<string> {
  const adminSupabase = await createAdminServerClient();
  const { data: { user } } = await adminSupabase.auth.getUser();
  if (!user) return "";
  const svc = createAdminServiceClient();
  const { data } = await svc.from("usuarios").select("agencia_id").eq("auth_user_id", user.id).single();
  return data?.agencia_id ?? "";
}

const SYSTEM_PROMPT = `Eres un Director Comercial de Élite y Consultor Estratégico experto en Account-Based Marketing (ABM) y recuperación de cuentas institucionales perdidas. Tu objetivo es analizar los datos de un cliente perdido este año y redactar una instrucción ejecutiva, quirúrgica y de alto rendimiento para reconquistar la cuenta en el próximo ciclo comercial.

Recibirás las variables del formulario (fechas, interés, observaciones) y, de forma prioritaria, uno de los siguientes 5 motivos de pérdida. Debes aplicar estrictamente la táctica asignada a ese motivo:

### 🎯 PLAN DE CONTRAATAQUE SEGÚN EL MOTIVO SELECCIONADO:

1. Si el motivo es "otra-agencia" (Viajan con otra agencia):
   - Táctica corporativa: Forzar la descommoditización rompiendo la inercia institucional. Prohibido competir bajando precios de forma lineal. Introducir en el próximo ciclo una propuesta técnica de valor añadido enfocada a la gestión de riesgos (coberturas médicas superiores, ratios de personal incluidos, cláusulas de cancelación premium) para evidenciar la vulnerabilidad y precariedad de la opción barata del competidor ante el comité decisor.

2. Si el motivo es "imposible-contacto" (Imposible conseguir contacto inicial):
   - Táctica corporativa: Pivotar drásticamente los canales de comunicación. Queda totalmente vetada la insistencia mediante canales digitales (email) o telefónicos estándar. Ejecutar un abordaje presencial institucional en frío dirigido directamente a la cadena de mando superior (Dirección, Jefatura de Estudios o Secretaría General), utilizando acreditaciones del sector y casos de éxito de la misma zona geográfica como palanca de reputación.

3. Si el motivo es "sin-respuesta" (No contestaron tras enviar presupuesto):
   - Táctica corporativa: Mitigar la desconexión comercial mediante la estrategia del "Foco de Duda Técnica". Evitar el seguimiento comercial reactivo ("saber qué les pareció"). El contraataque debe basarse en un contacto telefónico de urgencia o visita agendada argumentando una optimización crítica en el itinerario original o una renegociación de tarifas con proveedores de vuelos/hoteles en exclusiva antes de que finalice su ventana de decisión.

4. Si el motivo es "cancelado-colegio" (El colegio canceló el viaje este año):
   - Táctica corporativa: Explotar la necesidad latente de reactivación. La cuenta está caliente pero paralizada por factores coyunturales (falta de profesores involucrados o problemas organizativos internos). Abordar la cuenta de forma temprana facilitando herramientas de gestión integral llave en mano que reduzcan a cero la carga de trabajo administrativo y de responsabilidad legal del equipo docente.

5. Si el motivo es "precio" (Presupuesto fuera de su presupuesto):
   - Táctica corporativa: Reingeniería financiera e ingeniería de producto inversa. No se hacen descuentos. En el próximo ciclo se presenta una propuesta segmentada por módulos (cambio de categorías de alojamiento, optimización de fechas para temporadas de menor demanda, o sustitución de transportes) permitiendo al cliente realizar recortes de costes controlados por él mismo, manteniendo la rentabilidad de la agencia en el margen técnico.

### ⚠️ REGLAS ESTRICTAS DE SINTAXIS Y FORMATO:
- Estilo Ejecutivo: Uso imperativo de verbos en infinitivo o imperativo de alta carga comercial ("Ejecutar", "Pivotar", "Auditar", "Desmantelar"). Cero rodeos, directo a la acción comercial.
- Estructura: Un único bloque de texto continuo (Fase de Abordaje Temprano + Palanca de Cierre).
- Restricciones: Máximo 50-60 palabras. Prohibido añadir introducciones, títulos, saludos, listas con viñetas o conclusiones. El texto debe salir formateado para poblar directamente el textarea del agente.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { oportunidad, datos_modal_actual } = body;

    if (!datos_modal_actual?.observaciones_objeciones && !datos_modal_actual?.motivo_no_viaje) {
      return NextResponse.json({ success: false, error: "Faltan datos del cierre" }, { status: 400 });
    }

    const agenciaId = await getAgenciaId();
    const anthropic = await getAnthropicClient(agenciaId);

    const au = datos_modal_actual.auditoria ?? {};
    const auditoriaLines: string[] = [];
    if (au.competidor) auditoriaLines.push(`- Agencia competidora: ${au.competidor === 'otros' && au.competidor_otros ? au.competidor_otros : au.competidor}`);
    if (au.factor_competencia) auditoriaLines.push(`- Factor clave de pérdida: ${au.factor_competencia}`);
    if (au.contrapropuesta) auditoriaLines.push(`- Contrapropuesta presentada: ${au.contrapropuesta}`);
    if (au.canal_intentado) auditoriaLines.push(`- Canales intentados: ${Array.isArray(au.canal_intentado) ? au.canal_intentado.join(', ') : au.canal_intentado}`);
    if (au.numero_intentos) auditoriaLines.push(`- Intentos realizados: ${au.numero_intentos}`);
    if (au.tactica_fallida) auditoriaLines.push(`- Barrera detectada: ${au.tactica_fallida}`);
    if (au.ultimo_hito) auditoriaLines.push(`- Último hito de feedback: ${au.ultimo_hito}`);
    if (au.num_seguimientos) auditoriaLines.push(`- Seguimientos realizados: ${au.num_seguimientos}`);
    if (au.via_ultimo_intento) auditoriaLines.push(`- Vía del último intento: ${au.via_ultimo_intento}`);
    if (au.causa_cancelacion) auditoriaLines.push(`- Causa cancelación: ${au.causa_cancelacion}`);
    if (au.intencion_recuperar) auditoriaLines.push(`- Intención recuperar viaje: ${au.intencion_recuperar}`);
    if (au.brecha_precio) auditoriaLines.push(`- Brecha económica: ${au.brecha_precio}`);
    if (au.elementos_caros) auditoriaLines.push(`- Elementos que encarecieron: ${Array.isArray(au.elementos_caros) ? au.elementos_caros.join(', ') : au.elementos_caros}`);
    const auditoriaBlock = auditoriaLines.length > 0 ? `\nDatos de auditoría adicionales:\n${auditoriaLines.join('\n')}` : '';

    const userMsg = `Datos del centro:
- Nombre: ${oportunidad?.nombre_centro || "Desconocido"}
- Valor estimado: ${oportunidad?.valor_estimado ? `${oportunidad.valor_estimado.toLocaleString("es-ES")} €` : "No indicado"}
- Destino de interés: ${oportunidad?.destino_interesado || "No indicado"}

Datos del cierre:
- ¿Por qué NO viajaron?: ${datos_modal_actual.motivo_no_viaje || "No indicado"}
- ¿Cuándo deciden el viaje?: ${datos_modal_actual.cuando_deciden || "No indicado"}
- Cuándo visitar el próximo año: ${datos_modal_actual.cuando_visitar || "No indicado"}
- Interés del profesor: ${datos_modal_actual.interes_profesor || "Medio"}
- Observaciones / Objeciones: ${datos_modal_actual.observaciones_objeciones || "Sin observaciones"}${auditoriaBlock}

Redacta la estrategia para la campaña próxima.`;

    const aiRes = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }],
    });

    const estrategia = aiRes.content[0].type === "text" ? aiRes.content[0].text.trim() : "";

    return NextResponse.json({ success: true, estrategia });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
