export const TRAVEL_ICONS = [
  "Plane", "Bed", "Compass", "FolderPlus", "Train", "Car", "Ship", "Map", "Bus",
  "Ticket", "Utensils", "Camera", "Heart", "Shield", "Sun", "Mountain", "Activity",
  "Calendar", "Gift", "Luggage", "CreditCard", "Globe", "User", "Bike", "Wine",
  "MapPin", "ShoppingBag", "Coffee", "FileText"
];

export const DEFAULT_FORM_EXAMPLE = [
  {
    fila_id: "row_1",
    columnas: [
      { ancho: 6, campo: "proveedor", label: "Proveedor Mayorista", tipo: "db_select", origen: "tabla_nativa", propiedades: { required: true } },
      { ancho: 6, campo: "regimen", label: "Regimen Alimenticio", tipo: "select", origen: "jsonb_detalles", propiedades: { required: true, opciones: ["SA", "AD", "MP", "PC", "TI"] } }
    ]
  },
  {
    fila_id: "row_2",
    columnas: [
      { ancho: 6, campo: "check_in_fecha", label: "Fecha de Entrada", tipo: "date", origen: "jsonb_detalles", propiedades: { required: false } },
      { ancho: 6, campo: "check_out_fecha", label: "Fecha de Salida", tipo: "date", origen: "jsonb_detalles", propiedades: { required: false } }
    ]
  },
  {
    fila_id: "row_3",
    columnas: [
      { ancho: 12, campo: "notas_logistica", label: "Notas de Logistica", tipo: "textarea", origen: "jsonb_detalles", propiedades: { placeholder: "Ej: Solicitar habitaciones en la misma planta...", rows_textarea: 4 } }
    ]
  }
];

export const SYSTEM_BLOCKS = [
  { tipo: "db_select", label: "Proveedor", campo: "proveedor", origen: "tabla_nativa" },
  { tipo: "db_destination", label: "Destino", campo: "destino", origen: "tabla_nativa" },
  { tipo: "db_number", label: "Plazas / Viajeros", campo: "plazas", origen: "tabla_nativa" },
  { tipo: "db_number", label: "Noches / Dias", campo: "noches", origen: "tabla_nativa" },
];

export const DYNAMIC_BLOCKS = [
  { tipo: "text", label: "Texto", origen: "jsonb_detalles" },
  { tipo: "date", label: "Fecha", origen: "jsonb_detalles" },
  { tipo: "select", label: "Selector", origen: "jsonb_detalles" },
  { tipo: "boolean", label: "Booleano", origen: "jsonb_detalles" },
  { tipo: "textarea", label: "Area de texto", origen: "jsonb_detalles" },
];
