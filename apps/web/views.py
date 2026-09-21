# -*- coding: utf-8 -*-
"""板块2：前端页面渲染
负责所有 HTML 页面，播放器交互逻辑在前端 static/js 中
"""
from django.shortcuts import render
from django.views.decorators.clickjacking import xframe_options_exempt


def home(request):
    """主页面：播放器 + 歌单 + 推荐等（后续各板块页面均从主页面跳转）"""
    return render(request, "index.html")


@xframe_options_exempt
def dashboard(request):
    """数据大屏：可独立打开（全屏演示），也可内嵌在主页面 iframe 中展示"""
    return render(request, "dashboard.html")
