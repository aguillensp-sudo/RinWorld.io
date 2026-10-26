# CAMBIOS EN SRCH-01

## 1. OBJETIVO DE LOS CAMBIOS
La búsqueda de referencias es el principal activo de bearingworld. Sin una búsqueda efectiva y rápida los usuarios desestimaran su uso. Hemos analizado a fondo el comportamiento de nuestro competidor para dejar afinada la busqueda. este cambio ya estaba anunciado e implica rediseño de la UI parcial en esta pantalla.

## 2. CAMPOS DE BUSQUEDA
Los datos que un usuario puede introducir son:
    REF: Campo de *referencia* (placeholder «p. ej. NU214»). Este campo es obligatorio.
    CHK: Checkbox *contiene* de forma de búsqueda. Si está marcado cambia la extracción de resultados.
    MAR: Campo de *marca* (placeholder «p. ej. SKF»). Opcional
    CAN: Campo de cantidad. Su etiqueta debe indicar ">=". Opcional
    INC: Campo de *incluir* (placeholder «p. ej. C3»). Opcional
    EXC: Campo de *excluir* (placeholder «p. ej. C3»). Opcional
    ARE: Desplegable de *zona*. Opcional
### DISEÑO UI
Al acceder  la pantalla, se mostrara solo el campo REF. Dicho campo sigue el estandar bearingworld de los campos de búsqueda que llevan una lupa visible.
Junto a este campo se mostrará un checkbox que permita al user una busqueda avanzada. Lo denominaremos *Filtros*
Si el usuario marca el checkbox, se mostrarán los campos CHK,MAR, INC, EXC y ARE. Si el usuario desmarca el checkbox *Filtros*, se ocultarán dichos campos.
Seguirán existiendo las migas de pan actuales para los filtros.
El campo REF y *Filtros* se mostrarán siempre visibles en una línea.Las migas de pan irán en esta misma línea.
El resto de campos, pasan a la línea siguiente y ocupan toda la línea.
    
## 3. FUNCIONAMIENTO DEL MOTOR DE BUSQUEDA
El nuevo funcionamiento de la búsqueda se realiza en dos fases:

1. Fase a). Traer todos los resultados en forma de lista previa cuyos caracteres cumplan los requisitos de búsqueda.
2. Fase b). Seleccionar de la lista previa los resultados que se quieran consultar desde 1 (mínimo) hasta el total de los resultados de la lista previa.
3. Fase c). Mostrar ofertas en tabla de datos

### FASE A. GENERACIÓN DE LISTA PREVIA
CASO 1. CAMPO REF INFORMADO. No hay más filtros.
El motor de búsqueda trae todos los registros que comienzan por los caracteres buscados. Esos resultados comienzan exactamente por los caracteres introducidos. Todos los resultados de la lista previa contienen exactamente los caracteres introducidos por el usuario y en el mismo orden de inserción en el campo REF.
CASO 1.1. Existe una sola referencia que coincide exactamente por los caracteres buscados. ---> Se muestra en lista previa la única referencia coincidente.
CASO 1.2. Existe más de una referencia que coincide exactamente por los caracteres buscados. ---> Se muestran en lista previa todas las referencias coincidentes.
CASO 3.3. No existe ninguna referencia coincidente --->trae la referencia que coincide exactamente con los caracteres introducidos hasta el carácter último coincicidente.
CAS0 3.4. No existe ninguna referencia coincidente con los caracteres ingresados ---> Muestra que NO HAY COINCIDENCIAS y avisa que si quiere crear un watcher.
CASO 2. CAMPO REF INFORMADO y *Filtros* marcado con checkbox CHK activado.
En este caso, el motor de búsqueda trae en forma de lista previa todos los resultados coincidentes que CONTIENEN los caracteres introducidos y en el mismo orden de inserción que aparecen en el campo REF.
Los casos 1.1, 1.2, 1.3 y 1.4 se aplican igual que en el caso anterior con esta diferencia. Funciona exactamente igual que el caso anterior pero los resultados no sólo mostrarán sufijos diferentes sino además prefijos.

### FASE B. DISPLAY DE LISTA PREVIA
Las referencias se muestran en una lista previa ordenadas por el número de registros que más coincidencias contienen. Ordenados desde arriba izquierda hacia la derecha en x columnas. El que mas tiene esta arriba a la izquierda y el siguiente al lado de este hacia la derecha..lectura normal. 
Es decir, si 10 empresas han publicado la referencia NU214ECJ, aparecerá un checkbox que contenga este resultado previo. cUANDO SE MARQUE el check del mismo, se accederá a ver las ofertas que corresponden a esa referencia
Por la experiencia previa, se conoce que pueden resultar gran cantidad de resultados previos por lo que debe preverse una paginación y mostrarse los mismos en varias columnas (dato a investigar). 
Asimismo y por experiencia previa, se va a necesitar paginación.
El usuario puede marcar manualmente los resultados visibles en la lista previa para acceder a la lista final de ofertas. Debemos dar dos opciones:
- marcar y consultar todos los resultados visibles que existen en la paginación resultante
- marcar y consultar los resultados visibles y no visibles contenidos en la primera y sucesivas paginaciones
**Espacios, guiones bajos o medios, puntos u otros caracteres que son ajenos a los códigos de rodamientos se eliminan aún siendo insertados por los usuarios y nunca afectan a los resultados obtenidos**

### FASE C. DISPLAY DE RESULTADOS FINALES.
A la hora de mostrar la tabla de ofertas después de haberse realizado la selección en lista previa, los distintos resultados de cada lista previa se van a mostrar siguendo la fecha de actualizacion de inventario de mas reciente a mas antiguo. En dicha lista final, se van a mezclar los resultados de las distintas listas previas seleccionadas.

## 4. PRECSIONES SOBRE DISEÑO DE CAMPOS y FILTROS INVISIBLES
El campo ARE es desplegable cuyo orden de presentación empieza por los continentes seguido de países.
La pantalla siempre tendrá una miga de pan que indica que el continente por defecto es el contienente donde reside la empresa. Por tanto, sólo si el usuario la quita se traeran los resultados de rodamientos fuera de su area.




