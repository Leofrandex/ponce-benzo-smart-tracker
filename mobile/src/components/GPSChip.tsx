import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import type { GPSState } from '../types';

export type { GPSState };

interface GPSChipProps {
  state: GPSState;
  coords?: { lat: number; lng: number };
}

const CONFIG: Record<GPSState, { label: string; color: string; bg: string }> = {
  idle:      { label: 'GPS no iniciado',  color: colors.textMuted,  bg: colors.bgElevated },
  searching: { label: 'Buscando GPS...',  color: colors.warning,    bg: colors.warningBg },
  found:     { label: 'GPS encontrado',   color: colors.success,    bg: colors.successBg },
  error:     { label: 'Error de GPS',     color: colors.danger,     bg: colors.dangerBg },
};

export function GPSChip({ state, coords }: GPSChipProps) {
  const { label, color, bg } = CONFIG[state];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {state === 'searching' ? (
        <ActivityIndicator size={12} color={color} style={styles.icon} />
      ) : (
        <Ionicons
          name={state === 'found' ? 'location' : state === 'error' ? 'location-outline' : 'location-outline'}
          size={13}
          color={color}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color }]}>
        {state === 'found' && coords
          ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
          : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 5,
  },
  label: {
    fontSize: 12,
    ...fonts.medium,
  },
});
