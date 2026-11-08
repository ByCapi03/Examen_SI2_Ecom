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
import { useAuth } from '../../context/AuthContext';
import { AuthResponse, RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC<Props> = ({ navigation, route }) => {
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Por favor completa los campos obligatorios (*).');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setShowActivationPrompt(false);

      const { data } = await api.post<AuthResponse>('/auth/register', {
        name: name.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim(),
        password: password.trim(),
        phone: phone.trim() || undefined,
      });

      await login(data.accessToken, data.user);
      
      const pendingReservation = route.params?.pendingReservation;
      if (pendingReservation) {
        navigation.replace('CreateReservation', pendingReservation);
      } else {
        navigation.navigate('MainTabs');
      }
    } catch (err: any) {
      const responseData = err.response?.data;
      if (responseData?.code === 'CLIENT_EXISTS_WITHOUT_DIGITAL_ACCOUNT') {
        setShowActivationPrompt(true);
        setError('Ya eres cliente de nuestra tienda. Debes activar tu cuenta digital.');
      } else {
        setError(responseData?.message || 'Error al intentar registrarse.');
      }
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
          <Text style={styles.title}>Crear Cuenta Digital</Text>
          <Text style={styles.subtitle}>Regístrate para realizar compras e interactuar con la tienda</Text>
        </View>

        {error && (
          <View style={[styles.errorBox, showActivationPrompt && styles.warningBox]}>
            <Text style={[styles.errorText, showActivationPrompt && styles.warningText]}>
              {error}
            </Text>
            {showActivationPrompt && (
              <Pressable
                style={styles.activateButton}
                onPress={() => navigation.navigate('ActivateAccount', { email: email.trim() })}
              >
                <Text style={styles.activateButtonText}>ACTIVAR MI CUENTA</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="María"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Gonzáles"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico *</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="70000000"
              keyboardType="phone-pad"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña *</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              placeholderTextColor={colors.muted}
            />
          </View>

          <Pressable
            style={[styles.registerButton, submitting && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={styles.registerButtonText}>Registrarme</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => navigation.navigate('Login', { pendingReservation: route.params?.pendingReservation })}>
            <Text style={styles.linkText}>
              ¿Ya tienes una cuenta? <Text style={styles.linkBold}>Inicia sesión</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
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
  warningBox: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  warningText: {
    color: colors.warning,
    fontWeight: '600',
    marginBottom: 10,
  },
  activateButton: {
    backgroundColor: colors.gold,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  activateButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
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
  registerButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  registerButtonText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
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
