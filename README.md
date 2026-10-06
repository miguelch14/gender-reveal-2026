# Gender reveal · Miguel & Anais

Invitación web genérica: todos reciben el mismo link y cada persona se registra a sí misma
y a sus acompañantes. Las confirmaciones llegan solas a una Google Sheet.

- Página: `index.html`, publicada en GitHub Pages → https://miguelch14.github.io/gender-reveal-2026/
- Backend: `apps-script/Code.gs` (Google Apps Script dentro de la hoja)

## Cómo funciona
1. El invitado abre el link, elige "Sí, asistiremos" o "No podremos asistir".
2. Si asiste: cuántas personas (máx. 8 por registro, `CONFIG.maxPeople`), nombre y apellido de
   cada una, restricción alimentaria y comentario (opcionales).
3. La respuesta se guarda en la pestaña **Respuestas**. El celular del invitado recuerda su
   registro: si vuelve a abrir el link, ve "Cambiar respuesta" y su fila se actualiza (no se duplica).
4. La pestaña **Resumen** muestra registros, personas confirmadas, aforo y lugares disponibles.

## Puesta en marcha
### 1. Página (GitHub)
1. Repo público → **Settings → Pages → Source: GitHub Actions**.
2. Cada push a `main` publica la página (pestaña **Actions**).

### 2. Hoja y backend (Google)
1. Crea una hoja (https://sheets.new). **Archivo → Configuración → Zona horaria: Lima**.
2. **Extensiones → Apps Script**: pega todo `apps-script/Code.gs` y guarda.
3. Ejecuta **prepararHoja** (acepta los permisos: *Configuración avanzada → Ir a … → Permitir*).
4. **Implementar → Nueva implementación → Aplicación web**: Ejecutar como **Yo**,
   acceso **Cualquier usuario**. Copia la URL `/exec` en `CONFIG.rsvpEndpoint` de `index.html`.
5. Prueba: abrir la URL `/exec` en el navegador muestra `{"ok":true,...}`.

**Si cambias `Code.gs` después:** Implementar → Administrar implementaciones → ✏️ →
Versión: **Nueva versión** → Implementar. Así la URL `/exec` no cambia.

## Probar
1. Abre el link desde WhatsApp en el celular, confirma con 2 personas → aparece una fila en Respuestas.
2. Vuelve a abrir el link → el botón dice "Cambiar respuesta"; quita una persona y envía →
   la misma fila se actualiza ("Veces actualizado" = 1).
3. Borra las filas de prueba de Respuestas.

## Seguridad
- No hay claves ni secretos en el repo. No publiques teléfonos ni nombres de invitados aquí:
  esos datos viven solo en tu Google Sheet (privada; no la compartas "con cualquiera que tenga el enlace").
- La URL `/exec` es pública por diseño. Solo acepta respuestas (no devuelve datos de la hoja),
  limita a 8 personas por registro, valida el id de registro y descarta bots con un campo trampa.
- Como el link es genérico, quien lo tenga puede registrarse: revisa Respuestas de vez en cuando.
- El script usa `@OnlyCurrentDoc`: solo tiene permiso sobre esta hoja.
- Las fotos de `assets/img/` están optimizadas y sin metadatos (GPS). Los originales (`fotos/`) no se suben.

## Notas
- Si cambias fecha u hora, actualiza también `assets/gender-reveal.ics`.
- El sitio tiene `noindex`: no aparece en Google, pero cualquiera con el link puede abrirlo.
