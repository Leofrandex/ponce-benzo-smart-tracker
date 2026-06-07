import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, fonts } from '../theme';
import { mockStores } from '../mock-data';

interface StorePickerSheetProps {
  visible: boolean;
  excludeStoreIds: string[];
  onPick: (storeId: string) => void;
  onClose: () => void;
}

export function StorePickerSheet({ visible, excludeStoreIds, onPick, onClose }: StorePickerSheetProps) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockStores
      .filter((s) => !excludeStoreIds.includes(s.store_id))
      .filter((s) => q === '' || s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q));
  }, [query, excludeStoreIds]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Agregar sucursal a la ruta</Text>
          <Text style={styles.subtitle}>Elegí una tienda del catálogo para reportarla hoy</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar tienda…"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView style={styles.list} bounces={false} keyboardShouldPersistTaps="handled">
            {results.map((store) => (
              <TouchableOpacity
                key={store.store_id}
                style={styles.row}
                onPress={() => { onPick(store.store_id); onClose(); setQuery(''); }}
                activeOpacity={0.7}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{store.name}</Text>
                  {store.address && <Text style={styles.rowAddr} numberOfLines={1}>{store.address}</Text>}
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </TouchableOpacity>
            ))}
            {results.length === 0 && (
              <Text style={styles.empty}>No hay tiendas que coincidan.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgSurface,
    borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: radii.full,
    backgroundColor: colors.border, marginBottom: 12,
  },
  title: { fontSize: 16, color: colors.textPrimary, ...fonts.bold },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.bgElevated, borderRadius: radii.sm,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, padding: 0 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, color: colors.textPrimary, ...fonts.semibold },
  rowAddr: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 24 },
});
