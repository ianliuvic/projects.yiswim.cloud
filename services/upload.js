const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

// 确保上传目录存在
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// 图片上传存储配置
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// 通用文件上传存储配置
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: config.IMAGE_MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只允许上传图片'));
    }
    cb(null, true);
  },
});

const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: config.FILE_MAX_SIZE },
});

// 动态判断文件域名前缀
function getFileUrlPrefix(req) {
  const role = config.ROLE;
  if (role === 'supplier') {
    return config.SUPPLIER_FILE_DOMAIN || `${req.protocol}://${req.get('host')}`;
  }
  return 'https://files.yiswim.cloud';
}

module.exports = { uploadImage, uploadFile, getFileUrlPrefix };
