# Nof1 Tracker Dashboard

一个安全的币安合约交易数据监控面板，基于 Cloudflare Workers 部署，保护API密钥安全。

## 功能特性

- 🔒 **安全架构**: API密钥仅存储在服务器端，前端无法访问
- 📊 **实时数据**: 60秒自动刷新，显示最新的账户和交易数据
- 💰 **盈亏分析**: 自定义基准日期，计算总盈利、盈利率等关键指标
- ⚙️ **灵活配置**: 独立配置文件，轻松调整初始资金和跟单日期
- 📱 **响应式设计**: 完美适配桌面和移动设备
- ⚡ **高性能**: 使用 Cloudflare Workers 边缘计算，全球加速
- 🎯 **专注合约**: 只显示期货合约相关数据，过滤现货交易

## 数据展示

### 1. 账户总资产
- 总资产折合 (USDT)
- 总盈利 (自2025-10-25以来)
- 总盈利率 (自2025-10-25以来)
- 未实现盈亏
- 未实现盈亏率
- 最大盈利 / 最大损失 (自2025-10-25以来)

### 2. 当前仓位
- 币种
- 方向 (LONG/SHORT)
- 开仓价格
- 标记价格
- 持仓量
- 未实现盈亏
- 收益率
- 保证金

### 3. 最近交易记录
- 最近25笔合约交易
- 成交价格、数量、金额
- 手续费
- 交易时间

## 技术架构

### 后端 (Cloudflare Workers)
- **Cloudflare Workers** 无服务器运行时
- 币安合约API集成
- HMAC-SHA256签名验证
- CORS支持
- 环境变量管理
- KV Assets 静态资源服务

### 前端
- **原生JavaScript** (ES6+)
- **CSS Grid** + **Flexbox** 响应式布局
- **Font Awesome** 图标
- 60秒自动刷新机制

### 部署平台
- **Cloudflare Workers** (边缘计算平台)

## 快速开始

### 1. 克隆项目

```bash
git clone git@github.com:kookim/nof1-tracker-dashboard.git
cd nof1-tracker-dashboard
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置币安API

1. 登录币安账户，创建只读权限的API密钥
2. 在 Cloudflare Workers 环境变量中配置：
   - `BINANCE_API_KEY`: 你的币安API Key
   - `BINANCE_SECRET_KEY`: 你的币安Secret Key
   - `USE_TESTNET`: `false` (主网) 或 `true` (测试网)

### 4. 本地开发

```bash
# 启动本地开发服务器（包含静态文件和API代理）
npm run dev

# 或直接使用 wrangler dev（Worker模式）
npm run dev:worker
```

访问 `http://localhost:8788` 查看应用（使用 `npm run dev`）。

### 5. 部署到 Cloudflare Workers

#### 方式一：使用命令行部署

```bash
# 配置 Cloudflare 认证（首次需要）
npx wrangler login

# 部署到 Cloudflare
npm run deploy
```

#### 方式二：通过 Cloudflare Dashboard 部署

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com) 创建 Worker
2. 连接你的 GitHub 仓库
3. 配置构建命令（如需要）:
   - **Build Command**: `npm install`（或留空使用默认）
   - **Deploy Command**: `npx wrangler deploy`（或留空使用默认）
4. 在 Worker 设置中添加环境变量（Secrets）
5. 点击部署

## 环境变量配置

在 Cloudflare Workers 的环境变量（Secrets）中配置以下变量：

| 变量名 | 描述 | 示例值 |
|--------|------|--------|
| `BINANCE_API_KEY` | 币安API Key | `XAbc123...` |
| `BINANCE_SECRET_KEY` | 币安Secret Key | `s3cr3tK3y...` |
| `USE_TESTNET` | 是否使用测试网络 | `false` |

**注意**: 在 Cloudflare Workers 中，需要使用 `wrangler secret put <KEY_NAME>` 命令或 Dashboard 来设置敏感信息。

```bash
# 使用命令行设置密钥
npx wrangler secret put BINANCE_API_KEY
npx wrangler secret put BINANCE_SECRET_KEY
npx wrangler secret put USE_TESTNET
```

## API端点

- `GET /api/account` - 获取账户信息
- `GET /api/positions` - 获取当前仓位
- `GET /api/trades?limit=25` - 获取交易记录
- `GET /api/config` - 检查API配置状态

## 安全说明

✅ **安全措施**:
- API密钥仅存储在 Cloudflare Workers 环境变量中
- 使用只读权限API密钥
- 前端无法访问敏感信息
- HTTPS加密传输
- 边缘计算，降低延迟

⚠️ **注意事项**:
- 请确保API密钥只有只读权限
- 定期轮换API密钥
- 监控API使用情况
- 不要在代码中提交密钥

## 自定义配置

### ⚙️ 交易配置

项目使用独立的配置文件 `trading-config.js` 来管理交易参数。修改配置后需要重新部署 Worker。

**配置文件位置：** `public/trading-config.js`

