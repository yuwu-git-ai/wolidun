// Generate all 7 batch output files with semantic analysis in Chinese
const fs = require('fs');
const path = require('path');

const ROOT = 'E:/窝里蹲点单系统';
const INTER = path.join(ROOT, '.understand-anything/intermediate');
const TMP = path.join(ROOT, '.understand-anything/tmp');

// ── Complexity helper ──
function complexity(nonEmpty) {
  if (nonEmpty < 50) return 'simple';
  if (nonEmpty < 200) return 'moderate';
  return 'complex';
}

// ── File-level summaries, tags, and types ──
// Keyed by file path
const FILE_META = {
  // ── Batch 1: server ──
  'server/__tests__/api.test.ts': {
    type: 'file',
    name: 'api.test.ts',
    summary: '后端 API 集成测试，验证 Express 应用路由和中间件的正确性。',
    tags: ['test', 'api-test', 'integration-test']
  },
  'server/app.ts': {
    type: 'file',
    name: 'app.ts',
    summary: 'Express 应用工厂函数，组装路由、中间件、限流和全局错误处理。',
    tags: ['entry-point', 'express', 'middleware', 'api-handler']
  },
  'server/db.ts': {
    type: 'file',
    name: 'db.ts',
    summary: 'SQLite 数据库初始化模块，管理连接、自动迁移、表创建和默认数据填充。',
    tags: ['database', 'sqlite', 'migration', 'singleton']
  },
  'server/index.ts': {
    type: 'file',
    name: 'index.ts',
    summary: '服务入口文件，加载环境变量、创建 Express 应用并启动 HTTP 服务器。',
    tags: ['entry-point', 'server', 'startup']
  },
  'server/middleware/auth.ts': {
    type: 'file',
    name: 'auth.ts',
    summary: '管理员认证中间件，通过 X-Admin-Key 请求头验证管理员身份。',
    tags: ['middleware', 'authentication', 'admin']
  },
  'server/middleware/rateLimit.ts': {
    type: 'file',
    name: 'rateLimit.ts',
    summary: '基于内存存储的 API 限流中间件，支持按方法和时间窗口限制请求频率。',
    tags: ['middleware', 'rate-limiting', 'security']
  },
  'server/routes/auth.ts': {
    type: 'file',
    name: 'auth.ts',
    summary: '用户认证路由，处理注册、登录、个人信息更新和密码修改。',
    tags: ['api-handler', 'authentication', 'user-management']
  },
  'server/routes/orders.ts': {
    type: 'file',
    name: 'orders.ts',
    summary: '订单管理路由，处理订单创建（含库存事务）、查询和状态更新。',
    tags: ['api-handler', 'orders', 'transaction']
  },
  'server/routes/posts.ts': {
    type: 'file',
    name: 'posts.ts',
    summary: '广场帖子路由，处理帖子的创建、查询、认领、完成和评论功能。',
    tags: ['api-handler', 'social', 'posts']
  },
  'server/routes/products.ts': {
    type: 'file',
    name: 'products.ts',
    summary: '商品管理路由，处理商品的增删改查和管理员密钥验证。',
    tags: ['api-handler', 'products', 'crud']
  },
  'server/routes/stats.ts': {
    type: 'file',
    name: 'stats.ts',
    summary: '统计数据路由，提供日/周/月维度的订单统计、热销排行和收入分析。',
    tags: ['api-handler', 'statistics', 'analytics']
  },
  // ── Batch 2: core src ──
  'src/App.tsx': {
    type: 'file',
    name: 'App.tsx',
    summary: '应用根组件，实现顾客端完整 UI：身份认证、商品浏览、购物车、订单确认和历史追踪。',
    tags: ['entry-point', 'component', 'customer-app']
  },
  'src/__tests__/IdentityForm.test.tsx': {
    type: 'file',
    name: 'IdentityForm.test.tsx',
    summary: 'IdentityForm 组件的单元测试，验证表单输入和提交流程。',
    tags: ['test', 'component-test', 'identity']
  },
  'src/api.ts': {
    type: 'file',
    name: 'api.ts',
    summary: '前端 API 客户端，封装所有后端请求（认证、商品、订单、统计、帖子），含重试逻辑和错误处理。',
    tags: ['api-client', 'fetch', 'error-handling', 'retry']
  },
  'src/components/AdminGate.tsx': {
    type: 'file',
    name: 'AdminGate.tsx',
    summary: '管理员入口守卫组件，提供密钥输入界面，验证通过后渲染后台面板。',
    tags: ['component', 'admin', 'authentication']
  },
  'src/components/CartPanel.tsx': {
    type: 'file',
    name: 'CartPanel.tsx',
    summary: '购物车面板组件，展示商品列表、数量调整、配送选择和价格汇总。',
    tags: ['component', 'cart', 'checkout']
  },
  'src/components/IdentityForm.tsx': {
    type: 'file',
    name: 'IdentityForm.tsx',
    summary: '身份表单组件，支持用户注册/登录，收集昵称、宿舍号和密码。',
    tags: ['component', 'identity', 'authentication']
  },
  'src/components/OrderHistory.tsx': {
    type: 'file',
    name: 'OrderHistory.tsx',
    summary: '订单历史组件，展示用户历史订单、订单追踪和状态变更实时高亮。',
    tags: ['component', 'orders', 'tracking']
  },
  'src/components/ProductCard.tsx': {
    type: 'file',
    name: 'ProductCard.tsx',
    summary: '商品卡片组件，展示商品图片、名称、价格、库存和加购按钮。',
    tags: ['component', 'product', 'ui']
  },
  'src/components/ProfileForm.tsx': {
    type: 'file',
    name: 'ProfileForm.tsx',
    summary: '个人资料编辑组件，支持修改宿舍号和密码。',
    tags: ['component', 'profile', 'settings']
  },
  'src/components/SquarePanel.tsx': {
    type: 'file',
    name: 'SquarePanel.tsx',
    summary: '广场面板组件，实现社区发帖、组队、评论、点赞和帖子详情功能。',
    tags: ['component', 'social', 'community']
  },
  'src/main.tsx': {
    type: 'file',
    name: 'main.tsx',
    summary: 'React 应用入口，挂载根组件到 DOM 并加载全局样式。',
    tags: ['entry-point', 'bootstrap', 'react']
  },
  // ── Batch 3 ──
  'src/__tests__/utils.test.ts': {
    type: 'file',
    name: 'utils.test.ts',
    summary: '工具函数单元测试，覆盖购物车键生成、价格计算和本地存储操作。',
    tags: ['test', 'unit-test', 'utils']
  },
  'src/components/AdminPanel.tsx': {
    type: 'file',
    name: 'AdminPanel.tsx',
    summary: '管理后台面板，提供订单管理（实时通知、状态流转、CSV导出）、商品CRUD和今日统计。',
    tags: ['component', 'admin', 'dashboard', 'order-management']
  },
  'src/components/OrderCard.tsx': {
    type: 'file',
    name: 'OrderCard.tsx',
    summary: '订单卡片组件，可展开显示订单详情和提供状态操作按钮。',
    tags: ['component', 'order', 'admin']
  },
  'src/constants.ts': {
    type: 'file',
    name: 'constants.ts',
    summary: '常量定义文件，包含默认分类列表和默认商品数据。',
    tags: ['constants', 'configuration', 'data']
  },
  'src/customerReducer.ts': {
    type: 'file',
    name: 'customerReducer.ts',
    summary: '顾客端状态管理 reducer，处理购物车、商品筛选和订单提交流程的状态转换。',
    tags: ['state-management', 'reducer', 'cart']
  },
  'src/hooks/useCustomerApp.ts': {
    type: 'file',
    name: 'useCustomerApp.ts',
    summary: '顾客端核心 Hook，整合产品加载、购物车操作、订单创建和剪贴板复制等业务逻辑。',
    tags: ['hook', 'business-logic', 'state-management']
  },
  'src/types.ts': {
    type: 'file',
    name: 'types.ts',
    summary: 'TypeScript 类型定义文件，声明 Product、CartItem、Order、Post 等核心数据类型。',
    tags: ['type-definition', 'typescript', 'data-model']
  },
  'src/utils.ts': {
    type: 'file',
    name: 'utils.ts',
    summary: '通用工具函数，含购物车键生成、价格计算、本地存储读写和错误消息提取。',
    tags: ['utility', 'cart', 'local-storage']
  },
  // ── Batch 4 ──
  'docker-compose.yml': {
    type: 'service',
    name: 'docker-compose.yml',
    summary: 'Docker Compose 配置，定义单服务部署方案，挂载数据卷并映射端口。',
    tags: ['orchestration', 'infrastructure', 'deployment']
  },
  'Dockerfile': {
    type: 'service',
    name: 'Dockerfile',
    summary: '多阶段 Docker 构建文件，编译前端和 TypeScript 服务端代码，产出最小化生产镜像。',
    tags: ['containerization', 'infrastructure', 'deployment']
  },
  // ── Batch 5 ──
  '.github/workflows/deploy.yml': {
    type: 'pipeline',
    name: 'deploy.yml',
    summary: 'GitHub Actions 部署工作流，通过 SSH 将代码同步到阿里云 ECS 并重启 Docker 容器。',
    tags: ['ci-cd', 'deployment', 'github-actions']
  },
  // ── Batch 6 ──
  '.env.example': {
    type: 'config',
    name: '.env.example',
    summary: '环境变量模板文件，定义 PORT、ADMIN_KEY、DB_PATH 等配置项示例。',
    tags: ['configuration', 'environment', 'template']
  },
  'CLAUDE.md': {
    type: 'document',
    name: 'CLAUDE.md',
    summary: '项目开发指南文档，面向 AI 编程助手，详述架构、命令、部署流程和代码规范。',
    tags: ['documentation', 'development', 'ai-guide']
  },
  'README.md': {
    type: 'document',
    name: 'README.md',
    summary: '项目说明文档，介绍窝里蹲点单系统的技术栈、本地开发和部署方式。',
    tags: ['documentation', 'entry-point', 'overview']
  },
  'REQUIREMENTS.md': {
    type: 'document',
    name: 'REQUIREMENTS.md',
    summary: '需求文档，详细描述系统功能需求、交互流程和设计规范。',
    tags: ['documentation', 'requirements', 'specification']
  },
  'index.html': {
    type: 'file',
    name: 'index.html',
    summary: 'SPA 入口 HTML 文件，定义根挂载节点和页面元数据。',
    tags: ['entry-point', 'html', 'spa']
  },
  'metadata.json': {
    type: 'config',
    name: 'metadata.json',
    summary: '项目元数据配置文件。',
    tags: ['configuration', 'metadata']
  },
  'package.json': {
    type: 'config',
    name: 'package.json',
    summary: 'NPM 包配置，定义项目依赖、脚本命令和构建配置。依赖 React 19、Express、better-sqlite3 等。',
    tags: ['configuration', 'dependencies', 'build-system']
  },
  'tsconfig.json': {
    type: 'config',
    name: 'tsconfig.json',
    summary: 'TypeScript 前端编译配置，启用严格模式和 JSX 支持。',
    tags: ['configuration', 'typescript', 'build-system']
  },
  'tsconfig.server.json': {
    type: 'config',
    name: 'tsconfig.server.json',
    summary: 'TypeScript 服务端编译配置，输出 CommonJS 模块以兼容 Node.js 运行环境。',
    tags: ['configuration', 'typescript', 'server']
  },
  // ── Batch 7 ──
  '.understand-anything/.understandignore': {
    type: 'file',
    name: '.understandignore',
    summary: '代码分析忽略规则文件，定义分析时排除的文件和目录模式。',
    tags: ['configuration', 'analysis', 'ignore-patterns']
  },
  '.understand-anything/config.json': {
    type: 'config',
    name: 'config.json',
    summary: 'Understand-Anything 分析配置，指定输出语言等选项。',
    tags: ['configuration', 'analysis']
  },
  'eslint.config.mjs': {
    type: 'file',
    name: 'eslint.config.mjs',
    summary: 'ESLint 配置文件，定义 TypeScript 和 React 代码检查规则。',
    tags: ['configuration', 'linting', 'code-quality']
  },
  'src/__tests__/ErrorBoundary.test.tsx': {
    type: 'file',
    name: 'ErrorBoundary.test.tsx',
    summary: 'ErrorBoundary 组件测试，验证错误捕获和回退 UI 渲染逻辑。',
    tags: ['test', 'component-test', 'error-handling']
  },
  'src/components/AnalyticsPanel.tsx': {
    type: 'file',
    name: 'AnalyticsPanel.tsx',
    summary: '数据分析面板组件，可视化展示订单统计图表和趋势。',
    tags: ['component', 'analytics', 'charts']
  },
  'src/components/BarChart.tsx': {
    type: 'file',
    name: 'BarChart.tsx',
    summary: '柱状图组件，基于 Canvas 渲染数据可视化图表。',
    tags: ['component', 'charts', 'visualization']
  },
  'src/components/ErrorBoundary.tsx': {
    type: 'file',
    name: 'ErrorBoundary.tsx',
    summary: 'React 错误边界组件，捕获子组件渲染异常并展示友好的错误回退界面。',
    tags: ['component', 'error-handling', 'boundary']
  },
  'src/index.css': {
    type: 'file',
    name: 'index.css',
    summary: '全局样式文件，引入 Tailwind CSS v4 和自定义滚动条隐藏工具类。',
    tags: ['stylesheet', 'tailwind', 'global']
  },
  'vite.config.ts': {
    type: 'file',
    name: 'vite.config.ts',
    summary: 'Vite 构建配置，设置 API 代理、路径别名和环境变量注入。',
    tags: ['configuration', 'vite', 'build-system']
  },
  'vitest.config.ts': {
    type: 'file',
    name: 'vitest.config.ts',
    summary: 'Vitest 测试框架配置，设置测试环境和路径别名。',
    tags: ['configuration', 'testing', 'vitest']
  }
};

