import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';

interface CompetitionTabProps {
  onPress: () => void;
  hasDraft?: boolean; // hay datos de competencia capturados sin registrar
}

export function CompetitionTab({ onPress, hasDraft = false }: CompetitionTabProps) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.85}>
      {hasDraft && <View style={styles.draftDot} />}
      <Ionicons name="flag" size={12} color={colors.white} />
      <Text style={styles.label}>COMPETENCIA</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: 'absolute', right: 0, top: 170,
    backgroundColor: colors.accent,
    paddingVertical: 8, paddingHorizontal: 4,
    borderTopLeftRadius: radii.sm, borderBottomLeftRadius: radii.sm,
    alignItems: 'center', gap: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: -2, height: 0 },
    elevation: 4,
  },
  draftDot: {
    width: 7, height: 7, borderRadius: radii.full,
    backgroundColor: colors.warning,
  },
  label: {
    color: colors.white, fontSize: 8, ...fonts.bold,
    letterSpacing: 0.5,
    transform: [{ rotate: '90deg' }],
    width: 80, textAlign: 'center', marginVertical: 30,
  },
});
