"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  ScanLine,
  MessageSquare,
  Bot,
  Send,
  Camera,
  FileText,
  MapPin,
  Heart,
  ShoppingBag,
  Lock,
  User,
  Users,
  CreditCard,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  Copy,
  Calendar,
  Mars,
  Venus,
  CircleDashed,
} from "lucide-react";
import type {
  ViajeInfo,
  ViajeroForm,
  PagadorForm,
  ExtraSeleccionado,
} from "@/types/registro";
import styles from "./registro.module.css";
import chatStyles from "./chat.module.css";

// ── Datos vacíos ──────────────────────────────────────────────────────────────

const VIAJERO_VACIO: ViajeroForm = {
  nombre: "",
  apellidos: "",
  dni: "",
  dni_caducidad: "",
  pasaporte: "",
  pasaporte_caducidad: "",
  fecha_nacimiento: "",
  email: "",
  telefono: "",
  direccion: "",
};

const PAGADOR_VACIO: PagadorForm = {
  nombre: "",
  apellidos: "",
  dni: "",
  direccion: "",
};

// ── Tipos del chat ────────────────────────────────────────────────────────────

type ChatMessage =
  | { from: "bot"; text: React.ReactNode }
  | { from: "user"; text: string }
  | { from: "widget"; widget: ChatWidget };

interface OcrDatos {
  nombre: string;
  apellidos: string;
  tipoDoc: "dni" | "pasaporte";
  numeroDoc: string;
  fechaNacimiento: string;
  fechaCaducidad: string;
  sexo?: string;
  numeroSoporte?: string;
  nacionalidad?: string;
  lugarNacimiento?: string;
  domicilio?: string;
  mrzLinea1?: string;
  mrzLinea2?: string;
}

type ChatWidget =
  | { type: "ocr" }
  | { type: "ocr_confirm"; datos: OcrDatos }
  | { type: "nombre" }
  | { type: "tipo_doc" }
  | { type: "numero_doc"; tipoDoc: "dni" | "pasaporte" }
  | { type: "fecha_nacimiento" }
  | { type: "fecha_caducidad_doc"; tipoDoc: "dni" | "pasaporte" }
  | { type: "contacto" }
  | { type: "tutor" }
  | { type: "quien_paga"; viajeros: ViajeroForm[]; tutores?: { nombre: string; apellidos: string; email: string; telefono: string }[] }
  | { type: "seleccionar_viajero_pagador"; viajeros: ViajeroForm[] }
  | { type: "datos_pagador" }
  | { type: "direccion"; viajerosConDireccion: { nombre: string; direccion: string }[] }
  | { type: "sexo" }
  | { type: "numero_soporte" }
  | { type: "alergias" }
  | { type: "extras"; viaje: ViajeInfo; numViajeros: number }
  | { type: "mas_viajeros" }
  | { type: "inicio_viajero" }
  | { type: "forma_pago"; viaje: ViajeInfo; viajeros: ViajeroForm[]; pagador: PagadorForm; extras: ExtraSeleccionado[]; total: number }
  | { type: "resumen"; viaje: ViajeInfo; viajeros: ViajeroForm[]; pagador: PagadorForm; extras: ExtraSeleccionado[]; total: number; metodoPago: string };

interface Props {
  viaje: ViajeInfo;
  logoUrl: string | null;
  brandColor: string | null;
  domain: string;
}

// ── Validaciones ──────────────────────────────────────────────────────────────

