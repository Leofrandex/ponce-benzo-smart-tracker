import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, fonts } from '../theme';
import type { StoreStatus } from '../types';

const CONFIG: Record<StoreStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',  color: colors.textMuted,   bg: colors.bgElevated },
  completed: { label: 'Completado', color: colors.success,     bg: colors.successBg },
  skipped:   { label: 'Saltado',    color: colors.warning,     bg: colors.warningBg },
  anomaly:   { label: 'Anomalía',   color: colors.danger,      bg: colors.dangerBg },
};

export function StatusBadge({ status }: { status: StoreStatus }) {
  const { label, color, bg } = CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  text: {
    fontSize: 11,
    ...fonts.semibold,
  },
});
