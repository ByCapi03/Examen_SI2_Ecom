import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Dimensions, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, CameraView } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { RootStackParamList } from '../../types';
import { api } from '../../api/api';
import { colors, spacing, typography, radius } from '../../theme/theme';

// Fix for Expo 51+ where Camera.Constants was removed, but tfjs still expects it
if (!(Camera as any).Constants) {
  (Camera as any).Constants = {
    Type: {
      front: 'front',
      back: 'back',
    },
  };
}

const TensorCamera = cameraWithTensors(CameraView as any);
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SMOOTHING_FACTOR = 0.5;

type Props = NativeStackScreenProps<RootStackParamList, 'TryOn'>;

export const TryOnScreen: React.FC<Props> = ({ route, navigation }) => {
  const { variantId } = route.params;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [productConfig, setProductConfig] = useState<any>(null);

  const [overlayStyles, setOverlayStyles] = useState<any>({});
  const [hud, setHud] = useState('Buscando a la persona…');
  const hudRef = useRef('');
  const [imageError, setImageError] = useState(false);
  // Al salir se desmonta primero la cámara (GL) y recién después se cierra la pantalla: así la cámara no sigue
  // pintando sobre una superficie ya liberada (provocaba "Error during updateTexImage" y cerraba la app).
  const [closing, setClosing] = useState(false);
  const leaveAction = useRef<any>(null);

  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const isDetecting = useRef(false);
  const previousKeypoints = useRef<{ [name: string]: any }>({});
  const unmounted = useRef(false);
  
  // Animation frame ref to be able to cancel it
  const requestAnimationFrameId = useRef<number>(0);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (leaveAction.current) return; // ya se está cerrando: dejar salir
      e.preventDefault();
      leaveAction.current = e.data.action;
      unmounted.current = true;
      if (requestAnimationFrameId.current) cancelAnimationFrame(requestAnimationFrameId.current);
      setClosing(true);
      setTimeout(() => navigation.dispatch(e.data.action), 350);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    unmounted.current = false;
    
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');

        if (status !== 'granted') {
          return;
        }

        const res = await api.get(`/store/try-on/${variantId}`);
        setProductConfig(res.data);
        
        await tf.ready();
        
        const model = poseDetection.SupportedModels.MoveNet;
        const detectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        };
        detectorRef.current = await poseDetection.createDetector(model, detectorConfig);
        
        if (!unmounted.current) setModelReady(true);
      } catch (err) {
        console.error('TryOn init error:', err);
        if (!unmounted.current) {
          Alert.alert('Error', 'No se pudo inicializar la cámara o el modelo de IA.');
        }
      } finally {
        if (!unmounted.current) setLoadingConfig(false);
      }
    })();

    return () => {
      unmounted.current = true;
      if (requestAnimationFrameId.current) {
        cancelAnimationFrame(requestAnimationFrameId.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
      }
    };
  }, [variantId]);

  // En algunos teléfonos Android la imagen del tensor llega girada respecto a la pantalla y la IA no reconoce a la
  // persona (confianza ~0.1). Si tras varios cuadros no hay hombros claros se prueba otro giro y se conserva el que funcione.
  const ROTATIONS = [0, 90, 270, 180];
  const rotIdx = useRef(0);
  const badFrames = useRef(0);
  const goodFrames = useRef(0);
  const rotLocked = useRef(false);

  const rotateTensor = (t: tf.Tensor3D, deg: number): tf.Tensor3D => {
    if (deg === 0) return t;
    return tf.tidy(() => {
      if (deg === 90) return tf.reverse(tf.transpose(t, [1, 0, 2]), 1) as tf.Tensor3D; // horario
      if (deg === 270) return tf.reverse(tf.transpose(t, [1, 0, 2]), 0) as tf.Tensor3D; // antihorario
      return tf.reverse(t, [0, 1]) as tf.Tensor3D;
    });
  };

  /** Devuelve un punto detectado en la imagen girada a las coordenadas del tensor original, ya espejado (cámara frontal). */
  const mapKeypoint = (kp: any, deg: number, W: number, H: number) => {
    let x = kp.x;
    let y = kp.y;
    if (deg === 90) { x = kp.y; y = H - 1 - kp.x; }
    else if (deg === 270) { x = W - 1 - kp.y; y = kp.x; }
    else if (deg === 180) { x = W - 1 - kp.x; y = H - 1 - kp.y; }
    return { ...kp, x: W - x, y };
  };

  const nextRotation = () => {
    rotIdx.current = (rotIdx.current + 1) % ROTATIONS.length;
    badFrames.current = 0;
    goodFrames.current = 0;
    previousKeypoints.current = {};
    detectorRef.current?.reset?.();
  };

  const handleCameraStream = (images: IterableIterator<tf.Tensor3D>) => {
    const loop = async () => {
      if (unmounted.current) return;
      if (isDetecting.current) {
        requestAnimationFrameId.current = requestAnimationFrame(loop);
        return;
      }

      const imageTensor = images.next().value;
      if (!imageTensor) {
        requestAnimationFrameId.current = requestAnimationFrame(loop);
        return;
      }

      let rotated: tf.Tensor3D | null = null;
      try {
        isDetecting.current = true;
        if (detectorRef.current) {
          const deg = ROTATIONS[rotIdx.current];
          const [H, W] = imageTensor.shape;
          rotated = rotateTensor(imageTensor, deg);
          const poses = await detectorRef.current.estimatePoses(rotated as any);

          if (poses && poses.length > 0) {
            const mapped = { ...poses[0], keypoints: poses[0].keypoints.map((k) => mapKeypoint(k, deg, W, H)) };
            const byName = (n: string) => mapped.keypoints.find((k) => k.name === n)?.score ?? 0;
            const shoulderScore = Math.min(byName('left_shoulder'), byName('right_shoulder'));

            if (shoulderScore >= 0.35) {
              goodFrames.current += 1;
              badFrames.current = 0;
              if (goodFrames.current >= 3) rotLocked.current = true;
            } else if (shoulderScore < 0.3) {
              goodFrames.current = 0;
              badFrames.current += 1;
              // Sin giro fijado: tras 8 cuadros malos se prueba el siguiente. Con giro fijado: tras ~4 s sin verte se reintenta.
              if (badFrames.current >= (rotLocked.current ? 60 : 8)) { rotLocked.current = false; nextRotation(); }
            }
            updateOverlay(mapped as any);
          } else {
            setOverlayStyles({});
          }
        }
      } catch (err) {
        // ignore occasional tensor errors
      } finally {
        if (rotated && rotated !== imageTensor) tf.dispose(rotated);
        tf.dispose(imageTensor);
        isDetecting.current = false;
        requestAnimationFrameId.current = requestAnimationFrame(loop);
      }
    };
    loop();
  };

  const updateOverlay = (pose: poseDetection.Pose) => {
    if (!pose.keypoints) return;

    // Apply EWMA smoothing
    const keypoints = pose.keypoints.map(kp => {
      if (!kp.name) return kp;
      const prev = previousKeypoints.current[kp.name];
      if (prev && kp.score && kp.score >= 0.35) {
        kp.x = prev.x * (1 - SMOOTHING_FACTOR) + kp.x * SMOOTHING_FACTOR;
        kp.y = prev.y * (1 - SMOOTHING_FACTOR) + kp.y * SMOOTHING_FACTOR;
      }
      
      if (kp.score && kp.score >= 0.35) {
        previousKeypoints.current[kp.name] = { ...kp };
      } else {
        delete previousKeypoints.current[kp.name];
      }
      return kp;
    });

    const findKP = (name: string) => keypoints.find(k => k.name === name);

    const leftShoulder = findKP('left_shoulder');
    const rightShoulder = findKP('right_shoulder');
    const leftHipRaw = findKP('left_hip');
    const rightHipRaw = findKP('right_hip');
    const leftHip = leftHipRaw;
    const rightHip = rightHipRaw;
    const leftKnee = findKP('left_knee');
    const rightKnee = findKP('right_knee');
    const leftAnkle = findKP('left_ankle');
    const rightAnkle = findKP('right_ankle');

    const leftElbow = findKP('left_elbow');
    const rightElbow = findKP('right_elbow');

    const productData = productConfig?.product;
    const arType = productData?.arType;
    const isArticulated = productData?.arTorsoUrl && productData?.arLeftSleeveUrl && productData?.arRightSleeveUrl;

    // We need to map tensor coordinates (which depend on camera resolution) to screen coordinates
    // However, TensorCamera output might not match screen dimensions perfectly, we'll assume it scales to fill
    // For simplicity, we just use raw tensor coordinates if we configure tensor size to match screen aspect ratio,
    // or scale them. Let's assume tensor is mapped.
    
    // We will use relative ratios based on standard tensor size (e.g. 152x200 or whatever it outputs).
    // Let's assume keypoints are in Tensor dimensions. 
    // To be precise, we need the tensor dimensions. We will pass a fixed size to TensorCamera.
    const tensorWidth = 360;
    const tensorHeight = Math.floor((360 / SCREEN_W) * SCREEN_H);
    
    const scaleX = SCREEN_W / tensorWidth;
    const scaleY = SCREEN_H / tensorHeight;

    const toScreenX = (x: number) => x * scaleX;
    const toScreenY = (y: number) => y * scaleY;

    const newStyles: any = {};

    // Umbral más bajo que el de los demás puntos: sentado o con algo delante, MoveNet rara vez pasa de 0.3 en los hombros
    const SHOULDER_MIN = 0.2;
    const HIP_MIN = 0.25;
    const shouldersVisible = !!(leftShoulder?.score && leftShoulder.score > SHOULDER_MIN && rightShoulder?.score && rightShoulder.score > SHOULDER_MIN);
    const hipsVisible = !!(leftHipRaw?.score && leftHipRaw.score > HIP_MIN && rightHipRaw?.score && rightHipRaw.score > HIP_MIN);
    const sc = (k: any) => (k?.score ?? 0).toFixed(2);
    const hudNext = `${shouldersVisible ? '✓' : '✗'} hombros (${sc(leftShoulder)}/${sc(rightShoulder)}) · ${hipsVisible ? '✓' : '✗'} caderas · giro ${ROTATIONS[rotIdx.current]}°${rotLocked.current ? ' fijo' : ''}`;
    if (hudRef.current !== hudNext) { hudRef.current = hudNext; setHud(hudNext); }

    if (arType === 'TOP') {
      if (shouldersVisible) {
        // Con la cámara frontal de cerca casi nunca se ven las caderas: si faltan se estiman bajo los hombros.
        const estShoulderW = Math.abs(leftShoulder!.x - rightShoulder!.x);
        const estimateHip = (sh: any) => ({ x: sh.x, y: sh.y + estShoulderW * 1.6, score: 1 });
        const leftHip = hipsVisible ? leftHipRaw! : estimateHip(leftShoulder);
        const rightHip = hipsVisible ? rightHipRaw! : estimateHip(rightShoulder);
        
        const shoulderWidth = Math.abs(toScreenX(leftShoulder.x) - toScreenX(rightShoulder.x));
        const centerX = toScreenX((leftShoulder.x + rightShoulder.x) / 2);
        const topY = toScreenY(Math.min(leftShoulder.y, rightShoulder.y));
        const bottomY = toScreenY(Math.max(leftHip.y, rightHip.y));

        const width = shoulderWidth * 2.1; // Padding increased
        const height = (bottomY - topY) * 1.5;

        if (isArticulated) {
          newStyles.torso = {
            opacity: 1,
            position: 'absolute',
            left: centerX - width / 2,
            top: topY - height * 0.1,
            width,
            height,
            zIndex: 999,
            elevation: 999,
          };

          const drawSleeve = (shoulder: any, elbow: any, hip: any, isLeft: boolean) => {
            let ex, ey;
            if (elbow?.score && elbow.score > 0.35) {
              ex = toScreenX(elbow.x);
              ey = toScreenY(elbow.y);
            } else {
              const hx = toScreenX(hip.x) - toScreenX(shoulder.x);
              const hy = toScreenY(hip.y) - toScreenY(shoulder.y);
              const hlen = Math.hypot(hx, hy) || 1;
              const sLen = hlen * 0.4;
              ex = toScreenX(shoulder.x) + (hx / hlen) * sLen;
              ey = toScreenY(shoulder.y) + (hy / hlen) * sLen;
            }

            const sx = toScreenX(shoulder.x);
            const sy = toScreenY(shoulder.y);
            const dx = ex - sx;
            const dy = ey - sy;
            let angle = Math.atan2(dy, dx);
            const length = Math.hypot(dx, dy);

            const sWidth = length * 1.3;
            const sHeight = sWidth * 0.4;
            const overlap = sWidth * 0.15; // 15% overlap on the shoulder

            let leftEdge;
            let pivotOffsetX;

            if (isLeft) {
              // Left sleeve: base is on the left edge.
              leftEdge = sx - overlap;
              pivotOffsetX = sWidth / 2 - overlap;
            } else {
              // Right sleeve: base is on the right edge.
              angle = angle - Math.PI;
              leftEdge = sx - sWidth + overlap;
              pivotOffsetX = -(sWidth / 2 - overlap);
            }

            return {
              opacity: 1,
              position: 'absolute',
              left: leftEdge,
              top: sy - sHeight / 2,
              width: sWidth,
              height: sHeight,
              transform: [
                { translateX: -pivotOffsetX },
                { rotate: `${angle}rad` },
                { translateX: pivotOffsetX }
              ],
              zIndex: 998,
              elevation: 998,
            };
          };

          newStyles.leftSleeve = drawSleeve(leftShoulder, leftElbow, leftHip, true);
          newStyles.rightSleeve = drawSleeve(rightShoulder, rightElbow, rightHip, false);
        } else {
          newStyles.rigid = {
            opacity: 1,
            position: 'absolute',
            left: centerX - width / 2,
            top: topY - height * 0.1,
            width,
            height,
            zIndex: 999,
            elevation: 999,
          };
        }
        setOverlayStyles(newStyles);
      } else {
        setOverlayStyles({});
      }
    } else if (arType === 'BOTTOM') {
      // Si no se ven las caderas o las rodillas se estiman desde los hombros (la cámara frontal rara vez las muestra)
      if (hipsVisible || shouldersVisible) {
        const estShoulderW = shouldersVisible ? Math.abs(leftShoulder!.x - rightShoulder!.x) : 0;
        const estimateHip = (sh: any) => ({ x: sh.x, y: sh.y + estShoulderW * 1.6, score: 1 });
        const bLeftHip: any = hipsVisible ? leftHipRaw! : estimateHip(leftShoulder);
        const bRightHip: any = hipsVisible ? rightHipRaw! : estimateHip(rightShoulder);

        const hipWidth = Math.abs(toScreenX(bLeftHip.x) - toScreenX(bRightHip.x));
        const centerX = toScreenX((bLeftHip.x + bRightHip.x) / 2);
        const topY = toScreenY(Math.min(bLeftHip.y, bRightHip.y));

        let bottomY = topY + hipWidth * 3; // fallback
        if (leftAnkle?.score && leftAnkle.score > 0.35 && rightAnkle?.score && rightAnkle.score > 0.35) {
          bottomY = toScreenY(Math.max(leftAnkle.y, rightAnkle.y));
        } else if (leftKnee?.score && leftKnee.score > 0.35 && rightKnee?.score && rightKnee.score > 0.35) {
          bottomY = toScreenY(Math.max(leftKnee.y, rightKnee.y)) + hipWidth * 1.8;
        }

        const width = hipWidth * 2.3;
        const height = (bottomY - topY) * 1.2;

        newStyles.rigid = {
          opacity: 1,
          position: 'absolute',
          left: centerX - width / 2,
          top: topY,
          width,
          height,
          zIndex: 999,
          elevation: 999,
        };
        setOverlayStyles(newStyles);
      } else {
        setOverlayStyles({});
      }
    } else if (arType === 'DRESS') {
      // Con la cámara frontal casi nunca se ven las caderas: si faltan se estiman bajo los hombros (como en la blusa).
      if (shouldersVisible) {
        const estShoulderW = Math.abs(leftShoulder!.x - rightShoulder!.x);
        const estimateHip = (sh: any) => ({ x: sh.x, y: sh.y + estShoulderW * 1.6, score: 1 });
        const dLeftHip: any = hipsVisible ? leftHipRaw! : estimateHip(leftShoulder);
        const dRightHip: any = hipsVisible ? rightHipRaw! : estimateHip(rightShoulder);

        const shoulderWidth = Math.abs(toScreenX(leftShoulder!.x) - toScreenX(rightShoulder!.x));
        const centerX = toScreenX((leftShoulder!.x + rightShoulder!.x) / 2);
        const topY = toScreenY(Math.min(leftShoulder!.y, rightShoulder!.y));
        const torsoHeight = toScreenY(Math.max(dLeftHip.y, dRightHip.y)) - topY;

        let bottomY = topY + torsoHeight * 2.5; // fallback
        if (leftKnee?.score && leftKnee.score > 0.35 && rightKnee?.score && rightKnee.score > 0.35) {
          bottomY = toScreenY(Math.max(leftKnee.y, rightKnee.y));
        }

        const width = shoulderWidth * 2.1;
        const height = (bottomY - topY) * 1.25;

        newStyles.rigid = {
          opacity: 1,
          position: 'absolute',
          left: centerX - width / 2,
          top: topY - height * 0.05,
          width,
          height,
          zIndex: 999,
          elevation: 999,
        };
        setOverlayStyles(newStyles);
      } else {
        setOverlayStyles({});
      }
    }
  };

  if (hasPermission === null || loadingConfig) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Iniciando Vestidor Virtual...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No tenemos acceso a la cámara.</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (!modelReady || !productConfig) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Cargando modelo de IA...</Text>
      </View>
    );
  }

  const tensorWidth = 360;
  const tensorHeight = Math.floor((360 / SCREEN_W) * SCREEN_H);

  return (
    <View style={styles.container}>
      {!closing && <TensorCamera
        style={styles.camera}
        facing="front"
        type="front"
        cameraTextureHeight={1920}
        cameraTextureWidth={1080}
        resizeHeight={tensorHeight}
        resizeWidth={tensorWidth}
        resizeDepth={3}
        onReady={handleCameraStream}
        autorender={true}
        useCustomShadersToResize={false}
      />}

      {overlayStyles.torso && productConfig.product?.arTorsoUrl && (
        <Image 
          source={{ uri: productConfig.product.arTorsoUrl }} 
          style={overlayStyles.torso}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      )}
      {overlayStyles.leftSleeve && productConfig.product?.arLeftSleeveUrl && (
        <Image 
          source={{ uri: productConfig.product.arLeftSleeveUrl }} 
          style={overlayStyles.leftSleeve}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      )}
      {overlayStyles.rightSleeve && productConfig.product?.arRightSleeveUrl && (
        <Image 
          source={{ uri: productConfig.product.arRightSleeveUrl }} 
          style={overlayStyles.rightSleeve}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      )}
      {overlayStyles.rigid && productConfig.product?.arImageUrl && (
        <Image 
          source={{ uri: productConfig.product.arImageUrl }} 
          style={overlayStyles.rigid}
          resizeMode="contain"
          onError={() => setImageError(true)}
        />
      )}

      <SafeAreaView style={styles.hudBox} edges={['top']} pointerEvents="none">
        <Text style={styles.hudText}>{hud}</Text>
        {!(productConfig.product?.arTorsoUrl || productConfig.product?.arImageUrl) ? (
          <Text style={styles.hudWarn}>Este producto no tiene imagen para el vestidor: súbela en el panel web (Productos, imagen AR).</Text>
        ) : null}
        {!productConfig.product?.arType ? (
          <Text style={styles.hudWarn}>Este producto no tiene tipo de prenda (blusa, falda o vestido): defínelo en el panel web para que se pueda probar.</Text>
        ) : null}
        {imageError ? <Text style={styles.hudWarn}>No se pudo descargar la imagen de la prenda.</Text> : null}
        {shouldersHint(hud) ? <Text style={styles.hudWarn}>Aléjate un poco para que se vean tus hombros.</Text> : null}
      </SafeAreaView>

      <SafeAreaView style={styles.overlayControls} edges={['bottom']}>
        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeBtnText}>Cerrar Vestidor</Text>
        </Pressable>
        <Text style={styles.infoText}>
          Mostrando: {productConfig.product?.name} ({productConfig.product?.arType})
        </Text>
      </SafeAreaView>
    </View>
  );
};

const shouldersHint = (hud: string) => hud.startsWith('✗');

const styles = StyleSheet.create({
  hudBox: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 4, paddingTop: 8, zIndex: 2000, elevation: 2000 },
  hudText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
  hudWarn: { color: '#fff', backgroundColor: 'rgba(185,28,28,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, textAlign: 'center', marginHorizontal: 16, overflow: 'hidden' },
  container: { flex: 1, backgroundColor: 'black' },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
    padding: spacing.xl,
  },
  camera: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
    color: colors.primary,
  },
  errorText: {
    ...typography.h3,
    color: colors.danger,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  overlayControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 2000,
    elevation: 2000,
  },
  closeBtn: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  closeBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoText: {
    ...typography.caption,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.xs,
    borderRadius: radius.sm,
  }
});
