import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDb } from '../store/localStore';
import { formatLogLine } from '../diagnostics/log';
import { colors, fonts } from '../theme';

export function DebugLogScreen() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const db = await getDb();
      const rows = await db.getAllAsync<{ ts: string; level: string; event: string; detail: string | null }>(
        `SELECT ts, level, event, detail FROM sync_log ORDER BY ts DESC LIMIT 300`,
      );
      setLines(rows.map(formatLogLine));
    })();
  }, []);
  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Diagnóstico</Text>
      <FlatList data={lines} keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Text style={styles.line}>{item}</Text>} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase, padding: 12 },
  title: { fontSize: 16, color: colors.textPrimary, ...fonts.bold, marginBottom: 8 },
  line: { fontSize: 11, color: colors.textSecondary, fontFamily: 'monospace', marginBottom: 2 },
});
