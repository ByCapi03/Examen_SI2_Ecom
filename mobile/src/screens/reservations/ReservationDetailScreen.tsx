import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../../api/api';
import { ReservationDetail, RootStackParamList } from '../../types';
import { useStripe } from '@stripe/stripe-react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'ReservationDetail'>;

export const ReservationDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { reservationId } = route.params;

  const [reservation, setReservation] = useState<ReservationDetail | any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'TARJETA' | 'QR' | 'BILLETERA_MOVIL'>('TARJETA');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get<ReservationDetail>(`/reservations/my/${reservationId}`);
      setReservation(data);
    } catch (err: any) {
      console.error('Error fetching reservation detail:', err);
      setError(err.response?.data?.message || 'Reserva no encontrada');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [reservationId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (pendingPayment && paymentStatus !== 'APROBADO' && paymentStatus !== 'RECHAZADO') {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/payments/${pendingPayment.paymentId}/status`);
          if (res.data.status === 'APROBADO') {
            setPaymentStatus('APROBADO');
            clearInterval(interval);
            setTimeout(() => {
              setPendingPayment(null);
              setPaymentStatus(null);
              fetchDetail();
            }, 2000);
          } else if (res.data.status === 'RECHAZADO' || res.data.expired) {
            setPaymentStatus('RECHAZADO');
            clearInterval(interval);
            Alert.alert('Pago rechazado', 'El pago fue rechazado o ha expirado.');
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pendingPayment, paymentStatus]);

  const handleCancelReservation = async () => {
    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro de que deseas cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await api.patch(`/reservations/my/${reservationId}/cancel`);
              await fetchDetail();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'No se pudo cancelar la reserva.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paying, setPaying] = useState(false);
  const [validating, setValidating] = useState(false);

  const handlePay = async (paymentOption: 'DEPOSIT_30' | 'FULL') => {
    if (paymentMethod === 'BILLETERA_MOVIL' && !phoneNumber) {
       Alert.alert('Error', 'Ingresa tu número de celular para la billetera móvil');
       return;
    }

    try {
      setPaying(true);

      if (paymentMethod === 'QR') {
        const resPayment = await api.post(`/payments/qr`, {
          reservationId,
          paymentOption,
          clientPlatform: 'mobile'
        });
        setPendingPayment(resPayment.data);
        setPaymentStatus('PENDIENTE');
        setPaying(false);
        return;
      }

      if (paymentMethod === 'BILLETERA_MOVIL') {
        const resPayment = await api.post(`/payments/mobile-wallet`, {
          reservationId,
          paymentOption,
          phoneNumber,
          clientPlatform: 'mobile'
        });
        setPendingPayment(resPayment.data);
        setPaymentStatus('PENDIENTE');
        setPaying(false);
        return;
      }

      const res = await api.post(`/reservations/${reservationId}/create-payment`, {
        paymentOption,
        clientPlatform: 'mobile',
      });

      const { clientSecret } = res.data;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Atemporal',
        paymentIntentClientSecret: clientSecret,
      });

      if (initError) {
        Alert.alert('Error', 'No se pudo iniciar la pasarela de pago');
        setPaying(false);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          Alert.alert('Cancelado', 'El pago fue cancelado');
        } else {
          Alert.alert('Error', presentError.message || 'Error al procesar el pago');
        }
        setPaying(false);
        return;
      }

      setValidating(true);
      Alert.alert('Éxito', 'Pago enviado. Validando con el servidor...');
      
      // Poll to check status
      const interval = setInterval(async () => {
        try {
          // Primero reconciliamos forzando al backend a consultar Stripe
          const reconcileResponse = await api.post(`/reservations/${reservationId}/reconcile-payment`);
          console.log('[RECONCILE RESPONSE]', reconcileResponse.status, reconcileResponse.data);

          // Luego obtenemos el estado actualizado
          const checkRes = await api.get<ReservationDetail>(`/reservations/my/${reservationId}`);
          console.log('[REFRESHED RESERVATION]', checkRes.data);
          
          const isConfirmed = checkRes.data.status === 'CONFIRMADA';
          const isPaidOrPartial = checkRes.data.paymentSummary?.paymentState === 'PARCIAL' || checkRes.data.paymentSummary?.paymentState === 'PAGADO';

          if (isConfirmed && isPaidOrPartial) {
            clearInterval(interval);
            setReservation(checkRes.data);
            setValidating(false);
          }
        } catch (e) {
          console.error(e);
        }
      }, 3000);

      // Stop polling after 30 seconds just in case
      setTimeout(() => {
        clearInterval(interval);
        setValidating(false);
        fetchDetail();
      }, 30000);

    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Error al generar intención de pago');
    } finally {
      setPaying(false);
    }
  };

  const handleSimulate = async (action: 'approve' | 'reject') => {
    if (!pendingPayment) return;
    try {
      await api.post(`/payments/${pendingPayment.paymentId}/simulate/${action}`);
    } catch(e:any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0056b3" />
        <Text style={styles.loadingText}>Cargando detalle de reserva...</Text>
      </View>
    );
  }

  if (error || !reservation) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Reserva no encontrada'}</Text>
      </View>
    );
  }

  const isCancellable =
    reservation.status !== 'CANCELADA' && 
    reservation.status !== 'ATENDIDA' && 
    (!reservation.paymentSummary || reservation.paymentSummary.paidAmount === 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>Reserva #{reservation.id}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{reservation.status}</Text>
          </View>
        </View>

        <View style={styles.metaList}>
          <Text style={styles.metaItem}>
            <Text style={styles.bold}>Sucursal:</Text> {reservation.branch?.name}
          </Text>
          <Text style={styles.metaItem}>
            <Text style={styles.bold}>Fecha de recojo:</Text> {reservation.date}
          </Text>
          {reservation.approximateTime && (
            <Text style={styles.metaItem}>
              <Text style={styles.bold}>Hora estimada:</Text> {reservation.approximateTime}
            </Text>
          )}
        </View>
      </View>

      {/* Items Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Productos Reservados</Text>

        {reservation.items.map((item: any) => {
          const product = item.variant?.product;
          const colorName = item.variant?.color?.name || '';
          const sizeName = item.variant?.size?.name || '';

          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemImageContainer}>
                {product?.imageUrl ? (
                  <Image source={{ uri: product.imageUrl }} style={styles.itemImage} />
                ) : (
                  <View style={styles.itemImagePlaceholder}>
                    <Text style={{ fontSize: 10, color: '#aaa' }}>Sin imagen</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemInfo}>
                <Text style={styles.productName}>{product?.name || 'Producto'}</Text>
                <Text style={styles.variantDetails}>
                  Talla: {sizeName} | Color: {colorName}
                </Text>
                <Text style={styles.quantityText}>Cantidad: {item.quantity} u.</Text>
              </View>
            </View>
          );
        })}
      </View>
      {/* Payment Section */}
      {reservation.paymentSummary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Pago</Text>
          <View style={styles.paymentSummaryBox}>
            <Text style={styles.metaItem}><Text style={styles.bold}>Total:</Text> Bs. {reservation.paymentSummary.total}</Text>
            {reservation.paymentSummary.paymentState !== 'PENDIENTE' && (
              <Text style={styles.metaItem}><Text style={styles.bold}>Pagado:</Text> Bs. {reservation.paymentSummary.paidAmount}</Text>
            )}
            {reservation.paymentSummary.paymentState === 'PARCIAL' && (
              <Text style={styles.metaItem}><Text style={styles.bold}>Saldo pendiente:</Text> Bs. {reservation.paymentSummary.remainingAmount}</Text>
            )}
            <Text style={styles.metaItem}>
              <Text style={styles.bold}>Estado:</Text>{' '}
              <Text style={{ 
                color: reservation.paymentSummary.paymentState === 'PAGADO' ? '#28a745' : 
                       reservation.paymentSummary.paymentState === 'PARCIAL' ? '#fd7e14' : '#666',
                fontWeight: 'bold'
              }}>
                {reservation.paymentSummary.paymentState === 'PAGADO' ? 'PAGO COMPLETO' : reservation.paymentSummary.paymentState}
              </Text>
            </Text>
          </View>
          
          {(reservation.paymentSummary.paymentState === 'PENDIENTE' && reservation.status === 'PENDIENTE') || 
           (reservation.paymentSummary.paymentState === 'PARCIAL' && reservation.status === 'CONFIRMADA') ? (
            <View style={styles.actionContainer}>
              {pendingPayment ? (
                <View style={styles.pendingContainer}>
                  {paymentStatus === 'APROBADO' && <Text style={{color:'green', fontSize: 16, fontWeight: 'bold'}}>PAGO APROBADO</Text>}
                  {paymentStatus === 'RECHAZADO' && <Text style={{color:'red', fontSize: 16, fontWeight: 'bold'}}>PAGO RECHAZADO</Text>}
                  {paymentStatus === 'PENDIENTE' && (
                    <>
                      <Text style={{color:'#0056b3', fontSize: 16, fontWeight: 'bold', marginBottom: 10}}>Esperando confirmación...</Text>
                      {paymentMethod === 'QR' && (
                        <View style={{alignItems: 'center'}}>
                          <Text>Escanea este código QR:</Text>
                          <Image source={{ uri: pendingPayment.qrImage }} style={{ width: 200, height: 200, marginVertical: 10 }} />
                          <Text>Monto: Bs. {pendingPayment.amount}</Text>
                          <Text>Ref: {pendingPayment.reference}</Text>
                        </View>
                      )}
                      {paymentMethod === 'BILLETERA_MOVIL' && (
                        <View style={{alignItems: 'center'}}>
                          <Text>Solicitud enviada a tu billetera ({phoneNumber}).</Text>
                          <Text>Monto: Bs. {pendingPayment.amount}</Text>
                          <Text>Ref: {pendingPayment.reference}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                        <Pressable style={[styles.payButton, {flex: 1, backgroundColor: '#28a745'}]} onPress={() => handleSimulate('approve')}>
                          <Text style={styles.payButtonText}>Simular Aprob.</Text>
                        </Pressable>
                        <Pressable style={[styles.payButton, {flex: 1, backgroundColor: '#dc3545'}]} onPress={() => handleSimulate('reject')}>
                          <Text style={styles.payButtonText}>Simular Rechazo</Text>
                        </Pressable>
                      </View>
                      <Pressable style={{marginTop: 10, padding: 10}} onPress={() => { setPendingPayment(null); setPaymentStatus(null); }}>
                        <Text style={{color: '#0056b3', textAlign: 'center'}}>Cancelar</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : validating ? (
                <View style={[styles.cancelButton, { backgroundColor: '#ffc107', marginTop: 10 }]}>
                   <ActivityIndicator color="#000" />
                   <Text style={[styles.cancelButtonText, { color: '#000', marginTop: 5 }]}>Validando pago...</Text>
                </View>
              ) : (
                <>
                  <View style={{ marginBottom: 15 }}>
                    <Text style={styles.sectionTitle}>Método de Pago</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                      <Pressable style={[styles.methodBtn, paymentMethod === 'TARJETA' && styles.methodBtnActive]} onPress={() => setPaymentMethod('TARJETA')}>
                        <Text style={[styles.methodBtnText, paymentMethod === 'TARJETA' && styles.methodBtnTextActive]}>Tarjeta</Text>
                      </Pressable>
                      <Pressable style={[styles.methodBtn, paymentMethod === 'QR' && styles.methodBtnActive]} onPress={() => setPaymentMethod('QR')}>
                        <Text style={[styles.methodBtnText, paymentMethod === 'QR' && styles.methodBtnTextActive]}>QR</Text>
                      </Pressable>
                      <Pressable style={[styles.methodBtn, paymentMethod === 'BILLETERA_MOVIL' && styles.methodBtnActive]} onPress={() => setPaymentMethod('BILLETERA_MOVIL')}>
                        <Text style={[styles.methodBtnText, paymentMethod === 'BILLETERA_MOVIL' && styles.methodBtnTextActive]}>Billetera</Text>
                      </Pressable>
                    </View>
                    {paymentMethod === 'BILLETERA_MOVIL' && (
                      <TextInput
                        style={styles.input}
                        placeholder="Número de celular"
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                      />
                    )}
                  </View>

                  {reservation.paymentSummary.paymentState === 'PENDIENTE' && (
                    <Pressable
                      style={[styles.payButton, paying && { opacity: 0.7 }]}
                      onPress={() => handlePay('DEPOSIT_30')}
                      disabled={paying}
                    >
                      <Text style={styles.payButtonText}>PAGAR 30% (Reserva)</Text>
                    </Pressable>
                  )}

                  <Pressable
                    style={[styles.payButton, styles.payFullButton, paying && { opacity: 0.7 }]}
                    onPress={() => handlePay('FULL')}
                    disabled={paying}
                  >
                    <Text style={styles.payButtonText}>
                      {reservation.paymentSummary.paymentState === 'PARCIAL' ? 'PAGAR SALDO PENDIENTE' : 'PAGAR COMPLETO'}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>
      )}
      {/* Cancel Action */}
      {isCancellable && (
        <View style={styles.actionContainer}>
          <Pressable
            style={[styles.cancelButton, cancelling && { opacity: 0.7 }]}
            onPress={handleCancelReservation}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.cancelButtonText}>CANCELAR RESERVA</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 16,
    textAlign: 'center',
  },
  headerCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  statusBadge: {
    backgroundColor: '#0056b3',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  metaList: {
    gap: 6,
  },
  metaItem: {
    fontSize: 14,
    color: '#444',
  },
  bold: {
    fontWeight: '600',
    color: '#1a1a1a',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginBottom: 10,
    gap: 14,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  variantDetails: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0056b3',
  },
  actionContainer: {
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentSummaryBox: {
    backgroundColor: '#f4f6f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  payButton: {
    backgroundColor: '#0056b3',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  payFullButton: {
    backgroundColor: '#28a745',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  methodBtnActive: {
    borderColor: '#0056b3',
    backgroundColor: '#e6f2ff',
  },
  methodBtnText: {
    color: '#555',
    fontWeight: '600',
  },
  methodBtnTextActive: {
    color: '#0056b3',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginTop: 5,
  },
  pendingContainer: {
    padding: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  }
});
