import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, radii, fonts } from '../theme';

interface Props {
  visible: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  /** danger: acción que no se deshace (rojo); primary: acción normal (azul). */
  tone?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void;
}

// Aviso con el diseño de la app (reemplaza Alert). Atrás o tocar afuera solo cierran el aviso.
export function ConfirmDialog({ visible, icon, title, body, cancelLabel, confirmLabel, tone = 'danger', onCancel, onConfirm }: Props) {
  const danger = tone === 'danger';
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} accessibilityViewIsModal>
          <View style={[styles.iconWrap, !danger && styles.iconWrapPrimary]}>
            <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={styles.action} />
            <Button label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={onConfirm} style={styles.action} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bgSurface,
    borderRadius: radii.lg,
    padding: 20,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconWrapPrimary: {
    backgroundColor: colors.bgElevated,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
    ...fonts.bold,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 8,
    ...fonts.regular,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  action: {
    flex: 1,
  },
});
