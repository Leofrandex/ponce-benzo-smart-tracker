# Instrucciones del Proyecto y Mantenimiento del Segundo Cerebro (Vault)

Este archivo sirve como la guía de comandos y reglas operativas unificadas para el desarrollo del proyecto **Ponzivenzo Smart Tracker** y la administración de su **Segundo Cerebro (Vault de Obsidian)**. Tanto `CLAUDE.md` como `AGENTS.md` deben ser copias idénticas de este documento.

---

## 🏛️ Invariante de Inicialización (Antes de empezar)
Antes de proponer o ejecutar cualquier cambio de código, todo agente de IA debe:
1. Leer [[ponce-benzo-vault/Home|Home.md]] en la carpeta `ponce-benzo-vault/` para tener un mapa general del proyecto.
2. Leer [[ponce-benzo-vault/resumen/Constitucion|Constitución]] para comprender las reglas inmutables de desarrollo, seguridad y schemas de datos.
3. Leer [[ponce-benzo-vault/roadmap/Roadmap Extendido|Roadmap Extendido]] y [[ponce-benzo-vault/pendientes/Pendientes|Pendientes]] para saber cuál es el estado actual de desarrollo y qué tareas están pendientes.

---

## 🛠️ Comandos de Desarrollo Rápidos

### 💻 1. Panel de Supervisión (Next.js — `hub/`)
Ejecuta los comandos desde el directorio `./hub`:
```bash
npm run dev      # Iniciar el servidor local de Next.js (localhost:3000)
npm run build    # Compilar el bundle de producción
npm run lint     # Ejecutar el validador estático ESLint
```

### 📱 2. Aplicación Móvil (React Native Expo — `mobile/`)
Ejecuta los comandos desde el directorio `./mobile`:
```bash
npm run start    # Iniciar la consola de Expo (metro bundler)
npm run android  # Iniciar la app en un emulador o dispositivo Android conectado
npm run ios      # Iniciar la app en un simulador iOS (macOS)
```

### 🗄️ 3. Herramientas y Utilidades (`tools/`)
Ejecuta estos scripts desde la raíz del proyecto para tareas auxiliares:
```bash
python tools/verify_supabase_connection.py   # Comprobar handshake con la DB Supabase
```

---

## ⚙️ Reglas de Mantenimiento Obligatorio del Vault (`ponce-benzo-vault/`)

El agente es responsable de mantener la coherencia y actualización del Segundo Cerebro. Se deben respetar las siguientes reglas estrictas:

### ⚠️ Regla de Cierre: Actualización del Vault
* **Actualizar el vault es SIEMPRE el último paso obligatorio de toda tarea o sesión de desarrollo antes de darla por finalizada.** No des una tarea por completada sin haber actualizado la documentación correspondiente en el vault (Bitácora, Roadmap, Pendientes, etc.).
* **Protocolo Inbox V.O.L.T.:** Al finalizar una sesión o completar un hito, ESTÁ ESTRICTAMENTE PROHIBIDO hacer append al final del archivo tracker. Es OBLIGATORIO abrir la ruta `C:\Users\sebastian.castro\Documents\oito\V.O.L.T\vault\proyectos\poncebenzo\poncebenzo-tracker.md` y REEMPLAZAR únicamente el contenido de la sección `## 2. Estado Operativo` con los datos actualizados de la sesión. NUNCA alteres las secciones comerciales o financieras.

### 📂 Estructura y Flexibilidad del Vault
* Eres libre de modificar y crear nuevas carpetas o notas en el vault siempre que lo veas necesario para organizar mejor la información.
* **Restricción**: Antes de crear una nueva carpeta o cambiar significativamente la estructura del vault, debes proponer el cambio al usuario, obtener su **aprobación explícita** y registrar la decisión en la carpeta de decisiones arquitectónicas (`ponce-benzo-vault/decisiones/`).

### 📝 Procedimientos por Categoría

1. **Registro de Sesiones (Bitácora)**:
   - Al finalizar una sesión de trabajo exitosa o realizar cambios en el código, crea un log en `ponce-benzo-vault/logs/Log-YYYY-MM-DD.md` usando la plantilla [[ponce-benzo-vault/templates/Template - Log|Template - Log]].
   - Añade la entrada de manera cronológica en la tabla de [[ponce-benzo-vault/logs/Session Logs|Session Logs]].

