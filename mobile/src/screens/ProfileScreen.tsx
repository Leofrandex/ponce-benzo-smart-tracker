import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useRouteCtx } from '../context/RouteContext';
import { useSyncCtx } from '../context/SyncContext';
import { Button } from '../components/Button';
import { colors, radii, fonts } from '../theme';
import { VERSION_STAMP } from '../diagnostics/version';
import { getDb } from '../store/localStore';
import { getTodayVisits, localDayRangeUtc } from '../services/db';
import { supabase } from '../services/supabase';
import { resolveToday } from '../session/sessionStore';
import { withTimeout } from '../utils/withTimeout';
import { fechaLocalISO } from '../utils/localDate';
import {
  computeTodayStats, computeWeekStats, formatDuracion,
  type TodayStats, type WeekStats,
} from '../stats/profileStats';
import type { AnomalyType } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  sin_stock: 'Sin stock',
  cambio_planograma: 'Cambio de planograma',
  diferencia_precios: 'Diferencia de precios',
  producto_danado: 'Producto dañado',
  otro: 'Otro',
};

const SKIP_LABELS: Record<string, string> = {
  fuera_de_ruta: 'fuera de ruta',
  sin_acceso: 'sin acceso',
  otro: 'otro motivo',
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function horaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Anillo de avance sin react-native-svg ────────────────────────────────────
// Dos mitades recortadas; cada una contiene un medio anillo (bordes top+right)
// que se rota según el porcentaje.
function ProgressRing({ pct, size = 84, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const deg = Math.max(0, Math.min(100, pct)) * 3.6;
  const half = size / 2;
  const arc = {
    position: 'absolute' as const,
    top: 0,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
    borderColor: 'transparent',
    borderTopColor: colors.accent,
    borderRightColor: colors.accent,
  };
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: colors.bgElevated }} />
      {deg > 0 && (
        <View style={{ position: 'absolute', left: half, width: half, height: size, overflow: 'hidden' }}>
          <View style={[arc, { left: -half, transform: [{ rotate: `${Math.min(deg, 180) - 135}deg` }] }]} />
        </View>
      )}
      {deg > 180 && (
        <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
          <View style={[arc, { left: 0, transform: [{ rotate: `${deg - 135}deg` }] }]} />
        </View>
      )}
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={styles.ringText}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

function Tile({ label, value, detail, color }: { label: string; value: number; detail: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        {color && <View style={[styles.dot, { backgroundColor: color }]} />}
        <Text style={styles.tileLabel}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.tileDetail} numberOfLines={1}>{detail}</Text>
    </View>
  );
}

