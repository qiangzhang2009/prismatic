# SpecStory：完整修复聊天记录方案

## 一、SpecStory失效不保存聊天记录：从易到难的完整修复方案

SpecStory的核心原理是**只读Cursor本地SQLite数据库（state.vscdb）中的聊天数据，自动导出为项目内.specstory文件夹的Markdown文件**，失效几乎都源于Cursor版本更新、权限问题、存储结构变更或插件配置异常，按以下优先级逐步修复即可：

### 步骤1：基础功能校验与开关重置（5分钟快速排查）

1. **确认自动保存功能正常开启**

打开Cursor命令面板（`Ctrl+Shift+P` Windows/Linux，`Cmd+Shift+P` macOS），输入并执行 `SpecStory: Auto Save`，确保开关处于**启用**状态；再执行 `SpecStory: Save Composer and Chat History`，手动触发一次保存，查看项目根目录是否生成 `.specstory/history` 文件夹，且里面有最新的Markdown聊天记录文件。

1. **校验项目路径一致性**

Cursor的聊天记录绑定的是**绝对工作区路径**，如果你的项目文件夹改名、移动了位置、更换了磁盘挂载路径，会导致SpecStory无法匹配到对应的workspace聊天数据。

解决方法：关闭Cursor，重新通过「文件-打开文件夹」选择当前项目的**完整正确路径**打开，再重试保存功能。

1. **关闭Cursor冲突的Beta功能**

部分Cursor Beta功能会修改聊天数据的存储结构，导致SpecStory读取失败。打开Cursor设置 → 找到Beta选项卡，关闭 `Agent Window`、`Advanced Context Discovery` 等实验性功能，重启Cursor后重试。

### 步骤2：权限与存储路径修复

1. **修复文件夹写入权限**

SpecStory需要在项目根目录创建并写入 `.specstory` 文件夹，如果你的项目在系统保护目录、云端同步盘（OneDrive/ iCloud）、NAS挂载盘，或Linux/macOS下没有写入权限，会导致保存失败。

解决方法：

- Windows：右键项目文件夹 → 属性 → 安全，给当前用户勾选「完全控制」权限；

- macOS/Linux：终端进入项目目录，执行 `chmod 755 . && mkdir -p .specstory/history && chmod 755 .specstory`，手动创建文件夹并赋予写入权限；

- 避免将项目放在实时同步的云端盘内，同步锁会导致文件写入失败。

1. **确认Cursor本地数据库路径正常**

SpecStory的数据源是Cursor本地的state.vscdb数据库，先确认数据库文件存在（不同系统路径如下）：

|系统|核心数据库路径|
|---|---|
|Windows|`%APPDATA%\Cursor\User\workspaceStorage\`|
|macOS|`~/Library/Application Support/Cursor/User/workspaceStorage/`|
|Linux|`~/.config/Cursor/User/workspaceStorage/`|
|进入路径后，每个hash命名的文件夹对应一个项目，打开里面的 `workspace.json` 可匹配到对应的项目路径，确认 `state.vscdb` 文件存在且大小不为0（为空说明聊天数据本身没有被Cursor保存）。||
### 步骤3：插件重装与版本兼容修复

1. **彻底重装SpecStory插件**

打开Cursor扩展面板，找到SpecStory，点击卸载 → 完全关闭Cursor（包括后台进程）→ 重新打开Cursor → 重新搜索安装SpecStory最新版 → 重启Cursor后重试自动保存功能。

1. **降级适配旧版Cursor**

如果你更新了Cursor最新版后出现失效，大概率是Cursor修改了聊天数据的存储表结构，SpecStory还未适配。可以：

- 前往Cursor官网下载上一个稳定版重装；

- 或在SpecStory的GitHub/官方文档查看是否有兼容最新Cursor的版本更新。

### 步骤4：终极手动兜底修复（以上都无效时使用）

如果自动保存功能完全失效，可手动导出Cursor聊天数据，再放入SpecStory目录实现历史回溯：

1. 关闭Cursor，找到对应项目的 `state.vscdb` 文件（见步骤2的路径）；

2. 用SQLite工具（如DB Browser for SQLite）打开该文件，查询 `ItemTable` 或 `cursorDiskKV` 表，找到key为 `composer.composerData`、`workbench.panel.aichat.view.aichat.chatdata` 相关的聊天数据，导出为JSON/Markdown格式；

3. 将导出的Markdown文件放入项目的 `.specstory/history/` 目录，重启Cursor后，SpecStory即可正常识别和加载这些历史记录。

---

## 二、SpecStory无法修复时，推荐的Cursor长效记忆平替方案

如果SpecStory持续无法适配，以下方案可完美替代，甚至实现更强的跨会话长效记忆，按适配度和易用性排序：

### 1. cursaves（最贴合SpecStory的开源平替）

- 仓库地址：[https://github.com/Callum-Ward/cursaves](https://github.com/Callum-Ward/cursaves)

- 核心优势：专为Cursor打造的聊天记录持久化工具，和SpecStory功能高度一致，**原生适配Cursor最新的存储结构**，自动备份所有项目的聊天记录，支持一键导出Markdown、跨会话检索历史、自动归档，完全开源免费，无云依赖，所有数据本地存储。

- 上手成本：一键安装Cursor扩展，开箱即用，无需额外配置，自动接管所有项目的聊天记录保存。

### 2. cursor-memory-bank（长效项目记忆标杆）

- 仓库地址：[https://github.com/bramscher/cursor-memory-bank](https://github.com/bramscher/cursor-memory-bank)

- 核心优势：不止是聊天记录保存，更是为Cursor打造**全生命周期的项目持久化记忆**。纯Markdown文件实现，零外部依赖，不仅保存聊天历史，还能固化项目技术决策、开发进度、代码规范、需求文档，让Cursor在跨会话、跨窗口、甚至跨设备时，完整记住项目的所有上下文，彻底解决AI“失忆”问题，社区活跃度极高，适配Cursor所有最新版本。

### 3. Cursor原生零依赖备份方案（终极兜底）

如果不想安装任何扩展，可直接用系统定时任务实现自动备份，彻底杜绝数据丢失：

- Windows：创建批处理脚本，定时复制 `%APPDATA%\Cursor\User\` 整个目录到备份文件夹；

- macOS/Linux：创建crontab定时任务，定时执行 `cp -r ~/Library/Application\ Support/Cursor/User/ ~/cursor_backup/$(date +%Y%m%d)`，实现每日自动备份所有聊天数据库。

---

## 三、Cursor项目长效记忆的终极搭建方案

想要彻底解决Cursor跨会话失忆、聊天记录丢失问题，推荐搭建「本地聊天备份+项目记忆银行」双架构：

1. **基础层**：用cursaves实现所有聊天记录的自动备份、导出和检索，替代SpecStory的核心功能，确保每一条对话都被本地持久化保存；

2. **增强层**：在项目中接入cursor-memory-bank，结构化沉淀项目的核心上下文（需求文档、技术栈、开发规范、关键决策、踩坑记录），让Cursor每次打开项目都能自动加载完整记忆，无需重复同步背景信息；

3. **兜底层**：设置系统定时任务，每日自动备份Cursor的User目录，即使出现软件崩溃、版本更新异常，也能完整恢复所有历史数据。
> （注：文档部分内容可能由 AI 生成）