# 窝里蹲点单系统

宿舍点单小程序 —— 浏览商品、加入购物车、一键复制订单发微信群。

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS + motion
- **后端**: Express + better-sqlite3
- **部署**: Node.js 单进程，前端静态文件由 Express 托管

## 本地开发

```bash
npm install
npm run dev:all    # 前后端同时启动
```

- 前端: http://localhost:3000
- 后端: http://localhost:3001
- 管理后台: http://localhost:3000/admin

## 环境变量

复制 `.env.example` 为 `.env`：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3001` |
| `ADMIN_KEY` | 管理后台密钥 | `admin123` |
| `DB_PATH` | 数据库路径 | `./data/ordering.db` |

## 部署

```bash
npm run build
NODE_ENV=production node server/index.ts
```

生产模式下 Express 自动托管 `dist/` 静态文件，单端口访问。
