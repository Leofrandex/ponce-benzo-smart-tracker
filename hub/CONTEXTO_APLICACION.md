# 📋 Contexto de la Aplicación: Ponzivenzo Smart Tracker

Este documento detalla el propósito, las funcionalidades, el problema que resuelve y la arquitectura técnica del ecosistema **Ponzivenzo Smart Tracker**.

---

## 🚀 1. ¿Qué es Ponzivenzo Smart Tracker?

**Ponzivenzo Smart Tracker** es una Progressive Web App (PWA) de nivel empresarial diseñada para la gestión y monitoreo en tiempo real de mercaderistas en campo. Permite a los vendedores y promotores gestionar sus rutas diarias, realizar check-ins geo-verificados en tiendas y permite a los supervisores visualizar el desempeño de la flota desde un panel centralizado.

---

## 🔍 2. Problema que Resuelve

Antes de esta solución, la gestión de mercaderistas enfrentaba los siguientes retos:
1. **Falta de Veracidad**: Dificultad para confirmar si el mercaderista realmente estuvo en el punto de venta (PDV) a la hora reportada.
2. **Opacidad Logística**: Los supervisores no tenían visibilidad en tiempo real de dónde se encontraba su equipo o qué tiendas faltaban por visitar.
3. **Reportes Manuales**: Ineficiencia en la recolección de datos y fotos, que a menudo se enviaban por canales informales (WhatsApp/Telegram) perdiendo trazabilidad.
4. **Zonas Sin Conexión**: Pérdida de datos cuando el mercaderista se encontraba en sótanos o zonas con mala cobertura celular.

---

## ✅ 3. La Solución Ofrecida

Ponzivenzo Smart Tracker digitaliza todo el proceso de preventa y mercadeo mediante:
*   **Geolocalización Obligatoria**: Uso de `navigator.geolocation` con alta precisión para validar la presencia física.
*   **Auditoría Visual Anti-Fraude**: Captura de fotos bloqueando la galería del teléfono (solo cámara en vivo) y forzando el uso de la cámara trasera.
*   **Sincronización Offline-First**: Capacidad de trabajar sin internet y sincronizar los datos automáticamente cuando se recupera la conexión.
*   **Dashboard de Control**: Mapa en tiempo real para supervisores con "mapas de calor" y estados de cumplimiento.

---

## 🛠️ 4. Funcionalidades Integradas

### A. Perfil Mercaderista (Ruta)
*   **Gestión de Sesión**: "Iniciar Jornada" y "Finalizar Jornada" para tracking de horas laborales.
*   **Ruta Dinámica**: Listado interactivo de tiendas asignadas para el día.
*   **Check-in Inteligente**:
    *   Validación de distancia (Geo-fencing) contra las coordenadas maestras de la tienda.
    *   Formulario de visita (Inventario, novedades, comentarios).
    *   Captura de evidencia fotográfica obligatoria.
*   **Historial de Visitas**: Consulta de gestiones pasadas y estado de sincronización.

### B. Perfil Supervisor (Monitor)
*   **Mapa en Tiempo Real**: Visualización de la ubicación actual de todos los mercaderistas.
*   **Monitor de Actividad**: Seguimiento de sesiones activas y alertas de inactividad.
*   **Reportes de cumplimiento**: Resumen de tiendas visitadas vs. programadas.
*   **Asignación de Tareas**: (En desarrollo) Creación de tareas específicas por PDV.

---

## 🏗️ 5. Arquitectura Técnica

### Stack de Tecnologías
*   **Framework**: Next.js 14 (App Router) con TypeScript.
*   **Estilos**: Tailwind CSS con un diseño oscuro premium (`--bg-base: #0f0f1a`).
*   **Base de Datos**: PostgreSQL con extensión **PostGIS** para cálculos geográficos avanzados.
*   **Autenticación**: Supabase Auth (Integrado en el contexto de React).
*   **Estado local**: `sessionStorage` para persistencia rápida y **Dexie.js (IndexedDB)** para el motor offline.

---

## 🔐 6. Integración con Supabase y Seguridad

Aunque actualmente la aplicación utiliza datos mock (simulados) para ciertas funciones de supervisión, la infraestructura está lista para la migración total a Supabase con las siguientes características:

### Row Level Security (RLS)
Se implementará una capa de seguridad estricta en la base de datos:
*   **Usuarios (Mercaderistas)**: Solo pueden leer sus propias rutas y escribir sus propias visitas/sesiones. No tienen acceso a datos de otros compañeros.
*   **Supervisores**: Pueden leer los datos de todos los mercaderistas bajo su cargo, pero no modificar configuraciones globales del sistema.
*   **Admins**: Acceso total para gestión de maestros (tiendas, correos, roles).

### Esquema de Datos Clave
*   **`stores`**: Almacena `master_lat` y `master_lng` usando tipos geográficos de PostGIS para permitir consultas de proximidad rápidas.
*   **`visits`**: Vincula las fotos almacenadas en **Supabase Storage** con la coordenada exacta donde se tomó.
*   **`sessions`**: Registro de timestamps de inicio/fin de jornada para control de nómina y asistencia.

---

## 🛡️ 7. Medidas Anti-Fraude
La aplicación está diseñada para ser "incisiva" en la veracidad de los datos:
1.  **Cámara Forzada**: El input de fotos usa `capture="environment"`, lo que impide al usuario subir fotos viejas desde la galería.
2.  **Validación Geo-espacial**: El botón de "Finalizar Visita" solo se habilita si el GPS del usuario está dentro de un radio permitido (ej. 100m) de la tienda.
3.  **Timestamp Inmutable**: Las horas de visita son generadas por el servidor (o validadas contra él) para evitar trucos con el reloj del teléfono.

---

## 📈 8. Futuro del Proyecto
*   **Integración de AI**: Análisis de fotos para detectar automáticamente el share-of-shelf (espacio en góndola).
*   **Notificaciones Push**: Alertas al mercaderista cuando se desvía de su ruta o al supervisor ante anomalías.
*   **Offline Pro**: Sincronización de fondo (Background Sync) nativa para garantizar que ninguna foto se pierda.
