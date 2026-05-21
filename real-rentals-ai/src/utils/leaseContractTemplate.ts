/**
 * Plantilla del Contrato de Alquiler RIAL - Cláusulas y definiciones.
 * Uso: generación de PDF profesional con todas las condiciones legales.
 */

export interface ContractSection {
  sectionTitle: string;
  paragraphs: string[];
}

/**
 * Retorna las secciones del contrato (cláusulas) en orden.
 * Los datos dinámicos (propiedad, locatario, fechas) se inyectan en leaseRoutes.
 */
export function getContractSections(): ContractSection[] {
  return [
    {
      sectionTitle: '1) DEFINICIONES CLAVE',
      paragraphs: [
        'Publicación: Anuncio del inmueble en RIAL con descripción, precio, fechas, capacidad, servicios incluidos y reglas particulares.',
        'Reserva/Alquiler: Confirmación del inmueble por el Locatario mediante RIAL para un período determinado.',
        'Seña: Pago inicial del 50% al confirmar el alquiler desde la app (según disponibilidad/flujo de pago).',
        'Garantía (Depósito de Seguridad): Monto destinado a cubrir daños, faltantes, limpieza extraordinaria o deudas del Locatario.',
        'Acceso Digital: Sistema de ingreso sin llaves (código, QR, token, cerradura inteligente u otro equivalente).',
      ],
    },
    {
      sectionTitle: '2) CONDICIONES DE PAGO (OBLIGATORIAS)',
      paragraphs: [
        '2.1 Seña del 50% al alquilar desde la app — Al confirmar el alquiler en RIAL, el Locatario podrá abonar una Seña del 50% del monto correspondiente, la cual se imputa al total.',
        '2.2 Pago del saldo y habilitación del acceso — El saldo restante (y cualquier monto exigible) deberá estar acreditado conforme el calendario mostrado en RIAL. RIAL y/o el Locador pueden no habilitar el Acceso Digital hasta que el pago figure acreditado.',
        '2.3 Regla especial: alquiler por 3 meses (pago total + garantía) — Si el Locatario contrata un alquiler de 3 (tres) meses, acepta que: deberá pagar los 3 meses completos por adelantado, más 1 (un) mes adicional en concepto de Garantía, todo en un solo pago (o en el flujo equivalente definido por RIAL) antes de habilitarse el Acceso Digital.',
        '2.4 Plazo de 48 horas tras la seña — Una vez abonada la seña (50% del total), el Locatario tiene 48 (cuarenta y ocho) horas corridas para pagar el saldo. Si no lo hace, la seña no es reembolsable y la reserva se cancela.',
      ],
    },
    {
      sectionTitle: '3) MORA, FALTA DE PAGO Y CANCELACIÓN POR INCUMPLIMIENTO (15 DÍAS)',
      paragraphs: [
        '3.1 Mora automática — La falta de pago total o parcial a su vencimiento genera mora automática, sin necesidad de aviso formal.',
        '3.2 Cancelación/Resolución por falta de pago a los 15 días — Si el Locatario no regulariza el pago dentro de 15 (quince) días corridos desde el vencimiento, el Locador podrá cancelar y/o resolver el Contrato de Alquiler, con las siguientes consecuencias: pérdida del derecho a uso/ocupación del inmueble, obligación de desocupar y permitir la restitución del inmueble, posibilidad de aplicar la Garantía a montos adeudados y/o daños, y cobro/reclamo de cualquier diferencia pendiente conforme la normativa aplicable.',
        '3.3 Restricción de Acceso Digital por mora — En caso de mora, y si es técnicamente posible, el Locador y/o RIAL podrán suspender o restringir el Acceso Digital hasta la regularización del pago, sin que ello implique renuncia a derechos del Locador.',
      ],
    },
    {
      sectionTitle: '4) ACCESO AL INMUEBLE (SIN LLAVES): CÓDIGO/QR Y RESPONSABILIDAD',
      paragraphs: [
        '4.1 Acceso Digital — El ingreso se realiza mediante Acceso Digital. No hay entrega de llaves físicas.',
        '4.2 Uso personal e intransferible — El Locatario se obliga a: no compartir el código/QR/token con terceros no autorizados, no publicarlo ni reenviarlo sin control, custodiarlo como información sensible. Todo acceso realizado con el Acceso Digital asignado se presume efectuado por el Locatario o por personas bajo su responsabilidad.',
        '4.3 Uso indebido = incumplimiento grave — Compartir, divulgar o manipular el sistema de acceso constituye incumplimiento grave y habilita: deshabilitación inmediata del Acceso Digital, cancelación/resolución del alquiler, y reclamo de daños, costos o penalidades (incluida ejecución de Garantía si corresponde).',
      ],
    },
    {
      sectionTitle: '5) ESTADO DEL INMUEBLE, VERIFICACIÓN Y DEVOLUCIÓN',
      paragraphs: [
        '5.1 Condición de entrega y evidencia — El Locatario acepta que el estado del inmueble se determina por: el estándar "mismas condiciones en que se entregó", la descripción y fotos de la Publicación, y evidencia de entrada/salida (fotos/video, checklist digital, informe del Locador o proveedor de limpieza/mantenimiento).',
        '5.2 Obligación de devolución — Al finalizar el alquiler, el Locatario debe devolver el inmueble: en las mismas condiciones en que fue entregado (salvo desgaste normal), sin faltantes, con limpieza razonable (o según reglas específicas de la Publicación).',
        '5.3 Daños o devolución en mal estado: se aplica la garantía — Si el inmueble no se devuelve en las mismas condiciones, el Locatario acepta que: se podrá ejecutar la Garantía para cubrir daños, faltantes, limpieza extraordinaria, reposiciones o reparaciones, y si la Garantía no alcanza, el Locatario deberá pagar la diferencia por los medios habilitados.',
      ],
    },
    {
      sectionTitle: '6) CONDUCTA Y USO PERMITIDO (OBLIGACIONES DEL LOCATARIO)',
      paragraphs: [
        'El Locatario se obliga a: usar el inmueble únicamente para el destino permitido y dentro de la capacidad indicada; respetar reglas del edificio/condominio/vecindario y "house rules" de la Publicación; no realizar actividades ilícitas, peligrosas o que generen molestias; no subalquilar, ceder o permitir ocupación por terceros fuera de lo permitido; no alterar cerraduras/sistemas de acceso ni instalaciones; cuidar mobiliario, electrodomésticos y áreas comunes (si aplica).',
        'Incumplimientos de conducta podrán derivar en: advertencia, cargos por daños/costos, restricción de acceso y/o cancelación del alquiler, según gravedad.',
      ],
    },
    {
      sectionTitle: '7) SERVICIOS, CONSUMOS Y CARGOS ADICIONALES',
      paragraphs: [
        'El Locatario debe cumplir con lo indicado en la Publicación sobre: servicios incluidos/excluidos, consumos (luz/agua/internet/gas) cuando correspondan, multas/expensas aplicables por su conducta.',
        'Cuando el Locatario genere costos (daños, sanciones del condominio, limpieza extraordinaria, reposición de accesorios, etc.), acepta asumirlos.',
      ],
    },
    {
      sectionTitle: '8) CANCELACIONES, CAMBIOS Y NO PRESENTACIÓN',
      paragraphs: [
        'Las políticas de cancelación, cambios de fechas y no presentación ("no-show") serán las mostradas en RIAL durante el proceso de contratación y/o las reglas específicas del anuncio.',
        'Cuando exista contradicción, prevalecerá lo que sea más específico para esa reserva (lo mostrado y aceptado en la confirmación de alquiler).',
      ],
    },
    {
      sectionTitle: '9) COMUNICACIONES OFICIALES',
      paragraphs: [
        'El Locatario acepta que las comunicaciones de RIAL/Locador (avisos de pago, reglas, incidentes, cargos, evidencias y resoluciones) podrán realizarse por: mensajería interna de RIAL, notificaciones push, email y/o WhatsApp vinculados a su cuenta.',
      ],
    },
    {
      sectionTitle: '10) ROL DE RIAL Y LIMITACIÓN OPERATIVA',
      paragraphs: [
        'RIAL facilita el proceso (publicación, reserva, pagos, soporte), pero: no garantiza la conducta del Locador o Locatario, no inspecciona físicamente cada inmueble, y no asume obligaciones del Locador salvo que se indique expresamente.',
        'RIAL podrá suspender cuentas y/o reservas ante fraude, violaciones de seguridad, incumplimientos reiterados o riesgos para terceros.',
      ],
    },
    {
      sectionTitle: '11) ACEPTACIÓN ELECTRÓNICA Y PRUEBA',
      paragraphs: [
        'El Locatario acepta que: la aceptación por click ("Acepto"), OTP, confirmación de reserva y/o comprobantes de pago constituyen consentimiento válido.',
        'Los registros electrónicos (logs, mensajes, comprobantes, bitácoras de acceso digital) podrán usarse como evidencia del Contrato y de incumplimientos.',
      ],
    },
    {
      sectionTitle: '12) LEY APLICABLE Y JURISDICCIÓN (MIAMI-DADE, FLORIDA)',
      paragraphs: [
        'Las propiedades gestionadas en RIAL operan principalmente en Miami-Dade County, Florida, Estados Unidos.',
        'El presente Contrato se rige por las leyes del Estado de Florida, Estados Unidos, y las normas federales aplicables en lo pertinente.',
        'Para controversias derivadas del Contrato, las partes se someten a la jurisdicción de los tribunales competentes del condado de Miami-Dade, Florida, salvo disposición imperativa en contrario.',
      ],
    },
  ];
}

