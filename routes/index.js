const express = require('express');
const config = require('../config');
const apiRoutes = require('./api');
const pageRoutes = require('./pages');

function registerRoutes(app) {
  // 为供应商兜底的静态文件服务
  app.use('/uploads', express.static(config.UPLOAD_DIR));

  // API 路由
  app.use('/api', apiRoutes);

  // 页面路由（放最后，因为 /:projectId 是通配）
  app.use('/', pageRoutes);
}

module.exports = { registerRoutes };
