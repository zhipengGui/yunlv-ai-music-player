# -*- coding: utf-8 -*-
"""访问口令中间件：未输入正确口令前，禁止访问所有页面和接口

- 口令配置：settings.ACCESS_CODE（为空则关闭口令保护）
- 通过口令后写入 session（gate_verified），有效期 7 天
- /gate/ 与 /static/ 路径放行，其余一律拦截
"""
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import redirect

# 无需口令即可访问的前缀
PUBLIC_PREFIXES = ("/gate/", "/static/", "/favicon.ico")


class AccessCodeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        code = getattr(settings, "ACCESS_CODE", "") or ""

        # 未启用口令：直接放行
        if not code:
            return self.get_response(request)

        # 公开路径：放行
        if path.startswith(PUBLIC_PREFIXES):
            return self.get_response(request)

        # 已通过验证：放行
        if request.session.get("gate_verified"):
            return self.get_response(request)

        # 未通过验证：API 返回 403，页面跳转口令页
        if path.startswith("/api/"):
            return JsonResponse({"code": 403, "msg": "需要访问口令才能使用"}, status=403)
        return redirect("/gate/login/")
