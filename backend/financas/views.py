import json
import re
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import CATEGORIAS, CATEGORIAS_RECEITA, Lancamento, Mes

CHAVE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
ZERO = Decimal("0")


class Invalido(Exception):
    pass


def api(*metodos):
    def deco(fn):
        # ponytail: app local sem login, então sem CSRF. Colocar auth + CSRF antes de publicar na internet.
        @csrf_exempt
        @require_http_methods(metodos)
        @wraps(fn)
        def view(request, *args, **kwargs):
            try:
                return fn(request, *args, **kwargs)
            except Invalido as erro:
                return JsonResponse({"erro": str(erro)}, status=400)

        return view

    return deco


def _corpo(request):
    try:
        dados = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise Invalido("JSON inválido.")
    if not isinstance(dados, dict):
        raise Invalido("JSON inválido.")
    return dados


def _mes(chave, criar=False):
    if not CHAVE.match(chave):
        raise Invalido("Mês inválido, use AAAA-MM.")
    if criar:
        return Mes.objects.get_or_create(chave=chave)[0]
    # GET não cria linha: navegar pelos meses não suja o histórico
    return Mes.objects.filter(chave=chave).first() or Mes(chave=chave)


def _aplicar(lanc, dados):
    if "tipo" in dados:
        lanc.tipo = dados["tipo"]
    if lanc.tipo not in ("receita", "gasto"):
        raise Invalido("Tipo deve ser receita ou gasto.")

    if "descricao" in dados:
        lanc.descricao = str(dados["descricao"]).strip()
    if not lanc.descricao or len(lanc.descricao) > 120:
        raise Invalido("Descrição obrigatória (até 120 caracteres).")

    if "categoria" in dados:
        lanc.categoria = str(dados["categoria"])
    validas = CATEGORIAS if lanc.tipo == "gasto" else CATEGORIAS_RECEITA
    if lanc.categoria not in validas:
        raise Invalido("Categoria inválida.")

    if "valor" in dados:
        try:
            valor = Decimal(str(dados["valor"]).replace(",", "."))
        except InvalidOperation:
            raise Invalido("Valor inválido.")
        if not valor.is_finite() or valor < 0 or valor >= Decimal("1e10"):
            raise Invalido("Valor inválido.")
        lanc.valor = valor.quantize(Decimal("0.01"))
    if lanc.valor is None:
        raise Invalido("Valor obrigatório.")

    if "dia" in dados:
        dia = dados["dia"]
        if dia in (None, ""):
            lanc.dia = None
        else:
            try:
                dia = int(dia)
            except (TypeError, ValueError):
                raise Invalido("Dia inválido.")
            if not 1 <= dia <= 31:
                raise Invalido("Dia deve ser de 1 a 31.")
            lanc.dia = dia

    for campo in ("pago", "fixo"):
        if campo in dados:
            setattr(lanc, campo, bool(dados[campo]))


def _lanc_json(l):
    return {
        "id": l.id,
        "tipo": l.tipo,
        "descricao": l.descricao,
        "categoria": l.categoria,
        "valor": float(l.valor),
        "dia": l.dia,
        "pago": l.pago,
        "fixo": l.fixo,
    }


def _resumo(mes, lancs):
    receitas = sum((l.valor for l in lancs if l.tipo == "receita"), ZERO)
    gastos = [l for l in lancs if l.tipo == "gasto"]
    total_gastos = sum((l.valor for l in gastos), ZERO)
    pago = sum((l.valor for l in gastos if l.pago), ZERO)

    por_categoria = {}
    por_grupo = {"essencial": ZERO, "desejo": ZERO, "futuro": ZERO}
    for l in gastos:
        por_categoria[l.categoria] = por_categoria.get(l.categoria, ZERO) + l.valor
        por_grupo[CATEGORIAS.get(l.categoria, "desejo")] += l.valor

    saldo = receitas - total_gastos
    meta = (receitas * mes.meta_pct / 100).quantize(Decimal("0.01"))
    guardado = por_categoria.get("Investimentos", ZERO) + max(saldo, ZERO)
    return {
        "receitas": float(receitas),
        "gastos": float(total_gastos),
        "saldo": float(saldo),
        "pago": float(pago),
        "a_pagar": float(total_gastos - pago),
        "meta_valor": float(meta),
        "guardado": float(guardado),
        "por_categoria": {k: float(v) for k, v in sorted(por_categoria.items(), key=lambda kv: -kv[1])},
        "por_grupo": {k: float(v) for k, v in por_grupo.items()},
    }


def _mes_json(mes):
    lancs = list(mes.lancamentos.all()) if mes.pk else []
    return {
        "chave": mes.chave,
        "meta_pct": mes.meta_pct,
        "obs": mes.obs,
        "lancamentos": [_lanc_json(l) for l in lancs],
        "resumo": _resumo(mes, lancs),
        "categorias": CATEGORIAS,
        "categorias_receita": CATEGORIAS_RECEITA,
    }


@api("GET", "PATCH")
def mes(request, chave):
    if request.method == "GET":
        return JsonResponse(_mes_json(_mes(chave)))

    dados = _corpo(request)
    m = _mes(chave, criar=True)
    if "meta_pct" in dados:
        try:
            pct = int(dados["meta_pct"])
        except (TypeError, ValueError):
            raise Invalido("Meta inválida.")
        if not 0 <= pct <= 100:
            raise Invalido("Meta deve ser de 0 a 100%.")
        m.meta_pct = pct
    if "obs" in dados:
        m.obs = str(dados["obs"])[:2000]
    m.save()
    return JsonResponse(_mes_json(m))


@api("POST")
def criar_lancamento(request, chave):
    if not CHAVE.match(chave):
        raise Invalido("Mês inválido, use AAAA-MM.")
    lanc = Lancamento()
    _aplicar(lanc, _corpo(request))  # valida antes de criar o mês
    lanc.mes = _mes(chave, criar=True)
    lanc.save()
    return JsonResponse(_lanc_json(lanc), status=201)


@api("PATCH", "DELETE")
def lancamento(request, pk):
    lanc = get_object_or_404(Lancamento, pk=pk)
    if request.method == "DELETE":
        lanc.delete()
        return HttpResponse(status=204)
    _aplicar(lanc, _corpo(request))
    lanc.save()
    return JsonResponse(_lanc_json(lanc))


@api("POST")
def copiar_fixos(request, chave):
    destino = _mes(chave, criar=True)
    ano, numero = map(int, chave.split("-"))
    anterior = f"{ano - 1}-12" if numero == 1 else f"{ano}-{numero - 1:02d}"

    existentes = {(l.tipo, l.descricao) for l in destino.lancamentos.all()}
    novos = [
        Lancamento(
            mes=destino, tipo=l.tipo, descricao=l.descricao, categoria=l.categoria,
            valor=l.valor, dia=l.dia, fixo=True,
        )
        for l in Lancamento.objects.filter(mes__chave=anterior, fixo=True)
        if (l.tipo, l.descricao) not in existentes
    ]
    Lancamento.objects.bulk_create(novos)
    return JsonResponse({**_mes_json(destino), "copiados": len(novos)})


@api("GET")
def historico(request):
    meses = list(
        Mes.objects.filter(lancamentos__isnull=False)
        .distinct()
        .prefetch_related("lancamentos")
        .order_by("-chave")[:12]
    )
    saida = []
    for m in reversed(meses):
        r = _resumo(m, list(m.lancamentos.all()))
        saida.append({"chave": m.chave, "receitas": r["receitas"], "gastos": r["gastos"], "saldo": r["saldo"]})
    return JsonResponse(saida, safe=False)
