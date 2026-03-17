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
    const { projectId, stepId, newRecord, action, recordIndex } = req.body;
    
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
                action,
                recordIndex
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
    const currentRole = process.env.ROLE || 'client'; // ← 新增：获取当前角色
    
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
                    time: requestTime,
                    role: currentRole // ← 新增：告诉 n8n 当前是谁在查数据！
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

    // 从环境变量中获取 ROLE，如果没有设置，默认当做 client
    const currentRole = process.env.ROLE || 'client';

    // 渲染页面模板，同时传 projectId 和 role
    res.render('project', { 
        projectId: projectId,
        role: currentRole  // ← 新增这行，把角色传给前端
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

// ==========================================
// 【新增核心逻辑：动态判断文件域名】
// ==========================================
const getFileUrlPrefix = (req) => {
    // 获取当前实例的角色
    const role = process.env.ROLE || 'client';

    if (role === 'supplier') {
        // 优先尝试读取环境变量中的中立文件域名 (比如在 Coolify 配了 SUPPLIER_FILE_DOMAIN)
        if (process.env.SUPPLIER_FILE_DOMAIN) {
            return process.env.SUPPLIER_FILE_DOMAIN;
        }
        // 【保底防御】：如果没有配中立文件域名，就直接拿当前浏览器的中立主域名
        // 这要求我们在下方开启 Express 的静态文件托管作为备用
        return `${req.protocol}://${req.get('host')}`; 
    } else {
        // 【客户分支】：直接使用你配好的 Nginx 高性能域名
        return 'https://files.yiswim.cloud';
    }
};

// ==========================================
// 【重要：为供应商兜底的静态文件服务】
// ==========================================
// 虽然客户走 Nginx，但如果供应商没有专属的 Nginx 域名，
// 我们得让当前的 Node.js 实例能够自己把 /n8n_files/uploads 里的文件吐给供应商
app.use('/uploads', express.static(UPLOAD_DIR));

// ==========================================
// 【修改后的图片上传接口】
// ==========================================
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });

  const filePath = req.file.path;
  const optimizedName = `opt-${req.file.filename}`;
  const optimizedPath = path.join(UPLOAD_DIR, optimizedName);

  try {
    await sharp(filePath)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 }) 
      .toFile(optimizedPath);

    fs.unlinkSync(filePath);
    
    // 调用上面写好的方法，动态获取域名前缀
    const fileBaseUrl = getFileUrlPrefix(req); 

    res.json({
      success: true,
      url: `${fileBaseUrl}/uploads/${optimizedName}`
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

// ==========================================
// 【修改后的通用文件上传接口】
// ==========================================
app.post('/api/upload-file', uploadFile.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "未接收到文件" });
  }

  try {
    const filename = req.file.filename;
    
    // 调用上面写好的方法，动态获取域名前缀
    const fileBaseUrl = getFileUrlPrefix(req);
    
    res.json({
      success: true,
      url: `${fileBaseUrl}/uploads/${filename}`
    });
  } catch (err) {
    console.error('文件上传处理失败:', err);
    res.status(500).json({ success: false, message: "文件保存失败" });
  }
});
// ==========================================

