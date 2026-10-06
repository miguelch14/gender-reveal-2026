/**
 * @OnlyCurrentDoc  (el script solo puede tocar esta hoja, no el resto de tu Drive)
 */

/**
 * Backend de confirmaciones del gender reveal de Miguel & Anais.
 *
 * Invitación genérica: cualquiera con el link se registra a sí mismo y a sus acompañantes.
 * Cada registro trae un id aleatorio generado en el celular del invitado; si vuelve a
 * responder desde el mismo celular, se actualiza su fila en lugar de duplicarla.
 *
 * Publicación: Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión
 *   (o la primera vez: Nueva implementación → Aplicación web, Ejecutar como: Yo,
 *    Quién tiene acceso: Cualquier usuario). La URL /exec va en CONFIG.rsvpEndpoint.
 *
 * Antes, ejecuta una vez prepararHoja() para crear las pestañas Respuestas y Resumen.
 */

var SHEET_NAME = 'Respuestas';
var HEADERS = [
  'Timestamp', 'ID registro', 'Contacto', 'Respuesta', 'Cantidad',
  'Asistentes', 'Celular', 'Restricciones', 'Comentario', 'Veces actualizado'
];
var MAX_PEOPLE = 8;     // máximo por registro (igual que CONFIG.maxPeople en index.html)
var CAPACITY = 60;      // aforo total, para el Resumen

// Menú en la hoja: Invitación → Preparar hoja
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Invitación')
    .addItem('Preparar hoja', 'prepararHoja')
    .addToUi();
}

/** Crea (o completa) las pestañas Respuestas y Resumen. Se puede ejecutar más de una vez. */
function prepararHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var r = getSheet_();
  r.setColumnWidth(6, 260);
  r.getRange('F:F').setWrap(true);

  var s = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  s.clear();
  s.getRange('A1:B7').setValues([
    ['Registros recibidos', '=COUNTA(Respuestas!B2:B)'],
    ['Registros que asisten', '=COUNTIF(Respuestas!D2:D,"si")'],
    ['Personas confirmadas', '=SUMIF(Respuestas!D2:D,"si",Respuestas!E2:E)'],
    ['Registros que no asisten', '=COUNTIF(Respuestas!D2:D,"no")'],
    ['Aforo', CAPACITY],
    ['Lugares disponibles', '=B5-B3'],
    ['Alerta', '=IF(B3>B5,"⚠️ Se superó el aforo","")']
  ]);
  s.getRange('A1:A7').setFontWeight('bold');
  s.setColumnWidth(1, 220);
  ss.setActiveSheet(s);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Campo trampa: las personas no lo ven; si viene lleno es un bot. Respondemos ok sin guardar.
    if (data.website) return json_({ ok: true });

    var id = String(data.r || '').trim();
    if (!/^[a-z0-9]{8,16}$/.test(id)) return json_({ ok: false, error: 'id inválido' });

    var respuesta = data.respuesta === 'si' ? 'si' : data.respuesta === 'no' ? 'no' : '';
    if (!respuesta) return json_({ ok: false, error: 'respuesta inválida' });

    var asistentes = [];
    if (respuesta === 'si' && Array.isArray(data.asistentes)) {
      asistentes = data.asistentes
        .map(function (n) { return text_(n, 80); })
        .filter(function (n) { return n; });
    }
    if (respuesta === 'si' && !asistentes.length) return json_({ ok: false, error: 'sin asistentes' });
    if (asistentes.length > MAX_PEOPLE) return json_({ ok: false, error: 'demasiadas personas' });

    var contacto = text_(data.contacto, 80) || asistentes[0] || '';
    if (!contacto) return json_({ ok: false, error: 'sin nombre' });

    var row = [
      new Date(),
      id,
      contacto,
      respuesta,
      asistentes.length,
      asistentes.join('\n'),
      respuesta === 'si' ? phone_(data.celular) : '',
      respuesta === 'si' ? text_(data.restricciones, 120) : '',
      text_(data.comentario, 300),
      0
    ];

    var sheet = getSheet_();
    var existing = findRow_(sheet, id);
    if (existing > 0) {
      row[9] = (Number(sheet.getRange(existing, 10).getValue()) || 0) + 1;
      sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Permite comprobar en el navegador que la URL /exec responde.
function doGet() {
  return json_({ ok: true, service: 'gender-reveal-rsvp' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.getRange('G:G').setNumberFormat('@');   // celulares como texto
  }
  return sheet;
}

function findRow_(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return -1;
}

// Solo dígitos, espacios y + (ej. "987 654 321"); como texto para no perder el formato.
function phone_(v) {
  var s = String(v == null ? '' : v).replace(/[^\d+ ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return s ? "'" + s : '';
}

// Texto limpio y acotado; neutraliza fórmulas (=, +, -, @) para que la hoja no las ejecute.
function text_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
