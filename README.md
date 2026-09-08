# 丝月工坊

丝月工坊是一个本地优先的个人工具总站，使用 React、TypeScript、Vite 与 Electron 构建。桌面版使用 SQLite 保存数据，网页轻量版使用 IndexedDB。

## 首版功能

- 匿名读取并缓存一个 Bangumi 用户的公开收藏，支持五类条目、筛选、排序和详情查看
- 桌面端本地音乐资料库、播放队列、随机与循环播放、失效文件重新定位
- Tiptap 所见即所得笔记、文件夹、标签、置顶、全文搜索和回收站
- 目标、里程碑、自动进度、逾期提示、完成与归档视图
- 浅色、深色、跟随系统，以及 JSON 全量备份与恢复

## 开发与构建

```bash
npm install
npm run dev:web
npm run dev:desktop
npm run test
npm run build:web
npm run build:desktop
npm run package:win
```

网页生产文件输出到 `dist/`，Electron 构建输出到 `out/`，Windows 安装包输出到 `release/`。

## 数据说明

- Electron 数据库位于系统分配的应用数据目录，数据库名为 `siyue-workshop.sqlite`。
- 网页版数据保存在当前浏览器的 `siyue-workshop` IndexedDB 中。
- 音乐文件不会被复制或删除；应用只保存文件路径和元数据索引。
- 备份包含设置、收藏缓存、笔记、目标和音乐索引，不包含音乐原文件。
- Bangumi 集成只读取公开收藏，不需要登录，也不会写回用户账号。
