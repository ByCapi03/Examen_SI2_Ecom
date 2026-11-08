import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ActivateAccount'>;

export const ActivateAccountScreen: React.FC<Props> = ({ route, navigation }) => {
  const initialEmail = route.params?.email || '';

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 1: Request activation code
  const handleRequestCode = async () => {
    if (!email.trim()) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const { data } = await api.post('/auth/request-account-activation', {
        email: email.trim(),
      });

      setSuccessMessage(data.message || 'Código de activación enviado a tu correo.');
      setStep(2);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Error al solicitar el código de activación.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Activate account with code and password
  const handleActivateAccount = async () => {
    if (!code.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const { data } = await api.post('/auth/activate-account', {
        email: email.trim(),
        code: code.trim(),
        password: password.trim(),
      });

      setSuccessMessage(
        data.message || 'Cuenta activada correctamente. Ahora puedes iniciar sesión.'
      );
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Error al intentar activar la cuenta.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.cream }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Image
            source={require('../../../assets/ATEMPORAL.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Activar Cuenta Digital</Text>
          <Text style={styles.subtitle}>
            Si realizaste compras previas en tienda física, activa tu acceso digital.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {successMessage && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          {/* Step 1 Form */}
          {step === 1 && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo Electrónico del Cliente</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="ejemplo@correo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                style={[styles.primaryButton, submitting && { opacity: 0.7 }]}
                onPress={handleRequestCode}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.primaryButtonText}>Enviar Código de Activación</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Step 2 Form */}
          {step === 2 && !successMessage?.includes('correctamente') && (
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Código de Activación (6 dígitos)</Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nueva Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repite la contraseña"
                  secureTextEntry
                  placeholderTextColor={colors.muted}
                />
              </View>

              <Pressable
                style={[styles.primaryButton, submitting && { opacity: 0.7 }]}
                onPress={handleActivateAccount}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirmar y Activar Cuenta</Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Success Navigation Button */}
          {successMessage?.includes('correctamente') && (
            <View style={{ marginTop: spacing.md }}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.primaryButtonText}>Ir a Iniciar Sesión</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>
              ¿Ya activaste tu cuenta? <Text style={styles.linkBold}>Iniciar sesión</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.primary,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 240,
    height: 120,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.beige,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.cream,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  successText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  form: {
    gap: spacing.md,
  },
  inputGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.subtitle,
    color: colors.primaryDark,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: colors.beige,
  },
  linkBold: {
    color: colors.gold,
    fontWeight: '700',
  },
});