// ── Function summaries, tags, and complexity ──
const FUNC_META = {
  // Batch 1
  'server/app.ts:createApp': {
    summary: '创建并配置 Express 应用实例，注册路由、中间件和全局错误处理。',
    tags: ['factory', 'express', 'middleware']
  },
  'server/db.ts:getDb': {
    summary: '获取 SQLite 数据库单例，首次调用时初始化连接、迁移和默认数据。',
    tags: ['singleton', 'database', 'initialization']
  },
  'server/db.ts:runMigrations': {
    summary: '执行数据库版本迁移，从 v1 到 v5 逐步升级表结构。',
    tags: ['migration', 'database', 'schema']
  },
  'server/db.ts:initTables': {
    summary: '创建数据库核心表结构（products、orders、posts 等）。',
    tags: ['database', 'schema', 'ddl']
  },
  'server/db.ts:seedDefaults': {
    summary: '首次运行时插入默认商品数据。',
    tags: ['database', 'seed', 'initialization']
  },
  'server/middleware/auth.ts:requireAdmin': {
    summary: '验证请求头中的管理员密钥，不匹配则返回 403。',
    tags: ['middleware', 'authentication', 'guard']
  },
  'server/middleware/rateLimit.ts:rateLimit': {
    summary: '创建限流中间件工厂函数，按 IP + 方法限制请求频率。',
    tags: ['middleware', 'rate-limiting', 'factory']
  },
  'server/routes/auth.ts:hashPassword': {
    summary: '使用 SHA-256 对密码进行哈希加密。',
    tags: ['utility', 'security', 'hashing']
  },
  'server/routes/orders.ts:serializeOrder': {
    summary: '将数据库订单记录转换为 API 响应格式，解析 JSON 字段。',
    tags: ['serialization', 'transformation']
  },
  'server/routes/products.ts:serializeProduct': {
    summary: '将数据库商品记录转换为 API 响应格式，转换布尔字段。',
    tags: ['serialization', 'transformation']
  },
  'server/routes/stats.ts:daysInMonth': {
    summary: '计算指定年月的天数。',
    tags: ['utility', 'date']
  },
  // Batch 2
  'src/App.tsx:CustomerApp': {
    summary: '顾客端主组件，管理标签切换、商品浏览、购物车操作和订单确认流程。',
    tags: ['component', 'main', 'customer']
  },
  'src/App.tsx:App': {
    summary: '应用根组件，根据路径分派顾客端或管理后台界面。',
    tags: ['entry-point', 'router', 'root']
  },
  'src/api.ts:request': {
    summary: '通用 HTTP 请求函数，支持指数退避重试和统一错误处理。',
    tags: ['http', 'retry', 'error-handling']
  },
  'src/api.ts:getErrorMessage': {
    summary: '从错误对象中提取可读的错误消息。',
    tags: ['utility', 'error-handling']
  },
  'src/api.ts:createOrder': {
    summary: '创建订单 API，发送用户身份、商品列表和配送选项。',
    tags: ['api-client', 'order']
  },
  'src/api.ts:fetchProducts': {
    summary: '获取所有商品列表。',
    tags: ['api-client', 'product']
  },
  'src/components/AdminGate.tsx:AdminGate': {
    summary: '管理员入口组件，提供密钥输入和自动验证功能。',
    tags: ['component', 'admin', 'gate']
  },
  'src/components/CartPanel.tsx:CartPanel': {
    summary: '购物车面板，展示商品、调整数量、选择配送方式并计算总价。',
    tags: ['component', 'cart', 'checkout']
  },
  'src/components/IdentityForm.tsx:IdentityForm': {
    summary: '身份表单，支持注册和登录模式切换，收集用户信息。',
    tags: ['component', 'identity', 'form']
  },
  'src/components/OrderHistory.tsx:OrderHistory': {
    summary: '订单历史组件，支持订单列表、实时刷新和状态变更高亮。',
    tags: ['component', 'orders', 'history']
  },
  'src/components/ProductCard.tsx:ProductCard': {
    summary: '商品卡片，展示商品信息、库存状态、热度标签和加购按钮。',
    tags: ['component', 'product', 'card']
  },
  'src/components/ProfileForm.tsx:ProfileForm': {
    summary: '个人资料编辑表单，支持修改宿舍号和密码。',
    tags: ['component', 'profile', 'form']
  },
  'src/components/SquarePanel.tsx:SquarePanel': {
    summary: '广场面板主组件，管理帖子列表、创建、互动和评论区。',
    tags: ['component', 'social', 'community']
  },
  // Batch 3
  'src/components/AdminPanel.tsx:AdminPanel': {
    summary: '管理后台主面板，整合订单管理（实时通知+状态流转）、商品CRUD和统计概览。',
    tags: ['component', 'admin', 'dashboard']
  },
  'src/components/OrderCard.tsx:OrderCard': {
    summary: '可展开的订单卡片，显示订单详情并提供备货/送达/取消操作按钮。',
    tags: ['component', 'order', 'expandable']
  },
  'src/customerReducer.ts:createInitialState': {
    summary: '创建顾客端初始状态，包含默认分类和空购物车。',
    tags: ['factory', 'state', 'initialization']
  },
  'src/customerReducer.ts:customerReducer': {
    summary: '顾客端核心 Reducer，处理购物车增删改、商品筛选和订单确认等 15+ 种 Action。',
    tags: ['reducer', 'state-management', 'cart']
  },
  'src/hooks/useCustomerApp.ts:useCustomerApp': {
    summary: '顾客端核心 Hook，整合产品加载轮询、购物车操作、订单创建和剪贴板复制。',
    tags: ['hook', 'business-logic', 'orchestration']
  },
  'src/utils.ts:getCartKey': {
    summary: '生成购物车项的唯一键（基于商品ID+冲泡/冷冻选项）。',
    tags: ['utility', 'cart', 'key-generation']
  },
  'src/utils.ts:getItemUnitPrice': {
    summary: '计算单个购物车项的单价（含附加服务费）。',
    tags: ['utility', 'pricing', 'cart']
  },
  'src/utils.ts:getCartStorageKey': {
    summary: '获取当前用户购物车的 localStorage 键名。',
    tags: ['utility', 'local-storage', 'cart']
  },
  'src/utils.ts:loadCartFromStorage': {
    summary: '从 localStorage 加载当前用户的购物车数据。',
    tags: ['utility', 'local-storage', 'persistence']
  },
  'src/utils.ts:saveCartToStorage': {
    summary: '将购物车数据持久化到 localStorage。',
    tags: ['utility', 'local-storage', 'persistence']
  },
  // Batch 7
  'src/__tests__/ErrorBoundary.test.tsx:BrokenComponent': {
    summary: '测试用组件，可控制是否抛出错误以验证 ErrorBoundary 行为。',
    tags: ['test', 'mock', 'component']
  },
  'src/components/AnalyticsPanel.tsx:AnalyticsPanel': {
    summary: '数据分析面板，支持日/周/月维度切换和数据图表可视化。',
    tags: ['component', 'analytics', 'dashboard']
  },
  'src/components/BarChart.tsx:BarChart': {
    summary: '可复用柱状图组件，基于 Canvas API 渲染响应式数据图表。',
    tags: ['component', 'chart', 'canvas']
  },
  'src/components/ErrorBoundary.tsx:ErrorBoundary': {
    summary: 'React 错误边界，捕获子组件异常并渲染友好的错误回退界面。',
    tags: ['component', 'error-handling', 'boundary']
  }
};

