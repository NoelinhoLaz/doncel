export interface SchemaField {
  ancho: number;
  campo: string;
  label: string;
  tipo: string;
  origen: string;
  propiedades: Record<string, any>;
}

export interface SchemaRow {
  fila_id: string;
  fijo?: boolean;
  columnas: SchemaField[];
}

const FIJOS_ALOJAMIENTO: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_nombre',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'nombre_alojamiento', label: 'Nombre del alojamiento', tipo: 'places_autocomplete', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Buscar alojamiento...' } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_categoria',
    fijo: true,
    columnas: [
      { ancho: 3, campo: 'tipo_hab', label: 'Tipo', tipo: 'select', origen: 'jsonb_detalles', propiedades: { required: true, opciones: ['Habitación', 'Suite', 'Estudio', 'Apartamento', 'Bungalow', 'Villa'] } },
      { ancho: 3, campo: 'categoria', label: 'Categoría', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['1*', '2*', '3*', '4*', '5*', 'GL'] } },
      { ancho: 3, campo: 'regimen', label: 'Régimen', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['SA', 'AD', 'MP', 'PC', 'TI'] } },
      { ancho: 3, campo: 'uso', label: 'Uso', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Individual', 'Doble', 'Triple', 'Cuádruple', 'Familiar'] } },
    ]
  },
  {
    fila_id: 'row_fijo_destino',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_proveedor',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes',
    fijo: true,
    columnas: [
      { ancho: 3, campo: 'plazas', label: 'Personas', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 3, campo: 'noches', label: 'Noches', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 3, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 3, campo: 'total_neto', label: 'Total', tipo: 'number_readonly', origen: 'tabla_nativa', propiedades: { readonly: true } },
    ]
  },
  {
    fila_id: 'row_fijo_notas',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas', label: 'Notas', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Instrucciones especiales...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_ENTRADAS: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_entradas',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_entrada',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'tipo_entrada', label: 'Tipo de entrada', tipo: 'select', origen: 'jsonb_detalles', propiedades: { required: true, opciones: ['General', 'Reducida', 'Infantil', 'Senior', 'Grupo', 'VIP'] } }
    ]
  },
  {
    fila_id: 'row_fijo_nombre_evento',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'nombre_evento', label: 'Nombre del lugar/evento', tipo: 'places_autocomplete', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Ej: Museo del Prado, PortAventura...' } }
    ]
  },
  {
    fila_id: 'row_fijo_ubicacion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'ubicacion', label: 'Ubicación', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true, placeholder: 'Seleccionar ubicaciones...' } }
    ]
  },
  {
    fila_id: 'row_fijo_fecha_horario',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_prevista', label: 'Fecha prevista', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'horario', label: 'Horario', tipo: 'select', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Seleccionar horario', opciones: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] } },
    ]
  },
  {
    fila_id: 'row_fijo_proveedor',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_cantidad_precio',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'cantidad', label: 'Cantidad', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio coste (€)', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: false } },
      { ancho: 4, campo: 'precio_persona', label: 'Precio por persona (€)', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_notas_entradas',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_adicionales', label: 'Notas adicionales', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Entrada con audioguía, Acceso a zona VIP...', rows_textarea: 4 } }
    ]
  }
];

