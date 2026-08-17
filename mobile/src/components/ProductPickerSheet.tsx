import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import type { Product } from '../types';

interface Props {
  visible: boolean;
  title: string;
  options: Product[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

export function ProductPickerSheet({ visible, title, options, selectedIds, onConfirm, onClose }: Props) {
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');

  useEffect(() => { if (visible) { setDraft(selectedIds); setQuery(''); } }, [visible, selectedIds]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return options;
    return options.filter(
      (p) => p.name.toLowerCase().includes(q)
          || p.sku.toLowerCase().includes(q)
          || (p.brand ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  function toggle(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Opcional — dejalo vacío si la anomalía no es de un producto</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, marca o código…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView style={styles.list} bounces={false} keyboardShouldPersistTaps="handled">
            {results.map((p) => {
              const active = draft.includes(p.product_id);
              return (
                <TouchableOpacity
                  key={p.product_id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => toggle(p.product_id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionInfo}>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={styles.optionMeta}>{[p.brand, p.sku].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={active ? colors.accent : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
            {results.length === 0 && <Text style={styles.empty}>No hay productos que coincidan.</Text>}
          </ScrollView>

          {/* Sin disabled: cero productos es una respuesta valida. */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => { onConfirm(draft); onClose(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmLabel}>
              {draft.length > 0 ? `Confirmar (${draft.length})` : 'Sin productos'}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radii.full,
    backgroundColor: colors.border, marginBottom: 12,
  },
  title: {
    fontSize: 12, color: colors.textSecondary, ...fonts.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgElevated, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: radii.sm, marginBottom: 4, backgroundColor: colors.bgElevated,
  },
  optionActive: { backgroundColor: colors.accentGlow },
  optionInfo: { flex: 1 },
  optionLabel: { fontSize: 13, color: colors.textPrimary, ...fonts.medium },
  optionLabelActive: { color: colors.accent, ...fonts.semibold },
  optionMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
  confirmBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: radii.md,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  confirmLabel: { fontSize: 14, color: colors.white, ...fonts.semibold },
});
