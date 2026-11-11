const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// La app lee esta bandera (EXPO_PUBLIC_*) para saber si el vestidor con cámara está incluido en el bundle.
process.env.EXPO_PUBLIC_TRYON = process.env.TRYON === '1' ? '1' : '0';

// El vestidor virtual usa TensorFlow y librerías nativas que NO existen en Expo Go y hacen que Metro
// se quede sin memoria. En modo normal (Expo Go) se reemplazan por un stub; con TRYON=1 se incluyen
// (solo para una compilación propia con `expo run:ios` / EAS).
const HEAVY = [
  /^@tensorflow\//,
  /^@mediapipe\//,
  /^react-native-fs$/,
  /^expo-gl$/,
];
const stub = path.resolve(__dirname, 'src/stubs/tryon-unavailable.js');

const rnfsFake = path.resolve(__dirname, 'src/stubs/rnfs-fake.js');
const stripeWeb = path.resolve(__dirname, 'src/stubs/stripe-web.js');
const original = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return { type: 'sourceFile', filePath: stripeWeb };
  }
  // TRYON=1: el vestidor con cámara se incluye (solo en teléfono); react-native-fs se simula porque Expo Go no lo trae.
  if (process.env.TRYON === '1' && platform !== 'web') {
    if (moduleName === 'react-native-fs') return { type: 'sourceFile', filePath: rnfsFake };
  } else if (HEAVY.some((re) => re.test(moduleName))) {
    return { type: 'sourceFile', filePath: stub };
  }
  return original ? original(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

// expo-sqlite en el navegador usa WebAssembly y necesita estas cabeceras
config.resolver.assetExts.push('wasm');
config.server = config.server || {};
const prevEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = prevEnhance ? prevEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return base(req, res, next);
  };
};

module.exports = config;