function makeFileNode(filePath, meta, extract) {
  const e = extract || {};
  const ex = meta.complexity || complexity(e.nonEmptyLines || 0);
  return {
    id: `${meta.type}:${filePath}`,
    type: meta.type,
    name: meta.name,
    filePath: filePath,
    summary: meta.summary,
    tags: meta.tags,
    complexity: ex
  };
}

function makeFuncNode(filePath, func, meta) {
  const m = meta || {};
  return {
    id: `function:${filePath}:${func.name}`,
    type: 'function',
    name: func.name,
    filePath: filePath,
    lineRange: [func.startLine, func.endLine],
    summary: m.summary || `函数 ${func.name}`,
    tags: m.tags || ['function'],
    complexity: complexity(func.endLine - func.startLine + 1)
  };
}

function makeClassNode(filePath, cls, meta) {
  const m = meta || {};
  return {
    id: `class:${filePath}:${cls.name}`,
    type: 'class',
    name: cls.name,
    filePath: filePath,
    lineRange: [cls.startLine, cls.endLine],
    summary: m.summary || `类 ${cls.name}`,
    tags: m.tags || ['class'],
    complexity: complexity(cls.endLine - cls.startLine + 1)
  };
}

// ── Process each batch ──
for (let bi = 1; bi <= 7; bi++) {
  const extractPath = path.join(TMP, `ua-file-extract-results-${bi}.json`);
  const inputPath = path.join(TMP, `ua-file-analyzer-input-${bi}.json`);

  if (!fs.existsSync(extractPath) || !fs.existsSync(inputPath)) {
    console.error(`Missing files for batch ${bi}`);
    continue;
  }

  const extract = JSON.parse(fs.readFileSync(extractPath, 'utf8'));
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const importData = input.batchImportData || {};

  const nodes = [];
  const edges = [];

  for (const result of extract.results) {
    const fp = result.path;
    const fmeta = FILE_META[fp];
    if (!fmeta) { console.warn(`No meta for ${fp}`); continue; }

    // ── File node ──
    const fileNode = makeFileNode(fp, fmeta, result);
    nodes.push(fileNode);

    // ── Function/Class nodes ──
    const funcs = result.functions || [];
    for (const func of funcs) {
      const key = `${fp}:${func.name}`;
      const fm = FUNC_META[key];
      const fn = makeFuncNode(fp, func, fm);
      nodes.push(fn);
      // contains edge
      edges.push({ source: fileNode.id, target: fn.id, type: 'contains', direction: 'forward', weight: 1.0 });
      // exports edge for exported functions
      const exp = (result.exports || []).find(x => x.name === func.name);
      if (exp) {
        edges.push({ source: fileNode.id, target: fn.id, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }

    const classes = result.classes || [];
    for (const cls of classes) {
      const key = `${fp}:${cls.name}`;
      const cm = FUNC_META[key];
      const cn = makeClassNode(fp, cls, cm);
      nodes.push(cn);
      edges.push({ source: fileNode.id, target: cn.id, type: 'contains', direction: 'forward', weight: 1.0 });
      const exp = (result.exports || []).find(x => x.name === cls.name);
      if (exp) {
        edges.push({ source: fileNode.id, target: cn.id, type: 'exports', direction: 'forward', weight: 0.8 });
      }
    }

    // ── Import edges ──
    const imports = importData[fp] || [];
    for (const imp of imports) {
      const targetMeta = FILE_META[imp];
      const targetType = targetMeta ? targetMeta.type : 'file';
      edges.push({
        source: fileNode.id,
        target: `${targetType}:${imp}`,
        type: 'imports',
        direction: 'forward',
        weight: 0.7
      });
    }

    // ── Category-specific edges ──
    if (fmeta.type === 'config') {
      // Config files configure related code
      if (fp === 'package.json') {
        edges.push({ source: `config:${fp}`, target: 'file:src/main.tsx', type: 'configures', direction: 'forward', weight: 0.6 });
        edges.push({ source: `config:${fp}`, target: 'file:server/index.ts', type: 'configures', direction: 'forward', weight: 0.6 });
      }
      if (fp === 'tsconfig.json') {
        edges.push({ source: `config:${fp}`, target: 'file:src/App.tsx', type: 'configures', direction: 'forward', weight: 0.6 });
      }
      if (fp === 'tsconfig.server.json') {
        edges.push({ source: `config:${fp}`, target: 'file:server/index.ts', type: 'configures', direction: 'forward', weight: 0.6 });
      }
      if (fp === '.env.example') {
        edges.push({ source: `config:${fp}`, target: 'file:server/index.ts', type: 'configures', direction: 'forward', weight: 0.6 });
      }
    }

    if (fmeta.type === 'document') {
      if (fp === 'README.md') {
        edges.push({ source: `document:${fp}`, target: 'file:src/App.tsx', type: 'documents', direction: 'forward', weight: 0.5 });
        edges.push({ source: `document:${fp}`, target: 'file:server/index.ts', type: 'documents', direction: 'forward', weight: 0.5 });
      }
      if (fp === 'CLAUDE.md') {
        edges.push({ source: `document:${fp}`, target: 'file:src/App.tsx', type: 'documents', direction: 'forward', weight: 0.5 });
      }
    }

    if (fmeta.type === 'service') {
      edges.push({ source: `service:${fp}`, target: 'file:server/index.ts', type: 'deploys', direction: 'forward', weight: 0.7 });
      edges.push({ source: `service:${fp}`, target: 'file:src/main.tsx', type: 'deploys', direction: 'forward', weight: 0.7 });
    }

    if (fmeta.type === 'pipeline') {
      edges.push({ source: `pipeline:${fp}`, target: 'service:Dockerfile', type: 'triggers', direction: 'forward', weight: 0.6 });
      edges.push({ source: `pipeline:${fp}`, target: 'service:docker-compose.yml', type: 'triggers', direction: 'forward', weight: 0.6 });
    }

    // ── Test edges ──
    if (fp.includes('__tests__') || fp.includes('.test.')) {
      // Find the source file being tested
      const testImports = importData[fp] || [];
      for (const timp of testImports) {
        const tmeta = FILE_META[timp];
        if (tmeta && tmeta.type === 'file') {
          edges.push({
            source: `${tmeta.type}:${timp}`,  // production → test
            target: fileNode.id,
            type: 'tested_by',
            direction: 'forward',
            weight: 0.5
          });
        }
      }
    }
  }

  // ── Infra cross-file edges ──
  for (const result of extract.results) {
    const fp = result.path;
    if (fp === 'docker-compose.yml') {
      edges.push({ source: 'service:docker-compose.yml', target: 'service:Dockerfile', type: 'depends_on', direction: 'forward', weight: 0.6 });
    }
  }

  // ── Write output ──
  const outputPath = path.join(INTER, `batch-${bi}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ nodes, edges }, null, 2));
  console.log(`Batch ${bi}: ${nodes.length} nodes, ${edges.length} edges → batch-${bi}.json`);
}

console.log('Done! All 7 batches written.');