function KV({ label, value, first }: { label: string; value: string | number; first?: boolean }) {
  return (
    <View style={[styles.kv, !first && styles.kvBorder]}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

// ── Datos ────────────────────────────────────────────────────────────────────

type WeekState = { status: 'loading' } | { status: 'ok'; data: WeekStats } | { status: 'offline' };

async function loadWeek(userId: string): Promise<WeekStats | null> {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
  const routesSince = fechaLocalISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 12));
  const [visitsRes, routesRes] = await Promise.all([
    supabase.from('visits').select('visit_id, store_id, check_in_time, status')
      .eq('user_id', userId).gte('check_in_time', since.toISOString()),
    supabase.from('routes').select('route_date, store_ids, is_special')
      .eq('user_id', userId).gte('route_date', routesSince),
  ]);
  if (visitsRes.error || routesRes.error) return null;

  // Las visitas aún en el teléfono no están en el servidor: se suman sin duplicar.
  const db = await getDb();
  const local = await db.getAllAsync<{ visit_id: string; store_id: string; check_in_time: string; status: string }>(
    `SELECT visit_id, store_id, check_in_time, status FROM visits WHERE user_id = ? AND synced = 0`, userId,
  );
  const byId = new Map<string, { store_id: string; check_in_time: string; status: string }>();
  for (const v of [...(visitsRes.data ?? []), ...local]) byId.set(v.visit_id, v);

  return computeWeekStats({ visits: [...byId.values()], routes: routesRes.data ?? [], now });
}

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { routeItems } = useRouteCtx();
  const { counts } = useSyncCtx();
  const navigation = useNavigation<ProfileNavProp>();
  const [today, setToday] = useState<TodayStats | null>(null);
  const [sessionStart, setSessionStart] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekState>({ status: 'loading' });

  const userId = user?.id;

  // Se recalcula cada vez que se entra a la pestaña: el mercaderista viene de
  // registrar una visita y espera ver el número ya actualizado.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let alive = true;
      (async () => {
        try {
          const db = await getDb();
          const { startIso, endIso } = localDayRangeUtc();
          const [visits, reports, { session }] = await Promise.all([
            getTodayVisits(db, userId),
            db.getAllAsync<{ photo_uri: string | null }>(
              `SELECT photo_uri FROM competition_reports WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
              userId, startIso, endIso,
            ),
            resolveToday(db, userId),
          ]);
          if (!alive) return;
          setSessionStart(session?.session_start ?? null);
          setToday(computeTodayStats({
            routeStatuses: routeItems.map((i) => i.status),
            visits,
            competitionReports: reports,
            sessionStart: session?.session_start ?? null,
            sessionEnd: session?.session_end ?? null,
            now: new Date(),
          }));
        } catch (e) {
          console.warn('[profile] métricas de hoy FAIL:', (e as { message?: string })?.message ?? e);
        }
      })();
      withTimeout(loadWeek(userId), 8000, null).then((w) => {
        if (alive) setWeek(w ? { status: 'ok', data: w } : { status: 'offline' });
      });
      return () => { alive = false; };
    }, [userId, routeItems]),
  );

  if (!user) return null;

  const now = new Date();
  const fecha = `${DIAS[now.getDay()]} ${now.getDate()} ${MESES[now.getMonth()]}`;
  const firstName = user.full_name.split(' ')[0];
  const s = today;
  const maxTipo = s?.anomaliasPorTipo[0]?.count ?? 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tu recorrido hoy</Text>
        <Text style={styles.subtitle}>Hola, {firstName} · {fecha}</Text>

        {/* Avance */}
        <View style={[styles.card, styles.hero]}>
          <ProgressRing pct={s?.avancePct ?? 0} />
          <View style={styles.heroText}>
            {s && s.total > 0 ? (
              <>
                <Text style={styles.heroMain}>
                  {s.total - s.pendientes} de {s.total} tiendas
                </Text>
                <Text style={styles.heroSub}>
                  {s.pendientes === 0 ? 'Ruta terminada' : `${s.pendientes} pendiente${s.pendientes === 1 ? '' : 's'}`}
                </Text>
                {sessionStart && s.minutosEnRuta != null && (
                  <Text style={styles.heroSub}>
                    En ruta desde las {horaLocal(sessionStart)} ({formatDuracion(s.minutosEnRuta)})
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={styles.heroMain}>Sin ruta cargada</Text>
                <Text style={styles.heroSub}>Cuando tengas ruta asignada verás tu avance aquí</Text>
              </>
            )}
          </View>
        </View>

        {/* Desglose */}
        <View style={styles.grid}>
          <Tile label="Realizadas" value={s?.realizadas ?? 0} detail="con check-in" />
          <Tile label="Completadas" value={s?.completadas ?? 0} detail="sin novedad" color={colors.success} />
          <Tile
            label="Con anomalías"
            value={s?.anomalias ?? 0}
            detail={s && s.anomaliasReportadas > 0
              ? `${s.anomaliasReportadas} anomalía${s.anomaliasReportadas === 1 ? '' : 's'} reportada${s.anomaliasReportadas === 1 ? '' : 's'}`
              : 'ninguna'}
            color={colors.warning}
          />
          <Tile
            label="Omitidas"
            value={s?.omitidas ?? 0}
            detail={s?.motivoOmisionPrincipal ? SKIP_LABELS[s.motivoOmisionPrincipal] ?? 'otro motivo' : '—'}
            color={colors.textMuted}
          />
        </View>

        {counts.records > 0 && (
          <View style={styles.syncNote}>
            <View style={[styles.dot, { backgroundColor: colors.warning }]} />
            <Text style={styles.syncText}>
              {counts.records} registro{counts.records === 1 ? '' : 's'} en el teléfono, falta sincronizar
            </Text>
          </View>
        )}

        {/* Anomalías por tipo */}
        {s && s.anomaliasPorTipo.length > 0 && (
          <>
            <Text style={styles.section}>Anomalías de hoy</Text>
            <View style={[styles.card, styles.bars]}>
              {s.anomaliasPorTipo.map((a) => (
                <View key={a.type} style={styles.bar}>
                  <View style={styles.barTop}>
                    <Text style={styles.barLabel}>{ANOMALY_LABELS[a.type] ?? a.type}</Text>
                    <Text style={styles.barValue}>{a.count}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(a.count / maxTipo) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Registros */}
        <Text style={styles.section}>Lo que registraste</Text>
        <View style={styles.card}>
          <KV first label="Fotos" value={s?.fotos ?? 0} />
          <KV label="Reposiciones" value={s?.reposiciones ?? 0} />
          <KV label="Reportes de competencia" value={s?.reportesCompetencia ?? 0} />
        </View>

        {/* Semana */}
        <Text style={styles.section}>Últimos 7 días</Text>
        {week.status === 'offline' ? (
          <View style={[styles.card, styles.offline]}>
            <Text style={styles.offlineText}>Sin conexión. Se actualiza cuando vuelva la señal.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Visitas</Text>
              <Text style={styles.tileValue}>{week.status === 'ok' ? week.data.visitas : '—'}</Text>
              <Text style={styles.tileDetail} numberOfLines={1}>
                {week.status === 'ok' ? deltaText(week.data.visitas - week.data.visitasSemanaAnterior) : ' '}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Cumplimiento</Text>
              <Text style={styles.tileValue}>
                {week.status === 'ok' && week.data.cumplimientoPct != null ? `${week.data.cumplimientoPct}%` : '—'}
              </Text>
              <Text style={styles.tileDetail} numberOfLines={1}>de tus tiendas planificadas</Text>
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Button label="Cerrar sesión" onPress={signOut} variant="danger" style={styles.signOutBtn} />
          <TouchableOpacity onLongPress={() => navigation.navigate('DebugLog')} style={styles.versionStamp}>
            <Text style={styles.versionText}>{VERSION_STAMP}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function deltaText(d: number): string {
  if (d === 0) return 'igual que la semana anterior';
  return `${d > 0 ? '+' : ''}${d} vs semana anterior`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  title: { fontSize: 24, color: colors.textPrimary, paddingHorizontal: 4, ...fonts.extrabold },
  subtitle: { fontSize: 13, color: colors.textMuted, paddingHorizontal: 4, marginTop: 2, marginBottom: 16, ...fonts.medium },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  heroText: { flex: 1 },
  heroMain: { fontSize: 16, color: colors.textPrimary, ...fonts.bold },
  heroSub: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 17, ...fonts.medium },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringText: { fontSize: 20, color: colors.accent, ...fonts.extrabold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: { fontSize: 12, color: colors.textSecondary, ...fonts.medium },
  tileValue: { fontSize: 28, color: colors.textPrimary, marginTop: 6, fontVariant: ['tabular-nums'], ...fonts.extrabold },
  tileDetail: { fontSize: 11, color: colors.textMuted, marginTop: 2, ...fonts.medium },
  dot: { width: 8, height: 8, borderRadius: 4 },

  syncNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: colors.warningBg, borderRadius: radii.sm + 4,
  },
  syncText: { flex: 1, fontSize: 12, color: '#92400e', ...fonts.semibold },

  section: {
    fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.9,
    marginTop: 24, marginBottom: 8, paddingHorizontal: 4, ...fonts.bold,
  },

  bars: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 },
  bar: { marginTop: 10 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { fontSize: 12, color: colors.textSecondary, ...fonts.medium },
  barValue: { fontSize: 12, color: colors.textPrimary, ...fonts.bold },
  barTrack: { height: 6, backgroundColor: colors.bgElevated, borderRadius: radii.full, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.warning, borderRadius: radii.full },

  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16 },
  kvBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  kvLabel: { fontSize: 13, color: colors.textSecondary, ...fonts.medium },
  kvValue: { fontSize: 13, color: colors.textPrimary, fontVariant: ['tabular-nums'], ...fonts.bold },

  offline: { padding: 16 },
  offlineText: { fontSize: 12, color: colors.textMuted, ...fonts.medium },

  footer: { marginTop: 28, alignItems: 'stretch' },
  signOutBtn: { marginTop: 0 },
  versionStamp: { marginTop: 16, alignItems: 'center', paddingVertical: 4 },
  versionText: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
});
