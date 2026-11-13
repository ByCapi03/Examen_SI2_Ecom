import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Camera, CameraView } from 'expo-camera';
import * as tf from '@tensorflow/tfjs';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { RootStackParamList } from '../../types';
import { api } from '../../api/api';
import { colors, spacing, typography, radius } from '../../theme/theme';

/**
 * Vestidor virtual.
 *
 * La vista previa es la cámara nativa (proporciones correctas). La IA (MoveNet) analiza fotos pequeñas tomadas en
 * silencio una tras otra: llegan bien orientadas y sin deformar en cualquier teléfono, a diferencia de leer la textura
 * de la cámara por OpenGL (que en Android entregaba la imagen deformada y la IA no reconocía a la persona).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'TryOn'>;
type Pt = { x: number; y: number; score: number };
type Styles = Record<string, any>;

const SHOULDER_MIN = 0.25; // confianza mínima para considerar visibles los hombros
const POINT_MIN = 0.3; // resto de puntos (caderas, rodillas, codos, tobillos)
const SMOOTHING = 0.6; // 1 = sin suavizado

const seen = (p?: Pt) => !!p && p.score > POINT_MIN;

export const TryOnScreen: React.FC<Props> = ({ route, navigation }) => {
  const { variantId } = route.params;

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [product, setProduct] = useState<any>(null);
  const [overlay, setOverlay] = useState<Styles>({});
  const [hud, setHud] = useState('Buscando a la persona…');
  const [imageError, setImageError] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);

  const cameraRef = useRef<CameraView>(null);
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  const layout = useRef({ width: 0, height: 0 });
  const prev = useRef<Record<string, Pt>>({});
  const productRef = useRef<any>(null);

  // 1) Permiso de cámara, datos de la prenda y modelo de IA
  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (!mounted.current) return;
        setHasPermission(status === 'granted');
        if (status !== 'granted') return;

        const res = await api.get(`/store/try-on/${variantId}`);
        productRef.current = res.data?.product;
        setProduct(res.data?.product);

        await tf.ready();
        detectorRef.current = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        });
      } catch (err: any) {
        console.error('TryOn init error:', err?.message ?? err);
        if (mounted.current) setLoadError('No se pudo iniciar el vestidor (cámara, prenda o modelo de IA). Revisa la conexión e inténtalo de nuevo.');
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    return () => {
      mounted.current = false;
      running.current = false;
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, [variantId]);

  // 2) Cámara lista: se elige una foto pequeña (rápida de analizar) y empieza el ciclo de detección
  const onCameraReady = async () => {
    try {
      const sizes = (await cameraRef.current?.getAvailablePictureSizesAsync()) ?? [];
      const parsed = sizes
        .map((s) => { const [w, h] = s.split('x').map(Number); return { s, px: w * h, min: Math.min(w, h) }; })
        .filter((o) => o.min >= 360 && Number.isFinite(o.px))
        .sort((a, b) => a.px - b.px);
      if (parsed.length) setPictureSize(parsed[0].s);
    } catch {
      // si el teléfono no informa tamaños, se usa el predeterminado
    }
    if (!running.current) {
      running.current = true;
      detectLoop();
    }
  };

  const detectLoop = async () => {
    while (running.current && mounted.current) {
      const camera = cameraRef.current;
      const detector = detectorRef.current;
      if (!camera || !detector) { await sleep(200); continue; }
      let image: tf.Tensor3D | null = null;
      try {
        const pic = await camera.takePictureAsync({ base64: true, quality: 0.5, shutterSound: false, skipProcessing: false });
        if (!pic?.base64 || !running.current) continue;
        image = decodeJpeg(tf.util.encodeString(pic.base64, 'base64'), 3);
        const [h, w] = image.shape;
        const poses = await detector.estimatePoses(image);
        if (!running.current) break;
        if (poses?.length) updateOverlay(poses[0], w, h);
        else { setOverlay({}); setHudOnce('Buscando a la persona…'); }
      } catch {
        await sleep(300); // la cámara puede fallar un cuadro (p. ej. al salir); se reintenta
      } finally {
        if (image) tf.dispose(image);
      }
    }
  };

  const hudRef = useRef('');
  const setHudOnce = (text: string) => { if (hudRef.current !== text) { hudRef.current = text; setHud(text); } };

  // 3) Puntos de la foto -> pantalla. La vista previa llena la pantalla recortando (cover) y la cámara frontal se ve espejada.
  const toScreen = (kp: poseDetection.Keypoint, imgW: number, imgH: number): Pt => {
    const { width: W, height: H } = layout.current;
    const scale = Math.max(W / imgW, H / imgH);
    const offX = (W - imgW * scale) / 2;
    const offY = (H - imgH * scale) / 2;
    return { x: W - (kp.x * scale + offX), y: kp.y * scale + offY, score: kp.score ?? 0 };
  };

  const updateOverlay = (pose: poseDetection.Pose, imgW: number, imgH: number) => {
    const pts: Record<string, Pt> = {};
    for (const kp of pose.keypoints) {
      if (!kp.name) continue;
      const p = toScreen(kp, imgW, imgH);
      const old = prev.current[kp.name];
      if (old && p.score > POINT_MIN) { p.x = old.x + (p.x - old.x) * SMOOTHING; p.y = old.y + (p.y - old.y) * SMOOTHING; }
      if (p.score > POINT_MIN) prev.current[kp.name] = p; else delete prev.current[kp.name];
      pts[kp.name] = p;
    }

    const lS = pts.left_shoulder, rS = pts.right_shoulder;
    const lHraw = pts.left_hip, rHraw = pts.right_hip;
    const shoulders = !!lS && !!rS && lS.score > SHOULDER_MIN && rS.score > SHOULDER_MIN;
    const hips = seen(lHraw) && seen(rHraw);
    setHudOnce(`${shoulders ? '✓' : '✗'} hombros (${(lS?.score ?? 0).toFixed(2)}/${(rS?.score ?? 0).toFixed(2)}) · ${hips ? '✓' : '✗'} caderas`);

    const prod = productRef.current;
    const type = prod?.arType;
    const shoulderW = shoulders ? Math.abs(lS.x - rS.x) : 0;
    // Con la cámara frontal casi nunca se ven las caderas: si faltan se estiman bajo los hombros
    const hipFrom = (sh: Pt): Pt => ({ x: sh.x, y: sh.y + shoulderW * 1.6, score: 1 });
    const lH = hips ? lHraw : shoulders ? hipFrom(lS) : undefined;
    const rH = hips ? rHraw : shoulders ? hipFrom(rS) : undefined;
    const box = (left: number, top: number, width: number, height: number, z = 999) =>
      ({ position: 'absolute', left, top, width, height, zIndex: z, elevation: z });

    const next: Styles = {};
    if (type === 'TOP' && shoulders && lH && rH) {
      const centerX = (lS.x + rS.x) / 2;
      const topY = Math.min(lS.y, rS.y);
      const bottomY = Math.max(lH.y, rH.y);
      const width = shoulderW * 2.1;
      const height = (bottomY - topY) * 1.5;
      const articulated = prod?.arTorsoUrl && prod?.arLeftSleeveUrl && prod?.arRightSleeveUrl;
      if (articulated) {
        next.torso = box(centerX - width / 2, topY - height * 0.1, width, height);
        next.leftSleeve = sleeve(lS, pts.left_elbow, lH, true);
        next.rightSleeve = sleeve(rS, pts.right_elbow, rH, false);
      } else {
        next.rigid = box(centerX - width / 2, topY - height * 0.1, width, height);
      }
    } else if (type === 'BOTTOM' && lH && rH) {
      const hipW = Math.abs(lH.x - rH.x) || shoulderW;
      const centerX = (lH.x + rH.x) / 2;
      const topY = Math.min(lH.y, rH.y);
      let bottomY = topY + hipW * 3;
      if (seen(pts.left_ankle) && seen(pts.right_ankle)) bottomY = Math.max(pts.left_ankle.y, pts.right_ankle.y);
      else if (seen(pts.left_knee) && seen(pts.right_knee)) bottomY = Math.max(pts.left_knee.y, pts.right_knee.y) + hipW * 1.8;
      const width = hipW * 2.3;
      next.rigid = box(centerX - width / 2, topY, width, (bottomY - topY) * 1.2);
    } else if (type === 'DRESS' && shoulders && lH && rH) {
      const centerX = (lS.x + rS.x) / 2;
      const topY = Math.min(lS.y, rS.y);
      const torso = Math.max(lH.y, rH.y) - topY;
      let bottomY = topY + torso * 2.5;
      if (seen(pts.left_knee) && seen(pts.right_knee)) bottomY = Math.max(pts.left_knee.y, pts.right_knee.y);
      const width = shoulderW * 2.1;
      const height = (bottomY - topY) * 1.25;
      next.rigid = box(centerX - width / 2, topY - height * 0.05, width, height);
    }
    setOverlay(next);
  };

  /** Manga: rectángulo girado desde el hombro hacia el codo (o hacia la cadera si no se ve el codo). */
  const sleeve = (shoulder: Pt, elbow: Pt | undefined, hip: Pt, isLeft: boolean) => {
    let ex: number, ey: number;
    if (seen(elbow)) { ex = elbow!.x; ey = elbow!.y; }
    else {
      const hx = hip.x - shoulder.x, hy = hip.y - shoulder.y, len = Math.hypot(hx, hy) || 1;
      ex = shoulder.x + (hx / len) * len * 0.4; ey = shoulder.y + (hy / len) * len * 0.4;
    }
    const dx = ex - shoulder.x, dy = ey - shoulder.y;
    let angle = Math.atan2(dy, dx);
    const w = Math.hypot(dx, dy) * 1.3, h = w * 0.4, overlap = w * 0.15;
    let left: number, pivot: number;
    if (isLeft) { left = shoulder.x - overlap; pivot = w / 2 - overlap; }
    else { angle -= Math.PI; left = shoulder.x - w + overlap; pivot = -(w / 2 - overlap); }
    return {
      position: 'absolute', left, top: shoulder.y - h / 2, width: w, height: h, zIndex: 998, elevation: 998,
      transform: [{ translateX: -pivot }, { rotate: `${angle}rad` }, { translateX: pivot }],
    };
  };

  const close = () => { running.current = false; navigation.goBack(); };

  // ── Pantallas de estado
  if (hasPermission === null || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Iniciando vestidor virtual…</Text>
      </View>
    );
  }
  if (hasPermission === false || loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError ?? 'No tenemos acceso a la cámara.'}</Text>
        <Pressable style={styles.backBtn} onPress={close}><Text style={styles.backBtnText}>Volver</Text></Pressable>
      </View>
    );
  }

  const garmentUrl = (key: string) => product?.[key] as string | undefined;
  const garment = (key: 'torso' | 'leftSleeve' | 'rightSleeve' | 'rigid', url?: string) =>
    overlay[key] && url ? (
      <Image key={key} source={{ uri: url }} style={overlay[key]} resizeMode="contain" onError={() => setImageError(true)} />
    ) : null;

  return (
    <View style={styles.container} onLayout={(e: LayoutChangeEvent) => { layout.current = e.nativeEvent.layout; }}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        animateShutter={false}
        pictureSize={pictureSize}
        onCameraReady={onCameraReady}
      />

      {garment('torso', garmentUrl('arTorsoUrl'))}
      {garment('leftSleeve', garmentUrl('arLeftSleeveUrl'))}
      {garment('rightSleeve', garmentUrl('arRightSleeveUrl'))}
      {garment('rigid', garmentUrl('arImageUrl'))}

      <SafeAreaView style={styles.hudBox} edges={['top']} pointerEvents="none">
        <Text style={styles.hudText}>{hud}</Text>
        {!product?.arType ? <Text style={styles.hudWarn}>Este producto no tiene tipo de prenda (blusa, falda o vestido): defínelo en el panel web.</Text> : null}
        {!(product?.arTorsoUrl || product?.arImageUrl) ? <Text style={styles.hudWarn}>Este producto no tiene imagen para el vestidor: súbela en el panel web.</Text> : null}
        {imageError ? <Text style={styles.hudWarn}>No se pudo descargar la imagen de la prenda.</Text> : null}
        {hud.startsWith('✗') ? <Text style={styles.hudWarn}>Aléjate un poco para que se vean tus hombros.</Text> : null}
      </SafeAreaView>

      <SafeAreaView style={styles.controls} edges={['bottom']}>
        <Pressable style={styles.closeBtn} onPress={close}><Text style={styles.closeBtnText}>Cerrar vestidor</Text></Pressable>
        <Text style={styles.infoText}>Mostrando: {product?.name} ({product?.arType ?? 'sin tipo'})</Text>
      </SafeAreaView>
    </View>
  );
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: spacing.xl },
  loadingText: { ...typography.body, marginTop: spacing.md, color: colors.primary },
  errorText: { ...typography.h3, color: colors.danger, marginBottom: spacing.lg, textAlign: 'center' },
  backBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.sm, width: '100%', alignItems: 'center' },
  backBtnText: { color: colors.white, fontWeight: 'bold' },
  hudBox: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', gap: 4, paddingTop: 8, zIndex: 2000, elevation: 2000 },
  hudText: { color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, overflow: 'hidden' },
  hudWarn: { color: '#fff', backgroundColor: 'rgba(185,28,28,0.85)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, textAlign: 'center', marginHorizontal: 16, overflow: 'hidden' },
  controls: { position: 'absolute', bottom: 20, left: 20, right: 20, alignItems: 'center', zIndex: 2000, elevation: 2000 },
  closeBtn: { backgroundColor: colors.danger, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.lg, marginBottom: spacing.md, elevation: 5 },
  closeBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 16 },
  infoText: { ...typography.caption, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.xs, borderRadius: radius.sm },
});
