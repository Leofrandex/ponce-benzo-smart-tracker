import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable,
  ScrollView, StyleSheet, Animated, Dimensions, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import { BottomSheetSelect, type SelectOption } from './BottomSheetSelect';
import { CameraModal } from './CameraModal';
import { mockCompetitorBrands } from '../mock-data';
import { newId } from '../services/sync/ids';
import type { CompetitionReportRecord, CompetitionReport } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_W = SCREEN_W * 0.82;

type ActivationType = NonNullable<CompetitionReport['activation_type']>;

const ACTIVATION_OPTIONS: SelectOption<ActivationType>[] = [
  { value: 'promocion',              label: 'Promoción' },
  { value: 'material_pop',           label: 'Material POP' },
  { value: 'espacios_exhibiciones',  label: 'Espacios / exhibiciones' },
  { value: 'impulso_activacion',     label: 'Impulso / activación' },
  { value: 'degustacion',            label: 'Degustación' },
  { value: 'otro',                   label: 'Otro' },
];

interface CompetitionPanelProps {
  visible: boolean;
  storeName: string;                       // solo display: a qué tienda queda atado
  initial: CompetitionReportRecord | null; // borrador previo para reabrir/editar
  onClose: () => void;
  onDone: (record: CompetitionReportRecord) => void;
}

export function CompetitionPanel({ visible, storeName, initial, onClose, onDone }: CompetitionPanelProps) {
  const slide = useRef(new Animated.Value(PANEL_W)).current;

  const [activationType, setActivationType] = useState<ActivationType | null>(initial?.activation_type ?? null);
  const [brandId, setBrandId] = useState<string | null>(initial?.brand_id ?? null);
  const [photoUris, setPhotoUris] = useState<string[]>(initial?.photo_uris ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [activationSheet, setActivationSheet] = useState(false);
  const [brandSheet, setBrandSheet] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Re-hidratar el borrador solo al abrir el panel (no al cambiar `initial`
  // con el panel abierto, para no pisar una edición en curso).
  useEffect(() => {
    if (!visible) return;
    setActivationType(initial?.activation_type ?? null);
    setBrandId(initial?.brand_id ?? null);
    setPhotoUris(initial?.photo_uris ?? []);
    setNotes(initial?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 0 : PANEL_W,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const brandOptions: SelectOption[] = mockCompetitorBrands.map((b) => ({ value: b.brand_id, label: b.name }));

  const canSave = activationType !== null && brandId !== null;

  function handleDone() {
    if (!canSave) return;
    onDone({
      report_id: initial?.report_id ?? newId(),
      brand_id: brandId,
      activation_type: activationType,
      photo_uris: photoUris,
      notes: notes.trim() === '' ? null : notes.trim(),
    });
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={[styles.panel, { transform: [{ translateX: slide }] }]}>
          <Pressable style={styles.panelInner} onPress={() => {}}>
            <View style={styles.header}>
              <Ionicons name="flag" size={18} color={colors.accent} />
              <Text style={styles.headerTitle}>Reporte de competencia</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSub}>Opcional · se guarda al registrar la visita en {storeName}</Text>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>¿Cuál fue la activación?</Text>
              <TouchableOpacity style={styles.field} onPress={() => setActivationSheet(true)} activeOpacity={0.75}>
                <Text style={[styles.fieldText, !activationType && styles.placeholder]}>
                  {ACTIVATION_OPTIONS.find((o) => o.value === activationType)?.label ?? 'Seleccioná la activación'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>¿Qué marca?</Text>
              <TouchableOpacity style={styles.field} onPress={() => setBrandSheet(true)} activeOpacity={0.75}>
                <Text style={[styles.fieldText, !brandId && styles.placeholder]}>
                  {brandOptions.find((o) => o.value === brandId)?.label ?? 'Seleccioná la marca'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Fotos de la activación</Text>
              <View style={styles.photoRow}>
                {photoUris.map((uri) => (
                  <View key={uri} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setPhotoUris((prev) => prev.filter((u) => u !== uri))}
                    >
                      <Ionicons name="close" size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addPhoto} onPress={() => setCameraOpen(true)} activeOpacity={0.75}>
                  <Ionicons name="camera-outline" size={22} color={colors.accent} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Notas (opcional)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Detalles de la actividad de la competencia…"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleDone}
                disabled={!canSave}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Listo</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>

      <BottomSheetSelect
        visible={activationSheet}
        title="¿Cuál fue la activación?"
        options={ACTIVATION_OPTIONS}
        selectedValue={activationType}
        onSelect={(v) => setActivationType(v)}
        onClose={() => setActivationSheet(false)}
      />
      <BottomSheetSelect
        visible={brandSheet}
        title="¿Qué marca?"
        options={brandOptions}
        selectedValue={brandId}
        onSelect={(v) => setBrandId(v)}
        onClose={() => setBrandSheet(false)}
      />
      <CameraModal
        visible={cameraOpen}
        onCapture={(uri) => { setPhotoUris((prev) => [...prev, uri]); setCameraOpen(false); }}
        onClose={() => setCameraOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row', justifyContent: 'flex-end' },
  panel: { width: PANEL_W, height: '100%' },
  panelInner: {
    flex: 1, backgroundColor: colors.bgBase,
    borderTopLeftRadius: radii.lg, borderBottomLeftRadius: radii.lg,
    paddingTop: 50, paddingHorizontal: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { flex: 1, fontSize: 15, color: colors.textPrimary, ...fonts.bold },
  closeBtn: { padding: 4 },
  headerSub: { fontSize: 11, color: colors.textMuted, marginTop: 2, marginBottom: 8 },
  body: { paddingBottom: 40 },
  label: {
    fontSize: 11, color: colors.textSecondary, ...fonts.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6,
  },
  field: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurface, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
  },
  fieldText: { flex: 1, fontSize: 14, color: colors.textPrimary, ...fonts.medium },
  placeholder: { color: colors.textMuted, ...fonts.regular },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 64, height: 64, borderRadius: radii.sm, backgroundColor: colors.bgElevated },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: radii.full,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  addPhoto: {
    width: 64, height: 64, borderRadius: radii.sm,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderAccent,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgSurface,
  },
  textArea: {
    backgroundColor: colors.bgSurface, borderRadius: radii.sm, padding: 12,
    fontSize: 14, color: colors.textPrimary, minHeight: 80,
    borderWidth: 1, borderColor: colors.border,
  },
  saveBtn: {
    marginTop: 20, backgroundColor: colors.accent,
    borderRadius: radii.md, paddingVertical: 14, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.white, fontSize: 15, ...fonts.semibold },
});
