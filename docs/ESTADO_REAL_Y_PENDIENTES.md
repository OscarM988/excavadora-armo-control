# EXCAVADORA-ARMO — Estado comprobable de la Práctica 4.3

## Base existente

- Frontend GitHub Pages: `https://oscarm988.github.io/excavadora-armo-control/`.
- Backend original: `https://vehiculo-iot.duckdns.org/docs`.
- Backend administración: `https://vehiculo-iot.duckdns.org/v43/openapi.json`.
- Control, Monitoreo y Administración se desarrollaron antes de este paquete.
- Se instalaron sucesivamente modificaciones de acceso por roles e invitado V1–V7.

## Qué contiene este ZIP V8

- Herramienta no destructiva de diagnóstico del frontend/backend.
- Pruebas de GET sin credenciales para API pública, sin mover vehículo.
- Núcleo probado de autorizaciones temporales, exclusividad y expiración (`modulo_backend_43`).
- 13 pruebas automatizadas del núcleo de sesiones, aprobadas en el entorno de preparación.
- Matriz de requisitos y procedimientos para la integración pendiente.

**No se ha integrado el núcleo de sesiones al backend de producción.** El ejemplo mantiene estado en memoria y NO sustituye la transacción real en RDS. No se debe desplegar ni conectar directamente a actuadores.

## Bloqueantes reales para afirmar que 4.3 está al 100 %

1. Auditar el **código actual** del repositorio privado `vehiculo_iot_api`: rutas reales, seguridad, servicios y cliente MySQL.
2. Revisar el **firmware ESP8266** y el contrato auténtico de comandos y `DETENER`. No se recibió aquí código fuente `.ino`.
3. Implementar exhibición física autorizada: unidad no asignada a cliente (o consentimiento explícito), habilitación del administrador, reserva exclusiva **en RDS**, token efímero, controles por modelo, comandos restringidos, límites y caducidad, STOP por watchdog y desconexión.
4. Implementar editor de demos privadas del comprador con endpoints reales, persistencia en RDS, validaciones y pruebas de ejecución/cancelación.
5. Validar autorización por recurso en cada REST y cada canal WSS, revocación, 401/403, propietario distinto y doble sesión.
6. Confirmar transacciones de altas/asignaciones/auditoría en RDS sin afectar datos históricos.
7. Completar pruebas P01–P17 y tres rondas de evaluación colaborativa con evidencia real.

No instalar migraciones sin respaldo verificado. No reutilizar un JWT de comprador para un invitado.

## Comportamiento físico

Una respuesta HTTP 200 o el indicador WSS conectado no acreditan que el ESP8266 haya ejecutado el movimiento. La confirmación física requiere telemetría o constatación supervisada. `DETENER` debe priorizarse y existir watchdog independiente en el firmware.
