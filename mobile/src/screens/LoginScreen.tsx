import React, { useState } from 'react';
import {
  View, Text, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { colors, radii, fonts } from '../theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Completá todos los campos.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) setError(err);
    } catch (e) {
      setError('Error inesperado. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.logoBlock}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoInitials}>PB</Text>
          </View>
          <Text style={styles.brand}>Ponce & Benzo</Text>
          <Text style={styles.tagline}>Smart Tracker</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="usuario@poncebenzo.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, styles.passInput]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button label="Entrar" onPress={handleLogin} loading={loading} style={styles.loginBtn} />

          <Text style={styles.hint}>Demo: czurita@ponce-benzo.com</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgBase },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoInitials: {
    fontSize: 26,
    color: colors.white,
    ...fonts.extrabold,
  },
  brand: {
    fontSize: 22,
    color: colors.textPrimary,
    ...fonts.extrabold,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    ...fonts.medium,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  card: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    ...fonts.bold,
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    ...fonts.semibold,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeBtn: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: colors.border,
    borderTopRightRadius: radii.sm,
    borderBottomRightRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeText: {
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    ...fonts.medium,
  },
  loginBtn: {
    marginTop: 4,
  },
  hint: {
    marginTop: 14,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
