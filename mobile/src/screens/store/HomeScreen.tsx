import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/api';
import { colors, radius, spacing, typography } from '../../theme/theme';

export const HomeScreen: React.FC<any> = ({ navigation }) => {
  const { user, isAuthenticated, logout } = useAuth();
  
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const isCliente = user?.roles?.includes('CLIENTE');

  useEffect(() => {
    const fetchRecs = async () => {
      if (!isAuthenticated || !isCliente) return;
      try {
        setLoadingRecs(true);
        const { data } = await api.get('/intelligence/recommendations/my?branchId=1&limit=4');
        setRecommendations(data.recommendations || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingRecs(false);
      }
    };
    fetchRecs();
  }, [isAuthenticated, isCliente]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerBox}>
        <Image
          source={require('../../../assets/ATEMPORAL.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandSubtitle}>Moda que trasciende épocas.</Text>
      </View>

      {isAuthenticated ? (
        <View style={styles.userCard}>
          <Text style={styles.welcomeText}>¡Hola, {user?.name}!</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
      ) : (
        <View style={styles.guestCard}>
          <Text style={styles.guestText}>Bienvenido a nuestra tienda digital</Text>
          <Text style={styles.guestSubtext}>Inicia sesión para disfrutar de la experiencia completa.</Text>
        </View>
      )}

      {/* RECOMENDACIONES IA */}
      {isAuthenticated && isCliente && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.sectionTitle}>Recomendado para ti ✨</Text>
          
          {loadingRecs ? (
            <ActivityIndicator size="large" color={colors.gold} style={{ marginVertical: 20 }} />
          ) : recommendations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recsScroll}>
              {recommendations.map(rec => (
                <Pressable 
                  key={rec.product.id} 
                  style={styles.recCard}
                  onPress={() => navigation.navigate('CatalogTab', { screen: 'ProductDetail', params: { productId: rec.product.id } })}
                >
                  <View style={styles.recImageContainer}>
                    {rec.product.imageUrl ? (
                      <Image source={{ uri: rec.product.imageUrl }} style={styles.recImage} />
                    ) : (
                      <View style={styles.recImagePlaceholder} />
                    )}
                    {rec.product.discount && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>-{rec.product.discount.percentage}%</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.recName} numberOfLines={2}>{rec.product.name}</Text>
                  <Text style={styles.recPrice}>Bs. {Number(rec.product.finalPrice).toFixed(2)}</Text>
                  <Text style={styles.recReason} numberOfLines={2}>"{rec.reason}"</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noRecsText}>Aún no tenemos recomendaciones personalizadas.</Text>
          )}
        </View>
      )}

      <View style={styles.actionContainer}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('CatalogTab')}
        >
          <Text style={styles.primaryButtonText}>Ver Catálogo</Text>
        </Pressable>

        {!isAuthenticated ? (
          <>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryButtonText}>Iniciar Sesión</Text>
            </Pressable>

            <Pressable
              style={styles.outlineButton}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.outlineButtonText}>Crear Cuenta</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.dangerButton} onPress={logout}>
            <Text style={styles.dangerButtonText}>Cerrar Sesión</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.cream,
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoImage: {
    width: 280,
    height: 140,
    marginBottom: spacing.sm,
  },
  brandSubtitle: {
    ...typography.subtitle,
    color: colors.muted,
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  welcomeText: {
    ...typography.h3,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  userEmail: {
    ...typography.body,
    color: colors.muted,
  },
  guestCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  guestText: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  guestSubtext: {
    ...typography.body,
    color: colors.muted,
    textAlign: 'center',
  },
  actionContainer: {
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.cream,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  outlineButton: {
    backgroundColor: colors.transparent,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#feb2b2',
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  recommendationsContainer: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  recsScroll: {
    flexDirection: 'row',
  },
  recCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginRight: spacing.md,
    width: 160,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recImageContainer: {
    width: '100%',
    height: 140,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: '#f0f0f0',
  },
  recImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e1e1e1',
  },
  discountBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  recName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 4,
  },
  recPrice: {
    ...typography.body,
    color: colors.danger,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recReason: {
    fontSize: 12,
    color: colors.gold,
    fontStyle: 'italic',
  },
  noRecsText: {
    ...typography.body,
    color: colors.muted,
    fontStyle: 'italic',
  }
});
