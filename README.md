# EXCAVADORA-ARMO

Aplicación web responsiva para el control remoto de una excavadora IoT mediante una API REST desarrollada con FastAPI, alojada en Amazon EC2 y conectada a Amazon RDS MySQL.

## Enlaces públicos

**Aplicación:**
https://oscarm988.github.io/excavadora-armo-control/

**Repositorio:**
https://github.com/OscarM988/excavadora-armo-control

**Swagger API:**
https://vehiculo-iot.duckdns.org/docs

**WebSocket WSS:**
wss://vehiculo-iot.duckdns.org/ws/vehiculo/1

## Tecnologías

- HTML5 y CSS3
- Bootstrap 5
- JavaScript ES6 Modules
- Fetch API y async/await
- WebSocket seguro (WSS)
- Autenticación JWT
- Python y FastAPI (backend existente)
- Amazon EC2
- Amazon RDS MySQL
- GitHub Pages
- Progressive Web App (PWA)

## Funcionalidades

- Inicio y cierre de sesión mediante JWT.
- Dos joysticks compatibles con mouse y pantalla táctil.
- Consulta de comandos desde la API.
- Envío REST de movimientos individuales.
- Solicitud automática de DETENER al soltar el joystick.
- Botones de Música, Velocidad y Luces.
- Selección de DEMO almacenadas.
- Ejecución y cancelación de DEMO mediante FastAPI.
- Recepción de eventos por WebSocket WSS.
- Indicadores de WebSocket, servidor AWS y consulta MySQL.
- Diseño responsivo para computadora y celular.
- Instalación como aplicación web progresiva.

## Estructura del repositorio

```text
excavadora-armo-control/
├── index.html
├── styles.css
├── acabados.css
├── app.js
├── manifest.json
├── service-worker.js
├── assets/
│   ├── favicon.svg
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
├── js/
│   ├── api-client.js
│   ├── control-service.js
│   └── rds-status.js
├── .nojekyll
└── README.md
```

## Arquitectura

```text
Navegador / PWA
       |
       | HTTPS / JWT
       v
API REST FastAPI
Amazon EC2
       |
       | Conexión privada MySQL
       v
Amazon RDS

Navegador
       |
       | WSS
       v
WebSocket FastAPI
```

El navegador no se conecta directamente a MySQL.

## Ejecución local

Requisitos:

- Python instalado.
- Navegador moderno.
- Conexión a Internet para utilizar AWS.

Clonar el repositorio:

```bash
git clone https://github.com/OscarM988/excavadora-armo-control.git
```

Entrar a la carpeta:

```bash
cd excavadora-armo-control
```

Iniciar servidor local:

```bash
python -m http.server 5500
```

Abrir:

http://127.0.0.1:5500/

Si el entorno local sirve los módulos `.js` con un tipo MIME incorrecto, se debe configurar el servidor para entregarlos como `text/javascript`.

## Integración con FastAPI

La aplicación utiliza la API existente:

https://vehiculo-iot.duckdns.org

Operaciones principales:

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /auth/login | Obtener JWT |
| GET | /comandos/vehiculo/1 | Consultar comandos |
| POST | /estado/movimiento | Enviar movimiento |
| GET | /demos/vehiculo/1 | Consultar DEMO |
| GET | /demos/{id}/movimientos | Consultar secuencia |
| POST | /demos/ejecutar | Ejecutar DEMO |
| POST | /demos/cancelar/1 | Cancelar DEMO |

Los comandos se identifican mediante `id_comando`, obtenido del catálogo de la API.

## WebSocket

La aplicación establece una conexión WSS para recibir eventos como:

- estado_inicial
- movimiento_individual
- demo_iniciado
- demo_movimiento
- demo_cancelado
- demo_finalizado

Los eventos indican actividad del backend, pero no confirman por sí solos que el hardware haya ejecutado un movimiento.

## Seguridad

- Autenticación JWT para operaciones protegidas.
- El token de sesión permanece en memoria del navegador.
- No se incluyen contraseñas, claves AWS ni credenciales MySQL en el repositorio.
- El control REST requiere habilitación manual.
- La operación física necesita validaciones adicionales de seguridad.
- La base de datos solo se consulta mediante FastAPI.
- La aplicación necesita Internet y AWS disponible para controlar el vehículo.

## Indicadores de conexión

**WebSocket WSS:** muestra el estado de la conexión del navegador.

**Servidor AWS:** comprueba disponibilidad HTTPS de FastAPI.

**Amazon RDS:** realiza una consulta de comandos mediante FastAPI para comprobar que puede leer datos almacenados en MySQL. No representa una consulta administrativa al servicio AWS RDS.

## Publicación

El frontend está publicado en GitHub Pages mediante la rama `main`, directorio raíz.

La aplicación funciona en computadora y dispositivos móviles.

## Pruebas realizadas

- Inicio de sesión JWT.
- Consulta de comandos reales.
- Movimiento individual mediante REST.
- Cambio de dirección y DETENER.
- Funcionamiento de ambos joysticks.
- Recepción independiente de eventos WSS.
- Ejecución y cancelación de DEMO.
- Desconexión y reconexión WebSocket.
- Diseño horizontal y vertical.
- Acceso público desde GitHub Pages.
- Consulta de MySQL mediante FastAPI.

## Autor

**Oscar Alexis Muñoz Resendiz**

Ingeniería en Sistemas Computacionales

Tecnológico Nacional de México — Campus Pachuca

2026