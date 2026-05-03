# UCUG1903

课程项目：80 年代**指令式合成**叙事 + 可编辑芯片风格乐谱，在浏览器中播放并显示**总线波形**，并支持**导出 WAV**（第九页音频素材）。

## Web 编辑器

路径：`web/`

### 运行方式

用**本地 HTTP 服务**打开（`fetch` 需要加载 `default-song.json`；也可依赖失败时的内置最短示例）。

```bash
cd web
npx --yes serve -l 8080 .
```

或已安装 Python 时：

```bash
cd web
python -m http.server 8080
```

浏览器访问终端里给出的地址（例如 `http://localhost:8080`）。

### 功能

- 表格编辑事件：`{起始 tick, 通道, note, octave, volume, duration (tick)}`，可选第 7 列波形：`square` / `sawtooth` / `noise` / `sine`（正弦仅作对比）。
- **播放 / 停止**，实时波形（`AnalyserNode` + Canvas）。
- **导出 WAV**：与当前表格内容一致（`OfflineAudioContext` 离线路由）。
- **导入 / 导出 JSON**；**复制为 Java 数组片段**（第七列波形字符串需按需删掉才能贴进 `int[][]`）。

时间与 `GameSong.java` 一致：**1 tick = 0.06 s**。默认示例与 `GameSong.SONG_DATA` 对齐，见 `web/default-song.json`。

### 第九页（视频 + 音频）

1. 用 **OBS**（或其它录屏）录制浏览器窗口，并采集系统/应用音频 → 得到演示**视频**。
2. 点击 **导出 WAV** → 得到与编辑内容一致的**音频**。

### Java 参考

`GameSong.java` 中的 `SONG_DATA` 为六列整型数组；网页在 JSON/贴回 Java 时多一列波形字符串，仅用于前端合成。
