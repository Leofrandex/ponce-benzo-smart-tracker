import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface BottomSheetSelectProps<T extends string = string> {
  visible: boolean;
  title: string;
  options: SelectOption<T>[];
  selectedValue: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
}

export function BottomSheetSelect<T extends string = string>({
  visible, title, options, selectedValue, onSelect, onClose,
}: BottomSheetSelectProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* onPress vacío: captura el toque para que no se propague al scrim y cierre */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.map((opt) => {
              const active = opt.value === selectedValue;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => { onSelect(opt.value); onClose(); }}
                  activeOpacity={0.7}
                >
                  {opt.icon && (
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={active ? colors.accent : colors.textMuted}
                    />
                  )}
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={18} color={colors.accent} style={styles.check} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4, borderRadius: radii.full,
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
    borderRadius: radii.sm, marginBottom: 4,
    backgroundColor: colors.bgElevated,
  },
  optionActive: { backgroundColor: colors.accentGlow },
  optionLabel: { flex: 1, fontSize: 14, color: colors.textPrimary, ...fonts.medium },
  optionLabelActive: { color: colors.accent, ...fonts.semibold },
  check: { marginLeft: 'auto' },
});
