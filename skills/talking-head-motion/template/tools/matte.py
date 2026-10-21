"""视频抠像：输出带透明通道的 webm，给 cutout（原位抠像）状态用。

模型：RobustVideoMatting（带时间一致性，边缘不会一帧一帧地闪）。
先下载 onnx 模型（GPL-3.0，单独下载，不随本仓库分发）：
  https://github.com/PeterL1n/RobustVideoMatting/releases  →  rvm_mobilenetv3_fp32.onnx
用法：
  pip install onnxruntime numpy
  python tools/matte.py 口播.mp4 public/matte.webm 1920 1080 rvm_mobilenetv3_fp32.onnx
然后把 src/config.js 里的 matte 设为 'matte.webm'。
"""
import subprocess
import sys

import numpy as np
import onnxruntime as ort

inp, out, W, H, model = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
sess = ort.InferenceSession(model)
fps = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", inp],
                     capture_output=True, text=True).stdout.strip()
dec = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", inp, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", fps, "-i", "-",
                        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "4M", "-auto-alt-ref", "0", out], stdin=subprocess.PIPE)
rec = [np.zeros([1, 1, 1, 1], np.float32)] * 4
dr = np.array([0.375], np.float32)  # 1080p 推荐 0.25–0.4
n = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    src = (img.astype(np.float32) / 255).transpose(2, 0, 1)[None]
    fgr, pha, *rec = sess.run(None, {"src": src, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": dr})
    a = (pha[0, 0] * 255).clip(0, 255).astype(np.uint8)
    enc.stdin.write(np.dstack([img, a]).tobytes())
    n += 1
enc.stdin.close()
enc.wait()
print("frames", n)
