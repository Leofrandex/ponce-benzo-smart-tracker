import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { GPSChip } from '../components/GPSChip';
import { CameraModal } from '../components/CameraModal';
import { Button } from '../components/Button';
import { BottomSheetSelect, type SelectOption } from '../components/BottomSheetSelect';
import DateTimePicker from '@react-native-community/datetimepicker';
import { StatusBadge } from '../components/StatusBadge';
import { CompetitionTab } from '../components/CompetitionTab';
import { CompetitionPanel } from '../components/CompetitionPanel';
import { colors, radii, fonts } from '../theme';
import { useRouteCtx } from '../context/RouteContext';
import { newId } from '../services/sync/ids';
import type { StoreStatus, VisitRecord, Visit } from '../types';
import type { CompetitionReportRecord } from '../types';
import type { RootStackParamList } from '../navigation/AppNavigator';

type CheckInRouteProp = RouteProp<RootStackParamList, 'CheckIn'>;

const MAX_DISTANCE_METERS = 200;

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type StatusOption = { value: StoreStatus; label: string; icon: keyof typeof Ionicons.glyphMap };
const STATUS_OPTIONS: StatusOption[] = [
  { value: 'completed', label: 'Completado', icon: 'checkmark-circle' },
  { value: 'skipped',   label: 'Omitido',    icon: 'arrow-redo' },
  { value: 'anomaly',   label: 'Anomalía',   icon: 'warning' },
];

const SKIP_REASON_OPTIONS: SelectOption<NonNullable<Visit['skip_reason']>>[] = [
  { value: 'fuera_de_ruta', label: 'Fuera de ruta' },
  { value: 'sin_acceso',    label: 'No hay acceso a la tienda' },
  { value: 'otro',          label: 'Otro' },
];