const FIJOS_SEGURO: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_seguro',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_seguro_tipo',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'tipo_seguro', label: 'Seguro', tipo: 'select', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Seleccione un seguro...', opciones: ['Seguro de Inclusión y asistencia médica', 'Seguro de Anulación', 'Seguro de Asistencia y Anulación', 'Seguro Especial Pérdida de Equipajes'] } }
    ]
  },
  {
    fila_id: 'row_seguro_proveedor',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_seguro_cobertura',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'cobertura_principal', label: 'Cobertura principal', tipo: 'select', origen: 'jsonb_detalles', propiedades: { required: false, placeholder: 'Seleccione cobertura...', opciones: ['Hasta 50.000 €', 'Hasta 100.000 €', 'Gastos Médicos Ilimitados'] } }
    ]
  },
  {
    fila_id: 'row_seguro_forma',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'forma_aplicacion', label: 'Forma de aplicación', tipo: 'radio_group', origen: 'jsonb_detalles', propiedades: { required: true, opciones: ['Por persona', 'Por grupo', 'Por reserva'] } }
    ]
  },
  {
    fila_id: 'row_seguro_obligatoriedad',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'obligatoriedad', label: 'Obligatorio / Opcional', tipo: 'radio_group', origen: 'jsonb_detalles', propiedades: { required: true, opciones: ['Opcional', 'Obligatorio', 'Incluido en precio'] } }
    ]
  },
  {
    fila_id: 'row_seguro_importes',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'cantidad_seguro', label: 'Cantidad', tipo: 'number', origen: 'jsonb_detalles', propiedades: { required: true, min: 1 } },
      { ancho: 4, campo: 'importe_unitario', label: 'Importe unitario (€)', tipo: 'number_decimal', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: '0,00' } },
      { ancho: 4, campo: 'total_seguro', label: 'Total', tipo: 'number_readonly', origen: 'jsonb_detalles', propiedades: { readonly: true } },
    ]
  },
  {
    fila_id: 'row_seguro_observaciones',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'observaciones_seguro', label: 'Observaciones', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { required: false, placeholder: 'Añada notas o detalles específicos sobre las coberturas de este seguro...', rows_textarea: 3 } }
    ]
  },
  {
    fila_id: 'row_seguro_enlaces',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'enlaces_seguro', label: 'Documentos y enlaces', tipo: 'links', origen: 'jsonb_detalles', propiedades: {} }
    ]
  }
];

