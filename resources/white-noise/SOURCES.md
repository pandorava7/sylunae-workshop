# 白噪音来源与制作记录

除内置的“雨落森叶”由用户提供本地源文件外，其余声音均通过 Openverse 的 CC0 筛选定位，原始作品页来自 Freesound。虽然 CC0 不强制署名，本项目仍在资源管理页保留作者、作品名和来源链接，便于复核与致谢。

| 资源 | 作者 | 原作品 | 最终文件 | SHA-256 |
| --- | --- | --- | --- | --- |
| 雨落森叶 | 用户提供 | `0911.FLAC`（项目本地源文件） | `window-rain.opus` | `3196a75b2e9168ff8eb5a06272e29c83df72960d7fbd414f49c71f8be05b5048` |
| 雾中森林 | BurghRecords | [Birds In Spring (Scotland)](https://freesound.org/people/BurghRecords/sounds/463903) | `misty-forest.opus` | `970972d7363904ba0a4f1d41e3e63ff5f4d7ba7d33c46514454be03608748651` |
| 午夜海岸 | chris_dagorne | [Big waves breaking and splashing against groyne](https://freesound.org/people/chris_dagorne/sounds/426075) | `midnight-ocean.opus` | `1fb57a573bb3cf165eb1ea8e0e647c0d4d4da6f35615de47d8c01f42e221bd06` |
| 壁炉余温 | visionear | [Aachen Burning Fireplace Crackling Fire Sounds](https://freesound.org/people/visionear/sounds/501417) | `warm-fireplace.opus` | `a5e72d09554abf14d44ff78d02ac6d6d6e035e6ca52fe133415a3b773c43bbf6` |
| 清晨咖啡馆 | waweee | [coffee shop ambience](https://freesound.org/people/waweee/sounds/370973) | `morning-cafe.opus` | `13d7a5ff15a4bb95880bb389ecde1ba028320ae9ab6193a283e8f0ea6a9169dc` |
| 夜行列车 | Syphon64 | [Subway Underground The Tube The Metro](https://freesound.org/people/Syphon64/sounds/135209) | `night-train.opus` | `8efa6e58bd30dceee1280146f10e43350722d2948ba08ca61312b9a55447cb7e` |
| 山间长风 | bitlab_coop | [Ambience Mountain Outdoor Mirador Horta](https://freesound.org/people/bitlab_coop/sounds/486891) | `mountain-wind.opus` | `7a4d3cff08a95ff4a89a95d3bedac9e03ee50458ecf84364e93de3078daade3b` |
| 静谧深夜 | felix.blume | [Forest at night, crickets, cicadas and insects](https://freesound.org/people/felix.blume/sounds/328293) | `quiet-night.opus` | `f2e5b86ec325443bc1ec08d9f4bc0b668139e1c2fe7c70bc648ad0542cbdc84b` |
| 林间溪流 | jackthemurray | [Stream River Water Up Close](https://freesound.org/people/jackthemurray/sounds/433589) | `forest-stream.opus` | `300d4439a5227ca6b76b65d088d79009d87fcfd1cba9c9f6b9b06821d8e8962b` |
| 远方雷雨 | sagetyrtle | [102610 distant thunder 01](https://freesound.org/people/sagetyrtle/sounds/107518) | `distant-thunder.opus` | `b7087d77f4678732c405e7f9b9121bcce27cf148061da76b78210ea18d08bf0f` |

许可：除“雨落森叶”按用户提供的项目本地资源记录外，其余条目均标记为 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)。发布前应确认 `0911.FLAC` 拥有可分发权，并对来源页再次人工复核。

## 音频处理

- 时长统一为约 600 秒；短于目标时长的素材以连续循环扩展。
- 使用 FFmpeg `libopus`、VBR、48 kHz、最高压缩复杂度。
- 依据声场保留单声道或立体声，目标码率为 64–96 kbps。
- 使用 EBU R128 loudness normalization，目标响度约 -24 LUFS、true peak -2 dB。
- 最终文件的体积与摘要记录在 `r2/manifest.json`，下载端会逐字节校验。

“雨落森叶”源文件 `0911.FLAC` 的 SHA-256 为 `05e69ec0f07792c42ad70e6b74845ca2613d557d07d91a4f1f43f677fce27b77`。它额外生成了 MP3 版本 `window-rain.mp3`，SHA-256 为 `bf14ffafb5342dd41c089839034d722519c6166f38de19b43deafd3c4068c5ec`；应用内置与下载清单继续使用体积更小的 Opus 版本。
