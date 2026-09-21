# -*- coding: utf-8 -*-
"""访问控制路由"""
from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.login_view, name="gate_login"),
    path("verify/", views.verify_view, name="gate_verify"),
    path("logout/", views.logout_view, name="gate_logout"),
]
