"""Control de sesiones comerciales 4.3: núcleo testeable, SIN actuadores.

NO montar en producción sin almacén compartido RDS, validación de propiedad y
adaptador físico con watchdog. Este módulo protege la lógica de permisos, pero
su almacén en memoria sólo sirve para pruebas unitarias de un proceso.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable, FrozenSet
import hashlib
import secrets
import threading
import time


class AccesoDenegado(Exception):
    """Acceso no autorizado o exhibición no disponible."""


class Ocupado(Exception):
    """Ya existe una reserva vigente del vehículo."""


@dataclass
class PermisoExhibicion:
    vehiculo: int
    vence: float
    comandos: FrozenSet[str]
    admin: int


@dataclass
class Reserva:
    vehiculo: int
    token_hash: str
    vence: float
    secuencia: int = 0
    ultimo_comando: str = "DETENER"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


class SesionesExhibicion:
    """Implementación para probar reglas sin transmitir movimiento físico.

    Persistencia REAL de permisos y reservas debe residir en RDS, no aquí.
    Deben autorizarse comandos en la API y en el firmware.
    """
    def __init__(self, disponible: Callable[[int], bool],
                 detener: Callable[[int], None], reloj: Callable[[], float] = time.monotonic):
        self._disponible = disponible
        self._detener = detener
        self._reloj = reloj
        self._guard = threading.RLock()
        self._permisos: dict[int, PermisoExhibicion] = {}
        self._reservas: dict[int, Reserva] = {}

    def autorizar(self, admin: int, vehiculo: int, segundos: int,
                 comandos: set[str]) -> None:
        if admin <= 0 or vehiculo <= 0 or not 1 <= segundos <= 3600:
            raise AccesoDenegado('Parámetros administrativos inválidos')
        permitidos = frozenset(x.upper() for x in comandos)
        if not permitidos or 'DETENER' not in permitidos or len(permitidos) > 16:
            raise AccesoDenegado('Debe incluir DETENER y una lista restringida')
        with self._guard:
            if not self._disponible(vehiculo):
                raise AccesoDenegado('Vehículo no disponible para exhibición')
            if vehiculo in self._reservas:
                raise Ocupado('Reserva activa; cierre antes de cambiar autorización')
            self._permisos[vehiculo] = PermisoExhibicion(vehiculo,
                self._reloj()+segundos,permitidos,admin)

    def iniciar(self, vehiculo: int, segundos: int = 60) -> tuple[str,int]:
        if not 1 <= segundos <= 60:raise AccesoDenegado('Duración fuera de límite')
        with self._guard:
            ahora=self._reloj()
            self._limpiar(vehiculo,ahora)
            permiso=self._permisos.get(vehiculo)
            if not permiso or permiso.vence <= ahora or not self._disponible(vehiculo):
                raise AccesoDenegado('No hay exhibición física autorizada')
            if vehiculo in self._reservas:
                raise Ocupado('La unidad ya está siendo controlada')
            token=secrets.token_urlsafe(32)
            self._reservas[vehiculo] = Reserva(vehiculo,_hash(token),
                min(permiso.vence,ahora+segundos))
            return token, min(segundos,int(permiso.vence-ahora))

    def validar(self, token: str, vehiculo: int, comando: str) -> int:
        """Devuelve secuencia solo si está autorizado; no envía órdenes.

        En un backend real, comando y despacho deben formar una operación con
        propiedad exclusiva, watchdog e idempotencia; la comprobación aquí
        sólo ilustra la política, no crea una autorización física.
        """
        if not token or len(token) > 256 or not isinstance(comando,str):
            raise AccesoDenegado('Datos inválidos')
        nombre=comando.strip().upper()
        with self._guard:
            ahora=self._reloj()
            self._limpiar(vehiculo,ahora)
            reserva=self._reservas.get(vehiculo)
            permiso=self._permisos.get(vehiculo)
            if (not reserva or not permiso or reserva.vence <= ahora
                or permiso.vence <= ahora or not self._disponible(vehiculo)
                or not secrets.compare_digest(_hash(token),reserva.token_hash)
                or nombre not in permiso.comandos):
                raise AccesoDenegado('Acceso, vehículo o comando no autorizado')
            reserva.secuencia += 1
            reserva.ultimo_comando=nombre
            return reserva.secuencia

    def finalizar(self, token: str, vehiculo: int) -> None:
        with self._guard:
            reserva=self._reservas.get(vehiculo)
            if not reserva or not secrets.compare_digest(_hash(token),reserva.token_hash):
                raise AccesoDenegado('Sesión no autorizada')
            self._detener(vehiculo)
            del self._reservas[vehiculo]

    def revocar(self, admin: int, vehiculo: int) -> None:
        with self._guard:
            permiso=self._permisos.get(vehiculo)
            if not permiso or permiso.admin != admin:
                raise AccesoDenegado('No corresponde al administrador')
            self._detener(vehiculo)
            self._reservas.pop(vehiculo,None)
            self._permisos.pop(vehiculo,None)

    def _limpiar(self, vehiculo: int, ahora: float) -> None:
        reserva=self._reservas.get(vehiculo)
        if reserva and reserva.vence <= ahora:
            self._detener(vehiculo)
            del self._reservas[vehiculo]
