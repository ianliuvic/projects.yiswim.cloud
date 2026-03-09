const express = require('express');
const path = require('path');
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
app.post('/api/upload', async (req, res) => {
    const { projectId, content } = req.body;
    try {
        const n8nUploadUrl = `https://n8n.yiswim.cloud/webhook/upload-to-notion`;
        const response = await fetch(n8nUploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, content })
        });
        if (response.ok) res.json({ success: true });
        else res.status(500).json({ success: false, message: "n8n 处理失败" });
    } catch (error) {
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

// 【API2 新增】验证 Token 并获取项目数据
app.post('/api/get-project', async (req, res) => {
    const { projectId, token } = req.body;
    try {
        const n8nUrl = `http://n8n-ywock00sw4ko80c4w4ogs8so:5678/webhook-test/verify-project`;
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




