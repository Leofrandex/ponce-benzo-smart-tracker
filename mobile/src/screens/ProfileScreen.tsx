import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { colors, radii, fonts } from '../theme';
import { VERSION_STAMP } from '../diagnostics/version';
import type { RootStackParamList } from '../navigation/AppNavigator';

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface StatCardProps {
  value: string | number;
  label: string;
}

function StatCard({ value, label }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<ProfileNavProp>();
  if (!user) return null;

  const initials = getInitials(user.full_name);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.fullName}>{user.full_name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard value="0" label="Visitas hoy" />
          <StatCard value="0" label="Esta semana" />
          <StatCard value="0" label="Completadas" />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID de usuario</Text>
            <Text style={styles.infoValue}>{user.id}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rol</Text>
            <Text style={styles.infoValue}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estado</Text>
            <Text style={[styles.infoValue, { color: colors.success }]}>Activo</Text>
          </View>
        </View>

        <Button
          label="Cerrar Sesión"
          onPress={signOut}
          variant="danger"
          style={styles.signOutBtn}
        />

        <TouchableOpacity onLongPress={() => navigation.navigate('DebugLog')} style={styles.versionStamp}>
          <Text style={styles.versionText}>{VERSION_STAMP}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    color: colors.textPrimary,
    ...fonts.extrabold,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    color: colors.white,
    ...fonts.bold,
  },
  fullName: {
    fontSize: 20,
    color: colors.textPrimary,
    ...fonts.bold,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 10,
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  roleText: {
    fontSize: 12,
    color: colors.accent,
    ...fonts.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    color: colors.accent,
    ...fonts.extrabold,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
    ...fonts.medium,
  },
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    ...fonts.medium,
  },
  infoValue: {
    fontSize: 13,
    color: colors.textPrimary,
    ...fonts.semibold,
    maxWidth: '60%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  signOutBtn: {
    marginTop: 4,
  },
  versionStamp: {
    marginTop: 24,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
});
