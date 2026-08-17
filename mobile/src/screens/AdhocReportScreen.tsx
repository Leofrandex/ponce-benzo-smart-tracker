import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StorePickerSheet } from '../components/StorePickerSheet';
import { fetchAllStores } from '../services/catalogApi';
import { useRouteCtx } from '../context/RouteContext';
import { colors, radii, fonts } from '../theme';
import type { Store } from '../types';

export function AdhocReportScreen() {
  const navigation = useNavigation<any>();
  const { startAdhocReport } = useRouteCtx();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAllStores()
      .then((s) => { if (alive) { setStores(s); setLoading(false); } })
      .catch(() => { if (alive) { setError('No se pudo cargar el catálogo de sucursales. Revisá tu conexión.'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  async function handlePick(storeId: string) {
    const store = stores.find((s) => s.store_id === storeId);
    if (!store || starting) return;
    setStarting(true);
    setError(null);
    try {
      await startAdhocReport(store);
      navigation.navigate('CheckIn', { store });
    } catch {
      setError('No se pudo abrir el reporte. Verificá la conexión y el permiso de ubicación.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Reporte suelto</Text>
        <Text style={styles.subtitle}>
          Reportá cualquier sucursal, esté o no en tu ruta de hoy. El GPS se enciende
          mientras dure el reporte.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <TouchableOpacity style={styles.cta} onPress={() => setPickerOpen(true)} activeOpacity={0.8} disabled={starting}>
          <Ionicons name="search" size={18} color={colors.white} />
          <Text style={styles.ctaLabel}>{starting ? 'Abriendo…' : 'Buscar sucursal'}</Text>
        </TouchableOpacity>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <StorePickerSheet
        visible={pickerOpen}
        stores={stores}
        excludeStoreIds={[]}
        onPick={handlePick}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase, padding: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, color: colors.textPrimary, ...fonts.bold },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  loader: { marginTop: 24 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 15,
  },
  ctaLabel: { fontSize: 15, color: colors.white, ...fonts.semibold },
  error: { fontSize: 13, color: colors.danger, marginTop: 14, ...fonts.medium },
});
