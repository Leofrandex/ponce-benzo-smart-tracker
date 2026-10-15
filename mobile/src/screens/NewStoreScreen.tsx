import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Image, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSyncCtx } from '../context/SyncContext';
import { Button } from '../components/Button';
import { CameraModal } from '../components/CameraModal';
import { colors, radii, fonts } from '../theme';
import { getDb } from '../store/localStore';
import { insertStoreProposal } from '../services/db';
import { newId } from '../services/sync/ids';
import { fetchAllStores, fetchClientOptions } from '../services/catalogApi';
import { nearbyStores, isWeakAccuracy, canSaveProposal, GPS_TIMEOUT_MS } from '../services/storeProposals';
import { withDeadline } from '../utils/withTimeout';
import { logEvent } from '../diagnostics/log';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Store } from '../types';

type Fix = { lat: number; lng: number; accuracy: number | null };
const OTRA = '';

export function NewStoreScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<RootStackParamList, 'NewStore'>>();
  const { user } = useAuth();
  const { flushNow } = useSyncCtx();

  const [name, setName] = useState(params?.initialName ?? '');
  const [clientId, setClientId] = useState<string>(OTRA);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [dupChecked, setDupChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sin conexión ambas listas quedan vacías: el formulario sigue funcionando.
  const [stores, setStores] = useState<Store[]>([]);
  const [clients, setClients] = useState<{ client_id: string; name: string }[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAllStores().then((s) => { if (alive) setStores(s); }).catch(() => {});
    fetchClientOptions().then((c) => { if (alive) setClients(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const cercanas = useMemo(() => (fix ? nearbyStores(stores, fix.lat, fix.lng) : []), [fix, stores]);

  async function capturar() {
    setGpsError(null); setPermDenied(false); setLocating(true); setDupChecked(false);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setGpsError('Sin permiso de ubicación. Actívalo en los ajustes del teléfono.');
        setPermDenied(true);
        return;
      }
      const pos = await withDeadline(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
        GPS_TIMEOUT_MS, 'ubicación',
      );
      setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null });
    } catch {
      setGpsError('No se pudo obtener la ubicación, intenta de nuevo.');
    } finally { setLocating(false); }
  }

  async function guardar() {
    if (!user || !fix || !canSaveProposal({ name, lat: fix.lat, lng: fix.lng })) return;
    setSaving(true);
    try {
      const db = await getDb();
      const proposal_id = newId();
      await insertStoreProposal(db, {
        proposal_id, user_id: user.id, name: name.trim(), client_id: clientId || null,
        note: note.trim() || null, photo_uri: photo ? JSON.stringify([photo]) : null,
        lat: fix.lat, lng: fix.lng, accuracy_m: fix.accuracy, captured_at: new Date().toISOString(),
      });
      await logEvent(db, 'info', 'store_proposal_saved', proposal_id, user.id);
      flushNow();
      Alert.alert('Sucursal registrada', 'La revisaremos para darla de alta.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Intenta de nuevo.');
    } finally { setSaving(false); }
  }

  const mostrarDuplicados = fix && cercanas.length > 0 && !dupChecked;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Registrar sucursal nueva</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Usa esto cuando estés en una sucursal que no aparece en el sistema. Guardamos su ubicación para darla de alta. No reemplaza el reporte de visita.
        </Text>

        <Text style={styles.label}>Nombre de la sucursal *</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Farmatodo La Trinidad" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Cadena o cliente</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ client_id: OTRA, name: 'Otra / no sé' }, ...clients].map((c) => (
            <TouchableOpacity key={c.client_id || 'otra'} onPress={() => setClientId(c.client_id)}
              style={[styles.chip, clientId === c.client_id && styles.chipOn]}>
              <Text style={[styles.chipText, clientId === c.client_id && styles.chipTextOn]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Nota</Text>
        <TextInput style={[styles.input, styles.multiline]} value={note} onChangeText={setNote} multiline
          placeholder="Dirección aproximada, referencia, contacto" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Foto de la fachada</Text>
        {photo ? (
          <TouchableOpacity onPress={() => setCamOpen(true)}><Image source={{ uri: photo }} style={styles.photo} /></TouchableOpacity>
        ) : (
          <Button label="Tomar foto" variant="secondary" onPress={() => setCamOpen(true)} />
        )}

        <Text style={styles.label}>Ubicación *</Text>
        <Button label={fix ? 'Volver a capturar ubicación' : 'Capturar ubicación'} variant={fix ? 'secondary' : 'primary'}
          onPress={capturar} loading={locating} />
        {fix && (
          <Text style={styles.fixText}>
            Ubicación capturada {fix.accuracy != null ? `(±${Math.round(fix.accuracy)} m)` : ''}
          </Text>
        )}
        {fix && isWeakAccuracy(fix.accuracy) && (
          <Text style={styles.warn}>Señal débil: muévete a la entrada o espera unos segundos</Text>
        )}
        {gpsError && (
          <Text style={styles.error}>{gpsError}</Text>
        )}
        {permDenied && (
          <Button label="Abrir ajustes" variant="secondary" onPress={() => Linking.openSettings()} />
        )}

        {mostrarDuplicados && (
          <View style={styles.dupCard}>
            <Text style={styles.dupTitle}>¿Es alguna de estas?</Text>
            {cercanas.slice(0, 5).map((s) => (
              <TouchableOpacity key={s.store_id} style={styles.dupRow} onPress={() => {
                Alert.alert('Ya existe', 'Esa sucursal ya existe: búscala por su nombre en la lista');
                navigation.goBack();
              }}>
                <Text style={styles.dupName}>{s.name}</Text>
                <Text style={styles.dupDist}>{Math.round(s.distance_m)} m</Text>
              </TouchableOpacity>
            ))}
            <Button label="No, es otra" variant="ghost" onPress={() => setDupChecked(true)} />
          </View>
        )}

        <Button label="Guardar sucursal" onPress={guardar} loading={saving}
          disabled={!canSaveProposal({ name, lat: fix?.lat ?? null, lng: fix?.lng ?? null }) || !!mostrarDuplicados}
          style={styles.save} />
      </ScrollView>
      <CameraModal visible={camOpen} onCapture={(uri) => { setPhoto(uri); setCamOpen(false); }} onClose={() => setCamOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.bgSurface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 17, color: colors.textPrimary, ...fonts.bold },
  content: { padding: 16, paddingBottom: 40, gap: 6 },
  help: { fontSize: 13, color: colors.textSecondary, backgroundColor: colors.bgElevated, padding: 12, borderRadius: radii.sm, marginBottom: 8 },
  label: { fontSize: 13, color: colors.textSecondary, marginTop: 12, ...fonts.semibold },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bgSurface },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  chips: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSurface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, color: colors.textPrimary },
  chipTextOn: { color: colors.white, ...fonts.semibold },
  photo: { width: '100%', height: 180, borderRadius: radii.sm },
  fixText: { fontSize: 13, color: colors.success, marginTop: 6 },
  warn: { fontSize: 13, color: colors.warning, backgroundColor: colors.warningBg, padding: 10, borderRadius: radii.sm, marginTop: 6 },
  error: { fontSize: 13, color: colors.danger, marginTop: 6 },
  dupCard: { marginTop: 14, padding: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.warningBg, gap: 4 },
  dupTitle: { fontSize: 14, color: colors.textPrimary, ...fonts.bold, marginBottom: 4 },
  dupRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dupName: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  dupDist: { fontSize: 13, color: colors.textMuted },
  save: { marginTop: 20 },
});
