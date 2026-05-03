# UCUG1903

课程项目材料：`*GameSong*` 事件驱动的方波编曲示例、幻灯片可用的 **音视频与图谱**导出、以及与静态网页的对齐脚本。

详细「实验文稿 + 幻灯片——网页资产映射」参见根目录 **`EXPERIMENT.md`**。

## 快速开始

### 导出音频与图谱

```powershell
cd d:\git\UCUG1903
python -m pip install -r tools\requirements.txt
python tools\export_assets.py
```

输出目录：`site\assets\`（`gamesong.wav`、波形与频谱 PNG、`compression_note.txt`）。

默认从仓库根目录的 `GameSong.java` 读取 `SONG_DATA`。

### 本地预览静态页面

任选其一：

```powershell
cd d:\git\UCUG1903\site
python -m http.server 8080
```

浏览器打开：`http://127.0.0.1:8080/index.html`。若从仓库根目录执行，也可以使用 `python -m http.server 8080 --directory site`（Python 3.7+）。

### 二维码（占位与正式部署）

先发布 `site/` 到你的静态域名，再填入真实 HTTPS URL：

```powershell
pip install -r tools\requirements_qr.txt
python tools\make_qr.py --url https://<your-real-url>/
```

### 幻灯片用小视频补丁（可选）

需要本机安装 FFmpeg：

```powershell
powershell -ExecutionPolicy Bypass -File tools\make_demo_video.ps1
```

生成 `site/assets/demo_slides.mp4`（已由 `.gitignore` 默认忽略）。

## 目录

| Path | Purpose |
|------|---------|
| `GameSong.java` | Java 常量 `SONG_DATA`（解析源） |
| `GAMESONGS.txt` | 编曲草稿片段（按需合并入主表） |
| `tools/export_assets.py` | 合成 WAV + PNG + 存储对比摘要 |
| `site/index.html` | 幻灯片可用的演示页骨架 |
| `EXPERIMENT.md` | **实验段落定稿**：步骤、观测、数值引用规范 |