const FIJOS_GUIAS: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_guias',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_nombre_guia',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'nombre_guia', label: 'Nombre del guía / Empresa', tipo: 'places_autocomplete', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Buscar o ingresar guía o empresa...' } }
    ]
  },
  {
    fila_id: 'row_fijo_idioma_tipo',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'idioma', label: 'Idioma', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Español', 'Inglés', 'Francés', 'Alemán', 'Italiano', 'Bilingüe', 'Otro'] } },
      { ancho: 6, campo: 'tipo_guia', label: 'Tipo de servicio', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Guía Local', 'Guía Acompañante', 'Coordinador', 'Asistencia'] } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_guias',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino / Punto de encuentro', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_fecha_horario_guias',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_servicio', label: 'Fecha del servicio', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'horario', label: 'Horario', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Mañana', 'Tarde', 'Día Completo', 'Por horas', 'Nocturno'] } },
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_guias',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_guias',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Personas', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Días', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_notas_guias',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_guia', label: 'Notas', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Instrucciones especiales, punto de encuentro...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_ACTIVIDADES: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_actividades',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_nombre_actividad',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'nombre_actividad', label: 'Nombre de la actividad', tipo: 'places_autocomplete', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Ej: Tour en bicicleta, Taller de cocina, Visita guiada...' } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_dificultad_act',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'tipo_actividad', label: 'Tipo de actividad', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Cultural', 'Aventura', 'Naturaleza', 'Gastronómica', 'Deportiva', 'Taller / Curso', 'Otro'] } },
      { ancho: 6, campo: 'dificultad', label: 'Dificultad / Nivel', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Fácil', 'Moderada', 'Difícil', 'Apto para todos los públicos'] } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_actividades',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino / Lugar de realización', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_fecha_horario_actividades',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_actividad', label: 'Fecha de la actividad', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'horario', label: 'Horario', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] } },
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_actividades',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_actividades',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Personas', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Días', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_notas_actividades',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_actividad', label: 'Notas', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Detalles específicos, requisitos, ropa recomendada...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_VUELOS: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_vuelos',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del vuelo...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_trayecto',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'tipo_trayecto', label: 'Tipo de trayecto', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Sólo ida', 'Ida y vuelta'], default: 'Sólo ida' } }
    ]
  },
  {
    fila_id: 'row_fijo_pnr_compania_vuelos',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'localizador', label: 'Localizador (PNR)', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: YX8P3L' } },
      { ancho: 6, campo: 'compania_aerea', label: 'Compañía Aérea', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Iberia, Vueling...' } },
    ]
  },
  {
    fila_id: 'row_fijo_numvuelo_clase_vuelos',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'numero_vuelo', label: 'Número de Vuelo', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: IB3204' } },
      { ancho: 6, campo: 'clase', label: 'Clase', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Turista', 'Premium Economy', 'Business', 'Primera clase'] } },
    ]
  },
  {
    fila_id: 'row_fijo_ruta_vuelos',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'origen_vuelo', label: 'Aeropuerto Origen', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: MAD (Madrid)' } },
      { ancho: 6, campo: 'destino_vuelo', label: 'Aeropuerto Destino', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: CDG (París)' } },
    ]
  },
  {
    fila_id: 'row_fijo_fecha_hora_vuelos',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_salida', label: 'Fecha de Salida', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'hora_salida', label: 'Hora de Salida', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: 14:30' } },
    ]
  },
  {
    fila_id: 'row_fijo_vuelta_pnr_compania',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'localizador_vuelta', label: 'Localizador Vuelta (PNR)', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: ZQ9R2K' } },
      { ancho: 6, campo: 'compania_aerea_vuelta', label: 'Compañía Aérea Vuelta', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Iberia, Vueling...' } },
    ]
  },
  {
    fila_id: 'row_fijo_vuelta_num_fecha',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'numero_vuelo_vuelta', label: 'Nº Vuelo Vuelta', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: IB3205' } },
      { ancho: 4, campo: 'fecha_regreso', label: 'Fecha de Regreso', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 4, campo: 'hora_regreso', label: 'Hora de Regreso', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: 21:15' } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_vuelos',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_vuelos',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_vuelos',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Pasajeros', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Trayectos', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_equipaje_vuelos',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'equipaje', label: 'Equipaje Incluido', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Solo artículo personal (mochila)', 'Equipaje de cabina (10kg)', 'Equipaje facturado (23kg)', 'Mochila + Equipaje facturado', 'Equipaje especial (deportivo/musical)', 'Sin equipaje'] } }
    ]
  },
  {
    fila_id: 'row_fijo_notas_vuelos',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_vuelo', label: 'Notas / Detalles del Vuelo', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Escalas, horarios de facturación, asientos reservados...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_CRUCERO: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_crucero',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del crucero...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_barco_naviera_crucero',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'nombre_barco', label: 'Nombre del Barco', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Symphony of the Seas, MSC World Europa...' } },
      { ancho: 6, campo: 'naviera', label: 'Compañía Naviera', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Royal Caribbean, MSC Cruceros...' } },
    ]
  },
  {
    fila_id: 'row_fijo_cabina_camarote_crucero',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'tipo_cabina', label: 'Tipo de Cabina', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Cabina Interior', 'Cabina Exterior (Ventana)', 'Cabina con Balcón', 'Suite', 'Dúplex / Familiar'] } },
      { ancho: 6, campo: 'numero_camarote', label: 'Número de Camarote / Cubierta', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Cubierta 10 - Camarote 10244' } },
    ]
  },
  {
    fila_id: 'row_fijo_regimen_embarque_crucero',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'regimen_bordo', label: 'Régimen a Bordo', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Pensión Completa', 'Todo Incluido', 'Todo Incluido Premium', 'Solo Alojamiento (Crucero fluvial)'] } },
      { ancho: 6, campo: 'puerto_embarque', label: 'Puerto de Embarque', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Barcelona, Miami...' } },
    ]
  },
  {
    fila_id: 'row_fijo_fechas_embarque_crucero',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_embarque', label: 'Fecha de Embarque', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'fecha_desembarque', label: 'Fecha de Desembarque', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_crucero',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino / Puerto Principal', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_crucero',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_crucero',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Pasajeros', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Noches', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_notas_crucero',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_crucero', label: 'Notas / Detalles del Crucero', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Turno de cena asignado, excursiones contratadas, tasas de embarque...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_RESTAURACION: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_restauracion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del servicio...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_nombre_restaurante',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'nombre_alojamiento', label: 'Nombre del Establecimiento / Restaurante', tipo: 'places_autocomplete', origen: 'jsonb_detalles', propiedades: { required: true, placeholder: 'Ej: Restaurante Botín, El Celler de Can Roca...' } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_servicio_menu',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'tipo_servicio', label: 'Tipo de Servicio', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Almuerzo', 'Cena', 'Desayuno', 'Brunch', 'Cóctel', 'Coffee Break', 'Degustación', 'Otro'] } },
      { ancho: 6, campo: 'tipo_menu', label: 'Tipo de Menú', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Menú cerrado / concertado', 'A la carta', 'Menú degustación', 'Buffet', 'Menú infantil'] } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_restauracion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino / Ubicación', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_fecha_horario_restauracion',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_reserva', label: 'Fecha de la Reserva', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'horario', label: 'Horario', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['13:00', '13:30', '14:00', '14:30', '15:00', '20:00', '20:30', '21:00', '21:30', '22:00'] } },
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_restauracion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_restauracion',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Personas', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Servicios', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_alergenos_restauracion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'alergenos', label: 'Restricciones dietéticas / Alérgenos', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Celíacos, vegetarianos, alergias a frutos secos...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_notas_restauracion',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_restauracion', label: 'Notas / Detalles de Reserva', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Código de vestimenta, bebidas incluidas, salón privado...', rows_textarea: 3 } }
    ]
  }
];

