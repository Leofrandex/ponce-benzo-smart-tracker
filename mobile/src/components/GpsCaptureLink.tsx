import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../theme';
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
  // Dos toques rapidos pueden abrir dos avisos: solo el primer "Capturar" cuenta. Se suelta si falla.
  const locked = useRef(false);

  async function capture() {
    if (locked.current) return;
    locked.current = true;
    const { ok } = await onCapture();
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
  if (gpsState !== 'found' || !hasLocation) return null;
  return (
    <TouchableOpacity onPress={confirm} style={styles.link} hitSlop={8} accessibilityRole="button">
      <Text style={styles.linkText}>¿Capturar GPS?</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'flex-start', marginTop: 8 },
  linkText: { fontSize: 12, color: colors.accent, textDecorationLine: 'underline', ...fonts.medium },
  done: { fontSize: 12, color: colors.success, marginTop: 8, ...fonts.medium },
});
