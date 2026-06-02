import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import { StatusBadge } from './StatusBadge';
import type { RouteStoreItem } from '../types';

interface StoreCardProps {
  item: RouteStoreItem;
  sessionActive: boolean;
  onPress: () => void;
  onRemove?: () => void;
}

export function StoreCard({ item, sessionActive, onPress, onRemove }: StoreCardProps) {
  const { store, order, status } = item;
  const isDone = status !== 'pending';
  const isLocked = !sessionActive || isDone;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isLocked}
      style={[
        styles.card,
        !sessionActive && styles.cardLocked,
        isDone && styles.cardDone,
      ]}
      activeOpacity={0.75}
    >
      <View style={[styles.orderBadge, !sessionActive && styles.orderBadgeLocked]}>
        {!sessionActive
          ? <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
          : <Text style={styles.orderText}>{order}</Text>
        }
      </View>

      <View style={styles.info}>
        <Text style={[styles.storeName, !sessionActive && styles.textLocked]} numberOfLines={1}>
          {store.name}
        </Text>
        {store.address && (
          <Text style={styles.address} numberOfLines={1}>{store.address}</Text>
        )}
      </View>

      <View style={styles.right}>
        <StatusBadge status={status} />
        {sessionActive && !isDone && (
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
        )}
        {onRemove && (
          <TouchableOpacity onPress={onRemove} hitSlop={8} style={styles.removeBtn}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLocked: {
    backgroundColor: colors.bgElevated,
    opacity: 0.55,
    elevation: 0,
    shadowOpacity: 0,
  },
  cardDone: {
    opacity: 0.65,
  },
  orderBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderBadgeLocked: {
    backgroundColor: colors.bgBase,
  },
  orderText: {
    fontSize: 13,
    color: colors.accent,
    ...fonts.bold,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  storeName: {
    fontSize: 14,
    color: colors.textPrimary,
    ...fonts.semibold,
  },
  textLocked: {
    color: colors.textMuted,
  },
  address: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chevron: {
    marginLeft: 4,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