export interface LeaseContractData {
  propertyTitle: string;
  propertyLocation: string;
  tenantName: string;
  tenantEmail: string;
  durationMonths: number;
  startDate: string;
  generationDate: string;
  monthlyPrice?: number;
}

/**
 * Escribe en el documento PDF el encabezado (datos del contrato) y todas las cláusulas.
 * Debe llamarse después de pipe() y antes de end().
 * @param doc Instancia de PDFDocument de pdfkit (any evita conflicto con sobrecargas de .text())
 */
export function buildContractPdfContent(doc: any, data: LeaseContractData): void {
  const margin = 50;
  const sectionTitleSize = 11;
  const bodySize = 9;
  const lineGap = 2;

  // Título principal
  doc.fontSize(16).font('Helvetica-Bold').text('CONTRATO DE ALQUILER TEMPORAL', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).font('Helvetica').text('Plataforma RIAL', { align: 'center' });
  doc.moveDown(1);

  // Datos del contrato (partes y objeto)
  doc.fontSize(11).font('Helvetica-Bold').text('DATOS DEL CONTRATO');
  doc.font('Helvetica').fontSize(bodySize);
  doc.text(`Inmueble (Publicación): ${data.propertyTitle}`, { lineGap });
  doc.text(`Ubicación: ${data.propertyLocation}`, { lineGap });
  doc.text(`Locatario: ${data.tenantName} (${data.tenantEmail})`, { lineGap });
  doc.text(`Duración: ${data.durationMonths} mes(es)`, { lineGap });
  if (data.monthlyPrice != null) {
    doc.text(`Precio mensual (referencia): $ ${data.monthlyPrice}`, { lineGap });
  }
  doc.text(`Fecha de inicio: ${data.startDate}`, { lineGap });
  doc.text(`Fecha de generación del contrato: ${data.generationDate}`, { lineGap });
  doc.moveDown(1);

  doc.font('Helvetica').text(
    'El presente contrato se rige por los términos y condiciones que se detallan a continuación, aceptados por el Locatario al confirmar la reserva/alquiler en RIAL. Ámbito operativo: Miami-Dade County, Florida, Estados Unidos.',
    { align: 'justify', lineGap: 3 }
  );
  doc.moveDown(1);

  // Secciones de cláusulas
  const sections = getContractSections();
  for (const section of sections) {
    doc.fontSize(sectionTitleSize).font('Helvetica-Bold').text(section.sectionTitle, { lineGap: 1 });
    doc.font('Helvetica').fontSize(bodySize);
    for (const paragraph of section.paragraphs) {
      doc.text(paragraph, { align: 'justify', lineGap: 3 });
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(1);
  doc.fontSize(bodySize).font('Helvetica').text(
    'Documento generado automáticamente por la plataforma RIAL. Los registros electrónicos de aceptación y de la transacción constituyen prueba del consentimiento y de las condiciones acordadas.',
    { align: 'center', lineGap: 2 }
  );
}
