# -*- coding: utf-8 -*-
"""答辩 PPT 内容 QA：逐页提取文本 + 检查越界/重叠风险"""
from pptx import Presentation
from pptx.util import Emu

PPT = r"f:\python学习大学\云律AI\ppt\云律AI-答辩PPT.pptx"
W, H = 13.33, 7.5

prs = Presentation(PPT)

def emu2in(v):
    return Emu(v).inches

issues = []
for idx, slide in enumerate(prs.slides, 1):
    print(f"\n{'='*60}\n第 {idx} 页")
    for shape in slide.shapes:
        if shape.has_text_frame:
            txt = shape.text_frame.text.strip()
            if txt:
                # 检查越界
                try:
                    x, y, w, h = emu2in(shape.left), emu2in(shape.top), emu2in(shape.width), emu2in(shape.height)
                    if x < -0.05 or y < -0.05 or x + w > W + 0.05 or y + h > H + 0.05:
                        issues.append(f"P{idx} 越界: [{x:.2f},{y:.2f},{w:.2f},{h:.2f}] '{txt[:20]}'")
                except Exception:
                    pass
                # 只打印关键文本（避免重复）
                t = txt.replace("\n", " ⏎ ")
                print(f"  · {t[:110]}")

print("\n" + "=" * 60)
if issues:
    print("【越界告警】")
    for i in issues:
        print(" -", i)
else:
    print("无越界问题")
