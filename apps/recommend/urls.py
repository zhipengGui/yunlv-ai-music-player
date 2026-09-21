# -*- coding: utf-8 -*-
"""板块5 路由：推荐 API"""
from django.urls import path

from . import views

urlpatterns = [
    path("daily/", views.daily, name="recommend-daily"),
]
