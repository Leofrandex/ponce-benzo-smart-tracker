# Plan de Proyecto: Ponzivenzo Smart Tracker

## 1. Visión y Alcance del Proyecto
Desarrollo conceptual de una plataforma integral (Aplicación para el Mercaderista + Panel de Control para el Supervisor) centrada en erradicarlaineficiencia del reporte vía WhatsApp, asegurando la trazabilidad geográfica real y estandarizando la recolección de datos en campo.

El sistema se compone de dos frentes:
1.  **El "Hub" Móvil (Para el Mercaderista):** Aplicación ágil centrada en la acción. Permite iniciar rutas (activando GPS), gestionar las paradas predefinidas, añadir/eliminar paradas de contingencia, y capturar información de estado estructurada en cada visita.
2.  **El Centro de Comando (Para el Supervisor):** Un panel gerencial (Dashboard) donde se recibe toda la información centralizada en tiempo real, se visualiza el progreso de las rutas, el mapa de calor/GPS y se procesan las alertas críticas.

---

## 2. Arquitectura de Herramientas Recomendadas

Para cumplir con el requerimiento de que la app funcione **tanto en teléfonos móviles como en laptops**, y centralizar la base de datos, proponemos el siguiente stack tecnológico:

### A. Frontend (La App del Mercaderista)
**Opciones para "Correr en Móvil y Laptop":**
*   **Recomendación Principal: React Native con Expo (Universal App).** Expo permite escribir el código una sola vez (en lenguaje JavaScript/React) y exportarlo como aplicación nativa para Android, aplicación nativa para iOS y como una aplicación Web responsiva (para usarse en Google Chrome desde una laptop).
*   **Alternativa PWA (Progressive Web App):** Construir una web app responsiva (ej. Next.js). Funciona como una página web en la laptop, pero en el celular el mercaderista le da a "Agregar a inicio" y se comporta casi como una app nativa, con acceso al GPS del celular. Es un poco más rápido de desarrollar pero tiene menos control "hermético" del ecosistema del teléfono.

### B. Backend y Base de Datos (El Cerebro)
*   **Recomendación: Supabase.** Es la alternativa moderna y de código abierto a Firebase. Nos proveerá:
    *   **Autenticación:** Login seguro para empleados.
    *   **Base de Datos Relacional (PostgreSQL):** Excelente para estructurar `[Usuarios]`, `[Clientes]`, `[Logs de Check-in]`. Soporta funciones geoespaciales (PostGIS) especiales para cálculos matemáticos GPS (Radio de la sucursal).
    *   **Storage:** Para alojar inteligentemente las miles de fotografías tomadas semanalmente.

### C. Visualización Gerencial (Para el "Responsable de la Cadena")
¿Cómo visualizar el responsable los datos? Leer base de datos cruda no es gerencial.
*   **Solución 1: Retool (Recomendada).** Retool es una plataforma líder para construir tableros internos súper rápido. Se conecta a Supabase y nos deja construir un "Portal Administrativo" Web. Ahí el gerente puede tener un mapa de Google integrado para ver los pines de los vendedores, una tabla para evaluar las fotos tomadas en el día, etc.
*   **Solución 2: Dashboard Custom en Next.js.** Un panel programado a la medida bajo el mismo dominio de la empresa. Más costoso visualmente pero 100% propio.

---

## 3. Plan de Desarrollo en Fases

### Fase 1: Discovery y Setup del Core (1-2 Semanas)
*   **Hito 1:** Levantamiento formal de todos los campos obligatorios del reporte.
*   **Hito 2:** Modelado de la Base de Datos en Supabase (Estructura de tablas, relaciones y Storage de imágenes).
*   **Hito 3:** Configuración del sistema de Login (Auth) con jerarquías (Vendedor callejero vs. Supervisor).

### Fase 2: Plataforma Móvil (3-4 Semanas)
*   **Hito 1:** UI/UX del "Hub de Rutas" y perfiles.
*   **Hito 2:** Integración Nativa *GPS Tracker*: Lógica de encendido/apagado en el `background` cuando oprime Iniciar/Finalizar Ruta.
*   **Hito 3:** Lógica de asignación de sucursales: Posibilidad de agregar sucursal externa a la pauta diaria si hay anomalías, o dar de baja una por cierre de local.
*   **Hito 4:** Motor de Captura: Acceso forzado a cámara de teléfono y subida de formulario hacia Supabase.

### Fase 3: Sala de Supervisores (2 Semanas)
*   **Hito 1:** Conexión de Retool o el Panel Web custom a Base de Datos.
*   **Hito 2:** Construcción del gráfico visual (Mapa) para cruzar Coordenada de Visita Reportada vs Ubicación de la Sucursal Fija (Anti-Fraude ligero).
*   **Hito 3:** Automatización con herramientas tipo **n8n / IA**: Solo notificarle a los gerentes de forma proactiva (email o WhatsApp interno) si la ruta acaba de fallar estrepitosamente o si una visita se reporta con un % de anomalía inusual.

### Fase 4: Piloto Alfa e Iteración (+1 Semana)
*   **Hito 1:** Pruebas controladas con 2 promotores (Ej. "Ruta prueba a Farmatodos vecinos").
*   **Hito 2:** Benchmark sobre el impacto del Tracker en la batería de los teléfonos corporativos.
*   **Hito 3:** Pase a producción de la primera flota.

---

## 4. Cuestionario de Discovery para la Reunión Comercial

Para perfumar la propuesta de viabilidad y estandarizar nuestro flujo, debemos sumar las siguientes dudas para Ponzivenzo junto a tus tres incógnitas iniciales planteadas:

1.  **Dinámica de Asignaciones:** ¿Las rutas diarias son estandarizadas (ej: Cada martes siempre tocan Gama 1, 2, 3)? ¿O el supervisor cambia las rutas a diario pasándoles un Excel?
2.  **Maestro Logístico:** ¿Existe un Maestro Documental con absolutamente todos los clientes actuales? Necesitaremos listar los comercios con sus Coordenadas GPS maestras teóricas para que la app sepa cruzarlas contra la coordenada del vendedor cuando diga "estoy aquí".
3.  **Fricción Informativa:** ¿Qué campos de captura de status son innegociables y diarios? ¿Quieren forzarlos a llenar checkboxes de productos, a teclear, o el input principal siempre será una foto + un campo de observaciones extra?
4.  **Consumo Pasivo o Activo:** ¿El responsable gerencial quiere un sistema de Alerta Automática (ej: Que la app detecte si alguien se desvía de la ruta y mande un email), o prefiere tener este Hub gerencial web y sentarse pasivamente a leer un mapa y hacer auditoría humana los viernes?
5.  **Offline Reality:** Al entrar a algunos almacenes comerciales venezolanos no hay cobertura celular 4G. ¿Debemos desarrollar arquitectura "Offline Mode" para que el vendedor guarde el reporte temporalmente, o se cuenta siempre con cobertura asumiendo que envían todo mientras suben de nuevo al camión/moto?
