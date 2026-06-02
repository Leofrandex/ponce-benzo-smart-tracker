import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';

export function CompetitionTab({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="flag" size={15} color={colors.white} />
      <Text style={styles.label}>COMPETENCIA</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: 'absolute', right: 0, top: 200,
    backgroundColor: colors.accent,
    paddingVertical: 12, paddingHorizontal: 7,
    borderTopLeftRadius: radii.md, borderBottomLeftRadius: radii.md,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: -2, height: 0 },
    elevation: 4,
  },
  label: {
    color: colors.white, fontSize: 9, ...fonts.bold,
    letterSpacing: 0.5,
    transform: [{ rotate: '90deg' }],
    width: 90, textAlign: 'center', marginVertical: 34,
  },
});
