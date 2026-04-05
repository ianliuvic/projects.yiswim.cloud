const express = require('express');
const path = require('path');
const config = require('./config');
const { registerRoutes } = require('./routes');

const app = express();

// 模板引擎
app.set('view engine', 'ejs');
app.set('views', config.VIEWS_DIR);

// 信任反向代理（Coolify / Traefik）
app.set('trust proxy', true);

// 中间件
app.use(express.static(config.PUBLIC_DIR));
app.use(express.json());

// 路由
registerRoutes(app);

module.exports = app;
