import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { PushDiagnostics } from '../../components/PushDiagnostics';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarBox}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Cliente ATEMPORAL'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>

        <View style={styles.activeBadge}>
          <Text style={styles.activeBadgeText}>Cuenta digital activa</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Información de la Cuenta</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nombre Completo</Text>
          <Text style={styles.infoValue}>{user?.name}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Correo Electrónico</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Rol de Usuario</Text>
          <Text style={styles.infoValue}>
            {user?.roles ? user.roles.join(', ') : 'CLIENTE'}
          </Text>
        </View>
      </View>

      <PushDiagnostics />

      <View style={styles.logoutContainer}>
        <Pressable style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.cream,
    flexGrow: 1,
  },
  avatarBox: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarLetter: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: '800',
  },
  userName: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  activeBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  activeBadgeText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xxl,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  infoRow: {
    marginBottom: spacing.md,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  logoutContainer: {
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
  logoutButton: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#feb2b2',
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
});