function validarDNI(dni: string): boolean {
  const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
  const cleaned = dni.trim().toUpperCase();
  if (!/^\d{8}[A-Z]$/.test(cleaned)) return false;
  const num = parseInt(cleaned.slice(0, 8), 10);
  return cleaned[8] === LETRAS[num % 23];
}

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function formatEuros(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function RegistroClient({ viaje, logoUrl, brandColor, domain }: Props) {
  const color = brandColor ?? "#2563eb";
  const [modoClasico, setModoClasico] = useState(false);

  if (modoClasico) {
    return <FormularioClasico viaje={viaje} logoUrl={logoUrl} brandColor={brandColor} domain={domain} onChat={() => setModoClasico(false)} />;
  }

  return <ChatRegistro viaje={viaje} logoUrl={logoUrl} color={color} domain={domain} onModoClasico={() => setModoClasico(true)} />;
}

// ── Chat de registro ──────────────────────────────────────────────────────────

function ChatRegistro({
  viaje,
  logoUrl,
  color,
  domain,
  onModoClasico,
}: {
  viaje: ViajeInfo;
  logoUrl: string | null;
  color: string;
  domain: string;
  onModoClasico: () => void;
}) {
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [botEscribiendo, setBotEscribiendo] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  // Estado de datos del viajero actual
  const [viajeros, setViajeros] = useState<ViajeroForm[]>([]);
  const [viajero, setViajero] = useState<ViajeroForm>({ ...VIAJERO_VACIO });
  const [tutor, setTutor] = useState({ nombre: "", telefono: "", email: "" });
  const [pagador, setPagador] = useState<PagadorForm>({ ...PAGADOR_VACIO });
  const [extras, setExtras] = useState<ExtraSeleccionado[]>([]);
  const [metodoPago, setMetodoPago] = useState("");
  const [esMenor, setEsMenor] = useState(false);
  const [tipoDoc, setTipoDoc] = useState<"dni" | "pasaporte">("dni");

  // Historial de pasos para el botón de volver
  // Cada entrada: { widgetIdx: número de mensajes al entrar, label: nombre del paso }
  const [historialPasos, setHistorialPasos] = useState<{ mensajes: ChatMessage[]; label: string }[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const addBotMessage = useCallback((text: React.ReactNode): Promise<void> => {
    return new Promise((resolve) => {
      setBotEscribiendo(true);
      setTimeout(() => {
        setBotEscribiendo(false);
        setStepKey((k) => k + 1);
        setMensajes((prev) => [...prev, { from: "bot", text }]);
        resolve();
      }, 400);
    });
  }, []);

  const addWidget = useCallback((widget: ChatWidget): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setMensajes((prev) => [...prev, { from: "widget", widget }]);
        resolve();
      }, 100);
    });
  }, []);


  // Quita el último widget (lo convierte en burbuja de usuario)
  const collapseLastWidget = useCallback((userText: string) => {
    setMensajes((prev) => {
      const copia = [...prev];
      // Elimina el último mensaje tipo widget
      const idx = [...copia].reverse().findIndex((m) => m.from === "widget");
      if (idx !== -1) copia.splice(copia.length - 1 - idx, 1);
      return [...copia, { from: "user", text: userText } as ChatMessage];
    });
  }, []);

  const [iniciado, setIniciado] = useState(false);

  // Guarda snapshot del estado de mensajes antes de avanzar al siguiente paso
  function pushPaso(label: string) {
    setHistorialPasos((prev) => [...prev, { mensajes: [...mensajes], label }]);
  }

  function volverPaso() {
    if (historialPasos.length === 0) {
      // Volver a bienvenida
      setIniciado(false);
      setMensajes([]);
      setHistorialPasos([]);
      return;
    }
    const prev = historialPasos[historialPasos.length - 1];
    setMensajes(prev.mensajes);
    setHistorialPasos((h) => h.slice(0, -1));
  }

  // Etiqueta del paso anterior para mostrar en el botón de volver
  const labelAnterior = historialPasos.length === 0
    ? "Bienvenida"
    : historialPasos[historialPasos.length - 1].label;

  async function iniciarChat(modo: "ocr" | "manual" | "clasico") {
    if (modo === "clasico") {
      onModoClasico();
      return;
    }
    setIniciado(true);
    if (modo === "ocr") {
      await addBotMessage("Haz una foto al DNI o pasaporte del viajero. Intenta que esté bien iluminado y sin reflejos para obtener mejores resultados.");
      await addWidget({ type: "ocr" });
      return;
    } else {
      await addBotMessage(<>¡De acuerdo, vamos paso a paso! Vamos a empezar con los <strong>datos de la persona que va a viajar</strong>. ¿Cuál es el nombre y apellidos del viajero, tal y como aparecen en su documentación oficial?</>);
    }
    await addWidget({ type: "nombre" });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, botEscribiendo]);

  // ── Handlers de cada paso ─────────────────────────────────────────────────

  async function handleElegirManual() {
    collapseLastWidget("Prefiero escribir los datos paso a paso");
    pushPaso("Bienvenida");
    await addBotMessage(<>¡De acuerdo, vamos paso a paso! Vamos a empezar con los <strong>datos de la persona que va a viajar</strong>. ¿Cuál es el nombre y apellidos del viajero, tal y como aparecen en su documentación oficial?</>);
    await addWidget({ type: "nombre" });
  }

  async function handleOCR() {
    collapseLastWidget("Adjuntar foto del documento");
    pushPaso("Bienvenida");
    await addWidget({ type: "ocr" });
  }

  async function handleOcrDone(datos: OcrDatos) {
    collapseLastWidget("Documento escaneado");
    pushPaso("Escaneo de documento");
    await addBotMessage("He leído el documento. Revisa los datos y corrígelos si es necesario antes de continuar:");
    await addWidget({ type: "ocr_confirm", datos });
  }

  async function handleOcrConfirm(datos: OcrDatos) {
    collapseLastWidget(`${datos.nombre} ${datos.apellidos}`);
    pushPaso("Confirmación OCR");
    const edad = calcularEdad(datos.fechaNacimiento);
    const menor = edad < 18;
    setEsMenor(menor);
    setTipoDoc(datos.tipoDoc);
    const sexoOcr = (datos.sexo === "M" || datos.sexo === "F") ? datos.sexo : null;
    const soporteOcr = datos.numeroSoporte || null;
    setViajero((v) => ({
      ...v,
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      fecha_nacimiento: datos.fechaNacimiento,
      ...(datos.tipoDoc === "dni"
        ? { dni: datos.numeroDoc, dni_caducidad: datos.fechaCaducidad }
        : { pasaporte: datos.numeroDoc, pasaporte_caducidad: datos.fechaCaducidad }),
      ...(sexoOcr && { sexo: sexoOcr }),
      ...(soporteOcr && { numero_soporte: soporteOcr }),
    }));

    // Log de todos los campos capturados por OCR
    console.log("=== OCR DATOS APLICADOS AL VIAJERO ===", {
      nombre: datos.nombre, apellidos: datos.apellidos,
      tipoDoc: datos.tipoDoc, numeroDoc: datos.numeroDoc,
      fechaNacimiento: datos.fechaNacimiento, fechaCaducidad: datos.fechaCaducidad,
      sexo: datos.sexo, numeroSoporte: datos.numeroSoporte,
      nacionalidad: datos.nacionalidad, lugarNacimiento: datos.lugarNacimiento,
      domicilio: datos.domicilio, mrzLinea1: datos.mrzLinea1, mrzLinea2: datos.mrzLinea2,
    });

    await addBotMessage(<>Perfecto. ¿Cuál es el email y el teléfono de contacto de <strong>{datos.nombre}</strong>?</>);
    await addWidget({ type: "contacto" });
  }

  async function handleNombre(nombreCompleto: string) {
    const partes = nombreCompleto.trim().split(/\s+/);
    const nombre = partes[0] ?? "";
    const apellidos = partes.slice(1).join(" ");
    collapseLastWidget(nombreCompleto.trim());
    pushPaso("Nombre y Apellidos");
    setViajero((v) => ({ ...v, nombre, apellidos }));
    await addBotMessage(<>Perfecto. ¿Cuál es la fecha de nacimiento de <strong>{nombre}</strong>?</>);
    await addWidget({ type: "fecha_nacimiento" });
  }

  async function handleFechaNacimiento(fecha: string) {
    collapseLastWidget(new Date(fecha + "T12:00:00").toLocaleDateString("es-ES"));
    pushPaso("Fecha de nacimiento");
    const edad = calcularEdad(fecha);
    const menor = edad < 18;
    setEsMenor(menor);
    setViajero((v) => ({ ...v, fecha_nacimiento: fecha }));
    await addBotMessage(<>¿Qué tipo de documento de identidad va a utilizar <strong>{viajero.nombre}</strong> para este viaje?</>);
    await addWidget({ type: "tipo_doc" });
  }

  async function handleTipoDoc(tipo: "dni" | "pasaporte") {
    collapseLastWidget(tipo === "dni" ? "DNI" : "Pasaporte");
    pushPaso("Tipo de documento");
    setTipoDoc(tipo);
    await addBotMessage(<>Perfecto, ahora introduce el número de documento de <strong>{viajero.nombre}</strong>:</>);
    await addWidget({ type: "numero_doc", tipoDoc: tipo });
  }

  async function handleNumeroDoc(numero: string, docTipo: "dni" | "pasaporte") {
    if (docTipo === "dni" && !validarDNI(numero)) {
      await addBotMessage("Ese DNI no parece válido. Por favor, comprueba el número e inténtalo de nuevo.");
      await addWidget({ type: "numero_doc", tipoDoc: docTipo });
      return;
    }
    collapseLastWidget(numero);
    pushPaso("Número de documento");
    if (docTipo === "dni") {
      setViajero((v) => ({ ...v, dni: numero }));
    } else {
      setViajero((v) => ({ ...v, pasaporte: numero }));
    }
    await addBotMessage(<>¿Cuál es la fecha de caducidad del documento de <strong>{viajero.nombre}</strong>?</>);
    await addWidget({ type: "fecha_caducidad_doc", tipoDoc: docTipo });
  }

  async function handleFechaCaducidad(fecha: string) {
    collapseLastWidget(new Date(fecha + "T12:00:00").toLocaleDateString("es-ES"));
    pushPaso("Caducidad del documento");
    if (tipoDoc === "dni") {
      setViajero((v) => ({ ...v, dni_caducidad: fecha }));
    } else {
      setViajero((v) => ({ ...v, pasaporte_caducidad: fecha }));
    }
    await addBotMessage(<>¿Cuál es la dirección postal de <strong>{viajero.nombre}</strong>?</>);
    await addWidget({ type: "direccion", viajerosConDireccion: viajeros.filter((v) => v.direccion).map((v) => ({ nombre: v.nombre, direccion: v.direccion })) });
  }

  async function handleDireccion(calle: string, cp: string, localidad: string, provincia: string) {
    const resumen = [calle, cp, localidad, provincia].filter(Boolean).join(", ");
    collapseLastWidget(resumen);
    pushPaso("Dirección");
    setViajero((v) => ({ ...v, direccion: resumen }));
    await addBotMessage(<>Puedes indicar un email y teléfono del viajero de manera <strong>opcional</strong>, solo se usará para avisos urgentes durante el viaje. {esMenor ? <>Todas las comunicaciones principales se realizarán a través del <strong>tutor</strong> que indicaremos más adelante.</> : <>Todas las comunicaciones principales se realizarán a través del <strong>cliente responsable del contrato</strong> que indicaremos más adelante.</>}</>);
    await addWidget({ type: "contacto" });
  }

  async function handleContacto(email: string, telefono: string) {
    collapseLastWidget([email, telefono].filter(Boolean).join(" · ") || "Sin datos de contacto");
    pushPaso("Contacto");
    setViajero((v) => ({ ...v, email, telefono }));
    await addBotMessage(<>Por normativa estricta del Ministerio del Interior (Real Decreto 933/2021), estamos obligados a registrar el sexo y el número de soporte de todos los pasajeros. Para empezar, ¿qué sexo figura oficialmente en el documento de identidad de <strong>{viajero.nombre}</strong>?</>);
    await addWidget({ type: "sexo" });
  }

  async function handleSexo(sexo: "M" | "F") {
    const label = sexo === "M" ? "Masculino" : "Femenino";
    collapseLastWidget(label);
    pushPaso("Sexo");
    setViajero((v) => ({ ...v, sexo }));
    await addBotMessage(<>¡Gracias! Y ya por último... sabemos que esto es un poco laborioso, pero también necesitamos el número de soporte del documento de <strong>{viajero.nombre}</strong> para que el Ministerio valide su registro. Tranquilo, es un código de 3 letras y 6 números (ejemplo: AAA111222).</>);
    await addWidget({ type: "numero_soporte" });
  }

  async function handleNumeroSoporte(soporte: string) {
    collapseLastWidget(soporte);
    pushPaso("Número de soporte");
    setViajero((v) => ({ ...v, numero_soporte: soporte }));
    await addBotMessage(<>¿Tiene <strong>{viajero.nombre}</strong> alguna alergia médica, intolerancia alimentaria o dieta especial que debamos reportar a los hoteles, restaurantes y aerolíneas?</>);
    await addWidget({ type: "alergias" });
  }

  function guardarViajeroEnLista(
    v: ViajeroForm,
    extrasViajero: ExtraSeleccionado[],
    alergiasViajero?: string[],
    tutorViajero?: { nombre: string; telefono: string; email: string } | null,
  ) {
    const viajeroCompleto: ViajeroForm = {
      ...v,
      extras: extrasViajero,
      alergias: alergiasViajero ?? v.alergias ?? [],
      tutor: tutorViajero ?? v.tutor ?? null,
    };
    setViajeros((prev) => {
      const idx = prev.findIndex((x) => x.nombre === v.nombre && x.apellidos === v.apellidos);
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = viajeroCompleto;
        return copia;
      }
      return [...prev, viajeroCompleto];
    });
  }

  async function handleAlergias(seleccionadas: string[]) {
    const texto = seleccionadas.length === 0 || seleccionadas.includes("Ninguna")
      ? "Ninguna restricción"
      : seleccionadas.join(", ");
    collapseLastWidget(texto);
    pushPaso("Alergias");
    setViajero((v) => ({ ...v, alergias: seleccionadas }));
    if (viaje.extras.length > 0) {
      await addBotMessage("El organizador del viaje ha preparado una serie de servicios opcionales. ¿Quieres añadir alguno a tu reserva?");
      await addWidget({ type: "extras", viaje, numViajeros: viajeros.length + 1 });
    } else {
      guardarViajeroEnLista({ ...viajero, alergias: seleccionadas }, []);
      await irAMasViajeros();
    }
  }

  async function handleExtras(extrasSeleccionados: ExtraSeleccionado[]) {
    const totalEx = extrasSeleccionados.reduce((s, e) => s + e.pvp * e.cantidad, 0);
    const resumenTexto = extrasSeleccionados.length > 0
      ? `${extrasSeleccionados.length} extra(s) — +${formatEuros(totalEx)}`
      : "Sin extras";
    collapseLastWidget(resumenTexto);
    guardarViajeroEnLista(viajero, extrasSeleccionados);
    await irAMasViajeros();
  }

  async function irAMasViajeros() {
    if (esMenor) {
      await addBotMessage("Al ser menor de edad, necesitamos que un tutor legal autorice su inscripción en el viaje y firme la documentación necesaria. ¿Quién será el tutor responsable?");
      await addWidget({ type: "tutor" });
    } else {
      await addBotMessage(<>Los datos de <strong>{viajero.nombre}</strong> están guardados. ¿Hay algún otro viajero que quieras registrar en este viaje?</>);
      await addWidget({ type: "mas_viajeros" });
    }
  }

  async function handleTutor(nombre: string, telefono: string, email: string) {
    collapseLastWidget(`Tutor: ${nombre}`);
    pushPaso("Datos del tutor");
    const tutorData = { nombre, telefono, email };
    setTutor(tutorData);
    setViajero((v) => ({ ...v, tutor: tutorData }));
    // Actualizar también en la lista si ya fue guardado
    setViajeros((prev) => prev.map((v) =>
      v.nombre === viajero.nombre && v.apellidos === viajero.apellidos
        ? { ...v, tutor: tutorData }
        : v
    ));
    await addBotMessage(<>Perfecto. ¿Hay algún otro viajero que quieras registrar en este viaje?</>);
    await addWidget({ type: "mas_viajeros" });
  }

  async function handleInicioViajero(modo: "ocr" | "manual") {
    if (modo === "ocr") {
      collapseLastWidget("Adjuntar foto del documento");
      await addBotMessage("Haz una foto al DNI o pasaporte del viajero. Intenta que esté bien iluminado y sin reflejos para obtener mejores resultados.");
      await addWidget({ type: "ocr" });
    } else {
      collapseLastWidget("Escribir los datos");
      await addBotMessage(<>¡De acuerdo! ¿Cuál es el nombre y apellidos del viajero, tal y como aparecen en su documentación oficial?</>);
      await addWidget({ type: "nombre" });
    }
  }

  async function handleMasViajeros(añadir: boolean) {
    if (añadir) {
      collapseLastWidget("Sí, añadir otro viajero");
      pushPaso(`Viajero ${viajeros.length + 1}`);
      setViajero({ ...VIAJERO_VACIO });
      setEsMenor(false);
      setTipoDoc("dni");
      await addBotMessage(<>¿Cómo quieres introducir los datos del siguiente viajero?</>);
      await addWidget({ type: "inicio_viajero" });
    } else {
      collapseLastWidget("No, continuar");
      pushPaso("Más viajeros");
      // Tutores únicos de los viajeros menores
      const tutoresUnicos = Object.values(
        viajeros
          .filter((v) => v.tutor?.nombre)
          .reduce<Record<string, { nombre: string; apellidos: string; email: string; telefono: string }>>((acc, v) => {
            const key = v.tutor!.nombre;
            if (!acc[key]) {
              const partes = v.tutor!.nombre.trim().split(" ");
              acc[key] = {
                nombre: partes[0] ?? "",
                apellidos: partes.slice(1).join(" "),
                email: v.tutor!.email ?? "",
                telefono: v.tutor!.telefono ?? "",
              };
            }
            return acc;
          }, {})
      );
      await addBotMessage("Para la emisión de las facturas del viaje, ¿quién se va a encargar de realizar los pagos?");
      await addWidget({ type: "quien_paga", viajeros, tutores: tutoresUnicos });
    }
  }

  async function handleQuienPaga(opcion: "viajero" | "otro" | "tutor", tutorData?: { nombre: string; apellidos: string; email: string; telefono: string }) {
    if (opcion === "tutor" && tutorData) {
      collapseLastWidget(`${tutorData.nombre} ${tutorData.apellidos}`.trim());
      pushPaso("Responsable de pago");
      setPagador({ nombre: tutorData.nombre, apellidos: tutorData.apellidos, dni: "", direccion: "", email: tutorData.email, telefono: tutorData.telefono });
      await addBotMessage(`Confirma o completa los datos de facturación de ${tutorData.nombre}:`);
      await addWidget({ type: "datos_pagador" });
    } else if (opcion === "viajero") {
      collapseLastWidget("Un viajero");
      pushPaso("Responsable de pago");
      const mayores = viajeros.filter((v) => calcularEdad(v.fecha_nacimiento) >= 18);
      if (mayores.length === 1) {
        const v = mayores[0];
        setPagador({ nombre: v.nombre, apellidos: v.apellidos, dni: v.dni, direccion: v.direccion, email: v.email, telefono: v.telefono });
        await addBotMessage(`Confirma o completa los datos de facturación de ${v.nombre}:`);
        await addWidget({ type: "datos_pagador" });
      } else {
        await addBotMessage("¿Cuál de los viajeros será el responsable del pago?");
        await addWidget({ type: "seleccionar_viajero_pagador", viajeros: mayores });
      }
    } else {
      collapseLastWidget("Otra persona / Empresa");
      pushPaso("Responsable de pago");
      await addBotMessage("De acuerdo, indica los datos fiscales de la persona o entidad que se hará cargo de los costes del viaje:");
      await addWidget({ type: "datos_pagador" });
    }
  }

  async function handleSeleccionarViajeroPagador(v: ViajeroForm) {
    collapseLastWidget(`${v.nombre} ${v.apellidos}`);
    pushPaso("Viajero pagador");
    setPagador({ nombre: v.nombre, apellidos: v.apellidos, dni: v.dni, direccion: v.direccion, email: v.email, telefono: v.telefono });
    await addBotMessage(`Confirma o completa los datos de facturación de ${v.nombre}:`);
    await addWidget({ type: "datos_pagador" });
  }

  async function handleDatosPagador(p: PagadorForm) {
    collapseLastWidget(`${p.nombre} ${p.apellidos}`);
    pushPaso("Datos de facturación");
    setPagador(p);
    const viajerosActuales = viajeros.length > 0 ? viajeros : [viajero];
    const totalFinal = viajerosActuales.reduce((s, v) => {
      const extrasV = v.extras ?? [];
      return s + viaje.pvp_por_viajero + extrasV.reduce((se, e) => se + e.pvp * e.cantidad, 0);
    }, 0);
    const nombresViajeros = viajerosActuales.map((v) => v.nombre).join(", ");
    await addBotMessage(<>Perfecto. Aquí tienes el resumen con los datos de <strong>{nombresViajeros}</strong>. Revísalo antes de continuar:</>);
    await addWidget({ type: "resumen", viaje, viajeros: viajerosActuales, pagador: p, extras: [], total: totalFinal, metodoPago: "" });
  }




  async function irAlResumen(metodo: string, viajerosData: ViajeroForm[], pagadorData: PagadorForm, total: number) {
    const nombresViajeros = viajerosData.map((v) => v.nombre).join(", ");
    await addBotMessage(<>¡Hemos terminado! Aquí tienes el resumen con los datos de <strong>{nombresViajeros}</strong>. Por favor, revísalo antes de confirmar.</>);
    await addWidget({ type: "resumen", viaje, viajeros: viajerosData, pagador: pagadorData, extras: [], total, metodoPago: metodo });
  }

  async function handleIrFormaPago(viajerosData: ViajeroForm[], pagadorData: PagadorForm, _extras: ExtraSeleccionado[], total: number) {
    collapseLastWidget("Revisado");
    pushPaso("Resumen");
    const numViajeros = viajerosData.length || 1;
    const totalExtras = viajerosData.reduce((s, v) => s + (v.extras ?? []).reduce((se, e) => se + e.pvp * e.cantidad, 0), 0);
    const plazos = viaje.plazos;
    let mensajePlazos: React.ReactNode = <>¿Cómo quieres realizar el pago?</>;
    if (plazos.length > 1) {
      const importes = plazos.map((p, i) => {
        const esUltimo = i === plazos.length - 1;
        return p.importe * numViajeros + (esUltimo ? totalExtras : 0);
      });
      mensajePlazos = <>Puedes realizar el pago en <strong>{plazos.length} plazos</strong> ({importes.map((imp) => formatEuros(imp)).join(", ")}) o de forma <strong>total</strong>. ¿Cómo quieres realizar el pago?</>;
    } else if (plazos.length === 1) {
      const imp = plazos[0].importe * numViajeros + totalExtras;
      mensajePlazos = <>El importe total a abonar es <strong>{formatEuros(imp)}</strong>. ¿Cómo quieres realizar el pago?</>;
    }
    await addBotMessage(mensajePlazos);
    await addWidget({ type: "forma_pago", viaje, viajeros: viajerosData, pagador: pagadorData, extras: [], total });
  }

  async function handleFormaPago(metodo: string, viajerosData: ViajeroForm[], pagadorData: PagadorForm, _extras: ExtraSeleccionado[], total: number) {
    setMetodoPago(metodo);
    const label = viaje.metodo_pago.find((m) => m.id === metodo)?.nombre ?? metodo;
    collapseLastWidget(label);
    await irAlResumen(metodo, viajerosData, pagadorData, total);
  }

  async function handleConfirmar() {
    collapseLastWidget("Registro enviado");

    // Calcular plazos con importes reales
    const numViajeros = viajeros.length || 1;
    const totalExtras = viajeros.reduce(
      (s, v) => s + (v.extras ?? []).reduce((se, e) => se + e.pvp * e.cantidad, 0), 0
    );
    const plazosCalculados = viaje.plazos.map((p, i) => {
      const esUltimo = i === viaje.plazos.length - 1;
      return {
        descripcion: p.descripcion,
        fecha: p.fecha,
        importeCalculado: p.importe * numViajeros + (esUltimo ? totalExtras : 0),
      };
    });

    const { submitRegistro } = await import("@/actions/portal");
    const result = await submitRegistro({
      domain,
      slug: viaje.slug,
      viajeros: viajeros.map((v) => ({
        nombre: v.nombre,
        apellidos: v.apellidos,
        dni: v.dni,
        dni_caducidad: v.dni_caducidad,
        pasaporte: v.pasaporte,
        pasaporte_caducidad: v.pasaporte_caducidad,
        fecha_nacimiento: v.fecha_nacimiento,
        sexo: v.sexo ?? null,
        numero_soporte: v.numero_soporte ?? null,
        email: v.email,
        telefono: v.telefono,
        direccion: v.direccion,
        alergias: v.alergias ?? [],
        extras: (v.extras ?? []).map((e) => ({
          id: e.id,
          nombre: e.nombre,
          pvp: e.pvp,
          cantidad: e.cantidad,
        })),
        tutor: v.tutor ?? null,
      })),
      pagador,
      metodoPago,
      plazosCalculados,
    });

    if (result?.error) {
      await addBotMessage(`Ha ocurrido un error al guardar el registro: ${result.error}. Por favor, inténtalo de nuevo o contacta con la agencia.`);
      return;
    }
    setEnviado(true);
  }

  // ── Renderizado de mensajes ───────────────────────────────────────────────

  function renderWidget(widget: ChatWidget, idx: number) {
    const isLast = idx === mensajes.length - 1;
    if (!isLast) return null; // Solo el último widget es interactivo

    switch (widget.type) {
      case "ocr":
        return <WidgetOcr domain={domain} onDone={handleOcrDone} />;
      case "ocr_confirm":
        return <WidgetOcrConfirm datos={widget.datos} onConfirm={handleOcrConfirm} onManual={() => { handleNombre(`${widget.datos.nombre} ${widget.datos.apellidos}`.trim() || "Manual"); }} />;
      case "nombre":
        return <WidgetNombre onSubmit={handleNombre} />;
      case "tipo_doc":
        return <WidgetTipoDoc onSelect={handleTipoDoc} />;
      case "numero_doc":
        return <WidgetNumeroDoc tipoDoc={widget.tipoDoc} onSubmit={handleNumeroDoc} />;
      case "fecha_nacimiento":
        return <WidgetFechaDropdown onSubmit={handleFechaNacimiento} maxHoy />;
      case "fecha_caducidad_doc":
        return <WidgetFechaDropdown onSubmit={handleFechaCaducidad} minHoy />;
      case "contacto":
        return <WidgetContacto onSubmit={handleContacto} />;
      case "tutor":
        return <WidgetTutor onSubmit={handleTutor} />;
      case "quien_paga":
        return <WidgetQuienPaga viajeros={widget.viajeros} tutores={widget.tutores} onSelect={handleQuienPaga} />;
      case "seleccionar_viajero_pagador":
        return <WidgetSeleccionarViajeroPagador viajeros={widget.viajeros} onSelect={handleSeleccionarViajeroPagador} />;
      case "datos_pagador":
        return <WidgetDatosPagador prefill={pagador} onSubmit={handleDatosPagador} />;
      case "direccion":
        return <WidgetDireccion viajerosConDireccion={widget.viajerosConDireccion} onSubmit={handleDireccion} />;
      case "mas_viajeros":
        return <WidgetMasViajeros numViajeros={viajeros.length} onSelect={handleMasViajeros} />;
      case "inicio_viajero":
        return <WidgetInicioViajero onSelect={handleInicioViajero} />;
      case "sexo":
        return <WidgetSexo nombre={viajero.nombre} onSubmit={handleSexo} />;
      case "numero_soporte":
        return <WidgetNumeroSoporte onSubmit={handleNumeroSoporte} />;
      case "alergias":
        return <WidgetAlergias onSubmit={handleAlergias} />;
      case "extras":
        return (
          <WidgetExtras
            viaje={widget.viaje}
            numViajeros={widget.numViajeros}
            onSubmit={handleExtras}
          />
        );
      case "forma_pago":
        return (
          <WidgetFormaPago
            viaje={widget.viaje}
            viajeros={widget.viajeros}
            pagador={widget.pagador}
            extras={widget.extras}
            total={widget.total}
            onSubmit={handleFormaPago}
          />
        );
      case "resumen":
        return (
          <WidgetResumen
            viaje={widget.viaje}
            viajeros={widget.viajeros}
            pagador={widget.pagador}
            extras={widget.extras}
            total={widget.total}
            metodoPago={widget.metodoPago}
            onIrFormaPago={handleIrFormaPago}
            onConfirmar={handleConfirmar}
          />
        );
      default:
        return null;
    }
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────

  if (enviado) {
    const esTransferencia = metodoPago === "Transferencia";
    return (
      <main className={styles.container} style={{ "--brand": color } as React.CSSProperties}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.successTitle}>¡Registro completado!</h1>
          <p className={styles.successText}>
            Hemos recibido tu solicitud para <strong>{viaje.nombre}</strong>. Nos pondremos en contacto contigo para confirmar la reserva.
          </p>
          {esTransferencia && (
            <div style={{ marginTop: "1.25rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "left" }}>
              <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0369a1", marginBottom: "0.5rem" }}>Instrucciones de pago por transferencia</p>
              {viaje.iban_transferencia && (
                <p style={{ fontSize: "0.85rem", color: "#0f172a", marginBottom: "0.5rem" }}>
                  Número de cuenta: <strong style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>{viaje.iban_transferencia}</strong>
                </p>
              )}
              <p style={{ fontSize: "0.82rem", color: "#374151" }}>
                Para que tu reserva sea efectiva, realiza la transferencia en las próximas <strong>24 horas</strong> indicando tu nombre y apellidos como concepto.
              </p>
            </div>
          )}
          <p className={styles.successSub} style={{ marginTop: "1rem" }}>Revisa tu email para más información.</p>
        </div>
      </main>
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────

  return (
    <main
      className={chatStyles.chatContainer}
      style={{ "--brand": color } as React.CSSProperties}
    >
      <div className={chatStyles.fadeTop} />
      <div className={chatStyles.fadeBottom} />

      {/* Cabecera fija — botón volver + logo + título + progreso viajero */}
      <header className={chatStyles.chatHeader}>
        {iniciado && (
          <button className={chatStyles.backBtn} onClick={volverPaso} aria-label="Volver">
            <ChevronLeft size={16} />
          </button>
        )}
        {logoUrl && <img src={logoUrl} alt="Logo" className={chatStyles.chatLogo} />}
        <p className={chatStyles.chatHeaderTrip}>{viaje.nombre}</p>

      </header>

      {/* Pantalla de bienvenida */}
      {!iniciado && (
        <div className={chatStyles.welcomeScreen}>
          <h1 className={chatStyles.welcomeTitle}>
            ¡Hola! Te damos la bienvenida al registro de pasajeros para tu viaje. 🎒<br />
            <strong>Para empezar, elige cómo prefieres rellenar los datos.</strong>
          </h1>

          <div className={chatStyles.suggestionsGrid} style={{ gridTemplateColumns: "1fr" }}>
            <button className={chatStyles.suggestionCard} onClick={() => iniciarChat("ocr")}>
              <Camera size={14} className={chatStyles.suggestionIcon} />
              Escanear DNI / Pasaporte
              <span className={chatStyles.suggestionBadge}>Recomendado</span>
            </button>
            <button className={chatStyles.suggestionCard} onClick={() => iniciarChat("manual")}>
              <MessageSquare size={14} className={chatStyles.suggestionIcon} />
              Formulario paso a paso
            </button>
            <button className={chatStyles.suggestionCard} onClick={() => iniciarChat("clasico")}>
              <FileText size={14} className={chatStyles.suggestionIcon} />
              Formulario tradicional
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de paso activo — mismo layout que bienvenida */}
      {iniciado && (() => {
        // Último mensaje del bot (hacia atrás)
        const ultimoBot = [...mensajes].reverse().find((m) => m.from === "bot");
        // Último widget (siempre el interactivo)
        const ultimoWidget = [...mensajes].reverse().find((m) => m.from === "widget");
        const ultimoWidgetIdx = ultimoWidget
          ? mensajes.lastIndexOf(ultimoWidget as ChatMessage)
          : -1;

        return (
          <div className={chatStyles.welcomeScreen}>
            {botEscribiendo ? (
              <div className={chatStyles.typingStep}>
                <span /><span /><span />
              </div>
            ) : (
              <h1 key={`title-${stepKey}`} className={[chatStyles.stepTitle, chatStyles.stepFadeIn].join(" ")}>
                {ultimoBot && (ultimoBot as { from: "bot"; text: string }).text}
              </h1>
            )}

            {!botEscribiendo && ultimoWidget && (
              <div key={`widget-${stepKey}`} className={[chatStyles.stepWidgetWrap, chatStyles.stepSlideUp].join(" ")}>
                {renderWidget((ultimoWidget as { from: "widget"; widget: ChatWidget }).widget, ultimoWidgetIdx)}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        );
      })()}


    </main>
  );
}

// ── Widgets ───────────────────────────────────────────────────────────────────

function WidgetNombre({ onSubmit }: { onSubmit: (nombreCompleto: string) => void }) {
  const [valor, setValor] = useState("");
  const valido = valor.trim().split(/\s+/).length >= 2 && !/\d/.test(valor);

  return (
    <div className={chatStyles.formWidget}>
      <input
        className={chatStyles.chatInput}
        placeholder="Nombre y apellidos del viajero"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valido) onSubmit(valor); }}
        autoFocus
      />
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onSubmit(valor)}
      >
        <Send size={14} /> Enviar
      </button>
    </div>
  );
}

// ── OCR ───────────────────────────────────────────────────────────────────────

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

function calcularLetraDNI(nums: string): string {
  const n = parseInt(nums.replace(/\D/g, "").slice(-8), 10);
  return LETRAS_DNI[n % 23] ?? "";
}

function extraerNumeroDNI(texto: string): string {
  const t = texto.toUpperCase();
  // Busca secuencias de 7-9 dígitos seguidos opcionalmente de una letra
  const matches = [...t.matchAll(/(\d{7,9})\s*([A-Z])?/g)];
  for (const m of matches) {
    const digits = m[1].slice(-8); // últimos 8 dígitos
    const letraOCR = m[2] ?? "";
    const letraCalculada = calcularLetraDNI(digits);
    // Si la letra OCR coincide o no hay letra, usar la calculada
    if (!letraOCR || letraOCR === letraCalculada) {
      return `${digits}${letraCalculada}`;
    }
    // Si hay letra OCR pero no coincide, igual devolvemos con la calculada
    if (digits.length === 8) {
      return `${digits}${letraCalculada}`;
    }
  }
  return "";
}

function parsearMRZ(texto: string): Partial<OcrDatos> {
  const t = texto.toUpperCase();
  const lineas = texto.split("\n").map(l => l.replace(/\s/g, "").toUpperCase());

  // ── Pasaporte: MRZ P< ────────────────────────────────────────────────────
  const mrz1 = lineas.find(l => l.startsWith("P<") && l.length >= 40);
  const mrz2 = lineas.find(l => /^\d{6}[0-9MF<]\d{6}/.test(l) && l.length >= 40);
  if (mrz1 && mrz2) {
    const nombreRaw = mrz1.slice(5).replace(/</g, " ").trim();
    const partes = nombreRaw.split("  ").map(p => p.trim());
    return {
      tipoDoc: "pasaporte",
      apellidos: partes[0] ?? "",
      nombre: partes[1] ?? "",
      numeroDoc: mrz2.slice(0, 9).replace(/</g, ""),
      fechaNacimiento: parseFechaMRZ(mrz2.slice(13, 19), false),
      fechaCaducidad: parseFechaMRZ(mrz2.slice(21, 27), true),
    };
  }

  // ── DNI español ───────────────────────────────────────────────────────────

  // 1. Número DNI: busca secuencia de 7-9 dígitos, toma los últimos 8 y calcula letra
  const numeroDoc = extraerNumeroDNI(texto);

  // 2. Fechas: DD MM YYYY o DD.MM.YYYY con separador cualquiera
  //    Filtra años válidos y descarta meses/días imposibles
  const regexFecha = /\b(\d{1,2})[\s.\-\/]+(\d{1,2})[\s.\-\/]+(\d{4})\b/g;
  const fechas = [...t.matchAll(regexFecha)]
    .map(m => {
      const dd = parseInt(m[1]), mm = parseInt(m[2]), yyyy = parseInt(m[3]);
      if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1920 || yyyy > 2060) return null;
      return { iso: `${yyyy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`, yyyy };
    })
    .filter(Boolean) as { iso: string; yyyy: number }[];

  const unicas = [...new Map(fechas.map(f => [f.iso, f])).values()].sort((a,b) => a.iso.localeCompare(b.iso));
  const fechaNacimiento = unicas.find(f => f.yyyy <= 2005)?.iso ?? unicas[0]?.iso ?? "";
  const fechaCaducidad = unicas.find(f => f.yyyy >= 2025)?.iso ?? unicas[unicas.length - 1]?.iso ?? "";

  // 3. Nombre y apellidos: líneas que contengan solo letras (con tildes) y espacios,
  //    longitud razonable, sin palabras clave de cabecera del documento
  const IGNORAR = /REINO|ESPA[NÑ]|CARD|DOCUMENTO|NACIONAL|IDENTIDAD|IDENTITY|SURNAME|APELLIDOS|NOMBRE|GIVEN|BIRTH|EXPIRY|VALID|NATIONALITY|SEXO|SEX|ISSUING|LUGAR|DOMICILIO/;
  const lineasNombres = t.split("\n")
    .map(l => l.replace(/[^A-ZÁÉÍÓÚÀÈÌÒÙÜÑ\s]/gi, "").replace(/\s+/g, " ").trim())
    .filter(l => {
      if (l.length < 3 || l.length > 40) return false;
      if (IGNORAR.test(l)) return false;
      if (!/^[A-ZÁÉÍÓÚÀÈÌÒÙÜÑ\s]+$/i.test(l)) return false;
      // Descartar líneas de una sola letra o palabras muy cortas repetidas
      const palabras = l.split(" ").filter(p => p.length >= 2);
      return palabras.length >= 1;
    });

  // DNI español: apellido1 / apellido2 / nombre (o apellidos en una línea / nombre en otra)
  const apellidos = lineasNombres.slice(0, Math.max(1, lineasNombres.length - 1)).join(" ").trim();
  const nombre = lineasNombres[lineasNombres.length - 1] ?? "";

  return {
    tipoDoc: "dni",
    nombre: nombre.trim(),
    apellidos: apellidos.trim(),
    numeroDoc,
    fechaNacimiento,
    fechaCaducidad,
  };
}

function parseFechaMRZ(s: string, caducidad = false): string {
  if (s.length < 6) return "";
  const yy = parseInt(s.slice(0, 2), 10);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  const yyyyBase = caducidad ? (yy < 50 ? 2000 : 1900) : (yy > 24 ? 1900 : 2000);
  return `${yyyyBase + yy}-${mm}-${dd}`;
}

function parseFechaES(m: RegExpMatchArray): string {
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const aaRaw = m[3];
  const aa = aaRaw.length === 2
    ? (parseInt(aaRaw, 10) > 30 ? `19${aaRaw}` : `20${aaRaw}`)
    : aaRaw;
  return `${aa}-${mm}-${dd}`;
}

function WidgetOcr({ onDone, domain }: { onDone: (datos: OcrDatos) => void; domain: string }) {
  const [estado, setEstado] = useState<"idle" | "procesando" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  async function redimensionar(file: File, maxW = 1200): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
        resolve({ base64, mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function procesarImagen(file: File) {
    setEstado("procesando");
    try {
      const { extraerDatosDocumento } = await import("@/actions/ocr");
      const { base64, mimeType } = await redimensionar(file);
      const datos = await extraerDatosDocumento(base64, mimeType, domain);
      onDone(datos);
    } catch (e) {
      console.error("OCR error:", e);
      setEstado("error");
    }
  }

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [modoCamara, setModoCamara] = useState(false);

  const esMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  async function abrirCamara() {
    if (esMobile) {
      inputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setModoCamara(true);
    } catch {
      inputRef.current?.click();
    }
  }

  // ref callback: se ejecuta cuando el elemento <video> aparece en el DOM
  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  function cerrarCamara() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setModoCamara(false);
  }

  function capturarFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    cerrarCamara();
    canvas.toBlob((blob) => { if (blob) procesarImagen(new File([blob], "foto.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.92);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(esMobile ? { capture: "environment" } : {})}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) procesarImagen(f); }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {modoCamara && typeof document !== "undefined" && createPortal(
        <div className={chatStyles.ocrOverlay}>
          <video ref={videoCallbackRef} autoPlay playsInline muted className={chatStyles.ocrVideo} />
          <div className={chatStyles.ocrCamaraGuia} />
          <div className={chatStyles.ocrCamaraBtns}>
            <button className={chatStyles.ocrCaptureBtn} onClick={capturarFoto}>
              <Camera size={20} />
            </button>
            <button className={chatStyles.ocrCancelBtn} onClick={cerrarCamara}>
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {!modoCamara && <div className={chatStyles.formWidget}>

      {estado === "idle" && (
        <>
          {esMobile ? (
            <button
              className={[chatStyles.sendBtn, chatStyles.sendBtnActive].join(" ")}
              onClick={abrirCamara}
            >
              <Camera size={16} /> Hacer foto del documento
            </button>
          ) : (
            <button
              className={[chatStyles.sendBtn, chatStyles.sendBtnActive].join(" ")}
              onClick={() => inputRef.current?.click()}
            >
              <ArrowUp size={16} /> Subir imagen del documento
            </button>
          )}
          <p className={chatStyles.ocrPrivacyNote}>
            <Lock size={11} /> Este documento se procesa de forma segura. No guardamos ni almacenamos tu archivo; solo lo leemos temporalmente para extraer los datos.
          </p>
        </>
      )}
      {estado === "procesando" && (
        <div className={chatStyles.ocrProgress}>
          <div className={chatStyles.ocrProgressBar} style={{ width: "100%", animation: "ocrPulse 1.2s ease-in-out infinite" }} />
          <p className={chatStyles.ocrProgressText}>Analizando documento…</p>
        </div>
      )}
      {estado === "error" && (
        <>
          <p className={chatStyles.inputHint} style={{ color: "#ef4444" }}>
            No se pudo leer el documento. Prueba con otra foto más nítida.
          </p>
          <button
            className={[chatStyles.sendBtn, chatStyles.sendBtnActive].join(" ")}
            onClick={() => setEstado("idle")}
          >
            Intentar de nuevo
          </button>
        </>
      )}
      </div>}
    </>
  );
}

function WidgetOcrConfirm({ datos, onConfirm, onManual }: { datos: OcrDatos; onConfirm: (d: OcrDatos) => void; onManual: () => void }) {
  const [nombre, setNombre] = useState(datos.nombre);
  const [apellidos, setApellidos] = useState(datos.apellidos);
  const [tipoDoc, setTipoDoc] = useState<"dni" | "pasaporte">(datos.tipoDoc);
  const [numeroDoc, setNumeroDoc] = useState(datos.numeroDoc);
  const [fechaNacimiento, setFechaNacimiento] = useState(datos.fechaNacimiento);
  const [fechaCaducidad, setFechaCaducidad] = useState(datos.fechaCaducidad);
  const [sexo, setSexo] = useState<"M" | "F" | "">(
    datos.sexo === "M" || datos.sexo === "F" ? datos.sexo : ""
  );
  const [numeroSoporte, setNumeroSoporte] = useState(datos.numeroSoporte ?? "");

  const valido = nombre.trim().length >= 1 && numeroDoc.trim().length >= 5;

  function formatFechaInput(iso: string): string {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function parseFechaInput(v: string): string {
    const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return "";
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yy = m[3].length === 2 ? (parseInt(m[3]) > 30 ? `19${m[3]}` : `20${m[3]}`) : m[3];
    return `${yy}-${mm}-${dd}`;
  }

  return (
    <div className={chatStyles.formWidget}>
      <label className={chatStyles.inputLabel}>Nombre</label>
      <input className={chatStyles.chatInput} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />

      <label className={chatStyles.inputLabel}>Apellidos</label>
      <input className={chatStyles.chatInput} value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" />

      <label className={chatStyles.inputLabel}>Tipo de documento</label>
      <div className={chatStyles.pillBtns} style={{ justifyContent: "flex-start", marginBottom: "0.25rem" }}>
        <button className={[chatStyles.pillBtn, tipoDoc === "dni" ? chatStyles.pillBtnSel : ""].join(" ")} onClick={() => setTipoDoc("dni")}>DNI</button>
        <button className={[chatStyles.pillBtn, tipoDoc === "pasaporte" ? chatStyles.pillBtnSel : ""].join(" ")} onClick={() => setTipoDoc("pasaporte")}>Pasaporte</button>
      </div>

      <label className={chatStyles.inputLabel}>Número de documento</label>
      <input className={chatStyles.chatInput} value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value.toUpperCase())} placeholder="12345678A" />

      <label className={chatStyles.inputLabel}>Fecha de nacimiento (dd/mm/aaaa)</label>
      <input className={chatStyles.chatInput} defaultValue={formatFechaInput(fechaNacimiento)} onBlur={(e) => setFechaNacimiento(parseFechaInput(e.target.value))} placeholder="dd/mm/aaaa" />

      <label className={chatStyles.inputLabel}>Fecha de caducidad (dd/mm/aaaa)</label>
      <input className={chatStyles.chatInput} defaultValue={formatFechaInput(fechaCaducidad)} onBlur={(e) => setFechaCaducidad(parseFechaInput(e.target.value))} placeholder="dd/mm/aaaa" />

      <label className={chatStyles.inputLabel}>Sexo (del documento)</label>
      <div className={chatStyles.pillBtns} style={{ justifyContent: "flex-start", marginBottom: "0.25rem" }}>
        <button className={[chatStyles.pillBtn, sexo === "M" ? chatStyles.pillBtnSel : ""].join(" ")} onClick={() => setSexo("M")}>M</button>
        <button className={[chatStyles.pillBtn, sexo === "F" ? chatStyles.pillBtnSel : ""].join(" ")} onClick={() => setSexo("F")}>F</button>
        <button className={[chatStyles.pillBtn, sexo === "" ? chatStyles.pillBtnSel : ""].join(" ")} onClick={() => setSexo("")}>No capturado</button>
      </div>

      <label className={chatStyles.inputLabel}>Nº de soporte (reverso DNI)</label>
      <input
        className={chatStyles.chatInput}
        value={numeroSoporte}
        onChange={(e) => setNumeroSoporte(e.target.value.toUpperCase().replace(/\s/g, ""))}
        placeholder="AAA123456"
        maxLength={9}
      />

      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onConfirm({
          nombre: nombre.trim(), apellidos: apellidos.trim(), tipoDoc,
          numeroDoc: numeroDoc.trim(), fechaNacimiento, fechaCaducidad,
          sexo: sexo || undefined,
          numeroSoporte: numeroSoporte.trim() || undefined,
        })}
      >
        <Check size={14} /> Confirmar datos
      </button>
      <button className={chatStyles.backBtn} style={{ position: "static", width: "auto", height: "auto", borderRadius: "0.5rem", padding: "0.5rem 1rem", marginTop: "0.25rem", background: "none", border: "none", color: "#9ca3af", fontSize: "0.8125rem" }} onClick={onManual}>
        Introducir manualmente
      </button>
    </div>
  );
}

function WidgetTipoDoc({ onSelect }: { onSelect: (tipo: "dni" | "pasaporte") => void }) {
  return (
    <div className={chatStyles.pillBtns}>
      <button className={chatStyles.pillBtn} onClick={() => onSelect("dni")}>
        <ScanLine size={14} /> DNI
      </button>
      <button className={chatStyles.pillBtn} onClick={() => onSelect("pasaporte")}>
        <FileText size={14} /> Pasaporte
      </button>
    </div>
  );
}

function WidgetNumeroDoc({
  tipoDoc,
  onSubmit,
}: {
  tipoDoc: "dni" | "pasaporte";
  onSubmit: (numero: string, tipo: "dni" | "pasaporte") => void;
}) {
  const [numero, setNumero] = useState("");

  const dniValido = (v: string) => {
    const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
    const c = v.trim().toUpperCase();
    if (!/^\d{8}[A-Z]$/.test(c)) return false;
    return c[8] === LETRAS[parseInt(c.slice(0, 8), 10) % 23];
  };

  const suficiente = tipoDoc === "dni" ? numero.trim().length === 9 : numero.trim().length >= 6;
  const valido = tipoDoc === "dni" ? dniValido(numero) : suficiente;
  const errorDni = tipoDoc === "dni" && suficiente && !valido;

  return (
    <div className={chatStyles.formWidget}>
      <input
        className={chatStyles.chatInput}
        placeholder={tipoDoc === "dni" ? "12345678Z" : "AA1234567"}
        value={numero}
        onChange={(e) => setNumero(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter" && valido) onSubmit(numero.trim(), tipoDoc); }}
        autoFocus
        maxLength={tipoDoc === "dni" ? 9 : 20}
      />
      {tipoDoc === "dni" && (
        <p className={chatStyles.inputHint} style={errorDni ? { color: "#ef4444" } : {}}>
          {errorDni ? "La letra no corresponde con los números" : "Formato: 8 números seguidos de la letra — ej. 12345678Z"}
        </p>
      )}
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onSubmit(numero.trim(), tipoDoc)}
      >
        <Send size={14} /> Enviar
      </button>
    </div>
  );
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function WidgetFechaDropdown({ onSubmit, maxHoy, minHoy }: { onSubmit: (fecha: string) => void; maxHoy?: boolean; minHoy?: boolean }) {
  const hoy = new Date();
  const añoHoy = hoy.getFullYear();

  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [año, setAño] = useState("");

  const añoMin = minHoy ? añoHoy : añoHoy - 100;
  const añoMax = minHoy ? añoHoy + 20 : añoHoy;
  const años = Array.from({ length: añoMax - añoMin + 1 }, (_, i) => (minHoy ? añoMin + i : añoMax - i));

  const diasEnMes = dia && mes && año ? new Date(Number(año), Number(mes), 0).getDate() : 31;
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1);

  const valido = !!dia && !!mes && !!año;

  function handleEnviar() {
    const d = dia.padStart(2, "0");
    const m = mes.padStart(2, "0");
    onSubmit(`${año}-${m}-${d}`);
  }

  return (
    <div className={chatStyles.formWidget}>
      <div className={chatStyles.fechaDropdowns}>
        <select className={chatStyles.fechaSelect} value={dia} onChange={(e) => setDia(e.target.value)} autoFocus>
          <option value="">Día</option>
          {dias.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={chatStyles.fechaSelect} value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">Mes</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select className={chatStyles.fechaSelect} value={año} onChange={(e) => setAño(e.target.value)}>
          <option value="">Año</option>
          {años.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={handleEnviar}
      >
        <Send size={14} /> Enviar
      </button>
    </div>
  );
}

function WidgetTutor({
  onSubmit,
}: {
  onSubmit: (nombre: string, telefono: string, email: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const valido = nombre.trim().length >= 3 && telefono.trim().length >= 9 && email.includes("@");

  return (
    <div className={chatStyles.formWidget}>
      <input className={chatStyles.chatInput} placeholder="Nombre y apellidos del tutor" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      <input className={chatStyles.chatInput} placeholder="Teléfono móvil" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      <input className={chatStyles.chatInput} placeholder="Email del tutor" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")} disabled={!valido} onClick={() => onSubmit(nombre.trim(), telefono.trim(), email.trim())}>
        <Check size={14} /> Guardar datos del tutor
      </button>
    </div>
  );
}

function WidgetQuienPaga({
  viajeros,
  tutores,
  onSelect,
}: {
  viajeros: ViajeroForm[];
  tutores?: { nombre: string; apellidos: string; email: string; telefono: string }[];
  onSelect: (opcion: "viajero" | "otro" | "tutor", tutorData?: { nombre: string; apellidos: string; email: string; telefono: string }) => void;
}) {
  const hayMayores = viajeros.some((v) => calcularEdad(v.fecha_nacimiento) >= 18);
  return (
    <div className={chatStyles.quickButtons}>
      {(tutores ?? []).map((t, i) => (
        <button key={i} className={chatStyles.quickBtn} onClick={() => onSelect("tutor", t)}>
          <User size={14} /> {t.nombre} {t.apellidos} (tutor)
        </button>
      ))}
      {hayMayores && (
        <button className={chatStyles.quickBtn} onClick={() => onSelect("viajero")}>
          <User size={14} /> Un viajero
        </button>
      )}
      <button className={chatStyles.quickBtn} onClick={() => onSelect("otro")}>
        <CreditCard size={14} /> Otra persona / Empresa
      </button>
    </div>
  );
}

function WidgetSeleccionarViajeroPagador({
  viajeros,
  onSelect,
}: {
  viajeros: ViajeroForm[];
  onSelect: (v: ViajeroForm) => void;
}) {
  return (
    <div className={chatStyles.quickButtons}>
      {viajeros.map((v, i) => (
        <button key={i} className={chatStyles.quickBtn} onClick={() => onSelect(v)}>
          <User size={14} /> {v.nombre} {v.apellidos}
        </button>
      ))}
    </div>
  );
}

function WidgetDatosPagador({ prefill, onSubmit }: { prefill?: PagadorForm; onSubmit: (p: PagadorForm) => void }) {
  const [nombre, setNombre] = useState(prefill?.nombre ?? "");
  const [apellidos, setApellidos] = useState(prefill?.apellidos ?? "");
  const [dni, setDni] = useState(prefill?.dni ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [telefono, setTelefono] = useState(prefill?.telefono ?? "");
  // Dirección Places
  const [calle, setCalle] = useState(prefill?.direccion ?? "");
  const [cp, setCp] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [sugerencias, setSugerencias] = useState<{ id: string; texto: string; subtexto: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (calle.trim().length < 3) { setSugerencias([]); return; }
    debounceRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const { searchPlaces } = await import("@/actions/places");
        const res = await searchPlaces(calle);
        setSugerencias((res || []).map((r: any) => ({ id: r.placeId, texto: r.mainText, subtexto: r.secondaryText })));
      } catch { setSugerencias([]); }
      finally { setCargando(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [calle]);

  async function seleccionar(s: { id: string; texto: string; subtexto: string }) {
    setSugerencias([]);
    skipRef.current = true;
    setCalle(s.texto);
    const partes = s.subtexto.split(",").map((p: string) => p.trim()).filter(Boolean);
    setLocalidad(partes[0] || "");
    setProvincia(partes[1] || "");
    try {
      const { getPlaceDetails } = await import("@/actions/places");
      const det = await getPlaceDetails(s.id);
      if (det?.postalCode) setCp(det.postalCode);
      if (det?.locality) setLocalidad(det.locality);
      if (det?.adminAreaL2 || det?.adminAreaL1) setProvincia(det.adminAreaL2 || det.adminAreaL1 || "");
    } catch { /* usa valores del texto */ }
  }

  const calleCompleta = calle.trim();
  const direccionFinal = [calleCompleta, cp, localidad, provincia].filter(Boolean).join(", ");
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const telValido = telefono.replace(/\D/g, "").length >= 9;
  const valido = nombre.trim().length >= 2 && dni.trim().length >= 5 && calleCompleta.length >= 3 && localidad.trim().length >= 2 && emailValido && telValido;

  return (
    <div className={chatStyles.formWidget}>
      <input className={chatStyles.chatInput} placeholder="Nombre completo / Razón Social" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      <input className={chatStyles.chatInput} placeholder="Apellidos (si es persona física)" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
      <input className={chatStyles.chatInput} placeholder="DNI / NIF / CIF" value={dni} onChange={(e) => setDni(e.target.value.toUpperCase())} />
      <input className={chatStyles.chatInput} type="email" placeholder="Email de contacto" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={chatStyles.chatInput} type="tel" placeholder="Teléfono de contacto" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 9))} />
      <div style={{ position: "relative" }}>
        <input className={chatStyles.chatInput} placeholder="Dirección — ej. Miguel de Cervantes, 5" value={calle} onChange={(e) => setCalle(e.target.value)} />
        {cargando && <span className={chatStyles.inputHint}>Buscando…</span>}
        {sugerencias.length > 0 && (
          <div className={chatStyles.placesSuggestions}>
            {sugerencias.map((s) => (
              <div key={s.id} className={chatStyles.placeItem} onMouseDown={() => seleccionar(s)}>
                <span className={chatStyles.placeMain}>{s.texto}</span>
                <span className={chatStyles.placeSub}>{s.subtexto}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={chatStyles.formRow}>
        <input className={chatStyles.chatInput} placeholder="C.P." maxLength={5} value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))} style={{ maxWidth: "90px" }} />
        <input className={chatStyles.chatInput} placeholder="Ciudad" value={localidad} onChange={(e) => setLocalidad(e.target.value)} />
      </div>
      <input className={chatStyles.chatInput} placeholder="Provincia" value={provincia} onChange={(e) => setProvincia(e.target.value)} />
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onSubmit({ nombre: nombre.trim(), apellidos: apellidos.trim(), dni: dni.trim(), direccion: direccionFinal, email: email.trim(), telefono: telefono.trim() })}
      >
        <Check size={14} /> Confirmar datos de facturación
      </button>
    </div>
  );
}

const PROVINCIAS = [
  "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Barcelona",
  "Burgos", "Cáceres", "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca",
  "Girona", "Granada", "Guadalajara", "Gipuzkoa", "Huelva", "Huesca", "Illes Balears", "Jaén",
  "A Coruña", "La Rioja", "Las Palmas", "León", "Lleida", "Lugo", "Madrid", "Málaga", "Murcia",
  "Navarra", "Ourense", "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia", "Valladolid",
  "Bizkaia", "Zamora", "Zaragoza", "Ceuta", "Melilla",
];

function WidgetContacto({ onSubmit }: { onSubmit: (email: string, telefono: string) => void; esMenor?: boolean }) {
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const emailValido = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const telValido = telefono === "" || telefono.replace(/\D/g, "").length >= 9;
  const valido = emailValido && telValido;

  return (
    <div className={chatStyles.formWidget}>
      <input
        className={chatStyles.chatInput}
        type="email"
        placeholder="correo@ejemplo.com (opcional)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />
      <input
        className={chatStyles.chatInput}
        type="tel"
        placeholder="612345678 (opcional)"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value.replace(/\D/g, "").slice(0, 9))}
      />
      <p className={chatStyles.inputHint}>9 dígitos sin espacios ni prefijo</p>
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onSubmit(email.trim(), telefono)}
      >
        <Send size={14} /> Enviar
      </button>
    </div>
  );
}

function WidgetDireccion({
  viajerosConDireccion = [],
  onSubmit,
}: {
  viajerosConDireccion?: { nombre: string; direccion: string }[];
  onSubmit: (calle: string, cp: string, localidad: string, provincia: string) => void;
}) {
  const [calle, setCalle] = useState("");
  const [piso, setPiso] = useState("");
  const [cp, setCp] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");
  const [sugerencias, setSugerencias] = useState<{ id: string; texto: string; subtexto: string; raw: any }[]>([]);
  const [cargando, setCargando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipRef = useRef(false);

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (calle.trim().length < 3) { setSugerencias([]); return; }
    debounceRef.current = setTimeout(async () => {
      setCargando(true);
      try {
        const { searchPlaces } = await import("@/actions/places");
        const res = await searchPlaces(calle);
        setSugerencias((res || []).map((r: any) => ({
          id: r.placeId,
          texto: r.mainText,
          subtexto: r.secondaryText,
          raw: r,
        })));
      } catch { setSugerencias([]); }
      finally { setCargando(false); }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [calle]);

  async function seleccionar(s: { id: string; texto: string; subtexto: string; raw: any }) {
    setSugerencias([]);
    skipRef.current = true;
    setCalle(s.texto);
    // Extraer ciudad y provincia del secondaryText "Ciudad, Provincia, España"
    const partes = s.subtexto.split(",").map((p: string) => p.trim()).filter(Boolean);
    setLocalidad(partes[0] || "");
    setProvincia(partes[1] || "");
    // Intentar obtener CP con getPlaceDetails
    try {
      const { getPlaceDetails } = await import("@/actions/places");
      const det = await getPlaceDetails(s.id);
      if (det?.postalCode) setCp(det.postalCode);
      if (det?.locality) setLocalidad(det.locality);
      if (det?.adminAreaL2 || det?.adminAreaL1) setProvincia(det.adminAreaL2 || det.adminAreaL1 || "");
    } catch { /* usa los valores del texto */ }
  }

  const valido = calle.trim().length >= 3 && localidad.trim().length >= 2;
  const calleCompleta = piso.trim() ? `${calle.trim()} ${piso.trim()}` : calle.trim();

  function copiarDireccion(dir: string) {
    // Formato guardado: "calle, cp localidad (provincia)"
    const matchProv = dir.match(/^(.*)\(([^)]+)\)$/);
    const sinProv = matchProv ? matchProv[1].trim() : dir;
    const prov = matchProv ? matchProv[2].trim() : "";
    const partes = sinProv.split(",").map((s) => s.trim());
    const calleVal = partes[0] ?? "";
    // cp y localidad en partes[1] = "28001 Madrid"
    const cpLoc = partes[1] ?? "";
    const cpMatch = cpLoc.match(/^(\d{4,5})\s+(.+)$/);
    skipRef.current = true;
    setCalle(calleVal);
    setCp(cpMatch ? cpMatch[1] : "");
    setLocalidad(cpMatch ? cpMatch[2] : cpLoc);
    setProvincia(prov);
    setSugerencias([]);
  }

  return (
    <div className={chatStyles.formWidget}>
      {viajerosConDireccion.length > 0 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <p className={chatStyles.inputHint} style={{ marginBottom: "0.3rem" }}>Usar la misma dirección que:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {viajerosConDireccion.map((v, i) => (
              <button key={i} type="button" className={chatStyles.quickBtn} style={{ fontSize: "0.78rem", padding: "0.4rem 0.8rem" }} onClick={() => copiarDireccion(v.direccion)}>
                <Copy size={12} /> {v.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ position: "relative" }}>
        <input
          className={chatStyles.chatInput}
          placeholder="Calle y número — ej. Miguel de Cervantes, 5"
          value={calle}
          onChange={(e) => setCalle(e.target.value)}
          autoFocus
        />
        {cargando && <span className={chatStyles.inputHint}>Buscando…</span>}
        {sugerencias.length > 0 && (
          <div className={chatStyles.placesSuggestions}>
            {sugerencias.map((s) => (
              <div key={s.id} className={chatStyles.placeItem} onMouseDown={() => seleccionar(s)}>
                <span className={chatStyles.placeMain}>{s.texto}</span>
                <span className={chatStyles.placeSub}>{s.subtexto}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        className={chatStyles.chatInput}
        placeholder="Piso, puerta… (opcional) — ej. 6B"
        value={piso}
        onChange={(e) => setPiso(e.target.value)}
      />
      <div className={chatStyles.formRow}>
        <input
          className={chatStyles.chatInput}
          placeholder="C.P."
          maxLength={5}
          value={cp}
          onChange={(e) => setCp(e.target.value.replace(/\D/g, ""))}
          style={{ maxWidth: "90px" }}
        />
        <input
          className={chatStyles.chatInput}
          placeholder="Ciudad"
          value={localidad}
          onChange={(e) => setLocalidad(e.target.value)}
        />
      </div>
      <input
        className={chatStyles.chatInput}
        placeholder="Provincia"
        value={provincia}
        onChange={(e) => setProvincia(e.target.value)}
      />
      <button
        className={[chatStyles.sendBtn, valido ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={!valido}
        onClick={() => onSubmit(calleCompleta, cp, localidad.trim(), provincia.trim())}
      >
        <MapPin size={14} /> Confirmar dirección
      </button>
    </div>
  );
}

const OPCIONES_ALERGIAS = [
  { id: "ninguna", label: "Ninguna" },
  { id: "celiaco", label: "Celíaco (Sin Gluten)" },
  { id: "lactosa", label: "Intolerancia a la Lactosa" },
  { id: "frutos_secos", label: "Alergia a Frutos Secos" },
  { id: "vegetariano", label: "Dieta Vegetariana / Vegana" },
  { id: "otra", label: "Otra restricción médica" },
];

function WidgetMasViajeros({ numViajeros, onSelect }: { numViajeros: number; onSelect: (añadir: boolean) => void }) {
  return (
    <div className={chatStyles.formWidget}>
      <p className={chatStyles.inputHint} style={{ color: "#6b7280", textAlign: "center" }}>
        {numViajeros} {numViajeros === 1 ? "viajero registrado" : "viajeros registrados"}
      </p>
      <div className={chatStyles.pillBtns} style={{ flexDirection: "column" }}>
        <button className={chatStyles.pillBtn} onClick={() => onSelect(true)}>
          <Plus size={14} /> Sí, añadir otro viajero
        </button>
        <button className={chatStyles.pillBtn} onClick={() => onSelect(false)}>
          <Check size={14} /> No, continuar con el registro
        </button>
      </div>
    </div>
  );
}

function WidgetInicioViajero({ onSelect }: { onSelect: (modo: "ocr" | "manual") => void }) {
  return (
    <div className={chatStyles.formWidget}>
      <div className={chatStyles.pillBtns} style={{ flexDirection: "column" }}>
        <button className={chatStyles.pillBtn} onClick={() => onSelect("ocr")}>
          <Camera size={14} /> Escanear documento (DNI / pasaporte)
        </button>
        <button className={chatStyles.pillBtn} onClick={() => onSelect("manual")}>
          <FileText size={14} /> Escribir los datos paso a paso
        </button>
      </div>
    </div>
  );
}

function WidgetSexo({ nombre, onSubmit }: { nombre: string; onSubmit: (sexo: "M" | "F") => void }) {
  const [mostrarAclaracion, setMostrarAclaracion] = useState(false);

  return (
    <div className={chatStyles.formWidget}>
      {mostrarAclaracion && (
        <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "0.65rem", padding: "0.65rem 0.75rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "#92400e" }}>
          ¡Entendido! Algunas aerolíneas y autoridades de aduanas exigen que el sexo coincida exactamente con el marcador binario de tu pasaporte o DNI para poder embarcar. ¿Cuál figura en el documento físico de <strong>{nombre}</strong>?
        </div>
      )}
      <div className={chatStyles.quickButtons}>
        <button className={chatStyles.quickBtn} onClick={() => onSubmit("M")}>
          <Mars size={14} /> {mostrarAclaracion ? "Masculino (M)" : "Masculino"}
        </button>
        <button className={chatStyles.quickBtn} onClick={() => onSubmit("F")}>
          <Venus size={14} /> {mostrarAclaracion ? "Femenino (F)" : "Femenino"}
        </button>
        {!mostrarAclaracion && (
          <button className={chatStyles.quickBtn} onClick={() => setMostrarAclaracion(true)}>
            <CircleDashed size={14} /> Otro / No binario
          </button>
        )}
      </div>
    </div>
  );
}

function WidgetNumeroSoporte({ onSubmit }: { onSubmit: (soporte: string) => void }) {
  const [valor, setValor] = useState("");

  // Máscara: 3 letras + 6 alfanuméricos, forzando mayúsculas
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
    setValor(raw);
  }

  const valido = /^[A-Z]{3}[A-Z0-9]{6}$/.test(valor);

  return (
    <div className={chatStyles.formWidget}>
      <input
        className={chatStyles.chatInput}
        placeholder="AAA111222"
        value={valor}
        onChange={handleChange}
        onKeyDown={(e) => { if (e.key === "Enter" && valido) onSubmit(valor); }}
        maxLength={9}
        autoFocus
        style={{ fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
      />
      <button
        className={`${chatStyles.sendBtn} ${valido ? chatStyles.sendBtnActive : ""}`}
        disabled={!valido}
        onClick={() => onSubmit(valor)}
      >
        <ChevronRight size={14} /> Confirmar
      </button>
    </div>
  );
}

function WidgetAlergias({ onSubmit }: { onSubmit: (sel: string[]) => void }) {
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [otraTexto, setOtraTexto] = useState("");

  function toggle(id: string) {
    if (id === "ninguna") {
      setSeleccionadas(["Ninguna"]);
      return;
    }
    setSeleccionadas((prev) => {
      const sinNinguna = prev.filter((s) => s !== "Ninguna");
      if (sinNinguna.includes(id)) return sinNinguna.filter((s) => s !== id);
      return [...sinNinguna, id];
    });
  }

  function handleEnviar() {
    let lista = seleccionadas.map((id) => {
      if (id === "otra") return otraTexto || "Otra restricción";
      return OPCIONES_ALERGIAS.find((o) => o.id === id)?.label ?? id;
    });
    onSubmit(lista);
  }

  const estaSeleccionado = (id: string) =>
    seleccionadas.includes(id === "ninguna" ? "Ninguna" : id);

  return (
    <div className={chatStyles.formWidget}>
      {OPCIONES_ALERGIAS.map((op) => (
        <button
          key={op.id}
          className={[chatStyles.checkBtn, estaSeleccionado(op.id) ? chatStyles.checkBtnSel : ""].join(" ")}
          onClick={() => toggle(op.id)}
        >
          <span className={chatStyles.checkBox}>
            {estaSeleccionado(op.id) && <Check size={10} strokeWidth={3} />}
          </span>
          {op.label}
        </button>
      ))}
      {seleccionadas.includes("otra") && (
        <input
          className={chatStyles.chatInput}
          placeholder="Especifica la alergia o restricción…"
          value={otraTexto}
          onChange={(e) => setOtraTexto(e.target.value)}
        />
      )}
      <button
        className={[chatStyles.sendBtn, seleccionadas.length > 0 ? chatStyles.sendBtnActive : ""].join(" ")}
        disabled={seleccionadas.length === 0}
        onClick={handleEnviar}
      >
        <Heart size={14} /> Continuar
      </button>
    </div>
  );
}

function WidgetExtras({
  viaje,
  numViajeros,
  onSubmit,
}: {
  viaje: ViajeInfo;
  numViajeros: number;
  onSubmit: (extras: ExtraSeleccionado[]) => void;
}) {
  const [seleccionados, setSeleccionados] = useState<ExtraSeleccionado[]>([]);

  function toggle(ext: { id: string; nombre: string; pvp: number }) {
    setSeleccionados((prev) => {
      const existe = prev.find((e) => e.id === ext.id);
      if (existe) return prev.filter((e) => e.id !== ext.id);
      return [...prev, { id: ext.id, nombre: ext.nombre, pvp: ext.pvp, cantidad: numViajeros }];
    });
  }

  const totalExtras = seleccionados.reduce((s, e) => s + e.pvp * e.cantidad, 0);

  return (
    <div className={chatStyles.formWidget}>
      <div className={chatStyles.extrasCarrusel}>
        {viaje.extras.map((ext) => {
          const sel = seleccionados.some((e) => e.id === ext.id);
          return (
            <button
              key={ext.id}
              className={[chatStyles.extraTarjeta, sel ? chatStyles.extraTarjetaSel : ""].join(" ")}
              onClick={() => toggle(ext)}
            >
              <div className={chatStyles.extraTarjetaHeader}>
                <p className={chatStyles.extraTarjetaNombre}>{ext.nombre}</p>
                <p className={chatStyles.extraTarjetaPvp}>{formatEuros(ext.pvp)}</p>
              </div>
              {ext.descripcion && <p className={chatStyles.extraTarjetaDesc}>{ext.descripcion}</p>}
              {ext.totalViajeros != null && ext.totalViajeros > 0 && (
                <p className={chatStyles.extraTarjetaConteo}>{ext.seleccionados} de {ext.totalViajeros} viajero{ext.totalViajeros !== 1 ? "s" : ""} han seleccionado este extra</p>
              )}
              <span className={[chatStyles.extraTarjetaBtn, sel ? chatStyles.extraTarjetaBtnSel : ""].join(" ")}>
                {sel ? <><Check size={10} strokeWidth={3} /> Añadido (+{formatEuros(ext.pvp)})</> : <><Plus size={10} /> Añadir</>}
              </span>
            </button>
          );
        })}
      </div>
      {seleccionados.length > 0 && (
        <p className={chatStyles.extraContador}>
          <ShoppingBag size={13} />
          Llevas {seleccionados.length} extra{seleccionados.length !== 1 ? "s" : ""} — +{formatEuros(totalExtras)}
        </p>
      )}
      <button className={`${chatStyles.sendBtn} ${chatStyles.sendBtnActive}`} onClick={() => onSubmit(seleccionados)}>
        <ChevronRight size={14} /> Continuar a formas de pago
      </button>
    </div>
  );
}

function WidgetFormaPago({
  viaje,
  viajeros,
  pagador,
  extras,
  total,
  onSubmit,
}: {
  viaje: ViajeInfo;
  viajeros: ViajeroForm[];
  pagador: PagadorForm;
  extras: ExtraSeleccionado[];
  total: number;
  onSubmit: (metodo: string, viajeros: ViajeroForm[], pagador: PagadorForm, extras: ExtraSeleccionado[], total: number) => void;
}) {
  const [seleccionado, setSeleccionado] = useState("");

  return (
    <div className={chatStyles.formWidget}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {viaje.metodo_pago.map((m) => (
          <button
            key={m.id}
            className={[chatStyles.quickBtn, seleccionado === m.id ? chatStyles.quickBtnSel : ""].join(" ")}
            onClick={() => { setSeleccionado(m.id); onSubmit(m.id, viajeros, pagador, extras, total); }}
            style={{ justifyContent: "flex-start" }}
          >
            {seleccionado === m.id ? <Check size={13} strokeWidth={3} /> : <CreditCard size={13} />}
            {m.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

function WidgetResumen({
  viaje,
  viajeros,
  pagador,
  extras,
  total,
  metodoPago,
  onIrFormaPago,
  onConfirmar,
}: {
  viaje: ViajeInfo;
  viajeros: ViajeroForm[];
  pagador: PagadorForm;
  extras: ExtraSeleccionado[];
  total: number;
  metodoPago: string;
  onIrFormaPago: (viajeros: ViajeroForm[], pagador: PagadorForm, extras: ExtraSeleccionado[], total: number) => void;
  onConfirmar: () => void;
}) {
  const labelPago = viaje.metodo_pago.find((m) => m.id === metodoPago)?.nombre ?? metodoPago;
  return (
    <div className={chatStyles.resumenCard}>
      {pagador.nombre && (
        <div className={chatStyles.resumenSeccion}>
          <p className={chatStyles.resumenLabel}><CreditCard size={10} /> Responsable del pago</p>
          <p className={chatStyles.resumenValor}>{pagador.nombre} {pagador.apellidos}</p>
          {pagador.dni && <p className={chatStyles.resumenMeta}>{pagador.dni}</p>}
          {pagador.email && <p className={chatStyles.resumenMeta}>{pagador.email}</p>}
          {pagador.telefono && <p className={chatStyles.resumenMeta}>{pagador.telefono}</p>}
          {pagador.direccion && <p className={chatStyles.resumenMeta}>{pagador.direccion}</p>}
        </div>
      )}
      {viajeros.map((v, i) => (
        <div key={i} className={chatStyles.resumenSeccion}>
          <p className={chatStyles.resumenLabel}><User size={10} /> {viajeros.length > 1 ? `Viajero ${i + 1}` : "Pasajero"}</p>
          <p className={chatStyles.resumenValor}>{v.nombre} {v.apellidos}</p>
          <p className={chatStyles.resumenMeta}>{v.dni || v.pasaporte}</p>
          {v.email && <p className={chatStyles.resumenMeta}>{v.email} · {v.telefono}</p>}
          {v.direccion && <p className={chatStyles.resumenMeta}>{v.direccion}</p>}
        </div>
      ))}
      {metodoPago && (
        <div className={chatStyles.resumenSeccion}>
          <p className={chatStyles.resumenLabel}><CreditCard size={10} /> Forma de pago</p>
          <p className={chatStyles.resumenValor}>{labelPago}</p>
        </div>
      )}
      <div className={chatStyles.resumenSeccion}>
        <p className={chatStyles.resumenLabel}><ShoppingBag size={10} /> Desglose económico</p>
        {viajeros.map((v, i) => {
          const extrasV = v.extras ?? [];
          const subtotal = viaje.pvp_por_viajero + extrasV.reduce((s, e) => s + e.pvp * e.cantidad, 0);
          return (
            <div key={i} style={{ marginBottom: "0.4rem" }}>
              <div className={chatStyles.resumenFila} style={{ fontWeight: 600 }}>
                <span>{v.nombre} {v.apellidos}</span>
                <span>{formatEuros(subtotal)}</span>
              </div>
              <div className={chatStyles.resumenFila} style={{ paddingLeft: "0.75rem", fontSize: "0.72rem", color: "#6b7280" }}>
                <span>Plaza</span>
                <span>{formatEuros(viaje.pvp_por_viajero)}</span>
              </div>
              {extrasV.map((e) => (
                <div key={e.id} className={chatStyles.resumenFila} style={{ paddingLeft: "0.75rem", fontSize: "0.72rem", color: "#6b7280" }}>
                  <span>{e.nombre}</span>
                  <span>+{formatEuros(e.pvp * e.cantidad)}</span>
                </div>
              ))}
            </div>
          );
        })}
        <div className={[chatStyles.resumenFila, chatStyles.resumenTotal].join(" ")}>
          <strong>Total</strong>
          <strong>{formatEuros(total)}</strong>
        </div>
      </div>
      {metodoPago ? (
        <button className={chatStyles.confirmarBtn} onClick={onConfirmar}>
          <Lock size={15} /> Finalizar y Enviar Registro Oficial
        </button>
      ) : (
        <button className={`${chatStyles.sendBtn} ${chatStyles.sendBtnActive}`} onClick={() => onIrFormaPago(viajeros, pagador, extras, total)}>
          <ChevronRight size={14} /> Continuar a forma de pago
        </button>
      )}
    </div>
  );
}

// ── Formulario clásico (modo escape) ─────────────────────────────────────────

function FormularioClasico({
  viaje,
  logoUrl,
  brandColor,
  domain,
  onChat,
}: Props & { onChat: () => void }) {
  const color = brandColor ?? "#2563eb";
  type PasoRegistro = "viajeros" | "pagador" | "extras" | "resumen";
  const PASOS: { id: PasoRegistro; label: string }[] = [
    { id: "viajeros", label: "Viajeros" },
    { id: "pagador", label: "Responsable de pago" },
    { id: "extras", label: "Extras" },
    { id: "resumen", label: "Resumen y pago" },
  ];

  const [paso, setPaso] = useState<PasoRegistro>("viajeros");
  const [viajeros, setViajeros] = useState<ViajeroForm[]>([{ ...VIAJERO_VACIO }]);
  const [viajeroActivo, setViajeroActivo] = useState(0);
  const [pagador, setPagador] = useState<PagadorForm>({ ...PAGADOR_VACIO });
  const [extras, setExtras] = useState<ExtraSeleccionado[]>([]);
  const [metodoPago, setMetodoPago] = useState<string>("");
  const [enviado, setEnviado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const pasoIndex = PASOS.findIndex((p) => p.id === paso);

  function actualizarViajero(index: number, campo: keyof ViajeroForm, valor: string) {
    setViajeros((prev) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  }

  function agregarViajero() {
    setViajeros((prev) => [...prev, { ...VIAJERO_VACIO }]);
    setViajeroActivo(viajeros.length);
  }

  function eliminarViajero(index: number) {
    if (viajeros.length === 1) return;
    setViajeros((prev) => prev.filter((_, i) => i !== index));
    setViajeroActivo((prev) => Math.max(0, prev === index ? index - 1 : prev > index ? prev - 1 : prev));
  }

  function validarViajeros(): boolean {
    const nuevosErrores: Record<string, string> = {};
    viajeros.forEach((v, i) => {
      if (!v.nombre.trim()) nuevosErrores[`v${i}_nombre`] = "Campo obligatorio";
      if (!v.apellidos.trim()) nuevosErrores[`v${i}_apellidos`] = "Campo obligatorio";
      if (!v.dni.trim()) nuevosErrores[`v${i}_dni`] = "Campo obligatorio";
      if (!v.dni_caducidad) nuevosErrores[`v${i}_dni_caducidad`] = "Campo obligatorio";
      if (!v.fecha_nacimiento) nuevosErrores[`v${i}_fecha_nacimiento`] = "Campo obligatorio";
    });
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function copiarDatosViajeroAPagador(index: number) {
    const v = viajeros[index];
    setPagador({ nombre: v.nombre, apellidos: v.apellidos, dni: v.dni, direccion: v.direccion });
  }

  function validarPagador(): boolean {
    const nuevosErrores: Record<string, string> = {};
    if (!pagador.nombre.trim()) nuevosErrores["p_nombre"] = "Campo obligatorio";
    if (!pagador.apellidos.trim()) nuevosErrores["p_apellidos"] = "Campo obligatorio";
    if (!pagador.dni.trim()) nuevosErrores["p_dni"] = "Campo obligatorio";
    if (!pagador.direccion.trim()) nuevosErrores["p_direccion"] = "Campo obligatorio";
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function toggleExtra(id: string, nombre: string, pvp: number) {
    setExtras((prev) => {
      const existe = prev.find((e) => e.id === id);
      if (existe) return prev.filter((e) => e.id !== id);
      return [...prev, { id, nombre, pvp, cantidad: viajeros.length }];
    });
  }

  const subtotalViajeros = viajeros.length * viaje.pvp_por_viajero;
  const subtotalExtras = extras.reduce((sum, e) => sum + e.pvp * e.cantidad, 0);
  const total = subtotalViajeros + subtotalExtras;

  function irSiguientePaso() {
    if (paso === "viajeros" && !validarViajeros()) return;
    if (paso === "pagador" && !validarPagador()) return;
    const idx = PASOS.findIndex((p) => p.id === paso);
    if (idx < PASOS.length - 1) {
      setPaso(PASOS[idx + 1].id);
      setErrores({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function irPasoAnterior() {
    const idx = PASOS.findIndex((p) => p.id === paso);
    if (idx > 0) {
      setPaso(PASOS[idx - 1].id);
      setErrores({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit() {
    if (!metodoPago) { setErrores({ metodo_pago: "Selecciona un método de pago" }); return; }
    const { submitRegistro } = await import("@/actions/portal");
    const numViajeros = viajeros.length || 1;
    const totalExtras = viajeros.reduce(
      (s, v) => s + (v.extras ?? []).reduce((se, e) => se + e.pvp * e.cantidad, 0), 0
    );
    const plazosCalculados = viaje.plazos.map((p, i) => {
      const esUltimo = i === viaje.plazos.length - 1;
      return {
        descripcion: p.descripcion,
        fecha: p.fecha,
        importeCalculado: p.importe * numViajeros + (esUltimo ? totalExtras : 0),
      };
    });

    await submitRegistro({
      domain,
      slug: viaje.slug,
      viajeros: viajeros.map((v) => ({
        nombre: v.nombre,
        apellidos: v.apellidos,
        dni: v.dni,
        dni_caducidad: v.dni_caducidad,
        pasaporte: v.pasaporte,
        pasaporte_caducidad: v.pasaporte_caducidad,
        fecha_nacimiento: v.fecha_nacimiento,
        sexo: v.sexo ?? null,
        numero_soporte: v.numero_soporte ?? null,
        email: v.email,
        telefono: v.telefono,
        direccion: v.direccion,
        alergias: v.alergias ?? [],
        extras: (v.extras ?? []).map((e) => ({
          id: e.id,
          nombre: e.nombre,
          pvp: e.pvp,
          cantidad: e.cantidad,
        })),
        tutor: v.tutor ?? null,
      })),
      pagador,
      metodoPago,
      plazosCalculados,
    });
    setEnviado(true);
  }

  if (enviado) {
    return (
      <main className={styles.container} style={{ "--brand": color } as React.CSSProperties}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.successTitle}>¡Registro completado!</h1>
          <p className={styles.successText}>Hemos recibido tu solicitud para <strong>{viaje.nombre}</strong>. Nos pondremos en contacto contigo para confirmar la reserva.</p>
          <p className={styles.successSub}>Revisa tu email para más información.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container} style={{ "--brand": color } as React.CSSProperties}>
      {/* Botón de vuelta al chat */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "1rem 1.5rem 0" }}>
        <button
          onClick={onChat}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.25rem",
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#374151",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          💬 Volver al chat
        </button>
      </div>

      <div className={styles.logoWrap}>
        {logoUrl && <img src={logoUrl} alt="Logo" className={styles.logoImg} />}
      </div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.headerEtiqueta}>Registro de viaje</p>
          <h1 className={styles.headerTitulo}>{viaje.nombre}</h1>
          <p className={styles.headerMeta}>{viaje.destino} · {formatFecha(viaje.fecha_salida)} – {formatFecha(viaje.fecha_vuelta)}</p>
        </div>
      </header>

      <nav className={styles.progreso}>
        <div className={`${styles.progresoInner} ${styles.contentWrap}`}>
          {PASOS.map((p, i) => (
            <div key={p.id} className={styles.progresoItem}>
              <div className={[styles.progresoCirculo, i < pasoIndex ? styles.progresoCompletado : "", i === pasoIndex ? styles.progresoActivo : ""].join(" ")}>
                {i < pasoIndex ? "✓" : i + 1}
              </div>
              <span className={[styles.progresoLabel, i === pasoIndex ? styles.progresoLabelActivo : ""].join(" ")}>{p.label}</span>
              {i < PASOS.length - 1 && <div className={[styles.progresoLinea, i < pasoIndex ? styles.progresoLineaCompletada : ""].join(" ")} />}
            </div>
          ))}
        </div>
      </nav>

      <div className={styles.contentWrap}>
        {paso === "viajeros" && (
          <PasoViajeros viajeros={viajeros} viajeroActivo={viajeroActivo} setViajeroActivo={setViajeroActivo} actualizarViajero={actualizarViajero} agregarViajero={agregarViajero} eliminarViajero={eliminarViajero} errores={errores} />
        )}
        {paso === "pagador" && (
          <PasoPagador pagador={pagador} setPagador={setPagador} viajeros={viajeros} copiarDatosViajero={copiarDatosViajeroAPagador} errores={errores} />
        )}
        {paso === "extras" && (
          <PasoExtras viaje={viaje} viajeros={viajeros} extras={extras} toggleExtra={toggleExtra} extraSeleccionado={(id) => extras.some((e) => e.id === id)} pvpTotal={subtotalViajeros} />
        )}
        {paso === "resumen" && (
          <PasoResumen viaje={viaje} viajeros={viajeros} pagador={pagador} extras={extras} subtotalViajeros={subtotalViajeros} subtotalExtras={subtotalExtras} total={total} metodoPago={metodoPago} setMetodoPago={setMetodoPago} errores={errores} />
        )}
      </div>

      <div className={styles.navegacion}>
        <div className={styles.navegacionInner}>
          {pasoIndex > 0 ? (
            <button className={styles.btnSecundario} onClick={irPasoAnterior}>Atrás</button>
          ) : <div />}
          {pasoIndex < PASOS.length - 1 ? (
            <button className={styles.btnPrimario} onClick={irSiguientePaso}>Siguiente</button>
          ) : (
            <button className={styles.btnRegistrar} onClick={handleSubmit}>Confirmar</button>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Sub-pasos del formulario clásico ─────────────────────────────────────────

function PasoViajeros({ viajeros, viajeroActivo, setViajeroActivo, actualizarViajero, agregarViajero, eliminarViajero, errores }: {
  viajeros: ViajeroForm[]; viajeroActivo: number; setViajeroActivo: (i: number) => void;
  actualizarViajero: (i: number, campo: keyof ViajeroForm, valor: string) => void;
  agregarViajero: () => void; eliminarViajero: (i: number) => void; errores: Record<string, string>;
}) {
  return (
    <section>
      <h2 className={styles.pasoTitulo}>Datos de los viajeros</h2>
      <p className={styles.pasoDesc}>Introduce los datos de cada persona que viaja.</p>
      {viajeros.length > 1 && (
        <div className={styles.viajerosTabs}>
          {viajeros.map((v, i) => (
            <button key={i} className={[styles.viajeroTab, i === viajeroActivo ? styles.viajeroTabActivo : ""].join(" ")} onClick={() => setViajeroActivo(i)}>
              {v.nombre || `Viajero ${i + 1}`}
            </button>
          ))}
        </div>
      )}
      {viajeros.map((v, i) => (
        <div key={i} className={styles.viajeroFormWrap} style={{ display: i === viajeroActivo ? "block" : "none" }}>
          {viajeros.length > 1 && (
            <div className={styles.viajeroHeader}>
              <h3 className={styles.viajeroNombre}>{v.nombre ? `${v.nombre} ${v.apellidos}` : `Viajero ${i + 1}`}</h3>
              <button className={styles.btnEliminar} onClick={() => eliminarViajero(i)}>Eliminar</button>
            </div>
          )}
          <div className={styles.grid2}>
            <Campo label="Nombre" obligatorio valor={v.nombre} onChange={(val) => actualizarViajero(i, "nombre", val)} error={errores[`v${i}_nombre`]} />
            <Campo label="Apellidos" obligatorio valor={v.apellidos} onChange={(val) => actualizarViajero(i, "apellidos", val)} error={errores[`v${i}_apellidos`]} />
          </div>
          <div className={styles.grid2}>
            <Campo label="DNI / NIF" obligatorio placeholder="12345678Z" valor={v.dni} onChange={(val) => actualizarViajero(i, "dni", val)} error={errores[`v${i}_dni`]} />
            <Campo label="Caducidad DNI" obligatorio tipo="date" valor={v.dni_caducidad} onChange={(val) => actualizarViajero(i, "dni_caducidad", val)} error={errores[`v${i}_dni_caducidad`]} />
          </div>
          <div className={styles.grid2}>
            <Campo label="Pasaporte" placeholder="AA1234567" valor={v.pasaporte} onChange={(val) => actualizarViajero(i, "pasaporte", val)} />
            <Campo label="Caducidad pasaporte" tipo="date" valor={v.pasaporte_caducidad} onChange={(val) => actualizarViajero(i, "pasaporte_caducidad", val)} />
          </div>
          <Campo label="Fecha de nacimiento" obligatorio tipo="date" valor={v.fecha_nacimiento} onChange={(val) => actualizarViajero(i, "fecha_nacimiento", val)} error={errores[`v${i}_fecha_nacimiento`]} />
          <div className={styles.separador} />
          <div className={styles.grid2}>
            <Campo label="Email" tipo="email" placeholder="correo@ejemplo.com" valor={v.email} onChange={(val) => actualizarViajero(i, "email", val)} />
            <Campo label="Teléfono" tipo="tel" placeholder="+34 600 000 000" valor={v.telefono} onChange={(val) => actualizarViajero(i, "telefono", val)} />
          </div>
          <Campo label="Dirección" placeholder="Calle, número, ciudad" valor={v.direccion} onChange={(val) => actualizarViajero(i, "direccion", val)} />
        </div>
      ))}
      <button className={styles.btnAnadirViajero} onClick={agregarViajero}>+ Añadir otro viajero</button>
    </section>
  );
}

function PasoPagador({ pagador, setPagador, viajeros, copiarDatosViajero, errores }: {
  pagador: PagadorForm; setPagador: (p: PagadorForm) => void;
  viajeros: ViajeroForm[]; copiarDatosViajero: (i: number) => void; errores: Record<string, string>;
}) {
  return (
    <section>
      <h2 className={styles.pasoTitulo}>Responsable de pago</h2>
      <p className={styles.pasoDesc}>Persona que se hará cargo del pago del viaje.</p>
      {viajeros.some((v) => v.nombre) && (
        <div className={styles.copiarBloque}>
          <p className={styles.copiarLabel}>Usar datos de un viajero:</p>
          <div className={styles.copiarBotones}>
            {viajeros.map((v, i) => v.nombre ? (
              <button key={i} className={styles.btnCopiar} onClick={() => copiarDatosViajero(i)}>{v.nombre} {v.apellidos}</button>
            ) : null)}
          </div>
        </div>
      )}
      <div className={styles.grid2}>
        <Campo label="Nombre" obligatorio valor={pagador.nombre} onChange={(val) => setPagador({ ...pagador, nombre: val })} error={errores["p_nombre"]} />
        <Campo label="Apellidos" obligatorio valor={pagador.apellidos} onChange={(val) => setPagador({ ...pagador, apellidos: val })} error={errores["p_apellidos"]} />
      </div>
      <Campo label="DNI / NIF" obligatorio placeholder="12345678Z" valor={pagador.dni} onChange={(val) => setPagador({ ...pagador, dni: val })} error={errores["p_dni"]} />
      <Campo label="Dirección completa" obligatorio placeholder="Calle, número, código postal, ciudad" valor={pagador.direccion} onChange={(val) => setPagador({ ...pagador, direccion: val })} error={errores["p_direccion"]} />
    </section>
  );
}

function PasoExtras({ viaje, viajeros, extras, toggleExtra, extraSeleccionado, pvpTotal }: {
  viaje: ViajeInfo; viajeros: ViajeroForm[]; extras: ExtraSeleccionado[];
  toggleExtra: (id: string, nombre: string, pvp: number) => void;
  extraSeleccionado: (id: string) => boolean; pvpTotal: number;
}) {
  return (
    <section>
      <h2 className={styles.pasoTitulo}>Precio y extras</h2>
      <div className={styles.precioBase}>
        <div className={styles.precioBaseFila}>
          <span>{viajeros.length} viajero{viajeros.length !== 1 ? "s" : ""} × {formatEuros(viaje.pvp_por_viajero)}</span>
          <strong>{formatEuros(pvpTotal)}</strong>
        </div>
      </div>
      {viaje.extras.length > 0 && (
        <>
          <h3 className={styles.extrasTitulo}>Servicios opcionales</h3>
          <div className={styles.extrasLista}>
            {viaje.extras.map((ext) => {
              const sel = extraSeleccionado(ext.id);
              return (
                <button key={ext.id} className={[styles.extraCard, sel ? styles.extraCardSel : ""].join(" ")} onClick={() => toggleExtra(ext.id, ext.nombre, ext.pvp)}>
                  <div className={styles.extraCheck}>{sel ? "✓" : "+"}</div>
                  <div className={styles.extraInfo}>
                    <span className={styles.extraNombre}>{ext.nombre}</span>
                    {ext.descripcion && <span className={styles.extraDesc}>{ext.descripcion}</span>}
                    {ext.totalViajeros != null && ext.totalViajeros > 0 && (
                      <span className={styles.extraConteo}>{ext.seleccionados} de {ext.totalViajeros} viajero{ext.totalViajeros !== 1 ? "s" : ""} han seleccionado este extra</span>
                    )}
                  </div>
                  <div className={styles.extraPvp}>{formatEuros(ext.pvp)}<span className={styles.extraPvpSub}>/ viajero</span></div>
                </button>
              );
            })}
          </div>
        </>
      )}
      {extras.length > 0 && (
        <div className={styles.extrasResumen}>
          <p className={styles.extrasResumenTitulo}>Extras seleccionados</p>
          {extras.map((e) => (
            <div key={e.id} className={styles.extrasResumenFila}>
              <span>{e.nombre} × {e.cantidad}</span>
              <span>{formatEuros(e.pvp * e.cantidad)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PasoResumen({ viaje, viajeros, pagador, extras, subtotalViajeros, subtotalExtras, total, metodoPago, setMetodoPago, errores }: {
  viaje: ViajeInfo; viajeros: ViajeroForm[]; pagador: PagadorForm; extras: ExtraSeleccionado[];
  subtotalViajeros: number; subtotalExtras: number; total: number;
  metodoPago: string; setMetodoPago: (m: string) => void; errores: Record<string, string>;
}) {
  return (
    <section>
      <h2 className={styles.pasoTitulo}>Resumen y método de pago</h2>
      <div className={styles.resumenBloque}>
        <h3 className={styles.resumenSubtitulo}>Viajeros ({viajeros.length})</h3>
        {viajeros.map((v, i) => (
          <div key={i} className={styles.resumenFila}>
            <span>{v.nombre} {v.apellidos}</span>
            <span className={styles.resumenMeta}>{v.dni}</span>
          </div>
        ))}
      </div>
      <div className={styles.resumenBloque}>
        <h3 className={styles.resumenSubtitulo}>Responsable de pago</h3>
        <div className={styles.resumenFila}>
          <span>{pagador.nombre} {pagador.apellidos}</span>
          <span className={styles.resumenMeta}>{pagador.dni}</span>
        </div>
        <p className={styles.resumenDireccion}>{pagador.direccion}</p>
      </div>
      <div className={styles.resumenBloque}>
        <h3 className={styles.resumenSubtitulo}>Precio</h3>
        <div className={styles.resumenFila}>
          <span>{viajeros.length} viajero{viajeros.length !== 1 ? "s" : ""} × {formatEuros(viaje.pvp_por_viajero)}</span>
          <span>{formatEuros(subtotalViajeros)}</span>
        </div>
        {extras.map((e) => (
          <div key={e.id} className={styles.resumenFila}>
            <span>{e.nombre} × {e.cantidad}</span>
            <span>{formatEuros(e.pvp * e.cantidad)}</span>
          </div>
        ))}
        <div className={[styles.resumenFila, styles.resumenTotal].join(" ")}>
          <strong>Total</strong>
          <strong>{formatEuros(total)}</strong>
        </div>
      </div>
      <div className={styles.resumenBloque}>
        <h3 className={styles.resumenSubtitulo}>Método de pago</h3>
        {errores["metodo_pago"] && <p className={styles.errorMsg}>{errores["metodo_pago"]}</p>}
        <div className={styles.metodosLista}>
          {viaje.metodo_pago.map((m) => (
            <button key={m.id} className={[styles.metodoCard, metodoPago === m.id ? styles.metodoCardSel : ""].join(" ")} onClick={() => setMetodoPago(m.id)}>
              <div className={styles.metodoCheck} />
              <div className={styles.metodoInfo}>
                <span className={styles.metodoNombre}>{m.nombre}</span>
                {m.descripcion && <span className={styles.metodoDesc}>{m.descripcion}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Campo reutilizable ────────────────────────────────────────────────────────

function Campo({ label, valor, onChange, tipo = "text", placeholder, obligatorio = false, error }: {
  label: string; valor: string; onChange: (v: string) => void;
  tipo?: string; placeholder?: string; obligatorio?: boolean; error?: string;
}) {
  return (
    <div className={styles.campoWrap}>
      <label className={styles.campoLabel}>{label}{obligatorio && <span className={styles.campoObl}> *</span>}</label>
      <input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={[styles.campoInput, error ? styles.campoInputError : ""].join(" ")} />
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}
