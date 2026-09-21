# -*- coding: utf-8 -*-
"""板块2 路由：前端页面"""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("dashboard/", views.dashboard, name="dashboard"),
]
