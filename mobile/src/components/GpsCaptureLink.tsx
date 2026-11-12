import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '../theme';
import type { GPSState } from '../types';

const AVISO = 'Esto es solo para capturar o actualizar el GPS de la tienda. El cambio es irreversible.';

interface GpsCaptureLinkProps {
  gpsState: GPSState;
  hasLocation: boolean;
  storeHasGps: boolean;
  onCapture: () => Promise<{ ok: boolean }>;
}

export function GpsCaptureLink({ gpsState, hasLocation, storeHasGps, onCapture }: GpsCaptureLinkProps) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  // Dos toques rapidos pueden abrir dos avisos: solo el primer "Capturar" cuenta. Se suelta si falla.
  const locked = useRef(false);

  async function capture() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    const { ok } = await onCapture();
    setBusy(false);
    if (ok) {
      setDone(true);
    } else {
      locked.current = false;
      Alert.alert('No se pudo guardar el GPS. Intenta de nuevo.');
    }
  }

  function confirm() {
    Alert.alert(
      'Capturar GPS de la tienda',
      storeHasGps ? `Esta tienda ya tiene GPS y se va a reemplazar. ${AVISO}` : AVISO,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Capturar', onPress: capture },
      ],
    );
  }

  if (done) return <Text style={styles.done}>GPS actualizado</Text>;
  if (busy) return <Text style={styles.busy}>Obteniendo GPS…</Text>;
  if (gpsState !== 'found' || !hasLocation) return null;
  return (
    <TouchableOpacity onPress={confirm} style={styles.btn} hitSlop={8} activeOpacity={0.8} accessibilityRole="button">
      <Ionicons name="locate" size={13} color={colors.accent} style={styles.icon} />
      <Text style={styles.btnText}>Capturar GPS</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Mismo formato que el chip de ubicación, con los colores del botón secundario.
  btn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radii.full, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.borderAccent,
  },
  icon: { marginRight: 5 },
  btnText: { fontSize: 12, color: colors.accent, ...fonts.semibold },
  busy: { fontSize: 12, color: colors.textMuted, ...fonts.medium },
  done: { fontSize: 12, color: colors.success, ...fonts.medium },
});