```javascript
const TRADING_CONFIG = {
    // 初始资金配置
    initialAssetValue: 140,        // 初始钱包余额 (USDT)
    initialAssetValueCurrency: 'USDT',

    // 跟单日期配置
    baseDate: '2025-10-25T00:00:00+08:00',  // 基准日期（用于计算盈利和统计的开始时间）
    baseDateDisplay: '2025-10-25',           // 页面显示的日期格式

    // 应用配置
    appName: 'DeepSeek Chat V3.1',             // 跟踪代理名称
    appTitle: '交易数据监控面板',               // 页面标题

    // 显示文本配置
    display: {
        dateTextPrefix: '自',
        dateTextSuffix: '以来'
    }
};
```

**配置说明：**

| 参数 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `initialAssetValue` | Number | 初始资金金额，用于计算总盈利 | 140 |
| `baseDate` | String | 跟单开始时间，用于筛选交易记录 | '2025-10-25T00:00:00+08:00' |
| `baseDateDisplay` | String | 页面显示的日期格式 | '2025-10-25' |
| `appName` | String | 跟踪代理名称，显示在页面顶部 | 'DeepSeek Chat V3.1onimy' |
| `appTitle` | String | 页面标题，显示在浏览器标签页 | '交易数据监控面板' |

**使用步骤：**

1. 编辑 `public/trading-config.js` 文件
2. 修改相应的配置值
3. 重新部署 Worker：`npm run deploy` 或通过 Dashboard 重新部署

### 修改刷新间隔

在 `public/script.js` 中修改：

```javascript
// 刷新间隔 (秒)
this.refreshInterval = 60;
```

## 故障排除

### 常见问题

1. **"后端API密钥未配置"错误**
   - 检查 Cloudflare Workers 环境变量（Secrets）是否正确设置
   - 确认API密钥格式正确
   - 使用 `npx wrangler secret list` 查看已设置的密钥

2. **"数据更新失败"错误**
   - 检查网络连接
   - 验证币安API服务状态
   - 确认API密钥权限正确

3. **页面无法加载**
   - 检查 Cloudflare Workers 部署状态和日志
   - 使用 `npx wrangler tail` 查看实时日志
   - 验证 Worker 是否正常运行

4. **配置修改后未生效**
   - 确认已修改 `public/trading-config.js` 文件
   - 重新部署 Worker
   - 检查浏览器缓存，尝试强制刷新（Ctrl+F5）

5. **盈利计算不正确**
   - 检查 `initialAssetValue` 是否设置正确
   - 确认 `baseDate` 设置为正确的跟单开始日期
   - 验证币安交易记录是否包含指定日期后的数据

6. **本地开发静态文件无法加载**
   - 使用 `npm run dev` 启动完整的本地开发服务器
   - 如果使用 `npm run dev:worker`，静态文件可能无法正常加载（需要 Cloudflare KV）

### 调试模式

打开浏览器开发者工具查看控制台日志：

```javascript
// 查看详细API调用日志
console.log('API请求:', request);
console.log('API响应:', response);
```

使用 Wrangler 查看日志：

```bash
# 实时查看 Worker 日志
npx wrangler tail

# 查看特定环境日志
npx wrangler tail --env production
```

## 项目结构

```
nof1-tracker-dashboard/
├── src/
│   └── index.js              # Cloudflare Worker 入口文件
├── public/                    # 静态资源目录
│   ├── binance-tracker.html  # 主页面
│   ├── styles.css            # 样式文件
│   ├── script.js             # 前端JavaScript
│   └── trading-config.js     # 交易配置文件 ⭐
├── dev-server.js             # 本地开发服务器
├── wrangler.toml             # Cloudflare Workers 配置文件
├── package.json              # 项目配置
├── .gitignore                # Git忽略文件
└── README.md                 # 项目文档
```

**关键文件：**
- `src/index.js` - Cloudflare Worker 主入口，处理 API 请求和静态资源
- `wrangler.toml` - Worker 配置（名称、入口、兼容性日期、静态资源）
- `public/` - 前端静态文件，通过 KV Assets 提供
- `dev-server.js` - 本地开发服务器，提供静态文件和 API 代理

## 开发说明

### 本地开发环境

项目支持两种本地开发模式：

1. **完整开发服务器** (`npm run dev`)
   - 提供静态文件服务
   - 代理 API 请求到 wrangler dev
   - 访问地址: `http://localhost:8788`

2. **Worker 模式** (`npm run dev:worker`)
   - 直接使用 wrangler dev
   - 访问地址: `http://localhost:8787`
   - 注意: 静态资源可能无法正常加载（依赖 Cloudflare KV）

推荐使用 `npm run dev` 进行本地开发。

### 部署流程

1. 代码推送到 GitHub
2. Cloudflare Workers 自动触发构建（如果配置了 CI/CD）
3. 或手动执行 `npm run deploy`

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如有问题或建议，请：
- 创建 [Issue](../../issues)
- 联系开发团队

---

## 项目来源

本项目是基于 [terryso/nof1-tracker-dashboard](https://github.com/terryso/nof1-tracker-dashboard) fork 并修改的版本。

**主要改动：**
- 从 Render/Express 架构迁移到 Cloudflare Workers
- 添加了本地开发服务器支持
- 优化了部署流程

**原始项目版权：** Copyright (c) 2025 terryso

**注意**: 本项目已从 Render 迁移到 Cloudflare Workers。如需旧版本（Render/Express），请查看原始仓库或 git 历史记录。
