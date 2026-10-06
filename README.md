# Gender reveal · Miguel & Anaís

Invitación web personalizada por hogar. Las confirmaciones llegan solas a una Google Sheet.

- Página: `index.html`, publicada en GitHub Pages → https://miguelch14.github.io/gender-reveal-2026/
- Backend: `apps-script/Code.gs` (Google Apps Script dentro de la hoja)

## Paso a paso

### 1. Publicar la página (GitHub)
1. Repo → **Settings → General → Danger Zone → Change visibility → Public** (Pages gratis exige repo público).
2. **Settings → Pages → Source: GitHub Actions**.
3. **Actions → "Deploy a GitHub Pages" → Run workflow**. En ~1 min la página está en la URL de arriba.

### 2. Crear la hoja y el backend (Google)
1. En https://sheets.new crea una hoja; llámala "Gender reveal – confirmaciones".
2. **Archivo → Configuración → Zona horaria: (GMT-05:00) Lima** → Guardar.
3. **Extensiones → Apps Script**. Borra lo que haya, pega todo `apps-script/Code.gs` y guarda (💾).
4. Arriba, elige la función **prepararHoja** → **Ejecutar**. Google pedirá permisos:
   *Revisar permisos → tu cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir*
   (es "no seguro" solo porque el script es tuyo y no está verificado por Google).
5. Vuelve a la hoja: aparecen las pestañas **Invitados**, **Respuestas** y **Resumen**.
6. En Apps Script: **Implementar → Nueva implementación → ⚙️ Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** → copia la **URL de la aplicación web** (termina en `/exec`).
7. Prueba: abre esa URL en el navegador; debe decir `{"ok":true,"service":"gender-reveal-rsvp"}`.

### 3. Conectar la página con la hoja
En `index.html`, en `CONFIG`:
- `rsvpEndpoint`: la URL `/exec`.
- `rsvpPhone`: tu WhatsApp, ej. `51999999999` (respaldo si falla el envío).
- `rsvpDeadline`: ej. `'sábado 24 de octubre'`.

Sube el cambio a `main`; GitHub Pages se vuelve a publicar solo.

### 4. Cargar invitados y enviar links
En la pestaña **Invitados**, una fila por hogar:

| h (id) | Nombres (saludo) | Cupos | Teléfono (51…) |
|---|---|---|---|
| *(vacío)* | Juan y María | 2 | 51987654321 |

Las columnas **Link**, **Estado**, **Confirmados**, **Alerta** y **WhatsApp** se llenan solas
(hasta 80 hogares). "Enviar" abre WhatsApp con el mensaje y el link listos.

- Deja `h` vacío y usa el menú **Invitación → Generar ids faltantes**: pone un id aleatorio
  (ej. `k7p2qx`) a cada hogar. No uses 001, 002…: serían fáciles de adivinar y alguien podría
  cambiar la respuesta de otro hogar. Una vez enviado un link, no cambies su id.
- `Nombres` es el saludo ("Hola, Juan y María") y prellena los nombres de pila del formulario.
- Los **cupos se validan en el servidor** con lo que dice esta hoja; editar `c=` en el link no sirve de nada.

### 5. Probar antes de enviar a todos
1. Abre el link de la fila de prueba ("Juan y María (prueba)") desde WhatsApp en el celular.
2. Confirma → debe aparecer una fila en **Respuestas** y el Estado en Invitados pasa a ✅.
3. Vuelve a responder "No podremos asistir" → la misma fila se actualiza (no se duplica).
4. Borra la fila de prueba en Respuestas y en Invitados.

## Seguridad
- No hay claves ni secretos en el repo. **No publiques teléfonos ni nombres reales aquí**:
  la lista de invitados vive solo en tu Google Sheet (privada; no la compartas "con cualquiera que tenga el enlace").
- La URL `/exec` es pública por diseño (la página la necesita). Solo acepta respuestas:
  no devuelve datos de la hoja. Valida el id del hogar y los cupos contra la pestaña Invitados.
- El script usa `@OnlyCurrentDoc`: solo tiene permiso sobre esta hoja.

## Notas
- Si cambias `Code.gs` después: **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva versión → Implementar**.
  Así la URL `/exec` no cambia. (Para `prepararHoja` no hace falta: basta con ejecutarla.)
- Los links genéricos (sin `?h=`) también guardan respuestas, pero no se cruzan con Invitados.
- El sitio tiene `noindex`: no aparece en Google, pero cualquiera con el link puede abrirlo.
