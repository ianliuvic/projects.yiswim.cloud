const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const n8n = require('../services/n8n');
const { uploadImage, uploadFile, getFileUrlPrefix } = require('../services/upload');

const router = express.Router();

// 增量保存单条记录
router.post('/append-record', async (req, res) => {
  const { projectId, stepId, newRecord, action, recordIndex } = req.body;

  if (!projectId || !stepId || !newRecord) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    const ok = await n8n.appendRecord({ projectId, stepId, newRecord, action, recordIndex });
    if (ok) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, message: 'n8n 处理失败' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 已废弃接口（保留兼容）
router.post('/upload', (req, res) => {
  res.status(410).json({ message: '此接口已废弃，请使用 /api/append-record' });
});

// 验证 Token 并获取项目数据
router.post('/get-project', async (req, res) => {
  const { projectId, token } = req.body;
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const requestTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const currentRole = config.ROLE;

  try {
    const { ok, result } = await n8n.verifyProject({
      projectId,
      token,
      metadata: { ip: clientIp, time: requestTime, role: currentRole },
    });

    if (ok && result.isValid) {
      res.json({ success: true, data: result });
    } else {
      res.status(401).json({ success: false, message: 'Token 无效或项目不存在' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '验证服务出错' });
  }
});

// 发送邮件通知
router.post('/send-email', async (req, res) => {
  const { projectId, emails, content } = req.body;

  if (!projectId || !emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    const ok = await n8n.sendEmail({ projectId, emails, content });
    if (ok) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, message: 'n8n 处理失败' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 图片上传（带 sharp 压缩）
router.post('/upload-image', uploadImage.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  const filePath = req.file.path;
  const optimizedName = `opt-${req.file.filename}`;
  const optimizedPath = path.join(config.UPLOAD_DIR, optimizedName);

  try {
    await sharp(filePath)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(optimizedPath);

    fs.unlinkSync(filePath);

    const fileBaseUrl = getFileUrlPrefix(req);
    res.json({ success: true, url: `${fileBaseUrl}/uploads/${optimizedName}` });
  } catch (err) {
    res.status(500).json({ success: false, message: '图片处理失败' });
  }
});

// 通用文件上传
router.post('/upload-file', uploadFile.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未接收到文件' });
  }

  try {
    const filename = req.file.filename;
    const fileBaseUrl = getFileUrlPrefix(req);
    res.json({ success: true, url: `${fileBaseUrl}/uploads/${filename}` });
  } catch (err) {
    console.error('文件上传处理失败:', err);
    res.status(500).json({ success: false, message: '文件保存失败' });
  }
});

module.exports = router;
