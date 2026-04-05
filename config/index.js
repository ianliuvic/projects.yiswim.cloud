const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  ROLE: process.env.ROLE || 'client',
  UPLOAD_DIR: '/n8n_files/uploads',
  N8N_BASE_URL: 'http://n8n-ywock00sw4ko80c4w4ogs8so:5678/webhook',
  SUPPLIER_FILE_DOMAIN: process.env.SUPPLIER_FILE_DOMAIN || '',
  IMAGE_MAX_SIZE: 10 * 1024 * 1024,
  FILE_MAX_SIZE: 25 * 1024 * 1024,
  VIEWS_DIR: path.join(__dirname, '..', 'views'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
};
