# 白噪音资源包

这个目录保存白噪音资源的制作记录，以及可上传到公开 R2 桶的文件。

## 目录结构

- `r2/audio/`：10 个时长约 10 分钟的 Opus 文件，以及内置雨声的 FLAC 源文件和 MP3 转码版本。该目录已被 Git 忽略，避免把大文件提交到仓库。
- `r2/covers/`：对应封面图。
- `r2/manifest.json`：文件大小、SHA-256、来源与许可清单。
- `source-audio/`：从来源站点取得的制作源文件，已被 Git 忽略。
- `SOURCES.md`：便于人工核对的来源和处理说明。

## 上传到 R2

把 `r2` 目录内的 `audio`、`covers` 和 `manifest.json` 上传到桶的 `resources/white-noise/` 前缀。最终音频 URL 应类似：

```text
https://assets.example.com/resources/white-noise/audio/misty-forest.opus
```

在 `.env.local` 中只填写公开下载根地址：

```dotenv
MAIN_VITE_RESOURCE_PUBLIC_BASE_URL=https://assets.example.com
```

桌面应用从 Electron 主进程发起只读 HTTPS 下载，不需要也不会读取 R2 API 密钥。`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` 和 `R2_BUCKET_NAME` 仅预留给未来的开发期上传脚本，禁止放进渲染进程或提交到 Git。

## 发布检查

1. 公开域名只能开放读取，不开放列举和写入。
2. 保持清单里的文件名、字节数和 SHA-256 不变；应用会在落盘前校验。
3. 更新某个音频时，同时更新 `src/resources/whiteNoiseCatalog.ts` 和 `r2/manifest.json`。
4. 如果网站端未来也要直接请求资源，再为实际站点域名配置最小化 CORS；当前桌面下载不依赖浏览器 CORS。
