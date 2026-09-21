# -*- coding: utf-8 -*-
"""访问口令视图：口令页展示 + 口令校验"""
from django.conf import settings
from django.shortcuts import redirect, render


def login_view(request):
    """口令输入页"""
    error = request.GET.get("error")
    return render(request, "gate/login.html", {"error": error})


def verify_view(request):
    """校验口令：正确则写入 session 并回到首页"""
    if request.method == "POST":
        code = request.POST.get("code", "").strip()
        if code and code == getattr(settings, "ACCESS_CODE", ""):
            request.session["gate_verified"] = True
            request.session.set_expiry(60 * 60 * 24 * 7)  # 7 天有效
            return redirect("/")
        return redirect("/gate/login/?error=1")
    return redirect("/gate/login/")


def logout_view(request):
    """退出：清除口令标记"""
    request.session.flush()
    return redirect("/gate/login/")
