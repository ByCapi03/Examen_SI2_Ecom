const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

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

if (process.env.TRYON !== '1') {
  const original = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (HEAVY.some((re) => re.test(moduleName))) {
      return { type: 'sourceFile', filePath: stub };
    }
    return original ? original(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