2. **Decisiones Técnicas (ADRs)**:
   - Si cambias el stack, alteras una funcionalidad principal, reestructuras carpetas o tomas una decisión técnica de diseño relevante: crea un registro en `ponce-benzo-vault/decisiones/ADR-XXX-Nombre.md` usando la plantilla [[ponce-benzo-vault/templates/Template - ADR|Template - ADR]].
   - Enlaza el ADR en el índice [[ponce-benzo-vault/decisiones/Registro de Decisiones|Registro de Decisiones]].

3. **Registro de Errores (Bugs)**:
   - Registra cada error o bug solucionado en la tabla de [[ponce-benzo-vault/bugs/Registro de Bugs|Registro de Bugs]].
   - Si la solución es compleja, crea una nota en `ponce-benzo-vault/bugs/` usando la plantilla [[ponce-benzo-vault/templates/Template - Bug|Template - Bug]] y enlázala en el registro.

4. **Procesamiento de la Bandeja de Entrada (Inbox)**:
   - Si hay archivos o notas en bruto en `ponce-benzo-vault/inbox/` (ej. transcripciones de reuniones), analízalos, distribuye su información a las notas correspondientes y mueve el archivo crudo original a `ponce-benzo-vault/inbox/procesados/` para mantener el inbox limpio.

---

## 📝 Buenas Prácticas de Formato de Obsidian

Para garantizar la legibilidad y la indexación correcta de Obsidian, respeta estas convenciones Markdown:

### 1. Metadatos (YAML Frontmatter)
Toda nota creada en el vault debe iniciar con metadatos estructurados en la parte superior:
```yaml
---
title: "Título de la Nota"
date: YYYY-MM-DD
tags:
  - categoria1
  - categoria2
---
```

### 2. Enlaces Internos (Wikilinks)
Usa siempre la sintaxis de corchetes dobles para enlazar notas dentro del vault:
- **Correcto**: `[[resumen/Constitucion\|Constitución]]` o `[[roadmap/Roadmap]]`.
- **Incorrecto**: `[Constitución](resumen/Constitucion.md)` o `[Constitución](file:///...)` (esta última sintaxis de ruta absoluta está reservada únicamente para la comunicación directa en chat o artefactos del entorno).

### 3. Destacados (Callouts)
Usa los bloques de notas enriquecidas para enfatizar información clave:
- `> [!NOTE]` — Información general o de contexto.
- `> [!TIP]` — Recomendaciones de optimización o buenas prácticas.
- `> [!IMPORTANT]` — Reglas que deben cumplirse a nivel de código.
- `> [!WARNING]` — Advertencias sobre posibles fallos o incompatibilidades.
- `> [!CAUTION]` — Riesgos de pérdida de datos o de seguridad.

---

## 🚫 Prácticas Prohibidas
- **NO** dupliques documentación técnica en archivos sueltos en la raíz del proyecto.
- **NO** crees notas sin frontmatter YAML ni etiquetas (`tags`).
- **NO** dejes la bandeja de entrada `ponce-benzo-vault/inbox/` con archivos sin procesar al terminar una sesión si has resuelto su contenido.
- **NO** rompas wikilinks existentes sin actualizar las referencias correspondientes.


---

## Protocolo de Cierre de Sesión — Bóveda Central de Oito (V.O.L.T.)

Al TERMINAR cualquier sesión de trabajo en este proyecto, además de actualizar este vault local, es OBLIGATORIO sincronizar la Bóveda central en `C:\Users\sebastian.castro\Documents\oito\V.O.L.T\vault\` (agentes Claude: invocar la skill `cierre-sesion`; otros agentes: seguir estos pasos):

1. **Prepend** (nunca append) una entrada nueva al inicio de `vault/proyectos/poncebenzo/poncebenzo-bitacora.md`: fecha + hecho / decidido / pendiente. Máximo ~10 líneas.
2. **Reemplazar** el estado en `vault/proyectos/poncebenzo/poncebenzo-tracker.md`: frontmatter (`resumen`, `fase`, `siguiente_paso`, `updated`) y secciones. El tracker es estado PURO, sin historial.
3. **Actualizar** la fila del proyecto en `vault/proyectos/index.md`.

**Sube SIEMPRE:** dinero, alcance, fechas, compromisos con el cliente, cambios de fase, bloqueos. **NO sube NUNCA:** detalle técnico (nodos, bugs, código, specs) — eso vive aquí y V.O.L.T. lo consulta vía el puntero `vault_local` del tracker central. Mantén al día el archivo de entrada de este vault (ponce-benzo-vault/Home.md): es la puerta que V.O.L.T. usa para profundizar.

