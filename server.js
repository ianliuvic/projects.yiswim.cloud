const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const app = express();

// 1. 告诉 Express 我们要使用 EJS 作为模板引擎
app.set('view engine', 'ejs');
// 告诉 Express 模板文件放在 views 文件夹下
app.set('views', path.join(__dirname, 'views'));

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
            body: JSON.stringify({ projectId, stepId, newRecord, action })
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
    try {
        const n8nUrl = `http://n8n-ywock00sw4ko80c4w4ogs8so:5678/webhook/verify-project`;
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, token })
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
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '没有文件' });
  }

  // 生成对外可访问的 URL，使用你的子域名
  const fileName = req.file.filename;
  const imageUrl = `https://files.yiswim.cloud/uploads/${fileName}`;

  res.json({
    success: true,
    url: imageUrl
  });
});










