# CAMBIOS A REALIZAR PARA MEJORAR LA UI/UX

## Objetivo
Mejorar la usabilidad de la aplicación. Los resultados con la actual UI son malos en determinadas funcionalidades. 

## metodología
Se irán aplicando cambios progrresivos interactuando el PO el LLM para ajustar a las necesidades de mejora observadas.

## gestión del archivo
Este archivo es la base de partida en la que el PO transmite los cambios. El LLm responde realizando los cambios solicitados justo debajo de la respuesta del PO. Se irán agregando funcionalidades de manera progresiva y los acuerdos quedarán en este archivo. 

## Lista de cambios a realizar
1. Hilos/Pantalla general
La información que se agrupa en una pantalla actual es incómoda por el espacio existente y poco práctica. El apartado de CONSULTAS y el apartado de OFERTAS son confusos de entender. 
2. Display de pantalla
2.1. Parte superior
Hay tres pestañas:
A)Conversación
B)SOY CLIENTE: recoge las ofertas que he recibido de los demás.
C)SOY PROVEEDOR: recoge las ofertas que yo he enviado a los demás.
**Orden de izquierda a derecha**
La pantalla mostraría los último mensajes entre usuarios de arriba a abajo de más reciente a más antiguo. Asimismo debe contener un campo **Campo &1**

Configuración de las tablas:
Cada oferta aparece en una sola tabla: las que me hacen, en Soy cliente; las que hago yo, en Soy proveedor. Actualmente una misma referencia aparece duplicada en una y otra por lo cual queda confuso y redundante. 
Ambas tablas no deben contener el campo Organización pues tú sabes quién tú eres y el hilo ya indica quien es la contraparte. Las tablas se llenan de letras que no sirven de nada como es ese caso.
El campo Pais carece de sentido y también debe elimarse.
Ambas tablas deben contener la misma estrutura de campo pues la información es igual en ambas desde dos puntos de vista diferentes.
Por tanto cada tabla debe quedar con este orden: (Todos los campos de la tabla permitirán hacer filtro. Podrán combinarse filtro en varios campos)
Referencia + Marca
Cantidad
Precio
Estado
Fecha
Plazo
Transporte
Válida hasta
Acciones
la parte inferior de la pantalla contendrá un espacio de búsqueda. 
2.2. Parte inferior
**Campo &1**: Campo estandar con lupa incluida con Placeholer:"Busca una referencia dentro de este hilo sobre la que quieras recuperar el contenido de la conversación"
La accicón a ejecutar será la siguiente: Se buscarán la referencia introducida por el usuario en todo el hilo del mensaje histórico. En caso de que existan coincidencias entre varias, deberán mostrarse las referencias exactas que se han encontrado, permitiendo la aplicación seleccionar sólo una de ellas. Una vez seleccionada una, se habilita un botón de Buscar y se pasa a la pestaña de CONVERSACIÓN en donde de arriba a abajo se mostrarán todos los mensajes siendo el más reciente de esa referncia el que se muestre en la parte de arriba. En caso de no existir coincidencias, se muestra un mensaje de aviso al usuario.

## Acceso a Hilos desde las diferentes pantallas de la aplicación
origen|Destino
-----|-----
Panel (Cajón Hilos)|CONVERSACIÓN
Vendiendo (botón Ver hilo)|Pantalla con el hilo de esa empresa
Vendiendo (botón Ver Acuerdo)|Pantalla con el hilo de esa empresa
Comprando (botón Contactar)|Pantalla con el hilo de esa empresa
Hilos | CONVERSACIÓN
Empresas (tarjeta de Empresa/botón Contactar)|Pantalla con el hilo de esa empresa

(*) La pantalla CONVERSACIÓN, es la actual con la lista de hilos.

## Acuerdos
- **CONVERSACIÓN** es la pantalla actual de Hilos, con la lista de todos los hilos. Es la pantalla básica y por defecto de Hilos.
- Al entrar en un hilo concreto (desde CONVERSACIÓN o desde los accesos de la tabla anterior) se llega al hilo de esa empresa en particular.
- **SOY PROVEEDOR**: todo lo que yo he ofertado a otras empresas. No aparecen las ofertas que otras empresas me han hecho a mí.
- **SOY CLIENTE**: las ofertas que otras empresas me han hecho a mí. No aparece lo que yo he ofertado.

