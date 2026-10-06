/**
 * Backend de confirmaciones del gender reveal de Miguel & Anaís.
 *
 * Guarda cada respuesta en la hoja "Respuestas" de la Google Sheet a la que
 * está vinculado este script (Extensiones → Apps Script).
 * Si un hogar (h) vuelve a responder, se actualiza su fila en lugar de duplicarla.
 *
 * Publicación: Implementar → Nueva implementación → Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Cualquier usuario
 * Copia la URL que termina en /exec en CONFIG.rsvpEndpoint del index.html.
 *
 * Antes, ejecuta una vez prepararHoja() para crear las pestañas Invitados,
 * Respuestas y Resumen (ver README.md).
 */

var SHEET_NAME = 'Respuestas';
var HEADERS = [
  'Timestamp', 'Hogar (h)', 'Nombres del hogar', 'Respuesta', 'Cantidad',
  'Asistentes', 'Restricciones', 'Comentario', 'Cupos', 'Veces actualizado'
];
var MAX_SEATS = 10;

var SITE_URL = 'https://miguelch14.github.io/gender-reveal-2026/';
var GUESTS_SHEET = 'Invitados';
var GUESTS_HEADERS = [
  'h (id)', 'Nombres (saludo)', 'Cupos', 'Teléfono (51…)', 'Link', 'Estado', 'Confirmados', 'Alerta', 'WhatsApp'
];
var GUEST_ROWS = 80;

// Menú en la hoja: Invitación → Preparar hoja
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Invitación')
    .addItem('Preparar hoja', 'prepararHoja')
    .addToUi();
}

/**
 * Crea las pestañas Respuestas, Invitados y Resumen con sus fórmulas.
 * Se puede ejecutar más de una vez: no borra los invitados que ya escribiste.
 */
function prepararHoja() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  getSheet_();

  var g = ss.getSheetByName(GUESTS_SHEET) || ss.insertSheet(GUESTS_SHEET, 0);
  g.getRange(1, 1, 1, GUESTS_HEADERS.length).setValues([GUESTS_HEADERS]).setFontWeight('bold');
  g.setFrozenRows(1);
  g.getRange('A:A').setNumberFormat('@');   // ids como texto: 007 no se vuelve 7
  g.getRange('D:D').setNumberFormat('@');
  if (!g.getRange('A2').getValue()) g.getRange('A2:D2').setValues([['007', 'Yembert y Laura', 2, '']]);

  var formulas = [];
  for (var r = 2; r <= GUEST_ROWS + 1; r++) {
    var resp = 'VLOOKUP($A' + r + ',Respuestas!$B:$E,';
    formulas.push([
      '=IF($A' + r + '="","","' + SITE_URL + '?h="&ENCODEURL($A' + r + ')&"&n="&ENCODEURL($B' + r + ')&"&c="&$C' + r + ')',
      '=IF($A' + r + '="","",IFERROR(IF(' + resp + '3,FALSE)="si","✅ Asiste","❌ No asiste"),"⏳ Pendiente"))',
      '=IF($A' + r + '="","",IFERROR(IF(' + resp + '3,FALSE)="si",' + resp + '4,FALSE),0),""))',
      '=IF(AND(ISNUMBER($G' + r + '),$G' + r + '>$C' + r + '),"⚠️ Más que los cupos","")',
      '=IF(OR($A' + r + '="",$D' + r + '=""),"",HYPERLINK("https://wa.me/"&$D' + r +
        '&"?text="&ENCODEURL("¡Hola, "&$B' + r + '&"! Con mucho cariño te enviamos la invitación a nuestro gender reveal: "&$E' + r + '),"Enviar"))'
    ]);
  }
  g.getRange(2, 5, GUEST_ROWS, 5).setFormulas(formulas);
  g.setColumnWidth(2, 200);
  g.setColumnWidth(5, 320);
  g.setColumnWidth(6, 120);

  var s = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  s.getRange('A1:B6').setValues([
    ['Hogares invitados', '=COUNTA(Invitados!A2:A)'],
    ['Cupos entregados', '=SUM(Invitados!C2:C)'],
    ['Hogares que asisten', '=COUNTIF(Invitados!F2:F,"✅ Asiste")'],
    ['Personas confirmadas', '=SUM(Invitados!G2:G)'],
    ['Hogares que no asisten', '=COUNTIF(Invitados!F2:F,"❌ No asiste")'],
    ['Hogares pendientes', '=COUNTIF(Invitados!F2:F,"⏳ Pendiente")']
  ]);
  s.getRange('A1:A6').setFontWeight('bold');
  s.setColumnWidth(1, 200);
  ss.setActiveSheet(g);
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

    var h = String(data.h || '').trim();
    if (!/^[A-Za-z0-9_-]{1,12}$/.test(h)) h = '';
    var respuesta = data.respuesta === 'si' ? 'si' : data.respuesta === 'no' ? 'no' : '';
    if (!respuesta) return json_({ ok: false, error: 'respuesta inválida' });

    var asistentes = [];
    if (respuesta === 'si' && Array.isArray(data.asistentes)) {
      asistentes = data.asistentes.slice(0, MAX_SEATS)
        .map(function (n) { return text_(n, 80); })
        .filter(function (n) { return n; });
    }
    if (respuesta === 'si' && !asistentes.length) return json_({ ok: false, error: 'sin asistentes' });

    var cupos = parseInt(data.cupos, 10);
    if (!(cupos >= 1 && cupos <= MAX_SEATS)) cupos = '';

    var row = [
      new Date(),
      h ? "'" + h : '',              // apóstrofo: conserva ceros a la izquierda (007)
      text_(data.hogar, 80),
      respuesta,
      asistentes.length,
      asistentes.join('\n'),
      respuesta === 'si' ? text_(data.restricciones, 120) : '',
      text_(data.comentario, 300),
      cupos,
      0
    ];

    var sheet = getSheet_();
    var existing = h ? findRow_(sheet, h) : -1;
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
  }
  return sheet;
}

function findRow_(sheet, h) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === h) return i + 2;
  }
  return -1;
}

// Texto limpio y acotado; neutraliza fórmulas (=, +, -, @) para que la hoja no las ejecute.
function text_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
