# -*- coding: utf-8 -*-
"""文本溢出估算：根据字号/字符宽度估算每段文字所需行数与高度，与文本框高度比对"""
from pptx import Presentation
from pptx.util import Emu, Pt
import re

PPT = r"f:\python学习大学\云律AI\ppt\云律AI-答辩PPT.pptx"
prs = Presentation(PPT)

def width_in(text, pt):
    """估算文本像素宽（in）：中文按1.0*pt宽，ASCII按0.55*pt宽"""
    cjk = len(re.findall(r'[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef“”‘’—…→★♪♫♬▶✓]', text))
    ascii_n = len(text) - cjk
    return (cjk * pt + ascii_n * 0.55 * pt) / 72.0

def height_in(text_lines, pt, box_h):
    """估算所需高度"""
    line_h = pt * 1.35 / 72.0
    return len(text_lines) * line_h

warn = []
for idx, slide in enumerate(prs.slides, 1):
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        tf = shape.text_frame
        if not tf.text.strip():
            continue
        w = Emu(shape.width).inches
        h = Emu(shape.height).inches
        if w <= 0.05 or h <= 0.05:
            continue
        total_lines = 0
        max_pt = 0
        for para in tf.paragraphs:
            pt = 18
            for run in para.runs:
                if run.font.size:
                    pt = run.font.size.pt
                    max_pt = max(max_pt, pt)
            txt = "".join(r.text for r in para.runs)
            if not txt:
                continue
            txt_w = width_in(txt, pt)
            lines = max(1, int(txt_w / w) + (1 if txt_w % w > 1e-6 else 0))
            # 显式换行符拆分
            for sub in txt.split("\n"):
                sub_w = width_in(sub, pt)
                sub_lines = max(1, int(sub_w / w) + (1 if sub_w % w > 1e-6 else 0))
                total_lines += sub_lines
        need_h = total_lines * (max_pt * 1.3 / 72.0)
        # 宽裕度不足（含自动换行风险）时告警
        if need_h > h * 1.25 and need_h > 0.2:
            warn.append(f"P{idx}: 文本可能溢出 框[{w:.2f}×{h:.2f}] 需高~{need_h:.2f} '{tf.text[:28]}'")

if warn:
    print(f"【疑似溢出 {len(warn)} 处】")
    for w_ in warn:
        print(" -", w_)
else:
    print("无文本溢出风险")
