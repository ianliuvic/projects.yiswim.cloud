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
        // 请求一个新的 n8n Webhook 用于验证
        const n8nUrl = `https://n8n.yiswim.cloud/webhook-test/verify-project`;
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, token })
        });
        
        const result = await response.json();
        
        // 约定 n8n 返回的格式为 { isValid: true, data: {...项目数据...} } 或 { isValid: false }
        if (response.ok && result.isValid) {
            res.json({ success: true, data: result.data });
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

