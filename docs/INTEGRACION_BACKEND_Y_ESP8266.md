# Integración segura del núcleo de sesiones físicas

No se debe conectar `modulo_backend_43/exhibicion_sesiones.py` directamente con el ESP8266. Es una máquina de estados probada en memoria, **no** un sistema de reservas distribuido.

## Contrato mínimo a implementar en el backend existente

- Autenticación administrativa válida al habilitar o revocar unidad de exhibición.
- Identificación real de unidad física; su titular/estado se obtiene del servidor, nunca del navegador.
- Rechazar vehículos vendidos/asignados sin consentimiento/sesión expresa.
- Reserva única por unidad con transacción y bloqueo real en MySQL/RDS; vencimiento calculado en servidor. Manejar concurrencia EC2/Uvicorn y reinicios.
- Token efímero de invitado de alta entropía guardado como hash, sin incorporarlo en URL ni logs.
- Lista reducida de comandos permitidos, con límites de duración por movimiento y velocidad/recorrido de hardware cuando aplique.
- Al mover, validar token, reserva, vehículo y capacidad **en cada comando**.
- Anular, expirar y revocar con `DETENER` prioritario y confirmación de recepción del microcontrolador; pérdida de canal activa watchdog del firmware.
- Aplicar autorización al canal WSS y no revelar datos de compradores al invitado.
- Registrar apertura, comandos permitidos/rechazados, expiración y cierre en auditoría RDS sin secretos.

## Falta de fuentes para conexión a producción

No se cuenta con `app/main.py`, servicios reales de movimiento, router real de Invitado, código SQL de tablas de sesiones ni firmware `.ino` actual. Antes de producir un instalador sobre AWS se requieren esas versiones exactas y respaldo SQL comprobado. Cualquier ruta nueva será propuesta, no una ruta existente verificada.

## Pruebas de aceptación necesarias

1. Invitado sin sesión: 401/403 ante movimiento real.
2. Administrador habilita una unidad expresamente apta para exhibición.
3. Un invitado controla durante el tiempo limitado y otro recibe 409.
4. Unidad ajena/privada: bloqueada incluso cambiando ID en DevTools.
5. Expires/cierre/red caído: DETENER físico y liberar reserva.
6. Con un móvil real y dispositivo en soporte seguro, comprobar acuse de MCU, no solo HTTP 200.
7. WSS protegido por unidad y reconexión sin permiso anterior.

No automatizar movimiento físico durante pruebas del instalador.
