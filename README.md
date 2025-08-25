# NeonClean（霓虹清理）

智能化电脑垃圾清理工具（Windows）。提供“推荐/可选”分级的安全清理、进度与取消、现代霓虹风 UI。

## 特性
- 智能扫描常见垃圾：临时目录、浏览器/应用缓存、回收站、缩略图与系统更新缓存
- “推荐/可选”分级：推荐项低风险，可选项多为系统级缓存（都会自动重建）
- 进度与可取消：扫描与清理均有百分比进度，支持随时取消
- 安全容错：忽略被占用/无权限的文件，不中断任务
- 现代 UI：霓虹渐变进度环、玻璃卡片、清晰的列表交互

## 可清理项（持续扩充）
推荐（安全）：
- 系统临时文件（os.tmpdir）、用户临时文件（%LocalAppData%\Temp）
- 回收站（全部磁盘）
- 浏览器缓存（默认配置文件）
  - Chrome：Cache / Code Cache / GPUCache
  - Edge：Cache / Code Cache / GPUCache
  - Firefox：cache2
  - Brave：Cache / Code Cache / GPUCache
  - Vivaldi：Cache / Code Cache / GPUCache
  - Opera：Cache / Code Cache / GPUCache
- 应用缓存
  - VS Code：Cache / CachedData / GPUCache / Service Worker CacheStorage
  - Discord：Cache / Code Cache / GPUCache / Service Worker CacheStorage
- 包管理器缓存
  - npm 缓存（%AppData%\npm-cache）
  - Yarn 缓存（%LocalAppData%\Yarn\Cache）
- Windows 缩略图缓存（thumbcache*.db，系统会自动重建）

可选（进阶，可能需要管理员权限）：
- Windows 更新缓存：C:\Windows\SoftwareDistribution\Download
- Windows 交付优化缓存：C:\Windows\SoftwareDistribution\DeliveryOptimization
- Windows 错误报告（WER）：C:\ProgramData\Microsoft\Windows\WER
- 系统 Prefetch：C:\Windows\Prefetch
- pnpm 存储：%LocalAppData%\pnpm\store / store-v3

说明：可选项均可安全删除，系统/工具会再生成；首次使用相关功能可能略慢。

## 运行
环境：Windows 10/11，Node.js LTS（建议 18 或 20）

```powershell
# 进入项目目录
cd "c:\Users\chu01\Desktop\wangp\lalajiji"

# 可选：Electron 下载加速镜像
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

# 安装依赖并启动
npm install
npm run dev
```

使用流程：开始扫描 → 全选推荐 → 一键清理  
提权建议：清理“更新缓存/交付优化/Prefetch/WER”等系统目录时，请以管理员身份启动 PowerShell 再运行

## 打包为 Windows 安装包（exe）
项目已集成 electron-builder（配置见 package.json 的 build 字段）。
- 准备图标：将 256×256 ICO 放到 build/icon.ico
- 打包命令：
```powershell
npm run dist:win
```
- 产物：dist/NeonClean-版本号-Setup.exe（NSIS 安装器）
- 便携版（可选）：`npx electron-builder --win portable`

## 常见问题
- “npm 不是内部命令”：安装 Node.js 后重开终端
- Electron 下载慢：设置上面的 ELECTRON_MIRROR 后重新 `npm install`
- 无权限清理：以管理员身份运行终端
- SmartScreen 警告：未签名应用属正常，正式发布可配置代码签名（购买证书后在 electron-builder 中配置）

## 安全与隐私
- 仅访问本机缓存/临时目录，不收集或上传任何个人数据
- 清理逻辑忽略被占用文件，尽量避免对系统/软件造成影响