### Configuración de las tablas
- **Una fila por referencia** (Referencia + Marca), que muestra siempre la última versión de la negociación. Las contraofertas no crean filas nuevas.
- **Consultas que me han hecho y no he respondido:** salen en Soy proveedor con Precio, Plazo, Transporte y Válida hasta vacíos. Al responder, la fila se llena con mi oferta.
- **Consultas que he hecho y nadie ha respondido:** salen en Soy cliente con estado ESPERANDO OFERTA.
- **Sin stock:** si el proveedor marca mi consulta como sin stock, sale en Soy cliente una fila con estado SIN STOCK.
- **Contraofertas:** si contraoferto como cliente, la fila sigue en mi Soy cliente con mis cifras y estado CONTRAOFERTA ENVIADA. Al proveedor le sale en su Soy proveedor, en la misma fila de su oferta, con estado CONTRAOFERTA RECIBIDA.

**Estados**
- Soy cliente: Esperando oferta · Por decidir · Contraoferta enviada · Aceptada · Rechazada · Expirada · Sin stock.
- Soy proveedor: Por responder · Esperando al cliente · Contraoferta recibida · Aceptada · Rechazada · Expirada · Sin stock.

**Acciones**
- Soy cliente, oferta por decidir: Aceptar · Contra-ofertar · Rechazar. Si la oferta ha expirado: Aceptar igualmente.
- Soy proveedor, consulta por responder: Responder con oferta · Sin stock.
- Soy proveedor, contraoferta recibida: Aceptar · Contra-ofertar · Rechazar.
- Resto de casos: sin acciones.

**Columnas**
- Notas (incoterm, forma de pago…): no es columna; se enseñan al pasar el ratón por la fila.
- Fecha: la del último movimiento de la fila, en formato «12 nov 2026».

**Filtros** (combinables entre sí)
- Referencia: texto.
- Estado: lista desplegable.
- Cantidad, Precio, Plazo y Transporte: desde/hasta.
- Fecha y Válida hasta: rango de fechas.
- Acciones: sin filtro.

**Orden**
- Por defecto, lo más reciente arriba. Se puede reordenar pulsando la cabecera de cada columna.

### Pantalla del hilo de una empresa
- Tres pestañas, de izquierda a derecha: **Mensajes** · **Soy cliente** · **Soy proveedor**.
- **Mensajes**: el más reciente arriba. El campo de escribir va arriba, encima de los mensajes.

### Etiqueta de referencia en los mensajes
- Cada mensaje queda enlazado a una de las referencias que se negocian en ese hilo, o a ninguna si es conversación general (nulo).
- La etiqueta no se escribe a mano: se elige entre las referencias que existen en el hilo.
- Junto al campo de escribir hay un campo «Sobre:» en el que se escribe. Al escribir, salen debajo las referencias del hilo que coinciden, en orden alfanumérico, y se elige una; «Conversación general» también se puede elegir. (PO, 17-nov-2026: no es una lista desplegable fija.)
  - Si se escribe desde una fila de Soy cliente o Soy proveedor, sale elegida la referencia de esa fila.
  - Si el hilo tiene una sola referencia, sale elegida esa.
  - Si tiene varias, no se puede enviar sin elegir (aunque sea «Conversación general»).
- Cada mensaje enseña su etiqueta (p. ej. 6205-2RS · SKF). Los de conversación general no llevan ninguna.
- Quien envió el mensaje puede cambiarle la etiqueta después.
- Los mensajes que ya existen quedan como conversación general; sus autores pueden etiquetarlos.
- La referencia va en claro, igual que ya va en consultas y ofertas. El texto del mensaje sigue cifrado.
- Requiere cambiar la base de datos: hoy un mensaje no puede llevar referencia.

### Búsqueda (Campo &1)
- Abajo del todo, dentro del hilo, visible en las tres pestañas. Con lupa y el texto de ayuda: «Busca una referencia dentro de este hilo sobre la que quieras recuperar el contenido de la conversación».
- Coincidencias parciales: «6205» encuentra 6205-2RS y 6205-ZZ. Cada opción va con su marca (6205-2RS · SKF, 6205-2RS · FAG).
- La lista se despliega mientras se escribe y solo se puede elegir una. Al elegirla se lanza la búsqueda, sin botón «Buscar».
- Al elegir, se pasa a la pestaña Mensajes y se ven solo los mensajes etiquetados con esa referencia, junto con sus consultas y ofertas, el más reciente arriba.
- Arriba aparece la etiqueta «Referencia: 6205-2RS · SKF ✕». La ✕ vuelve a la conversación completa.
- Los mensajes de conversación general solo se ven en la conversación completa.
- Sin coincidencias: aviso debajo del buscador «No hay ninguna referencia que coincida con «…» en este hilo».

