import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';

type RouteMode = 'normal' | 'special';

interface RouteModeToggleProps {
  mode: RouteMode;
  onChange: (mode: RouteMode) => void;
}

export function RouteModeToggle({ mode, onChange }: RouteModeToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.segment, mode === 'normal' && styles.segmentActive]}
        onPress={() => onChange('normal')}
        activeOpacity={0.8}
      >
        <Text style={[styles.label, mode === 'normal' && styles.labelActive]}>Ruta normal</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, mode === 'special' && styles.segmentActiveSpecial]}
        onPress={() => onChange('special')}
        activeOpacity={0.8}
      >
        <Ionicons
          name="star"
          size={13}
          color={mode === 'special' ? colors.warning : colors.textMuted}
          style={styles.star}
        />
        <Text style={[styles.label, mode === 'special' && styles.labelActiveSpecial]}>Ruta especial</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: colors.bgElevated,
    borderRadius: radii.md, padding: 3, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  segment: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: radii.sm,
  },
  segmentActive: { backgroundColor: colors.bgSurface },
  segmentActiveSpecial: { backgroundColor: colors.warningBg },
  star: {},
  label: { fontSize: 13, color: colors.textMuted, ...fonts.semibold },
  labelActive: { color: colors.accent },
  labelActiveSpecial: { color: colors.warning },
});
