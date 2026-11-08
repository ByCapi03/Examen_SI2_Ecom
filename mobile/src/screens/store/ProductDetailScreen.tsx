import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { ProductDetail, BranchAvailability, RootStackParamList } from '../../types';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { useCart } from '../../context/CartContext';
import { catalogRepository } from '../../database/catalog.repository';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export const ProductDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productId } = route.params;

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineProduct, setIsOfflineProduct] = useState(false);

  // Selection state
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);

  // Store availability state
  const [availabilities, setAvailabilities] = useState<BranchAvailability[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsOfflineProduct(false);
        const { data } = await api.get<ProductDetail>(`/store/products/${productId}`);
        setProduct(data);
        // Guardar detalle y variantes en SQLite en segundo plano
        catalogRepository.saveProductDetail(data).catch(e =>
          console.error('[SQLite] Error guardando detalle en SQLite:', e)
        );
      } catch (err: any) {
        console.warn('[ProductDetail] Error de red. Buscando en SQLite...', err.message);
        try {
          const localDetail = await catalogRepository.getProductDetail(productId);
          if (localDetail) {
            setProduct(localDetail);
            setIsOfflineProduct(true);
          } else {
            setError('Producto no disponible sin conexión');
          }
        } catch (sqlErr) {
          setError('Producto no encontrado o no disponible');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  // Derived unique colors and sizes based on current selection to enforce validity
  const getAvailableColors = () => {
    if (!product) return [];
    if (!selectedSizeId) {
      return Array.from(new Set(product.variants.map((v) => v.colorId))).map(
        (cid) => product.variants.find((v) => v.colorId === cid)!
      );
    }
    return product.variants.filter((v) => v.sizeId === selectedSizeId);
  };

  const getAvailableSizes = () => {
    if (!product) return [];
    if (!selectedColorId) {
      return Array.from(new Set(product.variants.map((v) => v.sizeId))).map(
        (sid) => product.variants.find((v) => v.sizeId === sid)!
      );
    }
    return product.variants.filter((v) => v.colorId === selectedColorId);
  };

  const uniqueColors = getAvailableColors().filter(
    (v, i, a) => a.findIndex((t) => t.colorId === v.colorId) === i
  );
  const uniqueSizes = getAvailableSizes().filter(
    (v, i, a) => a.findIndex((t) => t.sizeId === v.sizeId) === i
  );

  // Find selected variant
  const selectedVariant = product?.variants.find(
    (v) => v.colorId === selectedColorId && v.sizeId === selectedSizeId
  );

  const selectedColorVariant = product?.variants.find(
    (v) => v.colorId === selectedColorId
  );

  useEffect(() => {
    if (selectedVariant) {
      const fetchAvailability = async () => {
        try {
          setLoadingAvailability(true);
          setAvailabilities([]);
          setSelectedBranchId(null);
          setQuantity(1);
          const { data } = await api.get<BranchAvailability[]>(
            `/store/availability/${selectedVariant.id}`
          );
          setAvailabilities(data);
        } catch (err) {
          console.error('Error fetching store availability:', err);
        } finally {
          setLoadingAvailability(false);
        }
      };
      fetchAvailability();
    } else {
      setAvailabilities([]);
      setSelectedBranchId(null);
      setQuantity(1);
    }
  }, [selectedVariant]);

  const selectedBranchAvailability = availabilities.find(b => b.branchId === selectedBranchId);
  const maxAvailable = selectedBranchAvailability ? selectedBranchAvailability.available : 0;

  const handleReserve = () => {
    if (!product || !selectedVariant || !selectedBranchId || !selectedBranchAvailability) return;
    if (isOfflineProduct) {
      Alert.alert(
        'Modo Sin Conexión',
        'Para realizar una reserva es obligatorio contar con conexión a internet para confirmar stock con la sucursal.'
      );
      return;
    }
    route.params; // keep reference happy
    navigation.navigate('CreateReservation', {
      productId: product.id,
      productName: product.name,
      price: product.finalPrice,
      variantId: selectedVariant.id,
      sizeName: selectedVariant.sizeName,
      colorName: selectedVariant.colorName,
      branchId: selectedBranchId,
      branchName: selectedBranchAvailability.branchName,
      quantity
    });
  };

  const { addToCart } = useCart();

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !selectedBranchId || !selectedBranchAvailability) return;

    const result = addToCart(
      {
        productId: product.id,
        variantId: selectedVariant.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        size: selectedVariant.sizeName,
        color: selectedVariant.colorName,
        price: Number(product.finalPrice),
        quantity,
        available: maxAvailable
      },
      selectedBranchId,
      selectedBranchAvailability.branchName
    );

    if (result.success) {
      Alert.alert('Éxito', 'Agregado al carrito');
    } else {
      Alert.alert('Atención', result.message || 'No se pudo agregar al carrito');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando detalle del producto...</Text>
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Producto no encontrado'}</Text>
      </View>
    );
  }

  const formattedPrice = Number(product.price).toFixed(2);
  const isActionDisabled = !selectedVariant || !selectedBranchId || quantity < 1 || maxAvailable < quantity;

  const currentImageUrl = selectedVariant?.previewImageUrl || selectedColorVariant?.previewImageUrl || product.imageUrl;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Banner de Modo Offline */}
      {isOfflineProduct && (
        <View style={{ backgroundColor: '#374151', paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: '#f9fafb', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
            Estás viendo datos guardados en SQLite (Modo Offline). La disponibilidad por sucursal requiere conexión.
          </Text>
        </View>
      )}

      {/* Product Image */}
      <View style={styles.imageContainer}>
        {currentImageUrl ? (
          <Image
            source={{ uri: currentImageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>Imagen del Producto</Text>
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={styles.infoContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
          <Text style={styles.categoryText}>{product.categoryName}</Text>
          {product.collectionName && (
            <Text style={{ ...typography.caption, color: colors.gold }}>• {product.collectionName}</Text>
          )}
          {product.seasonName && (
            <Text style={{ ...typography.caption, color: colors.gold }}>• {product.seasonName}</Text>
          )}
        </View>
        <Text style={styles.nameText}>{product.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
          <Text style={styles.priceText}>Bs. {Number(product.finalPrice).toFixed(2)}</Text>
          {product.discount && (
            <>
              <Text style={{ ...typography.body, textDecorationLine: 'line-through', color: colors.muted }}>
                Bs. {Number(product.basePrice).toFixed(2)}
              </Text>
              <View style={{ backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                  {product.discount.type === 'PERCENTAGE' ? `-${product.discount.value}%` : `-Bs. ${product.discount.value}`}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Color Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Color: <Text style={{ fontWeight: 'normal' }}>{uniqueColors.find(c => c.colorId === selectedColorId)?.colorName || 'Seleccione un color'}</Text>
          </Text>
          <View style={styles.optionsRow}>
            {uniqueColors.map((v) => {
              const isSelected = selectedColorId === v.colorId;
              const bgColor = v.colorHexCode || colors.cream;
              return (
                <Pressable
                  key={`color-${v.colorId}`}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: bgColor },
                    isSelected && styles.colorSwatchSelected
                  ]}
                  onPress={() =>
                    setSelectedColorId(selectedColorId === v.colorId ? null : v.colorId)
                  }
                >
                  {!v.colorHexCode && (
                    <Text style={{ fontSize: 10, textAlign: 'center', color: colors.primary }}>
                      {v.colorName.substring(0, 3)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Size Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Talla</Text>
          <View style={styles.optionsRow}>
            {uniqueSizes.map((v) => {
              const isSelected = selectedSizeId === v.sizeId;
              return (
                <Pressable
                  key={`size-${v.sizeId}`}
                  style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                  onPress={() =>
                    setSelectedSizeId(selectedSizeId === v.sizeId ? null : v.sizeId)
                  }
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {v.sizeName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Store Availability Section */}
        {selectedColorId && selectedSizeId && (
          <View style={styles.availabilitySection}>
            <Text style={styles.availabilityTitle}>Disponibilidad en Tiendas</Text>

            {loadingAvailability ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 10 }} />
            ) : availabilities.length === 0 ? (
              <Text style={styles.noStockText}>
                Sin stock disponible para esta combinación.
              </Text>
            ) : (
              <View>
                {availabilities.map((b) => (
                  <Pressable 
                    key={b.branchId} 
                    style={[styles.branchCard, selectedBranchId === b.branchId && styles.branchCardSelected]}
                    onPress={() => {
                      setSelectedBranchId(b.branchId);
                      setQuantity(1);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.branchName, selectedBranchId === b.branchId && styles.branchNameSelected]}>{b.branchName}</Text>
                      <Text style={styles.cityName}>{b.cityName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.availableCount}>
                        Disponible: {b.available} u.
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              b.status === 'AVAILABLE' ? colors.primary : '#fcf8e3',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: b.status === 'AVAILABLE' ? colors.cream : '#8a6d3b',
                            },
                          ]}
                        >
                          {b.status === 'AVAILABLE' ? 'Disponible' : 'Pocas Unidades'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ))}

                {/* Quantity Selector */}
                {selectedBranchId && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={{ ...typography.subtitle, color: colors.primaryDark, marginBottom: spacing.xs }}>Cantidad</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' }}>
                        <Pressable 
                          onPress={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: '#f0f0f0' }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>-</Text>
                        </Pressable>
                        <Text style={{ paddingHorizontal: spacing.lg, fontSize: 16, fontWeight: 'bold' }}>{quantity}</Text>
                        <Pressable 
                          onPress={() => setQuantity(q => Math.min(maxAvailable, q + 1))}
                          disabled={quantity >= maxAvailable}
                          style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: '#f0f0f0' }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>+</Text>
                        </Pressable>
                      </View>
                      <Text style={{ ...typography.caption, color: colors.muted }}>(Máximo: {maxAvailable})</Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                  <Pressable 
                    disabled={isActionDisabled}
                    onPress={handleAddToCart}
                    style={[styles.reserveButton, { backgroundColor: colors.gold }, isActionDisabled && styles.reserveButtonDisabled]}
                  >
                    <Text style={[styles.reserveButtonText, { color: colors.primaryDark }]}>Agregar al carrito</Text>
                  </Pressable>

                  <Pressable 
                    disabled={isActionDisabled}
                    onPress={handleReserve}
                    style={[styles.reserveButton, { marginTop: 0 }, isActionDisabled && styles.reserveButtonDisabled]}
                  >
                    <Text style={styles.reserveButtonText}>Comprar ahora (Reserva)</Text>
                  </Pressable>

                  {product.arEnabled && product.arImageUrl && product.arType && selectedVariant && (
                    <Pressable 
                      onPress={() => navigation.navigate('TryOn', { variantId: selectedVariant.id })}
                      style={[styles.reserveButton, { backgroundColor: '#e2d5ed', marginTop: 0 }]}
                    >
                      <Text style={[styles.reserveButtonText, { color: colors.primary }]}>✨ PROBAR EN VESTIDOR</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cream,
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cream,
  },
  loadingText: {
    marginTop: spacing.md,
    ...typography.body,
    color: colors.muted,
  },
  errorText: {
    ...typography.h3,
    color: colors.danger,
    textAlign: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 360,
    backgroundColor: colors.white,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    ...typography.body,
    color: colors.muted,
  },
  infoContainer: {
    padding: spacing.xl,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    marginTop: -20,
  },
  categoryText: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  nameText: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  priceText: {
    ...typography.h3,
    color: colors.gold,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  optionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  optionText: {
    ...typography.body,
    color: colors.primary,
  },
  optionTextSelected: {
    fontWeight: '700',
    color: colors.cream,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2,
    borderColor: colors.gold,
  },
  availabilitySection: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  availabilityTitle: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  noStockText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  branchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  branchCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.cream,
  },
  branchName: {
    ...typography.subtitle,
    color: colors.primary,
  },
  branchNameSelected: {
    fontWeight: 'bold',
  },
  cityName: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
  },
  availableCount: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reserveButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  reserveButtonDisabled: {
    opacity: 0.5,
  },
  reserveButtonText: {
    ...typography.subtitle,
    color: colors.white,
  },
});
