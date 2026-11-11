/**
 * Extiende app.json: usa google-services.json (Firebase, necesario para push en Android)
 * solo si el archivo existe, para que la app compile igual sin él.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const hasGoogleServices = fs.existsSync(path.join(__dirname, 'google-services.json'));
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
