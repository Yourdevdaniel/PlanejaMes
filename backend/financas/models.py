from django.db import models

# categoria de gasto -> grupo da regra 50/30/20
CATEGORIAS = {
    "Moradia": "essencial",
    "Contas e serviços": "essencial",
    "Alimentação": "essencial",
    "Transporte": "essencial",
    "Saúde": "essencial",
    "Educação": "essencial",
    "Lazer": "desejo",
    "Compras": "desejo",
    "Assinaturas": "desejo",
    "Cuidados pessoais": "desejo",
    "Outros": "desejo",
    "Dívidas": "futuro",
    "Investimentos": "futuro",
}
CATEGORIAS_RECEITA = ["Salário", "Freela", "Vendas", "Rendimentos", "Outros"]


class Mes(models.Model):
    chave = models.CharField(max_length=7, unique=True)  # "2026-09"
    meta_pct = models.PositiveSmallIntegerField(default=10)
    obs = models.TextField(blank=True)

    def __str__(self):
        return self.chave


class Lancamento(models.Model):
    TIPOS = [("receita", "Receita"), ("gasto", "Gasto")]

    mes = models.ForeignKey(Mes, on_delete=models.CASCADE, related_name="lancamentos")
    tipo = models.CharField(max_length=7, choices=TIPOS)
    descricao = models.CharField(max_length=120)
    categoria = models.CharField(max_length=40)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    dia = models.PositiveSmallIntegerField(null=True, blank=True)
    pago = models.BooleanField(default=False)
    fixo = models.BooleanField(default=False)  # fixo = copiado pro mês seguinte

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.mes} · {self.descricao}"
