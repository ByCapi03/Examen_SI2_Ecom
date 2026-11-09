/**
 * Lanzador de los datos demo (multiplataforma).
 *   npm run seed:demo          -> crea las empresas demo si no existen
 *   npm run seed:demo:reset    -> borra SOLO las empresas demo y las vuelve a crear
 */
const path = require('path');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { rootDir: path.join(__dirname, '..', 'src') },
});
require(path.join(__dirname, '..', 'src', 'database', 'seed-demo.ts'))
  .main()
  .catch((err) => { console.error('\n✖ No se pudieron crear los datos demo:', err.message); process.exitCode = 1; });
