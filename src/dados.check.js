// Checagem da lógica de dinheiro e dos dados: npm run check
import assert from 'node:assert/strict'
import { api } from './api.js'

const lanc = (tipo, descricao, categoria, valor, extra = {}) => ({ tipo, descricao, categoria, valor, ...extra })

await api.criar('2026-01', lanc('receita', 'Salário', 'Salário', '3000'))
const aluguel = await api.criar('2026-01', lanc('gasto', 'Aluguel', 'Moradia', '1200,50', { dia: 5, fixo: true }))
await api.criar('2026-01', lanc('gasto', 'Cinema', 'Lazer', 99.5))
await api.criar('2026-01', lanc('gasto', 'Café', 'Lazer', 0.1))
await api.criar('2026-01', lanc('gasto', 'Pão', 'Alimentação', 0.2))

// entrada inválida não grava nada
for (const ruim of [
  lanc('gasto', 'x', 'Moradia', '-1'),
  lanc('gasto', 'x', 'Nada', '1'),
  lanc('gasto', 'x', 'Moradia', 'abc'),
  lanc('gasto', 'x', 'Moradia', ''),
  lanc('gasto', '   ', 'Moradia', '1'),
  lanc('gasto', 'x', 'Moradia', '1', { dia: 40 }),
]) {
  await assert.rejects(api.criar('2026-01', ruim))
}
await assert.rejects(api.mes('2026-13'))

// edição inválida não aplica pela metade
await assert.rejects(api.editar(aluguel.id, { descricao: 'Outro', valor: -5 }))
await api.editar(aluguel.id, { pago: true })

const jan = await api.mes('2026-01')
assert.equal(jan.lancamentos.length, 5)
assert.equal(jan.lancamentos[1].descricao, 'Aluguel')
const r = jan.resumo
assert.deepEqual([r.receitas, r.gastos, r.saldo, r.pago], [3000, 1300.3, 1699.7, 1200.5]) // 0,10 + 0,20 sem erro de float
assert.equal(r.por_grupo.essencial, 1200.7)
assert.equal(r.meta_valor, 300)

// só o fixo vai pro mês seguinte, sem pago e sem duplicar
assert.equal((await api.copiarFixos('2026-02')).copiados, 1)
assert.equal((await api.copiarFixos('2026-02')).copiados, 0)
const fev = await api.mes('2026-02')
assert.deepEqual(fev.lancamentos.map(l => [l.descricao, l.pago]), [['Aluguel', false]])

// abrir mês vazio não entra no histórico
await api.mes('2030-05')
assert.deepEqual((await api.historico()).map(h => h.chave), ['2026-01', '2026-02'])

// backup: ida e volta igual, e arquivo ruim é recusado
const antes = await api.historico()
await api.importar(api.exportar())
assert.deepEqual(await api.historico(), antes)
await assert.rejects(api.importar('lixo'))
await assert.rejects(api.importar('{"meses":{"2026-13":{"lancamentos":[]}}}'))
await assert.rejects(api.importar('{"meses":{"2026-01":{"lancamentos":[{"tipo":"gasto","descricao":"x","categoria":"Moradia","valor":-3}]}}}'))
assert.deepEqual(await api.historico(), antes)

console.log('ok: lógica de dados conferida')
