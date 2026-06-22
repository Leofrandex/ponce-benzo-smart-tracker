import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import { useSyncCtx } from '../context/SyncContext';

export function SyncBanner() {
  const { pendingCount, status } = useSyncCtx();

  let text: string | null = null;
  if (status === 'syncing') text = 'Sincronizando…';
  else if (pendingCount > 0) text = `${pendingCount} pendientes`;
  else if (status === 'offline') text = 'Sin conexión';
  else text = 'Al día';

  if (text === null) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={15} color={colors.warning} style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningBg,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  icon: {
    marginRight: 7,
  },
  text: {
    fontSize: 12,
    color: colors.warning,
    ...fonts.medium,
  },
});
