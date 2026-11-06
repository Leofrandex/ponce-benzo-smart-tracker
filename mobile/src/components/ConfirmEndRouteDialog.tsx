import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { END_ROUTE_CONFIRM as T } from '../session/confirmEndRoute';
import { colors, radii, fonts } from '../theme';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Atrás o tocar afuera solo cierran el aviso; únicamente "Sí" finaliza la ruta.
export function ConfirmEndRouteDialog({ visible, onCancel, onConfirm }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="flag-outline" size={22} color={colors.danger} />
          </View>
          <Text style={styles.title}>{T.title}</Text>
          <Text style={styles.body}>{T.body}</Text>
          <View style={styles.actions}>
            <Button label={T.cancel} variant="secondary" onPress={onCancel} style={styles.action} />
            <Button label={T.confirm} variant="danger" onPress={onConfirm} style={styles.action} />
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
