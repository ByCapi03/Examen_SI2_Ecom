// react-native-fs no existe en Expo Go. tfjs-react-native solo lo usa para cargar modelos desde archivos
// locales, que aquí no se necesita (el modelo se descarga por red), así que basta con una versión vacía.
const noop = async () => { throw new Error('react-native-fs no disponible en Expo Go'); };
const fake = new Proxy({}, {
  get: (_t, key) => (key === '__esModule' ? false : key === 'default' ? fake : (typeof key === 'string' && /Path$/.test(key) ? '' : noop)),
});
module.exports = fake;
