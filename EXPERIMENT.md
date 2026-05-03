## 实验部分（已定稿文稿 + 可追溯资产）

本节把「离线测量」与答辩/网页用的 **同源音视频与截图**绑在一起：`tools/export_assets.py` 是唯一的数据出口；`site/index.html` 只引用 `site/assets/*`，便于 GitHub Pages 或任意静态托管。

---

### 一、实验目的

1. 将 `audioChip.GameSong` 的事件表解释为 **离散 tick 节拍**下的「频率—振幅—时值」三元组（与课程主题「指令式合成」一致）。
2. 在 **不使用硬仪器** 的条件下，用最简 **方波** 近似 80 年代波形成分，回放并导出 **WAV** 与图谱，用于幻灯片第九页的可视化要求。
3. 对同一时长输出，完成 **PCM 近似字节量 vs 原始事件描述体积** 的估算，回扣项目 PDF 中对存储容量的讨论。

---

### 二、实验环境与数据源

| 项目 | 内容 |
|------|------|
| 事件源 | `GameSong.java` 中的 `SONG_DATA` |
| Tick | 代码注释：**1 tick = 0.06 s** |
| 本仓库合成器 | `tools/export_assets.py`（采样率默认 44100 Hz，导出到 `site/assets/`） |

**音高映射（与本仓库编曲注释一致）：** MIDI 近似式  

\[
\mathrm{midi}=12\cdot(\mathrm{octave}+1)+\mathrm{note},\quad f=440\cdot2^{(\mathrm{midi}-69)/12}.
\]

**静音/休止：** `note >= 12` 或 `volume == 0` 视为无声。

合成采用 **±1 归一后方波**并按 tick 离散切换时值；振幅先按 \( \mathrm{vol}/12 \)（与最大音量刻度 12 对齐）缩放，再在整段上对峰值做线性归一至 0.98，避免 WAV 剪切。

---

### 三、实验内容（可直接勾选的步骤）

#### 步骤 A：事件合法性（窄路径）

- 读出 `GameSong.java` 中全部 `{start,ch,note,octave,volume,duration}`，确认 **无负数**、声道号满足当前播放器支持（本实验仅验证 `channel=0`，与当前 `SONG_DATA` 一致）。
- 计算 **最大末端 tick**：`max(start + duration)`，推导 **理论总长** \(\approx\) `max_tick × 0.06` s。

#### 步骤 B：软件回放一致性

```powershell
cd d:\git\UCUG1903
python -m pip install -r tools\requirements.txt
python tools\export_assets.py
```

生成：

- `site/assets/gamesong.wav`
- `site/assets/waveform_detail.png`、`waveform_full.png`、`spectrogram.png`
- `site/assets/compression_note.txt`

**定性检查：** 目视波形首尾是否为零漂合理、频谱在发声段是否呈现 **谐波列** 特征（方波应有奇次谐波结构，粗览即可）。

#### 步骤 C：存储对比（必须与公式写清）

对 **等价 PCM**：

\[
B_{\mathrm{pcm}}=\mathrm{Fs}\times(\mathrm{bits}/8)\times\mathrm{channels}\times T.
\]

对 **等价事件字节（粗估）：** Java `int[6][]` → 每行 \(6\times 4\) 字节。当前脚本自动写入最近一次结果；请以你本机 `compression_note.txt` 为准填入报告数字。

---

### 四、观测指标与结论写法

| 观测项 | 方法 | 通过判据示例 |
|--------|------|----------------|
| 时值 | WAV 总长 vs `compression_note` 时长 | 差值小于一个缓冲区样本等价 |
| 削波 | 波形图 | `waveform_*` 无平顶饱和（脚本已封顶 0.98） |
| 频谱可读性 | `spectrogram.png` | 非静音段的能量聚集在可解释频带 |

**结论句式建议：** 「在 Fs=44100 Hz、mono、16-bit 假设下，同一片段若存裸 PCM，约为事件描述的数百倍量级；验证了以事件驱动替代流媒体式音频在存储上的合理性。」数值引用请永远来自 **当次导出** 的 `compression_note.txt`。

---

### 五、与「网页 / 幻灯片第十页二维码」的资产矩阵

| 幻灯片草稿位置 | 推荐素材 | 本仓库产出 |
|----------------|----------|------------|
| 第九页音频 | Demo 试听 | `site/assets/gamesong.wav`、`site/index.html` 内控件 |
| 第九页视频 | 任选其一 | FFmpeg 贴片（见下）或直接录屏本站 |
| 第九页图谱 | PNG | `waveform_*`、`spectrogram.png` |
| 第十页二维码 | 扫码打开线上页 | 部署后以真实 URL 运行 `tools/make_qr.py` |

**网页注意事项：** 移动端需要先 **手势后播放**。本页已实现「控件」与「Web Audio」二选一以避免双倍音量冲突。

二维码生成示例（部署后替换 URL）：

```powershell
pip install segno
python tools/make_qr.py --url https://<your-host>/<path-to-site>/
```

> 若以 GitHub Pages 将 **`site/` 作为站点根**，URL 常为 `https://<user>.github.io/<repo>/`，此时路径以实际 Pages 设定为准。

---

### 六、FFmpeg 生成「视频贴片」（可选）

在已安装 FFmpeg 的机器上将 **全长波形图 + WAV** 合成短视频：

```powershell
Set-Location d:\git\UCUG1903
ffmpeg -y -loop 1 -framerate 1 -i site\assets\waveform_full.png -i site\assets\gamesong.wav `
  -c:v libx264 -tune stillimage -pix_fmt yuv420p -c:a aac -shortest site\assets\demo_slides.mp4
```

若文件过大或不合课程提交规范，可仅本地留存或加入 `.gitignore`。

---

### 七、窄路径 vs 可选扩展

- **窄路径（本仓库已实现）：** 仅 `channel=0` 的现有 `GameSong.java`。
- **宽路径：** 若要实验多声道，`GAMESONGS.txt` 的多声道段落需先行 **合并写入** `GameSong.java` 或扩展到同一脚本；未完成合并前，不要把「声道隔离验证」写成结题结论。

---

### 八、方法与课程叙述的对照（可放入引言）

本项目模拟的是 **波形由少数参数驱动** 的早期声卡范式：波形形态固定为近似方波，音高映射到分频等价物，音量与时值用整数 tick 粒度描述。可与讲义「为何不直接生成正弦 / 为何不裸存 PCM」两个问题形成闭环：在算术复杂度与 ROM 压力下，音频被压缩为少量 **离散控制字**的可听展示。
