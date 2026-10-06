/**
 * @OnlyCurrentDoc  (el script solo puede tocar esta hoja, no el resto de tu Drive)
 */

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
// true: acepta respuestas del link genérico (sin ?h=). false: solo hogares de la pestaña Invitados.
var ALLOW_GENERIC = true;

// Menú en la hoja: Invitación → Preparar hoja
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Invitación')
    .addItem('Preparar hoja', 'prepararHoja')
    .addItem('Generar ids faltantes', 'generarIds')
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
  if (!g.getRange('B2').getValue()) g.getRange('A2:D2').setValues([[randomId_(), 'Juan y María (prueba)', 2, '']]);

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

/**
 * Pone un id aleatorio (ej. k7p2qx) a cada hogar con nombre y sin id.
 * Ids difíciles de adivinar: nadie puede cambiar la respuesta de otro hogar probando 001, 002…
 */
function generarIds() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var g = ss.getSheetByName(GUESTS_SHEET);
  if (!g) {
    ss.toast('No existe la pestaña "Invitados". Usa primero Invitación → Preparar hoja.', 'Invitación', 8);
    return;
  }
  var n = fillIds_(g, 2, Math.max(g.getLastRow() - 1, 0));
  ss.toast(n ? 'Se generaron ' + n + (n === 1 ? ' id.' : ' ids.')
             : 'No hay hogares sin id. Escribe el nombre en la columna B, debajo del encabezado.', 'Invitación', 8);
}

// Al escribir un nombre en Invitados (columna B), el id se genera solo.
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  if (sh.getName() !== GUESTS_SHEET || e.range.getColumn() > 2 || e.range.getLastColumn() < 2) return;
  var first = Math.max(e.range.getRow(), 2);
  var count = e.range.getLastRow() - first + 1;
  if (count > 0) fillIds_(sh, first, count);
}

// Rellena ids vacíos en filas con nombre; devuelve cuántos generó.
function fillIds_(g, firstRow, count) {
  if (count < 1) return 0;
  var last = g.getLastRow();
  var used = {};
  if (last >= 2) {
    g.getRange(2, 1, last - 1, 1).getValues().forEach(function (v) {
      var id = String(v[0]).trim();
      if (id) used[id] = true;
    });
  }
  var vals = g.getRange(firstRow, 1, count, 2).getValues();
  var made = 0;
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1]).trim() && !String(vals[i][0]).trim()) {
      var id;
      do { id = randomId_(); } while (used[id]);
      used[id] = true;
      g.getRange(firstRow + i, 1).setValue(id);
      made++;
    }
  }
  return made;
}

function randomId_() {
  var abc = 'abcdefghjkmnpqrstuvwxyz23456789';   // sin 0/o, 1/l/i para que no se confundan
  var id = '';
  for (var i = 0; i < 6; i++) id += abc.charAt(Math.floor(Math.random() * abc.length));
  return id;
}

// Cupos del hogar según la pestaña Invitados; -1 si el id no está en la lista.
function guestSeats_(h) {
  var g = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTS_SHEET);
  if (!g || g.getLastRow() < 2) return -1;
  var vals = g.getRange(2, 1, g.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === h) {
      var c = parseInt(vals[i][2], 10);
      return c >= 1 && c <= MAX_SEATS ? c : MAX_SEATS;
    }
  }
  return -1;
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

    // Los cupos salen de la hoja, no del link (el link se puede editar a mano).
    var cupos = '';
    if (h) {
      cupos = guestSeats_(h);
      if (cupos < 0) return json_({ ok: false, error: 'hogar desconocido' });
      if (asistentes.length > cupos) return json_({ ok: false, error: 'excede cupos' });
    } else if (!ALLOW_GENERIC) {
      return json_({ ok: false, error: 'link sin hogar' });
    } else if (asistentes.length > MAX_SEATS) {
      return json_({ ok: false, error: 'excede cupos' });
    }

    var row = [
      new Date(),
      h ? "'" + h : '',              // apóstrofo: el id queda como texto (no 007 → 7)
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
