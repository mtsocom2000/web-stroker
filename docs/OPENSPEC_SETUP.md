# OpenSpec 完整栈安装指南

**安装日期**: 2026-03-29  
**状态**: ✅ 已完成安装

---

## 📦 已安装的组件

### 1. OpenSpec Core
```
@fission-ai/openspec@1.2.0
```
**用途**: Spec 驱动开发的核心框架

**命令**:
```bash
openspec init              # 初始化项目
openspec change <name>     # 创建变更
openspec verify            # 验证实现
```

---

### 2. OpenCode Plugin: opencode-plugin-openspec
```
opencode-plugin-openspec@0.1.4
```
**GitHub**: https://github.com/Octane0411/opencode-plugin-openspec

**用途**: 
- 专用的 `openspec-plan` 模式
- 分离规划和实现阶段
- 保护代码不被意外修改

**使用**:
1. 在 OpenCode 中选择 **OpenSpec Architect** Agent
2. 开始规划架构
3. 切换到其他 Agent 进行实现

---

### 3. OpenSpec Skills

#### openspec-proposal-creation
**来源**: forztf/open-skilled-sdd  
**安装数**: 243

**用途**: 创建 OpenSpec 提案文档

**命令**:
```bash
# 在 OpenCode 中使用
/openspec-proposal-creation
```

#### openspec-implementation
**来源**: forztf/open-skilled-sdd  
**安装数**: 216

**用途**: 实现 OpenSpec 变更任务

**命令**:
```bash
# 在 OpenCode 中使用
/openspec-implementation
```

---

### 4. OpenSpec + Playwright E2E (可选)
```
openspec-playwright@0.1.29
```
**GitHub**: https://github.com/wxhou/openspec-playwright

**用途**: 
- 自动化 E2E 测试验证
- 三 Agent 测试流水线

**命令**:
```bash
openspec-pw init          # 初始化 (一次性)
openspec-pw doctor        # 检查环境
/opsx:e2e <feature>       # 运行 E2E 测试
```

---

## 🚀 快速开始

### 1. 初始化 OpenSpec 项目

```bash
cd your-project
openspec init
```

这会创建:
```
your-project/
├── AGENTS.md
├── project.md
└── openspec/
    └── changes/
```

### 2. 创建新变更

```bash
openspec change add-user-auth
```

创建:
```
openspec/changes/add-user-auth/
├── proposal.md
└── specs/
    ├── user-auth.md
    └── api-endpoints.md
```

### 3. 使用 OpenSpec Architect 规划

在 OpenCode 中:
1. 选择 **OpenSpec Architect** Agent
2. 描述你的需求
3. Agent 会创建/编辑 spec 文件

### 4. 实现变更

切换到开发 Agent:
```bash
/openspec-implementation
```

Agent 会:
1. 读取 specs
2. 创建实现计划
3. 编写代码

### 5. 验证 (可选)

```bash
openspec verify add-user-auth
```

### 6. E2E 测试 (可选)

```bash
/opsx:e2e add-user-auth
```

---

## 📋 OpenSpec 工作流

```
1. 发现需求
       ↓
2. 创建变更 (openspec change <name>)
       ↓
3. 规划架构 (OpenSpec Architect Agent)
       ↓
4. 实现功能 (Implementation Agent)
       ↓
5. 验证实现 (openspec verify)
       ↓
6. E2E 测试 (/opsx:e2e)
       ↓
7. 归档变更 (openspec archive)
```

---

## 🔧 配置

### opencode.json

插件已自动添加到全局配置:

```json
{
  "plugin": ["opencode-plugin-openspec"]
}
```

位置: `~/.config/opencode/opencode.json`

### Skills 位置

```
~/.agents/skills/
├── openspec-proposal-creation/
└── openspec-implementation/
```

---

## 📖 参考文档

- [OpenSpec 官方文档](https://github.com/fission-ai/openspec)
- [OpenSpec Plugin](https://github.com/Octane0411/opencode-plugin-openspec)
- [OpenSpec Skills](https://github.com/forztf/open-skilled-sdd)
- [Playwright E2E](https://github.com/wxhou/openspec-playwright)

---

## ⚠️ 注意事项

1. **权限**: Skills 以完整 Agent 权限运行，使用前请审查代码
2. **Node.js**: 需要 Node.js >= 20
3. **Playwright**: E2E 测试需要手动安装浏览器
   ```bash
   npx playwright install --with-deps
   ```

---

## 🐛 故障排除

### 问题：OpenSpec 命令未找到

```bash
# 确认全局安装
npm list -g @fission-ai/openspec

# 重新安装
npm install -g @fission-ai/openspec
```

### 问题：Skills 未加载

```bash
# 检查技能目录
ls ~/.agents/skills/ | grep openspec

# 重新安装技能
npx skills add forztf/open-skilled-sdd@openspec-proposal-creation -g -y
```

### 问题：OpenCode 插件未激活

```bash
# 检查配置
cat ~/.config/opencode/opencode.json

# 重启 OpenCode
```

---

**安装完成时间**: 2026-03-29  
**维护者**: Development Team
