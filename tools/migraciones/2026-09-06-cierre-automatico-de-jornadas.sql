-- ============================================================
-- Migración 2026-09-06 — cierre automático de jornadas olvidadas
--
-- Aplicar en el SQL editor de Supabase (producción).
--
-- Contexto: el viernes 2026-09-04 las cuatro jornadas del día quedaron sin
-- `session_end`. El hub consideraba "activo" a cualquier sesión abierta, así
-- que el sábado en la noche el mapa mostraba a todo el equipo en ruta. El hub
-- ya exige un ping reciente (hub/app/lib/queries/liveness.ts); esta migración
-- ataca el dato: cierra en el servidor las jornadas que nadie cerró, sin
-- depender de que el mercaderista vuelva a abrir la app.
--
-- Bloque 1 — función `close_stale_sessions(max_idle interval)`: cierra toda
--            sesión abierta cuyo último ping (o su inicio, si no hubo pings)
--            tenga más de `max_idle`. `session_end` = ese último ping, para
--            conservar la duración real de la jornada.
-- Bloque 2 — trigger que impide que un `session_end` ya fijado se ACORTE.
--            La app móvil, al abrirse días después, cierra localmente sus
--            sesiones viejas con `session_end = session_start` y hace upsert;
--            sin este guardia pisaría el valor bueno del servidor con una
--            jornada de duración cero.
-- Bloque 3 — job pg_cron cada 30 min con umbral de 3 h de inactividad.
--
-- NO BORRA DATOS. Sólo UPDATE de `sessions.session_end` donde era NULL.
-- Idempotente: se puede re-ejecutar sin efectos secundarios.
-- ============================================================

BEGIN;

-- ── 1. Función de cierre ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_stale_sessions(max_idle INTERVAL DEFAULT INTERVAL '3 hours')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closed_count INTEGER;
BEGIN
  WITH last_ping AS (
    SELECT s.session_id,
           COALESCE(MAX(p."timestamp"), s.session_start) AS last_seen
    FROM public.sessions s
    LEFT JOIN public.location_pings p ON p.session_id = s.session_id
    WHERE s.session_end IS NULL
    GROUP BY s.session_id, s.session_start
  ),
  closed AS (
    UPDATE public.sessions s
    SET session_end = lp.last_seen
    FROM last_ping lp
    WHERE s.session_id = lp.session_id
      AND lp.last_seen < NOW() - max_idle
    RETURNING s.session_id
  )
  SELECT COUNT(*) INTO closed_count FROM closed;
  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.close_stale_sessions(INTERVAL) FROM PUBLIC, anon, authenticated;

-- ── 2. Guardia: un cierre ya fijado no se acorta ────────────
CREATE OR REPLACE FUNCTION public.sessions_keep_latest_end()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.session_end IS NOT NULL
     AND NEW.session_end IS NOT NULL
     AND NEW.session_end < OLD.session_end THEN
    NEW.session_end := OLD.session_end;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_keep_latest_end ON public.sessions;
CREATE TRIGGER trg_sessions_keep_latest_end
  BEFORE UPDATE OF session_end ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.sessions_keep_latest_end();

-- ── 3. Job programado ───────────────────────────────────────
-- pg_cron viene preinstalado en Supabase; hay que activarlo una vez desde
-- Database → Extensions o con esta línea.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reprogramar si ya existía (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'close_stale_sessions') THEN
    PERFORM cron.unschedule('close_stale_sessions');
  END IF;
END $$;

SELECT cron.schedule(
  'close_stale_sessions',
  '*/30 * * * *',
  $$SELECT public.close_stale_sessions(INTERVAL '3 hours')$$
);

-- ── 4. Primera pasada: cierra lo que hoy esté huérfano ──────
SELECT public.close_stale_sessions(INTERVAL '3 hours') AS sesiones_cerradas;

COMMIT;
