import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../components/StatusBadge';
import { colors, radii, fonts } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getTodayVisits } from '../services/db';
import type { VisitRow } from '../services/db';
import type { StoreStatus } from '../types';
import { mockStores } from '../mock-data';

function getStoreName(storeId: string): string {
  return mockStores.find((s) => s.store_id === storeId)?.name ?? storeId;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: 'Completado',
    skipped: 'Saltado',
    anomaly: 'Anomalía',
  };
  return map[status] ?? status;
}

export function VisitHistoryScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getTodayVisits(db, user?.id ?? '')
        .then((rows) => { if (active) setVisits(rows); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [db, user?.id]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Hoy</Text>
        {!loading && (
          <Text style={styles.headerCount}>
            {visits.length} visita{visits.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.visit_id}
          contentContainerStyle={[styles.list, visits.length === 0 && styles.listEmpty]}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.storeId} numberOfLines={1}>{getStoreName(item.store_id)}</Text>
                <StatusBadge status={item.status as StoreStatus} />
              </View>

              <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{formatTime(item.check_in_time)}</Text>
                </View>
                {item.lat !== null && item.lng !== null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.metaText}>
                      {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}
                    </Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Ionicons
                    name={item.synced ? 'cloud-done-outline' : 'cloud-offline-outline'}
                    size={12}
                    color={item.synced ? colors.success : colors.warning}
                  />
                  <Text style={[styles.metaText, { color: item.synced ? colors.success : colors.warning }]}>
                    {item.synced ? 'Sincronizado' : 'Pendiente sync'}
                  </Text>
                </View>
              </View>

              {item.observations ? (
                <Text style={styles.observations} numberOfLines={2}>{item.observations}</Text>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={56} color={colors.bgElevated} />
              <Text style={styles.emptyTitle}>Sin visitas registradas</Text>
              <Text style={styles.emptyDesc}>
                Aún no registraste visitas hoy.{'\n'}Empezá la ruta desde la pestaña Ruta.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.textPrimary,
    ...fonts.extrabold,
  },
  headerCount: {
    fontSize: 13,
    color: colors.textMuted,
    ...fonts.medium,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  listEmpty: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeId: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    ...fonts.semibold,
    marginRight: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
    ...fonts.medium,
  },
  observations: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    color: colors.textSecondary,
    ...fonts.semibold,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
