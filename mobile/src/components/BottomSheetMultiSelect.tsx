import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import type { SelectOption } from './BottomSheetSelect';

interface Props<T extends string = string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  selectedValues: T[];
  onConfirm: (values: T[]) => void;
  onClose: () => void;
}

export function BottomSheetMultiSelect<T extends string = string>({
  visible, title, options, selectedValues, onConfirm, onClose,
}: Props<T>) {
  // Borrador local: solo se aplica al confirmar.
  const [draft, setDraft] = useState<T[]>(selectedValues);

  // Resincronizar el borrador cada vez que se abre.
  useEffect(() => {
    if (visible) setDraft(selectedValues);
  }, [visible, selectedValues]);

  function toggle(value: T) {
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.map((opt) => {
              const active = draft.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => toggle(opt.value)}
                  activeOpacity={0.7}
                >
                  {opt.icon && (
                    <Ionicons name={opt.icon} size={18} color={active ? colors.accent : colors.textMuted} />
                  )}
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  <Ionicons
                    name={active ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={active ? colors.accent : colors.textMuted}
                    style={styles.check}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.confirmBtn, draft.length === 0 && styles.confirmBtnDisabled]}
            onPress={() => { onConfirm(draft); onClose(); }}
            disabled={draft.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmLabel}>
              {draft.length > 0 ? `Confirmar (${draft.length})` : 'Seleccioná al menos una'}
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
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radii.full,
    backgroundColor: colors.border, marginBottom: 12,
  },
  title: {
    fontSize: 12, color: colors.textSecondary, ...fonts.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 12,
    borderRadius: radii.sm, marginBottom: 4, backgroundColor: colors.bgElevated,
  },
  optionActive: { backgroundColor: colors.accentGlow },
  optionLabel: { flex: 1, fontSize: 14, color: colors.textPrimary, ...fonts.medium },
  optionLabelActive: { color: colors.accent, ...fonts.semibold },
  check: { marginLeft: 'auto' },
  confirmBtn: {
    marginTop: 12, paddingVertical: 14, borderRadius: radii.md,
    backgroundColor: colors.accent, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: colors.bgElevated },
  confirmLabel: { fontSize: 14, color: colors.white, ...fonts.semibold },
});
