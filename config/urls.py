from django.urls import path

from shell import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/<str:entity>", views.api_create, name="api_create"),
    path("api/<str:entity>/<str:rid>", views.api_update, name="api_update"),
    path("<str:entity>", views.entity_list, name="list"),
    path("<str:entity>/", views.entity_list),
    path("<str:entity>/<str:rid>", views.record, name="record"),
    path("<str:entity>/<str:rid>/", views.record),
]
