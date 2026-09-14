from django.urls import path

from . import views

urlpatterns = [
    path("meses/<str:chave>/", views.mes),
    path("meses/<str:chave>/lancamentos/", views.criar_lancamento),
    path("meses/<str:chave>/copiar-fixos/", views.copiar_fixos),
    path("lancamentos/<int:pk>/", views.lancamento),
    path("historico/", views.historico),
]
