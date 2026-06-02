import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StoreCard } from '../components/StoreCard';
import { Button } from '../components/Button';
import { SyncBanner } from '../components/SyncBanner';
import { RouteModeToggle } from '../components/RouteModeToggle';
import { StorePickerSheet } from '../components/StorePickerSheet';
import { CompetitionTab } from '../components/CompetitionTab';
import { CompetitionPanel } from '../components/CompetitionPanel';
import { colors, radii, fonts } from '../theme';
import type { RouteStoreItem } from '../types';
import { useRouteCtx } from '../context/RouteContext';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatToday() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export function RouteScreen() {
  const navigation = useNavigation<NavProp>();
  const {
    routeItems,
    sessionActive,
    sessionEnded,
    startSession,
    endSession,
    completedCount,
    totalCount,
    pendingSyncCount,
    routeMode,
    setRouteMode,
    addStoreToRoute,
    removeStoreFromRoute,
    recordCompetitionReport,
  } = useRouteCtx();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [competitionOpen, setCompetitionOpen] = useState(false);

  const progress = totalCount > 0 ? completedCount / totalCount : 0;

  function handleStorePress(item: RouteStoreItem) {
    navigation.navigate('CheckIn', { store: item.store });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ruta del Día</Text>
          <Text style={styles.headerDate}>{formatToday()}</Text>
        </View>
        <View style={styles.progressLabelBox}>
          <Text style={styles.progressLabel}>{completedCount}/{totalCount}</Text>
          <Text style={styles.progressSub}>completadas</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      <FlatList
        data={routeItems}
        keyExtractor={(item) => item.store.store_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <SyncBanner pendingCount={pendingSyncCount} />
            {!sessionActive && !sessionEnded && (
              <RouteModeToggle mode={routeMode} onChange={setRouteMode} />
            )}
            {!sessionEnded && (routeItems.length > 0) && (
              <Button
                label={sessionActive ? 'Finalizar Ruta' : 'Empezar Ruta'}
                onPress={sessionActive ? endSession : startSession}
                variant={sessionActive ? 'danger' : 'primary'}
                style={styles.sessionBtn}
              />
            )}
            {sessionEnded && (
              <View style={styles.routeDoneBanner}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.routeDoneText}>Ruta finalizada — no se pueden editar las visitas</Text>
              </View>
            )}
          </>
        }
        ListFooterComponent={
          !sessionEnded ? (
            <TouchableOpacity style={styles.addStoreBtn} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
              <Ionicons name="add" size={18} color={colors.accent} />
              <Text style={styles.addStoreText}>
                {routeMode === 'special' ? 'Agregar sucursal' : 'Agregar otra sucursal'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <StoreCard
            item={item}
            sessionActive={sessionActive && !sessionEnded}
            onPress={() => handleStorePress(item)}
            onRemove={!sessionActive && !sessionEnded ? () => removeStoreFromRoute(item.store.store_id) : undefined}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="map-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Tu ruta está vacía</Text>
            <Text style={styles.emptyText}>
              {routeMode === 'special'
                ? 'Agregá una o más sucursales para empezar.'
                : 'No hay tiendas asignadas hoy.'}
            </Text>
          </View>
        }
      />
      {!sessionEnded && <CompetitionTab onPress={() => setCompetitionOpen(true)} />}

      <CompetitionPanel
        visible={competitionOpen}
        onClose={() => setCompetitionOpen(false)}
        onSave={recordCompetitionReport}
      />

      <StorePickerSheet
        visible={pickerOpen}
        excludeStoreIds={routeItems.map((i) => i.store.store_id)}
        onPick={addStoreToRoute}
        onClose={() => setPickerOpen(false)}
      />
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.textPrimary,
    ...fonts.extrabold,
  },
  headerDate: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    ...fonts.medium,
  },
  progressLabelBox: {
    alignItems: 'flex-end',
  },
  progressLabel: {
    fontSize: 18,
    color: colors.accent,
    ...fonts.bold,
  },
  progressSub: {
    fontSize: 11,
    color: colors.textMuted,
    ...fonts.medium,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bgElevated,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: radii.full,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  sessionBtn: {
    marginBottom: 16,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  routeDoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successBg,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.success,
  },
  routeDoneText: {
    flex: 1,
    fontSize: 13,
    color: colors.success,
    ...fonts.medium,
  },
  addStoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderAccent,
    borderRadius: radii.md, paddingVertical: 13, marginTop: 4,
  },
  addStoreText: { fontSize: 13, color: colors.accent, ...fonts.semibold },
  emptyTitle: { fontSize: 15, color: colors.textSecondary, ...fonts.semibold, marginTop: 10 },
});
