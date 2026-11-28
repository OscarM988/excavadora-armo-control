import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'modulo_backend_43'))
import pytest
from exhibicion_sesiones import SesionesExhibicion, AccesoDenegado, Ocupado

@pytest.fixture
def escenario():
    reloj=[100.0];paradas=[];disponibles={1:True,2:False}
    srv=SesionesExhibicion(lambda v:disponibles.get(v,False),
                           lambda v:paradas.append(v), lambda:reloj[0])
    return srv,reloj,paradas,disponibles

def autorizar(s):s.autorizar(1,1,120,{'AVANZAR','DETENER'})

def test_invitado_sin_autorizacion_rechazado(escenario):
    s,*_=escenario
    with pytest.raises(AccesoDenegado):s.iniciar(1)

def test_vehiculo_no_disponible_rechazado(escenario):
    s,*_=escenario
    with pytest.raises(AccesoDenegado):s.autorizar(1,2,120,{'DETENER'})

def test_exclusividad(escenario):
    s,*_=escenario;autorizar(s);s.iniciar(1)
    with pytest.raises(Ocupado):s.iniciar(1)

def test_comando_permitido(escenario):
    s,*_=escenario;autorizar(s);t,_=s.iniciar(1)
    assert s.validar(t,1,'AVANZAR')==1
    assert s.validar(t,1,'DETENER')==2

def test_comando_prohibido(escenario):
    s,*_=escenario;autorizar(s);t,_=s.iniciar(1)
    with pytest.raises(AccesoDenegado):s.validar(t,1,'GIRAR')

def test_token_ajeno(escenario):
    s,*_=escenario;autorizar(s);s.iniciar(1)
    with pytest.raises(AccesoDenegado):s.validar('un-token-falso',1,'DETENER')

def test_caducidad_detiene(escenario):
    s,reloj,paradas,_=escenario;autorizar(s);t,_=s.iniciar(1)
    reloj[0]+=61
    with pytest.raises(AccesoDenegado):s.validar(t,1,'AVANZAR')
    assert paradas==[1]

def test_finalizar_detiene_y_libera(escenario):
    s,_,paradas,_=escenario;autorizar(s);t,_=s.iniciar(1)
    s.finalizar(t,1)
    assert paradas==[1]
    nt,_=s.iniciar(1)
    assert nt!=t

def test_revocacion(escenario):
    s,_,paradas,_=escenario;autorizar(s);t,_=s.iniciar(1)
    s.revocar(1,1)
    assert paradas==[1]
    with pytest.raises(AccesoDenegado):s.validar(t,1,'AVANZAR')

def test_admin_incorrecto(escenario):
    s,*_=escenario;autorizar(s)
    with pytest.raises(AccesoDenegado):s.revocar(2,1)

def test_permitir_detener_obligatorio(escenario):
    s,*_=escenario
    with pytest.raises(AccesoDenegado):s.autorizar(1,1,120,{'AVANZAR'})

def test_no_renovar_ocupado(escenario):
    s,*_=escenario;autorizar(s);s.iniciar(1)
    with pytest.raises(Ocupado):autorizar(s)

def test_cambio_disponibilidad_denegado(escenario):
    s,_,_,disponibles=escenario;autorizar(s);t,_=s.iniciar(1)
    disponibles[1]=False
    with pytest.raises(AccesoDenegado):s.validar(t,1,'AVANZAR')
