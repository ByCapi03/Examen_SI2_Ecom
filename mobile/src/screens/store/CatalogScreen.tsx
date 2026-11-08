import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { api } from '../../api/api';
import { ProductSummary } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { catalogRepository } from '../../database/catalog.repository';

export const CatalogScreen: React.FC<any> = ({ navigation }) => {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [onlyPromotions, setOnlyPromotions] = useState<boolean>(false);

  const categories = Array.from(new Set(products.map(p => p.categoryName).filter((val): val is string => Boolean(val)))).sort();
  const seasons = Array.from(new Set(products.map(p => p.seasonName).filter((val): val is string => Boolean(val)))).sort();
  const collections = Array.from(new Set(products.map(p => p.collectionName).filter((val): val is string => Boolean(val)))).sort();

  const filteredProducts = products.filter(p => {
    if (selectedCategory && p.categoryName !== selectedCategory) return false;
    if (selectedSeason && p.seasonName !== selectedSeason) return false;
    if (selectedCollection && p.collectionName !== selectedCollection) return false;
    if (onlyPromotions && !p.discount) return false;
    return true;
  });

  const fetchProducts = async () => {
    try {
      setError(null);
      // 1. Intentar obtener productos desde el backend
      const { data } = await api.get<ProductSummary[]>('/store/products');
      setProducts(data);
      setIsOfflineData(false);

      // 2. Persistir en SQLite en segundo plano
      catalogRepository.saveProducts(data).catch((err) =>
        console.error('[SQLite] Error guardando catálogo en segundo plano:', err)
      );
    } catch (err: any) {
      console.warn('[Catalog] Error de red. Intentando cargar desde SQLite local...', err.message);

      // 3. Fallback a SQLite cuando falla la red o está offline
      try {
        const localProducts = await catalogRepository.getAllProducts();
        const syncDate = await catalogRepository.getLastSyncDate();

        if (localProducts.length > 0) {
          setProducts(localProducts);
          setIsOfflineData(true);
          setLastSync(syncDate ? new Date(syncDate).toLocaleTimeString() : null);
        } else {
          setError('No hay productos disponibles sin conexión. Conéctate a internet para sincronizar.');
        }
      } catch (sqlErr) {
        console.error('[SQLite] Error leyendo productos locales:', sqlErr);
        setError('No se pudo cargar el catálogo. Intenta nuevamente.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const renderItem = ({ item }: { item: ProductSummary }) => {
    const formattedPrice = Number(item.price).toFixed(2);

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
      >
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderImage}>
              <Text style={styles.placeholderText}>Sin imagen</Text>
            </View>
          )}

          {item.discount && (
            <View style={styles.badgeDiscount}>
              <Text style={styles.badgeDiscountText}>
                {item.discount.type === 'PERCENTAGE'
                  ? `-${item.discount.value}%`
                  : `-$${item.discount.amount}`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.categoryName} numberOfLines={1}>
            {item.categoryName}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.priceContainer}>
            {item.discount ? (
              <>
                <Text style={styles.originalPrice}>${formattedPrice}</Text>
                <Text style={styles.finalPrice}>
                  ${Number(item.finalPrice).toFixed(2)}
                </Text>
              </>
            ) : (
              <Text style={styles.price}>${formattedPrice}</Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedSeason(null);
    setSelectedCollection(null);
    setOnlyPromotions(false);
  };

  const hasActiveFilters =
    Boolean(selectedCategory) ||
    Boolean(selectedSeason) ||
    Boolean(selectedCollection) ||
    onlyPromotions;

  return (
    <View style={styles.container}>
      {/* Banner de Modo Offline */}
      {isOfflineData && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Mostrando datos locales de SQLite (Modo Offline){lastSync ? ` · Sinc: ${lastSync}` : ''}
          </Text>
        </View>
      )}

      {/* Filter Horizontal Scroll */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {hasActiveFilters && (
            <Pressable style={styles.clearBadge} onPress={clearFilters}>
              <Text style={styles.clearBadgeText}>Limpiar (X)</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.filterChip, onlyPromotions && styles.activeFilterChip]}
            onPress={() => setOnlyPromotions(!onlyPromotions)}
          >
            <Text
              style={[
                styles.filterChipText,
                onlyPromotions && styles.activeFilterChipText,
              ]}
            >
              Ofertas
            </Text>
          </Pressable>

          {categories.map((c) => (
            <Pressable
              key={c}
              style={[
                styles.filterChip,
                selectedCategory === c && styles.activeFilterChip,
              ]}
              onPress={() =>
                setSelectedCategory(selectedCategory === c ? null : c)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCategory === c && styles.activeFilterChipText,
                ]}
              >
                {c}
              </Text>
            </Pressable>
          ))}

          {seasons.map((s) => (
            <Pressable
              key={s}
              style={[
                styles.filterChip,
                selectedSeason === s && styles.activeFilterChip,
              ]}
              onPress={() => setSelectedSeason(selectedSeason === s ? null : s)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSeason === s && styles.activeFilterChipText,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}

          {collections.map((col) => (
            <Pressable
              key={col}
              style={[
                styles.filterChip,
                selectedCollection === col && styles.activeFilterChip,
              ]}
              onPress={() =>
                setSelectedCollection(selectedCollection === col ? null : col)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedCollection === col && styles.activeFilterChipText,
                ]}
              >
                {col}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando catálogo...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={fetchProducts}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No se encontraron productos.</Text>
          {hasActiveFilters && (
            <Pressable style={styles.retryButton} onPress={clearFilters}>
              <Text style={styles.retryButtonText}>Limpiar Filtros</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  offlineBanner: {
    backgroundColor: '#374151',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: '#f9fafb',
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.sm,
    color: colors.muted,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.white,
  },
  filtersWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  filterScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.danger + '20',
    marginRight: 6,
  },
  clearBadgeText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
    marginRight: 6,
  },
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.muted,
  },
  activeFilterChipText: {
    color: colors.white,
    fontWeight: '600',
  },
  listContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  card: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: colors.cream,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    ...typography.caption,
    color: colors.muted,
  },
  badgeDiscount: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeDiscountText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '700',
  },
  cardInfo: {
    padding: spacing.sm,
  },
  categoryName: {
    ...typography.caption,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  productName: {
    ...typography.subtitle,
    fontSize: 14,
    marginVertical: 4,
    color: colors.text,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing.xs,
  },
  price: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  originalPrice: {
    ...typography.caption,
    textDecorationLine: 'line-through',
    color: colors.muted,
  },
  finalPrice: {
    ...typography.body,
    fontWeight: '700',
    color: colors.danger,
  },
});
