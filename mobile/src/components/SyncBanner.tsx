import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import { useSyncCtx } from '../context/SyncContext';
import { deriveSyncBanner, type BannerTone } from '../sync/bannerState';

const TONE_COLORS: Record<BannerTone, { fg: string; bg: string }> = {
  syncing: { fg: colors.accent, bg: colors.accentGlow },
  offline: { fg: colors.warning, bg: colors.warningBg },
  pending: { fg: colors.warning, bg: colors.warningBg },
  synced: { fg: colors.success, bg: colors.successBg },
};

export function SyncBanner() {
  const { counts, status } = useSyncCtx();
  const banner = deriveSyncBanner({ status, records: counts.records, photos: counts.photos });
  if (!banner) return null;

  const tone = TONE_COLORS[banner.tone];
  return (
    <View style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.fg }]}>
      <Ionicons
        name={banner.icon as keyof typeof Ionicons.glyphMap}
        size={15}
        color={tone.fg}
        style={styles.icon}
      />
      <Text style={[styles.text, { color: tone.fg }]}>{banner.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  icon: {
    marginRight: 7,
  },
  text: {
    fontSize: 12,
    ...fonts.medium,
  },
});
