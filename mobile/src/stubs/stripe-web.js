// Stripe nativo no existe en el navegador: el pago con tarjeta solo funciona en el teléfono.
const React = require('react');
const unsupported = async () => ({ error: { message: 'El pago con tarjeta solo está disponible en la app del teléfono (Expo Go).' } });
module.exports = {
  StripeProvider: ({ children }) => React.createElement(React.Fragment, null, children),
  useStripe: () => ({ initPaymentSheet: unsupported, presentPaymentSheet: unsupported, confirmPayment: unsupported }),
};
