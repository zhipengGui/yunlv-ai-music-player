# -*- coding: utf-8 -*-
"""临时脚本：提取 PPT 各页文本（含备注），用完删除"""
import re
import zipfile

SRC = r"ppt/云律AI-答辩PPT.pptx"

z = zipfile.ZipFile(SRC)


def para_lines(xml):
    out = []
    for pa in re.split(r"</a:p>", xml):
        ts = re.findall(r"<a:t>(.*?)</a:t>", pa, re.S)
        if ts:
            out.append("".join(ts))
    return out


slide_names = sorted(
    [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)],
    key=lambda n: int(re.search(r"(\d+)", n.split("/")[-1]).group()),
)
note_names = sorted(
    [n for n in z.namelist() if re.match(r"ppt/notesSlides/notesSlide\d+\.xml$", n)],
    key=lambda n: int(re.search(r"(\d+)", n.split("/")[-1]).group()),
)

for s in slide_names:
    num = int(re.search(r"(\d+)", s.split("/")[-1]).group())
    xml = z.read(s).decode("utf-8", "ignore")
    print("\n========== Slide %d ==========" % num)
    for ln in para_lines(xml):
        print(ln)

for n in note_names:
    num = int(re.search(r"(\d+)", n.split("/")[-1]).group())
    xml = z.read(n).decode("utf-8", "ignore")
    lines = para_lines(xml)
    if lines:
        print("\n---- 备注(Slide %d) ----" % num)
        for ln in lines:
            print(ln)
