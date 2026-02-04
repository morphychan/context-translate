# Context Translate - 双语对照翻译扩展

基于 [Immersive Translate](https://github.com/immersive-translate/immersive-translate) 的归档版本 fork 而来，新增了 **LLM 翻译**支持。

## 项目来源

本项目 fork 自 [immersive-translate](https://github.com/immersive-translate/immersive-translate) 的归档代码，该项目原始 fork 自 [TWP (Traduzir-paginas-web)](https://github.com/FilipePS/Traduzir-paginas-web)。

> 注：原项目已迁移到新架构，本仓库为个人自用版本。

## 新增功能

### LLM 翻译支持

支持使用大语言模型进行翻译，相比传统翻译引擎：
- 更自然的译文
- 更好的上下文理解
- 支持自定义 Prompt

**支持的 LLM 提供商：**

| 提供商 | 类型 | 说明 |
|--------|------|------|
| Ollama | 本地 | 免费，隐私友好，需要本地部署 |
| OpenRouter | 云端 | 支持多种模型（Claude、GPT-4 等），需要 API Key |

### 原有功能

- 双语对照显示（原文 + 译文）
- 仅翻译内容区域，保留页面布局
- 支持 Google、Yandex 翻译引擎
- 支持 PDF 文件翻译
- 针对 Twitter、Reddit、Hacker News 等网站优化

## 安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/your-username/context-translate.git
cd context-translate

# 安装依赖
npm install

# 构建
npm run chrome    # Chrome 版本
npm run firefox   # Firefox 版本
npm run build     # 全部构建
```

### 加载到浏览器

**Chrome / Edge：**
1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist/chrome` 文件夹

**Firefox：**
1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击「临时载入附加组件」
3. 选择 `dist/firefox/manifest.json`

## 配置 LLM 翻译

1. 打开扩展的 **Options** 页面
2. 在「Page translation service」中选择 **LLM**
3. 选择 Provider（Ollama 或 OpenRouter）
4. 配置相应参数：

**Ollama（本地）：**
- API URL：`http://localhost:11434`（默认）
- Model：`qwen2.5:7b`（或其他已安装的模型）

**OpenRouter（云端）：**
- API URL：`https://openrouter.ai/api/v1`
- API Key：你的 OpenRouter API Key
- Model：`anthropic/claude-3-haiku`（或其他支持的模型）

5. 点击 **Test Connection** 测试连接
6. 翻译失败时会自动 fallback 到 Google 翻译

## 使用

- 点击浏览器工具栏的扩展图标
- 或使用快捷键：
  - `Ctrl+T` / `MacCtrl+T`：切换翻译
  - `Ctrl+D` / `MacCtrl+D`：切换双语显示

## 致谢

- [FilipePS/Traduzir-paginas-web](https://github.com/FilipePS/Traduzir-paginas-web) - 原始项目
- [immersive-translate](https://github.com/immersive-translate/immersive-translate) - Fork 来源

## License

[MPL 2.0 (Mozilla Public License)](LICENSE)
