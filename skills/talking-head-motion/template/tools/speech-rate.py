"""测语速，判断要不要加速。

用法：
  python tools/speech-rate.py 口播.mp4 口播稿.txt
口播稿没有的话，用语音识别出来的文字也行。

算法：
  - 字数：汉字每个算 1，英文单词和数字每个算 1。
  - 说话时长：用 ffmpeg 找出静音段（低于 -35dB 且超过 0.3 秒），总时长减掉静音。
  - 语速 = 字数 / 说话时长。这是「剪掉气口以后」的语速，和成片的感受最接近。

参考：日常聊天约 4–5 字/秒；节奏紧凑的知识类口播博主约 6.3–6.6 字/秒。
"""
import re
import subprocess
import sys

video, script = sys.argv[1], sys.argv[2]
text = open(script, encoding="utf-8").read()
chars = len(re.findall(r"[一-鿿]", text)) + len(re.findall(r"[A-Za-z]+|\d+", text))

dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                           capture_output=True, text=True).stdout.strip())
log = subprocess.run(["ffmpeg", "-i", video, "-af", "silencedetect=n=-35dB:d=0.3", "-f", "null", "-"],
                     capture_output=True, text=True).stderr
silence = sum(float(x) for x in re.findall(r"silence_duration: ([\d.]+)", log))
speech = max(dur - silence, 0.1)
rate = chars / speech

TARGET = 6.3
print(f"字数 {chars}，总时长 {dur:.1f} 秒，去掉停顿后说话时长 {speech:.1f} 秒")
print(f"语速约 {rate:.1f} 字/秒（剪掉气口后）")
if rate >= TARGET - 0.1:
    print("建议：不用加速。已经和节奏紧凑的口播博主差不多，再快观众会跟不上。")
elif rate >= 5.6:
    print(f"建议：可加可不加。加 1.1 倍后约 {rate * 1.1:.1f} 字/秒，更紧凑；不加也自然。")
else:
    speed = min(1.15, round(TARGET / rate, 2))
    print(f"建议：加速到 {speed} 倍左右（加速后约 {rate * speed:.1f} 字/秒），现在偏慢，观众容易划走。超过 1.15 倍声音会发尖，不建议再快。")
