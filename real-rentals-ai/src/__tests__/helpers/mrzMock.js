/** Mock de `mrz` para Jest (el paquete real es ESM y rompe el runner). */
module.exports = {
  parse: () => ({
    valid: false,
    fields: {},
    format: null,
    documentNumber: null,
  }),
};
