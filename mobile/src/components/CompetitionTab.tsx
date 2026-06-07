import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, radii, fonts } from '../theme';

interface CompetitionTabProps {
  onPress: () => void;
  hasDraft?: boolean; // hay datos de competencia capturados sin registrar
}

// El texto rotado conserva su caja de layout horizontal en RN; los márgenes
// negativos colapsan ese ancho para que la pestaña quede realmente delgada.
const LABEL_LENGTH = 70; // largo visual del texto rotado
const LABEL_THICKNESS = 10; // alto de línea del texto (ancho real que ocupa)
const LABEL_OFFSET = (LABEL_LENGTH - LABEL_THICKNESS) / 2;

export function CompetitionTab({ onPress, hasDraft = false }: CompetitionTabProps) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.85}>
      {hasDraft && <View style={styles.draftDot} />}
      <Text style={styles.label}>COMPETENCIA</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: 'absolute', right: 0, top: 170,
    backgroundColor: colors.accent,
    paddingVertical: 10, paddingHorizontal: 3,
    borderTopLeftRadius: radii.sm, borderBottomLeftRadius: radii.sm,
    alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: -2, height: 0 },
    elevation: 4,
  },
  draftDot: {
    width: 6, height: 6, borderRadius: radii.full,
    backgroundColor: colors.warning,
  },
  label: {
    color: colors.white, fontSize: 7, lineHeight: LABEL_THICKNESS, ...fonts.bold,
    letterSpacing: 0.5,
    transform: [{ rotate: '90deg' }],
    width: LABEL_LENGTH, textAlign: 'center',
    marginVertical: LABEL_OFFSET, marginHorizontal: -LABEL_OFFSET,
  },
});
