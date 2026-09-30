# Juno Studio

Portfolio web en React con un servidor Node para el inicio de sesión del panel y la carga de publicaciones.

## Desarrollo

1. Instalar dependencias con `npm install`.
2. Configurar `.env.local` con `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `APP_ORIGIN` y `PORT`.
3. Iniciar con `npm run dev`.
4. Abrir la web en el puerto que indique Vite y entrar al panel desde `/login`.

`.env.local` no se incluye en Git. Las credenciales se validan en Node y no forman parte de los archivos enviados al navegador.

## Publicación

Este proyecto necesita un alojamiento que ejecute Node; un hosting que sirva solo archivos estáticos no puede validar sesiones ni proteger la API. En producción, configurar las mismas variables en el proveedor, usar HTTPS y apuntar `APP_ORIGIN` al dominio exacto de la web. `SESSION_SECRET` debe ser aleatorio y tener al menos 32 caracteres. Si la aplicación está detrás de un proxy confiable, configurar `TRUST_PROXY=1`.

Ejecutar `npm run build` y luego `npm start`. Las publicaciones y los medios se guardan en `data/` y `uploads/`; en Hostinger se usan bajo `juno-storage/`, fuera de las carpetas de versiones. FFmpeg convierte los videos a MP4 H.264 de hasta 1280 px en el lado más largo, con audio AAC y optimización para reproducción web. El original se elimina tras una conversión correcta.

El endpoint de acceso limita intentos por IP, usa cookie de sesión `HttpOnly`, `SameSite=Strict` y `Secure` en producción, y valida el origen en las operaciones que modifican datos. Antes de publicar, usar una contraseña larga y exclusiva para este sitio.

## Despliegue en Hostinger

1. En hPanel, ir a **Websites → Add Website → Node.js Web App** y conectar el repositorio `LautyLuc/portJuno`, rama `main`. Esta opción requiere un plan Business o Cloud; en un VPS hay que configurar Node.js y el proceso manualmente.
2. Elegir Node.js 22, el preset Express, comando de build `npm run build`, comando de inicio `npm start` y archivo de entrada `server.js`.
3. En las variables de entorno de la app agregar `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `APP_ORIGIN=https://TU-DOMINIO` y `TRUST_PROXY=1`. Usar una contraseña nueva y exclusiva y un `SESSION_SECRET` aleatorio de al menos 32 caracteres; no subir `.env.local` al repositorio.
4. Desplegar, conectar el dominio y comprobar que HTTPS esté activo. Probar el inicio en `/login`, publicar una foto y un video, cerrar sesión y comprobar la portada y la reproducción.

Hostinger crea una carpeta nueva por cada despliegue, así que guardar medios dentro de la carpeta de la versión activa puede hacer que desaparezcan al actualizar. Esta app guarda automáticamente `data/` (publicaciones y orden) y `uploads/` en `juno-storage/` en la raíz del dominio, fuera de las carpetas versionadas. En el primer inicio tras este cambio, intenta copiar los datos y medios de la versión anterior. Revisá el log de inicio para confirmar la migración y comprobá que aparezcan las publicaciones. Para otros proveedores o una ruta personalizada, configurá `JUNO_STORAGE_DIR` con una ubicación persistente. Hacé copias de seguridad periódicas de `juno-storage/`; la persistencia entre versiones no reemplaza un backup.
