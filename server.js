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

// 【API】处理用户提交数据的接口（保持不变）
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

// 【拦截2】生成项目页面
app.get('/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    if (projectId === 'favicon.ico') return res.status(204).end();

    try {
        // 请求 n8n 获取当前项目数据
        const n8nUrl = `https://n8n.yiswim.cloud/webhook-test/check-project?id=${projectId}`;
        const response = await fetch(n8nUrl);
        
        if (!response.ok) return res.status(404).send('404 Not Found');

        // 获取 n8n 返回的数据
        const projectData = await response.json();

        // 【关键改变】不再拼接 HTML 字符串，而是告诉 Express 去渲染 project.ejs 文件
        // 并且把 projectId 和 projectData 这两个变量传给模板！
        res.render('project', { 
            projectId: projectId, 
            projectData: projectData 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('system error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务已启动，端口 ${PORT}`));



