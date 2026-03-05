const express = require('express');
const app = express();

// 这里的 :projectId 就是你说的 abcd
app.get('/:projectId', async (req, res) => {
    const projectId = req.params.projectId;

    // TODO: 这里可以在服务端去请求你的 n8n Webhook 获取数据
    // const response = await fetch(`https://n8n.yiswim.cloud/webhook/status?id=${projectId}`);
    // const data = await response.json();

    // 返回一段简单的 HTML 网页给用户
    const html = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>项目跟踪 - ${projectId}</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding-top: 50px; }
            </style>
        </head>
        <body>
            <h1>当前查询的项目代号是：${projectId}</h1>
            <p>正在努力开发中，这里后续会显示来自 n8n 的数据...</p>
        </body>
        </html>
    `;
    
    res.send(html);
});

// 监听 Coolify 分配的端口，默认通常是 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});