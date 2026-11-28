# EXCAVADORA-ARMO — Matriz P01–P17 (evidencias vigentes al 19/11/2026)

La matriz fue elaborada antes de las mejoras V1–V7. El cambio visual NO acredita automáticamente control físico ni permisos de backend. Actualiza solo con evidencia nueva.

| ID | Prueba | Estado documentado | Qué demostrar para cerrarla |
|---|---|---|---|
| P01 | Login Admin | Correcto | JWT admin y endpoint protegido 200 |
| P02 | Alta unidad | No ejecutado | POST en RDS, ID único y consulta posterior |
| P03 | Alta cliente | Parcial | POST real en RDS + lectura + auditoría |
| P04 | Asignación | Parcial | Crear y revocar asignación y permiso efectivo |
| P05 | Aislamiento comprador | No ejecutado | A no ve ni mueve unidad de B |
| P06 | Control | Correcto previo | Validar control real de la unidad autorizada |
| P07 | WSS | Correcto previo | Canal autorizado sin filtrar vehículos ajenos |
| P08 | Historial 10 | Correcto previo | Diez últimos individuales y sincronización |
| P09 | Demo persistente | Parcial | Crear/guardar/recargar pasos en RDS |
| P10 | Ejecutar/cancelar demo | Parcial | Exec física segura, CANCELAR, DETENER |
| P11 | Invitado | Parcial | Unidad física de exhibición autorizada |
| P12 | Invitado vs Admin | Parcial | 403 de backend a acceso privado |
| P13 | Vehículo ajeno | No ejecutado | 403 o 404 ante ID ajeno |
| P14 | Exclusividad | No ejecutado | Dos sesiones, una sola autorizada |
| P15 | Reconexión | Parcial | REST tras WSS; estado y permisos reconcilian |
| P16 | Responsive | Correcto previo | Móvil y escritorio tras cambios |
| P17 | Auditoría | Parcial | Persistencia en RDS de operaciones y actor |

NO atribuir pruebas de un solo módulo al sistema completo. El módulo de sesiones en memoria de V8 contiene pruebas **unitarias**, no prueba P14 de producción.
