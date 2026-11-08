import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { api } from '../../api/api';
import { enqueue, isNetworkError } from '../../sync/syncService';
import { colors, radius, spacing, typography } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateReservation'>;

const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const getFormattedDateToDisplay = (d?: Date) => {
  if (!d) return 'Seleccionar fecha';
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
};

const getFormattedDateToSubmit = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getFormattedTimeToDisplayAndSubmit = (d?: Date) => {
  if (!d) return 'Seleccionar hora';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const CreateReservationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { productName, price, variantId, sizeName, colorName, branchId, branchName, quantity } = route.params;

  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<Date | undefined>(undefined);
  
  const { user } = useAuth();
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!date) {
      Alert.alert('Error', 'Por favor selecciona una fecha de recojo');
      return;
    }

    if (!user) {
      Alert.alert(
        'Inicia sesión para continuar',
        'Para completar tu reserva necesitas una cuenta.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'YA TENGO CUENTA', 
            onPress: () => {
              navigation.navigate('Login', { 
                pendingReservation: { ...route.params, date: date.toISOString(), time: time?.toISOString() } 
              });
            } 
          },
          { 
            text: 'CREAR CUENTA', 
            onPress: () => {
              navigation.navigate('Register', { 
                pendingReservation: { ...route.params, date: date.toISOString(), time: time?.toISOString() } 
              });
            } 
          },
        ]
      );
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/reservations', {
        branchId,
        date: getFormattedDateToSubmit(date),
        approximateTime: time ? getFormattedTimeToDisplayAndSubmit(time) : '',
        items: [
          { variantId, quantity }
        ],
        clientPlatform: 'mobile'
      });

      const { reservationId } = res.data;

      Alert.alert('Reserva Creada', 'Por favor procede a pagar para confirmar tu reserva.', [
        { 
          text: 'OK', 
          onPress: () => {
            navigation.popToTop();
            navigation.navigate('ReservationDetail', { reservationId });
          } 
        }
      ]);

    } catch (err: any) {
      if (isNetworkError(err)) {
        // Sin conexión: se guarda en SQLite y se sincroniza al recuperar la red
        try {
          const op = await enqueue('RESERVATION', {
            branchId,
            date: getFormattedDateToSubmit(date),
            approximateTime: time ? getFormattedTimeToDisplayAndSubmit(time) : undefined,
            items: [{ variantId, quantity }],
            clientPlatform: 'mobile',
          }, `Reserva ${productName} (${sizeName}/${colorName}) x${quantity} — ${branchName}`);
          Alert.alert(
            'Reserva guardada sin conexión',
            `Código ${op.operationId.slice(0, 8).toUpperCase()}. Se enviará automáticamente cuando vuelvas a tener Internet. ` +
            'Si hay stock, se apartará y podrás pagarla desde "Mis reservas".',
            [{ text: 'OK', onPress: () => navigation.popToTop() }],
          );
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo guardar la reserva sin conexión');
        }
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Error al crear la reserva');
      }
    } finally {
      setLoading(false);
    }
  };

  const formattedPrice = Number(price).toFixed(2);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Confirmar Reserva</Text>
        
        <View style={styles.summaryBox}>
          <Text style={styles.productName}>{productName}</Text>
          <Text style={styles.detailText}>Talla: {sizeName} | Color: {colorName}</Text>
          <Text style={styles.detailText}>Sucursal: {branchName}</Text>
          <Text style={styles.detailText}>Cantidad: {quantity}</Text>
          <Text style={styles.priceText}>Bs. {formattedPrice}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Fecha de recojo *</Text>
          <Pressable 
            style={styles.pickerButton} 
            onPress={() => {
              setShowDatePicker(true);
              setShowTimePicker(false);
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.icon} />
            <Text style={[styles.pickerText, !date && styles.placeholderText]}>
              {getFormattedDateToDisplay(date)}
            </Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date || new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') {
                setShowDatePicker(false);
              }
              if (event.type === 'set' && selectedDate) {
                setDate(selectedDate);
                if (Platform.OS === 'ios') setShowDatePicker(false);
              } else if (event.type === 'dismissed') {
                setShowDatePicker(false);
              }
            }}
          />
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Hora aproximada</Text>
          <Pressable 
            style={styles.pickerButton} 
            onPress={() => {
              setShowTimePicker(true);
              setShowDatePicker(false);
            }}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} style={styles.icon} />
            <Text style={[styles.pickerText, !time && styles.placeholderText]}>
              {getFormattedTimeToDisplayAndSubmit(time)}
            </Text>
          </Pressable>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={time || new Date()}
            mode="time"
            display="default"
            onChange={(event, selectedTime) => {
              if (Platform.OS === 'android') {
                setShowTimePicker(false);
              }
              if (event.type === 'set' && selectedTime) {
                setTime(selectedTime);
                if (Platform.OS === 'ios') setShowTimePicker(false);
              } else if (event.type === 'dismissed') {
                setShowTimePicker(false);
              }
            }}
          />
        )}

        <View style={{ marginTop: 10 }}>
          <Pressable 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Crear Reserva</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  summaryBox: {
    backgroundColor: colors.cream,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  productName: {
    ...typography.h3,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.body,
    color: colors.muted,
    marginBottom: 4,
  },
  priceText: {
    ...typography.subtitle,
    color: colors.gold,
    marginTop: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    fontWeight: 'bold',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  icon: {
    marginRight: spacing.sm,
  },
  pickerText: {
    ...typography.body,
    color: colors.text,
  },
  placeholderText: {
    color: colors.muted,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typography.subtitle,
    color: colors.white,
  },
  paymentOptionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  paymentOptionCardSelected30: {
    borderColor: '#17a2b8',
    backgroundColor: '#e0f7fa',
  },
  paymentOptionCardSelectedFull: {
    borderColor: '#28a745',
    backgroundColor: '#e8f5e9',
  },
  paymentOptionText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  paymentOptionPrice: {
    ...typography.subtitle,
    color: colors.text,
  }
});