const FIJOS_TREN: SchemaRow[] = [
  {
    fila_id: 'row_fijo_descripcion_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'descripcion', label: 'Descripción', tipo: 'textarea', origen: 'tabla_nativa', propiedades: { required: false, placeholder: 'Descripción del trayecto en tren...', rows_textarea: 2 } }
    ]
  },
  {
    fila_id: 'row_fijo_tipo_trayecto_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'tipo_trayecto', label: 'Tipo de trayecto', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Sólo ida', 'Ida y vuelta'], default: 'Sólo ida' } }
    ]
  },
  {
    fila_id: 'row_fijo_pnr_compania_tren',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'localizador', label: 'Localizador (PNR)', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: X8RJ2L' } },
      { ancho: 6, campo: 'compania_tren', label: 'Compañía Ferroviaria', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Renfe', 'Avlo', 'Ouigo', 'Iryo', 'SNCF', 'Eurostar', 'Trenitalia', 'Amtrak', 'Otra'] } },
    ]
  },
  {
    fila_id: 'row_fijo_numtren_clase_tren',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'numero_tren', label: 'Número de Tren', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: AVE 03120' } },
      { ancho: 6, campo: 'clase_tren', label: 'Clase / Tarifa', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Estándar / Turista', 'Básica', 'Elige / Confort', 'Premium / Preferente', 'Silencio', 'Primera clase'] } },
    ]
  },
  {
    fila_id: 'row_fijo_ruta_tren',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'origen_tren', label: 'Estación de Origen', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Madrid Puerta de Atocha' } },
      { ancho: 6, campo: 'destino_tren', label: 'Estación de Destino', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Barcelona Sants' } },
    ]
  },
  {
    fila_id: 'row_fijo_fecha_hora_tren',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'fecha_salida', label: 'Fecha de Salida', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 6, campo: 'hora_salida', label: 'Hora de Salida', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: 09:15' } },
    ]
  },
  {
    fila_id: 'row_fijo_vuelta_pnr_compania_tren',
    fijo: true,
    columnas: [
      { ancho: 6, campo: 'localizador_vuelta', label: 'Localizador Vuelta (PNR)', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: ZQ8Y2K' } },
      { ancho: 6, campo: 'compania_tren_vuelta', label: 'Compañía Vuelta', tipo: 'select', origen: 'jsonb_detalles', propiedades: { opciones: ['Renfe', 'Avlo', 'Ouigo', 'Iryo', 'SNCF', 'Eurostar', 'Trenitalia', 'Amtrak', 'Otra'] } },
    ]
  },
  {
    fila_id: 'row_fijo_vuelta_num_fecha_tren',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'numero_tren_vuelta', label: 'Nº Tren Vuelta', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: AVE 03191' } },
      { ancho: 4, campo: 'fecha_regreso', label: 'Fecha de Regreso', tipo: 'date', origen: 'jsonb_detalles', propiedades: { required: false } },
      { ancho: 4, campo: 'hora_regreso', label: 'Hora de Regreso', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: 19:40' } },
    ]
  },
  {
    fila_id: 'row_fijo_destino_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'destino', label: 'Destino', tipo: 'db_destination', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_proveedor_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'proveedor', label: 'Proveedor', tipo: 'db_select', origen: 'tabla_nativa', propiedades: { required: true } }
    ]
  },
  {
    fila_id: 'row_fijo_importes_tren',
    fijo: true,
    columnas: [
      { ancho: 4, campo: 'plazas', label: 'Pasajeros', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'noches', label: 'Trayectos', tipo: 'db_number', origen: 'tabla_nativa', propiedades: { required: true } },
      { ancho: 4, campo: 'neto', label: 'Precio Coste', tipo: 'number_decimal', origen: 'tabla_nativa', propiedades: { required: true } },
    ]
  },
  {
    fila_id: 'row_fijo_asientos_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'asientos', label: 'Coche y Asiento(s)', tipo: 'text', origen: 'jsonb_detalles', propiedades: { placeholder: 'Ej: Coche 5 - Asientos 4A, 4B' } }
    ]
  },
  {
    fila_id: 'row_fijo_notas_tren',
    fijo: true,
    columnas: [
      { ancho: 12, campo: 'notas_tren', label: 'Notas / Detalles del Viaje', tipo: 'textarea', origen: 'jsonb_detalles', propiedades: { placeholder: 'Información de equipaje especial, políticas de cambios/anulaciones...', rows_textarea: 3 } }
    ]
  }
];

