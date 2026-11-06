import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii, fonts } from '../theme';
import { deriveUpdateBanner } from '../updates/updateBannerState';

// Queda sobre la barra de pestañas. pointerEvents none: el aviso nunca interrumpe el trabajo.
const TAB_BAR_CLEARANCE = 72;

export function UpdateBanner() {
  const { isDownloading, isUpdatePending, downloadProgress } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const banner = deriveUpdateBanner({ isDownloading, isUpdatePending, downloadProgress });
  if (!banner) return null;

  const ready = banner.kind === 'ready';
  const fg = ready ? colors.success : colors.accent;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}>
      <View style={[styles.card, { borderColor: fg }]}>
        <View style={styles.row}>
          <Ionicons name={ready ? 'checkmark-circle-outline' : 'cloud-download-outline'} size={16} color={fg} style={styles.icon} />
          <Text style={[styles.text, { color: fg }]}>{banner.text}</Text>
        </View>
        {!ready && banner.progress != null && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${banner.progress * 100}%`, backgroundColor: fg }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, elevation: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 7 },
  text: { flex: 1, fontSize: 13, ...fonts.medium },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.accentGlow, marginTop: 8, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
