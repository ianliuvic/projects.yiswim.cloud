const express = require('express');
const config = require('../config');

const router = express.Router();

// 主域名 → 404
router.get('/', (req, res) => {
  res.status(404).send('404 Not Found');
});

// 项目页面
router.get('/:projectId', (req, res) => {
  const projectId = req.params.projectId;
  if (projectId === 'favicon.ico') return res.status(204).end();

  res.render('project', {
    projectId: projectId,
    role: config.ROLE,
  });
});

module.exports = router;
