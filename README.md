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

Ejecutar `npm run build` y luego `npm start`. El servidor guarda las publicaciones en `data/`, los videos optimizados y las im?genes en `uploads/`, y las sesiones en `data/sessions/`; hay que conservar esos directorios o conectarlos a almacenamiento persistente al desplegar. FFmpeg se incluye con el proyecto: al publicar, los videos se convierten a MP4 H.264 de hasta 1280 px en el lado m?s largo, con audio AAC y optimizaci?n para reproducci?n web. El original se elimina tras una conversi?n correcta.

El endpoint de acceso limita intentos por IP, usa cookie de sesión `HttpOnly`, `SameSite=Strict` y `Secure` en producción, y valida el origen en las operaciones que modifican datos. Antes de publicar, usar una contraseña larga y exclusiva para este sitio.
