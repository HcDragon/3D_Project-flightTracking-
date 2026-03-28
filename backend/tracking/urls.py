from django.urls import path

from tracking.views import AnalyticsView, HealthView, RefreshView, RouteView, SnapshotView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("snapshot/", SnapshotView.as_view(), name="snapshot"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
    path("route/<str:callsign>/", RouteView.as_view(), name="route"),
]
