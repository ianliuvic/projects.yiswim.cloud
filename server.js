const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const app = express();

// 1. 告诉 Express 我们要使用 EJS 作为模板引擎
app.set('view engine', 'ejs');
// 告诉 Express 模板文件放在 views 文件夹下
app.set('views', path.join(__dirname, 'views'));

// --- 重要：告诉 Express 信任 Coolify 的反向代理 (Traefik) ---
// 这样 req.ip 就能直接拿到用户的真实 IP，而不是容器的内部 IP
app.set('trust proxy', true); 

// 2. 托管静态文件 (这样你就可以在 HTML 里通过 <link href="/style.css"> 引入样式了)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 【拦截1】直接访问主域名 -> 404
app.get('/', (req, res) => {
    res.status(404).send('404 Not Found'); 
});

// 【API1】处理用户提交数据的接口（保持不变）
// 【API】增量保存单条记录（推荐新名称）
app.post('/api/append-record', async (req, res) => {
    const { projectId, stepId, newRecord, action } = req.body;
    
    if (!projectId || !stepId || !newRecord) {
        return res.status(400).json({ success: false, message: "缺少必要参数" });
    }

    try {
        const n8nUrl = `http://n8n-ywock00sw4ko80c4w4ogs8so:5678/webhook/append-record`;  // ← 改成你上面的 webhook 路径
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectId,
                stepId,
                newRecord,
                action
            })
        });

        if (response.ok) {
            res.json({ success: true });
        } else {
            res.status(500).json({ success: false, message: "n8n 处理失败" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "服务器错误" });
    }
});

// （可选）保留旧接口做兼容，后面可以删除
app.post('/api/upload', (req, res) => {
    res.status(410).json({ message: "此接口已废弃，请使用 /api/append-record" });
});

// 【API2 新增】验证 Token 并获取项目数据
app.post('/api/get-project', async (req, res) => {
    const { projectId, token } = req.body;
    
     // --- 新增：获取 IP 和时间 ---
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const requestTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    try {
        const n8nUrl = `http://n8n-ywock00sw4ko80c4w4ogs8so:5678/webhook/verify-project`;
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                projectId,
                token,
                // --- 新增：传给 n8n 的额外信息 ---
                metadata: {
                    ip: clientIp,
                    time: requestTime
                }
            })
        });
        
        const rawResult = await response.json();
        
        // 【修改点】兼容 n8n 返回数组的情况：如果是数组就取第一个对象
        const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;
        
        // 判断 isValid 并把完整的 result 传给前端
        if (response.ok && result.isValid) {
            res.json({ success: true, data: result });
        } else {
            res.status(401).json({ success: false, message: "Token 无效或项目不存在" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "验证服务出错" });
    }
});

// 【拦截2 修改】生成项目页面 (不再提前请求数据，只返回空壳+弹窗)
app.get('/:projectId', (req, res) => {
    const projectId = req.params.projectId;
    if (projectId === 'favicon.ico') return res.status(204).end();

    // 直接渲染页面模板，只传 projectId
    res.render('project', { 
        projectId: projectId 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务已启动，端口 ${PORT}`));


// 【图片上传】
// 使用 Coolify 共享的持久化目录（与 n8n 容器映射的路径一致）
const UPLOAD_DIR = '/n8n_files/uploads';  // 注意：这个路径在 Node.js 容器里必须能写

// 确保目录存在（Coolify 容器启动时可能需要手动创建）
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 限制
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只允许上传图片'));
    }
    cb(null, true);
  }
});

// 图片上传接口
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  const filePath = req.file.path;
  const optimizedName = `opt-${req.file.filename}`;
  const optimizedPath = path.join(UPLOAD_DIR, optimizedName);

  try {
    // 使用 sharp 压缩图片：调整尺寸（如最大宽度1200px），转换为 webp (体积更小)
    await sharp(filePath)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 }) 
      .toFile(optimizedPath);

    // 删除原大图（可选）
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      url: `https://files.yiswim.cloud/uploads/${optimizedName}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "图片处理失败" });
  }
});


// ==========================================
// 【新增：通用文件上传（PDF, Word, Excel 等）】
// ==========================================

// 专门为通用文件创建一个 Multer 配置（不限制文件类型）
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 复用原本的 UPLOAD_DIR (/n8n_files/uploads)
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 为了防止中文文件名导致 URL 乱码或冲突，使用时间戳+随机字符+原后缀名
    const ext = path.extname(file.originalname);
    const uniqueName = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 后端限制放宽到 25MB（前端已限制 20MB）
});

// 通用文件上传接口
app.post('/api/upload-file', uploadFile.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "未接收到文件" });
  }

  try {
    const filename = req.file.filename;
    
    // 注意：普通文件不需要也不可以使用 sharp 处理，直接返回静态访问链接即可
    res.json({
      success: true,
      url: `https://files.yiswim.cloud/uploads/${filename}`
    });
  } catch (err) {
    console.error('文件上传处理失败:', err);
    res.status(500).json({ success: false, message: "文件保存失败" });
  }
});

// ==========================================

