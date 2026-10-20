# Conteos a Google Sheets

Cada conteo que se guarda en `/conteos` se copia automáticamente como una fila en una hoja de Google Sheets, con **una pestaña por tienda** (se crea sola la primera vez que llega un conteo de esa tienda). Solo se copian los datos; las fotos siguen en Supabase.

Columnas: Registro, Fecha y hora, Contado por, ID artículo, Producto, Cantidad, Cajas, Ancho, Largo, Alto, Lote, Vencimiento, Hora inicio, Hora cierre, Duración (min), Mesa. (Mesa va al final para que las pestañas creadas antes no se desordenen; el script le agrega el encabezado sola.)

El conteo siempre se guarda primero en Supabase. Si Google no responde, queda marcado como pendiente y se reenvía desde el panel (pestaña Conteos → "Enviar pendientes"). Si un coordinador elimina un conteo en el panel, también se borra su fila de la hoja.

## Instalación (una sola vez, unos 10 minutos)

### 1. Base de datos
Volver a ejecutar completo `supabase/conteos.sql` en el SQL Editor de Supabase (agrega la columna `en_sheets`; no borra datos).

### 2. Crear la hoja y pegar el script
1. En Google Drive, crear una hoja de cálculo nueva, por ejemplo **"Conteos Efficommerce"**.
2. En la hoja: **Extensiones → Apps Script**.
3. Borrar el contenido de `Código.gs` y pegar todo el archivo `google/conteos-sheets.gs`.
4. Guardar (icono de disquete).

### 3. Generar la clave
1. Arriba, en el selector de funciones, elegir **`configurar`** y pulsar **Ejecutar**.
2. Google pide permisos: **Revisar permisos** → elegir la cuenta → si aparece "Google no verificó esta app", entrar en **Configuración avanzada → Ir a (nombre del proyecto)** → **Permitir**. Es normal: el script es suyo y solo accede a esta hoja.
3. Abajo, en el **Registro de ejecución**, aparece `Clave para Vercel (SHEETS_WEBHOOK_SECRET): ...`. Copiar esa clave.

### 4. Publicar como aplicación web
1. **Implementar → Nueva implementación**.
2. En el engranaje de "Seleccionar tipo", elegir **Aplicación web**.
3. **Ejecutar como: Yo** · **Quién tiene acceso: Cualquier usuario**.
4. **Implementar** y copiar la **URL de la aplicación web** (termina en `/exec`).

"Cualquier usuario" es necesario para que Vercel pueda llamarla; sin la clave del paso 3 el script rechaza cualquier petición.

Para comprobarla, abrir la URL en el navegador: debe mostrar `{"ok":true,"servicio":"conteos"}`.

### 5. Configurar Vercel
En el proyecto de Vercel: **Settings → Environment Variables**, agregar en Production:

| Nombre | Valor |
|---|---|
| `SHEETS_WEBHOOK_URL` | la URL del paso 4 |
| `SHEETS_WEBHOOK_SECRET` | la clave del paso 3 |

Después: **Deployments → (último) → Redeploy**, para que tome las variables.

### 6. Pasar los conteos que ya existen
En el panel de coordinador, pestaña **Conteos**: aparece "Google Sheets: N conteo(s) sin copiar a la hoja" → **Enviar pendientes**.

## Si se cambia el script
Después de editar el código en Apps Script: **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**. Así la URL sigue siendo la misma y no hay que tocar Vercel.

## Notas
- La hoja debe quedarse en la cuenta de quien publicó el script (el script escribe como esa persona).
- Si se renombra una tienda, sus conteos nuevos van a una pestaña con el nombre nuevo; los anteriores quedan en la pestaña vieja.
- No editar a mano la columna **Registro**: es la que se usa para no duplicar filas y para borrar.
