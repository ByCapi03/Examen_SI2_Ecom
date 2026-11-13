import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types';

/** Permite navegar desde fuera de los componentes (p. ej. al tocar una notificación push). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