const FIXED_FIELDS_MAP: Record<string, SchemaRow[]> = {
  'Alojamiento': FIJOS_ALOJAMIENTO,
  'Entradas': FIJOS_ENTRADAS,
  'Entrada': FIJOS_ENTRADAS,
  'Seguro': FIJOS_SEGURO,
  'Seguros': FIJOS_SEGURO,
  'Guías': FIJOS_GUIAS,
  'Guía': FIJOS_GUIAS,
  'Guias': FIJOS_GUIAS,
  'Guia': FIJOS_GUIAS,
  'Actividades': FIJOS_ACTIVIDADES,
  'Actividad': FIJOS_ACTIVIDADES,
  'Actividades y excursiones': FIJOS_ACTIVIDADES,
  'Actividades y Excursiones': FIJOS_ACTIVIDADES,
  'Vuelos': FIJOS_VUELOS,
  'Vuelo': FIJOS_VUELOS,
  'Crucero': FIJOS_CRUCERO,
  'Cruceros': FIJOS_CRUCERO,
  'Restauración': FIJOS_RESTAURACION,
  'Restauracion': FIJOS_RESTAURACION,
  'Restaurante': FIJOS_RESTAURACION,
  'Restaurantes': FIJOS_RESTAURACION,
  'Tren': FIJOS_TREN,
  'Trenes': FIJOS_TREN,
};

export function getFixedFields(etiqueta?: string): SchemaRow[] {
  if (!etiqueta) return [];
  return FIXED_FIELDS_MAP[etiqueta] || [];
}

export function getFullSchema(tipo: { etiqueta?: string; contenido?: any }): SchemaRow[] {
  const fixed = getFixedFields(tipo?.etiqueta);
  const custom = Array.isArray(tipo?.contenido) ? tipo.contenido : [];
  return [...fixed, ...custom];
}
