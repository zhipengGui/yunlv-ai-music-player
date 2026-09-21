from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.summary, name="report-summary"),
    path("leaderboard/", views.leaderboard, name="report-leaderboard"),
    path("dashboard/", views.dashboard, name="report-dashboard"),
]
