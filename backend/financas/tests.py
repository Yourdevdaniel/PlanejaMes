import json

from django.test import TestCase


class FluxoDoMes(TestCase):
    def post(self, url, dados):
        return self.client.post(url, json.dumps(dados), content_type="application/json")

    def test_lanca_resume_valida_e_copia_fixos(self):
        self.assertEqual(self.post("/api/meses/2026-01/lancamentos/", {"tipo": "receita", "descricao": "Salário", "categoria": "Salário", "valor": "3000"}).status_code, 201)
        aluguel = self.post("/api/meses/2026-01/lancamentos/", {"tipo": "gasto", "descricao": "Aluguel", "categoria": "Moradia", "valor": "1200.50", "dia": 5, "fixo": True}).json()
        self.post("/api/meses/2026-01/lancamentos/", {"tipo": "gasto", "descricao": "Cinema", "categoria": "Lazer", "valor": 99.5})

        # entrada inválida não cria nada
        for ruim in ({"tipo": "gasto", "descricao": "x", "categoria": "Moradia", "valor": "-1"},
                     {"tipo": "gasto", "descricao": "x", "categoria": "Nada", "valor": "1"},
                     {"tipo": "gasto", "descricao": "x", "categoria": "Moradia", "valor": "NaN"},
                     {"tipo": "gasto", "descricao": "x", "categoria": "Moradia", "valor": "1", "dia": 40}):
            self.assertEqual(self.post("/api/meses/2026-01/lancamentos/", ruim).status_code, 400)
        self.assertEqual(self.client.get("/api/meses/2026-13/").status_code, 400)

        self.client.patch(f"/api/lancamentos/{aluguel['id']}/", json.dumps({"pago": True}), content_type="application/json")
        r = self.client.get("/api/meses/2026-01/").json()["resumo"]
        self.assertEqual((r["receitas"], r["gastos"], r["saldo"], r["pago"]), (3000, 1300, 1700, 1200.5))
        self.assertEqual(r["por_grupo"]["essencial"], 1200.5)

        # só o fixo vai pro mês seguinte, sem duplicar
        self.assertEqual(self.post("/api/meses/2026-02/copiar-fixos/", {}).json()["copiados"], 1)
        self.assertEqual(self.post("/api/meses/2026-02/copiar-fixos/", {}).json()["copiados"], 0)
        fev = self.client.get("/api/meses/2026-02/").json()
        self.assertEqual([l["descricao"] for l in fev["lancamentos"]], ["Aluguel"])
        self.assertFalse(fev["lancamentos"][0]["pago"])

        # GET de mês vazio não entra no histórico
        self.client.get("/api/meses/2030-05/")
        self.assertEqual([m["chave"] for m in self.client.get("/api/historico/").json()], ["2026-01", "2026-02"])
