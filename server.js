const express = require('express');
const app = express();

// 必须加上这行，才能解析前端发过来的 JSON 数据
app.use(express.json());

// 【拦截1】直接访问主域名 -> 404
app.get('/', (req, res) => {
    res.status(404).send('404 Not Found'); 
});

// 【新增：处理用户提交数据的 API 接口】
app.post('/api/upload', async (req, res) => {
    // 获取前端发来的数据（项目ID 和 用户填写的内容）
    const { projectId, content } = req.body;

    try {
        // 将数据转发给 n8n 专用于接收上传的 Webhook
        const n8nUploadUrl = `https://n8n.yiswim.cloud/webhook/upload-to-notion`;
        
        const response = await fetch(n8nUploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId: projectId, content: content })
        });

        if (response.ok) {
            res.json({ success: true, message: "数据已成功提交到 n8n" });
        } else {
            res.status(500).json({ success: false, message: "n8n 处理失败" });
        }
    } catch (error) {
        console.error("提交至 n8n 异常:", error);
        res.status(500).json({ success: false, message: "服务器内部错误" });
    }
});

// 【拦截2】生成项目页面 (统一模板)
app.get('/:projectId', async (req, res) => {
    const projectId = req.params.projectId;
    if (projectId === 'favicon.ico') return res.status(204).end();

    try {
        // 请求 n8n 获取当前项目数据
        // const n8nUrl = `https://n8n.yiswim.cloud/webhook/check-project?id=${projectId}`;
        const n8nUrl = `https://n8n.yiswim.cloud/webhook-test/check-project?id=${projectId}`;
        const response = await fetch(n8nUrl);
        
        if (!response.ok) return res.status(404).send('404 Not Found');

        // n8n 返回的格式假设为 { "projectName": "XX", "status": "XX" }
        const projectData = await response.json();

        // ！！！这里就是你所有项目通用的“统一模板”！！！
        const html = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>项目跟踪 - ${projectData.projectName}</title>
                <style>
                    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f5f5f5; }
                    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
                    textarea { width: 100%; height: 100px; margin-top: 10px; padding: 10px; box-sizing: border-box;}
                    button { background: #007bff; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; }
                    button:disabled { background: #ccc; }
                </style>
            </head>
            <body>
                <!-- 数据展示区 -->
                <div class="card">
                    <h2>项目名称：${projectData.projectName}</h2>
                    <p>当前状态：<b>${projectData.status}</b></p>
                </div>

                <!-- 数据提交区 -->
                <div class="card">
                    <h3>提交更新记录</h3>
                    <textarea id="userInput" placeholder="在此输入要提交给 Notion 的内容..."></textarea>
                    <br>
                    <button id="submitBtn" onclick="submitData()">提交到 Notion</button>
                    <p id="statusMsg" style="color: green;"></p>
                </div>

                <!-- 前端交互逻辑 -->
                <script>
                    async function submitData() {
                        const content = document.getElementById('userInput').value;
                        if (!content) return alert("请先输入内容！");
                        
                        const btn = document.getElementById('submitBtn');
                        const statusMsg = document.getElementById('statusMsg');
                        const projectId = '${projectId}'; // 从模板直接注入当前项目ID

                        btn.disabled = true;
                        btn.innerText = "正在提交...";

                        try {
                            // 发送给我们的 Node.js 后端 (/api/upload)
                            const res = await fetch('/api/upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ projectId, content })
                            });
                            const result = await res.json();
                            
                            if(result.success) {
                                statusMsg.innerText = "提交成功！";
                                document.getElementById('userInput').value = ''; // 清空输入框
                            } else {
                                statusMsg.style.color = 'red';
                                statusMsg.innerText = "提交失败：" + result.message;
                            }
                        } catch (e) {
                            statusMsg.style.color = 'red';
                            statusMsg.innerText = "网络错误！";
                        } finally {
                            btn.disabled = false;
                            btn.innerText = "提交到 Notion";
                        }
                    }
                </script>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        res.status(500).send('系统错误');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`服务已启动，端口 ${PORT}`));