const ANOMALY_TYPE_OPTIONS: SelectOption<NonNullable<Visit['anomaly_type']>>[] = [
  { value: 'sin_stock',          label: 'No hay stock' },
  { value: 'cambio_planograma',  label: 'Cambio en el planograma' },
  { value: 'diferencia_precios', label: 'Diferencia de precios' },
  { value: 'producto_danado',    label: 'Producto dañado' },
  { value: 'otro',               label: 'Otro' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function CheckInScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<CheckInRouteProp>();
  const { store } = params;
  const { recordVisit, gpsState, currentLocation } = useRouteCtx();

  const [selectedStatus, setSelectedStatus] = useState<StoreStatus>('completed');
  const [observations, setObservations] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [skipReason, setSkipReason] = useState<Visit['skip_reason']>(null);
  const [anomalyType, setAnomalyType] = useState<Visit['anomaly_type']>(null);
  const [lastRestockDate, setLastRestockDate] = useState<string | null>(null);

  const [skipSheetOpen, setSkipSheetOpen] = useState(false);
  const [anomalySheetOpen, setAnomalySheetOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [competitionDraft, setCompetitionDraft] = useState<CompetitionReportRecord | null>(null);
  const [competitionOpen, setCompetitionOpen] = useState(false);

  // Al cambiar de estado se descartan los valores del estado anterior.
  useEffect(() => {
    setSkipReason(null);
    setAnomalyType(null);
  }, [selectedStatus]);

  const locationVerified = useMemo(() => {
    if (!currentLocation) return null;
    const dist = haversineMeters(
      currentLocation.lat, currentLocation.lng,
      store.master_lat, store.master_lng,
    );
    return dist <= MAX_DISTANCE_METERS;
  }, [currentLocation, store]);

  const statusValid =
    selectedStatus === 'completed' ||
    (selectedStatus === 'skipped' && skipReason !== null) ||
    (selectedStatus === 'anomaly' && anomalyType !== null);

  const canSubmit = !submitting && gpsState === 'found' && photoUris.length > 0 && statusValid;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    const record: VisitRecord = {
      visit_id: newId(),
      store_id: store.store_id,
      check_in_time: new Date().toISOString(),
      check_in_location: currentLocation,
      photo_uris: photoUris,
      observations,
      status: selectedStatus,
      synced: false,
      anomaly_type: selectedStatus === 'anomaly' ? anomalyType : null,
      skip_reason: selectedStatus === 'skipped' ? skipReason : null,
      last_restock_date: lastRestockDate,
    };

    try {
      await recordVisit(store.store_id, record, competitionDraft ?? undefined);
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{store.name}</Text>
          {store.address && (
            <Text style={styles.headerSub} numberOfLines={1}>{store.address}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* GPS — viene del contexto, ya activo desde "Empezar Ruta" */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ubicación GPS</Text>
          <GPSChip state={gpsState} coords={currentLocation ?? undefined} />

          {gpsState === 'found' && locationVerified !== null && (
            <View style={[styles.fraudBanner, locationVerified ? styles.fraudOk : styles.fraudWarn]}>
              <Ionicons
                name={locationVerified ? 'shield-checkmark-outline' : 'warning-outline'}
                size={14}
                color={locationVerified ? colors.success : colors.warning}
              />
              <Text style={[styles.fraudText, { color: locationVerified ? colors.success : colors.warning }]}>
                {locationVerified
                  ? 'Ubicación verificada — dentro del radio de la tienda'
                  : `Fuera del radio de la tienda (> ${MAX_DISTANCE_METERS} m) — se registrará como no verificado`}
              </Text>
            </View>
          )}

          {gpsState === 'error' && (
            <Text style={styles.gpsErrorNote}>
              No se pudo obtener la ubicación. Volvé a la ruta y reiniciá la sesión.
            </Text>
          )}
        </View>

        {/* Fotos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidencia fotográfica</Text>
          <View style={styles.photoRow}>
            {photoUris.map((uri) => (
              <View key={uri} style={styles.photoWrap}>
                <Image source={{ uri }} style={styles.photoItem} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                >
                  <Ionicons name="close" size={12} color={colors.white} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addPhoto} onPress={() => setCameraOpen(true)} activeOpacity={0.75}>
              <Ionicons name="camera-outline" size={24} color={colors.accent} />
              <Text style={styles.addPhotoLabel}>{photoUris.length === 0 ? 'Capturar' : 'Otra foto'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.cameraNote}>Solo cámara en vivo — no galería · mínimo 1 foto</Text>
        </View>

        {/* Estado */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de la visita</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => {
              const active = selectedStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.statusOption, active && styles.statusOptionActive]}
                  onPress={() => setSelectedStatus(opt.value)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={active ? colors.accent : colors.textMuted}
                    style={styles.statusIcon}
                  />
                  <StatusBadge status={opt.value} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Motivo de omisión (solo si está omitido) */}
        {selectedStatus === 'skipped' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Motivo de omisión</Text>
            <TouchableOpacity
              style={styles.dropdownField}
              onPress={() => setSkipSheetOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.dropdownText, !skipReason && styles.dropdownPlaceholder]}>
                {SKIP_REASON_OPTIONS.find((o) => o.value === skipReason)?.label ?? 'Seleccioná un motivo'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Tipo de anomalía (solo si es anomalía) */}
        {selectedStatus === 'anomaly' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de anomalía</Text>
            <TouchableOpacity
              style={styles.dropdownField}
              onPress={() => setAnomalySheetOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.dropdownText, !anomalyType && styles.dropdownPlaceholder]}>
                {ANOMALY_TYPE_OPTIONS.find((o) => o.value === anomalyType)?.label ?? 'Seleccioná el tipo'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Fecha de última reposición (opcional) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Última reposición (opcional)</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={[styles.dropdownField, styles.dateField]}
              onPress={() => setDatePickerOpen(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.dropdownText, !lastRestockDate && styles.dropdownPlaceholder]}>
                {lastRestockDate ? formatDate(lastRestockDate) : 'Sin fecha'}
              </Text>
            </TouchableOpacity>
            {lastRestockDate && (
              <TouchableOpacity onPress={() => setLastRestockDate(null)} style={styles.clearDateBtn}>
                <Ionicons name="close" size={16} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
          {datePickerOpen && (
            <DateTimePicker
              value={lastRestockDate ? new Date(lastRestockDate) : new Date()}
              mode="date"
              maximumDate={new Date()}
              onChange={(event, date) => {
                setDatePickerOpen(Platform.OS === 'ios');
                if (event.type === 'set' && date) {
                  setLastRestockDate(date.toISOString().split('T')[0]);
                }
              }}
            />
          )}
        </View>

        {/* Observaciones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observaciones</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describí novedades, faltantes, anomalías observadas..."
            placeholderTextColor={colors.textMuted}
            value={observations}
            onChangeText={setObservations}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {!canSubmit && (
          <View style={styles.blockingBanner}>
            {gpsState !== 'found' && (
              <Text style={styles.blockingItem}>• GPS requerido — esperando señal desde la ruta</Text>
            )}
            {photoUris.length === 0 && (
              <Text style={styles.blockingItem}>• Foto requerida para registrar la visita</Text>
            )}
            {selectedStatus === 'skipped' && !skipReason && (
              <Text style={styles.blockingItem}>• Seleccioná el motivo de omisión</Text>
            )}
            {selectedStatus === 'anomaly' && !anomalyType && (
              <Text style={styles.blockingItem}>• Seleccioná el tipo de anomalía</Text>
            )}
          </View>
        )}

        <Button
          label="Registrar Visita"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          style={styles.submitBtn}
        />
      </ScrollView>

      <CameraModal
        visible={cameraOpen}
        onCapture={(uri) => { setPhotoUris((prev) => [...prev, uri]); setCameraOpen(false); }}
        onClose={() => setCameraOpen(false)}
      />

      <BottomSheetSelect
        visible={skipSheetOpen}
        title="Motivo de omisión"
        options={SKIP_REASON_OPTIONS}
        selectedValue={skipReason}
        onSelect={(v) => setSkipReason(v)}
        onClose={() => setSkipSheetOpen(false)}
      />

      <BottomSheetSelect
        visible={anomalySheetOpen}
        title="Tipo de anomalía"
        options={ANOMALY_TYPE_OPTIONS}
        selectedValue={anomalyType}
        onSelect={(v) => setAnomalyType(v)}
        onClose={() => setAnomalySheetOpen(false)}
      />

      <CompetitionTab hasDraft={competitionDraft !== null} onPress={() => setCompetitionOpen(true)} />
      <CompetitionPanel
        visible={competitionOpen}
        storeName={store.name}
        initial={competitionDraft}
        onClose={() => setCompetitionOpen(false)}
        onDone={setCompetitionDraft}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 16, color: colors.textPrimary, ...fonts.bold },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    ...fonts.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fraudBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: radii.sm,
  },
  fraudOk: { backgroundColor: colors.successBg },
  fraudWarn: { backgroundColor: colors.warningBg },
  fraudText: { flex: 1, fontSize: 12, lineHeight: 18, ...fonts.medium },
  gpsErrorNote: { fontSize: 12, color: colors.danger, marginTop: 8, ...fonts.medium },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { position: 'relative' },
  photoItem: { width: 76, height: 76, borderRadius: radii.sm, backgroundColor: colors.bgElevated },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: radii.full,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  addPhoto: {
    width: 76, height: 76, borderRadius: radii.sm,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.bgElevated,
  },
  addPhotoLabel: { fontSize: 10, color: colors.accent, ...fonts.semibold },
  cameraNote: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgElevated,
  },
  statusOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentGlow },
  statusIcon: { marginBottom: 6 },
  dropdownField: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
  },
  dropdownText: { flex: 1, fontSize: 14, color: colors.textPrimary, ...fonts.medium },
  dropdownPlaceholder: { color: colors.textMuted, ...fonts.regular },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateField: { flex: 1 },
  clearDateBtn: {
    width: 40, height: 40, borderRadius: radii.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.dangerBg,
  },
  textArea: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockingBanner: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.sm,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    gap: 4,
  },
  blockingItem: { fontSize: 12, color: colors.danger, ...fonts.medium },
  submitBtn: { marginTop: 4 },
});
