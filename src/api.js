// Tudo fica salvo no navegador (localStorage), no mesmo formato do backup exportado.
// As funções continuam async, então as telas não precisam saber de onde vêm os dados.

export const CATEGORIAS = {
  'Moradia': 'essencial',
  'Contas e serviços': 'essencial',
  'Alimentação': 'essencial',
  'Transporte': 'essencial',
  'Saúde': 'essencial',
  'Educação': 'essencial',
  'Lazer': 'desejo',
  'Compras': 'desejo',
  'Assinaturas': 'desejo',
  'Cuidados pessoais': 'desejo',
  'Outros': 'desejo',
  'Dívidas': 'futuro',
  'Investimentos': 'futuro',
}
export const CATEGORIAS_RECEITA = ['Salário', 'Freela', 'Vendas', 'Rendimentos', 'Outros']

const STORAGE = 'planejames:dados'
const CHAVE_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const mesVazio = () => ({ meta_pct: 10, obs: '', lancamentos: [] })
let memoria = { versao: 1, meses: {} } // sem localStorage (ex.: node na checagem), fica só em memória

function temStorage() {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null
  } catch {
    return false
  }
}

function ler() {
  if (!temStorage()) return memoria
  const bruto = localStorage.getItem(STORAGE)
  if (!bruto) return { versao: 1, meses: {} }
  try {
    return JSON.parse(bruto)
  } catch {
    // não sobrescreve: quem resolve é o usuário, importando um backup
    throw new Error('Os dados salvos neste navegador estão corrompidos. Importe um backup.')
  }
}

function gravar(dados) {
  if (!temStorage()) {
    memoria = dados
    return
  }
  try {
    localStorage.setItem(STORAGE, JSON.stringify(dados))
  } catch {
    throw new Error('Não deu pra salvar no navegador (armazenamento cheio ou bloqueado).')
  }
}

// lê, altera e grava; se fn lançar erro, nada é gravado
function alterar(fn) {
  const dados = ler()
  const resultado = fn(dados)
  gravar(dados)
  return resultado
}

// dinheiro em centavos inteiros pra 0,10 + 0,20 dar 0,30
const centavos = v => Math.round(v * 100)
const reais = c => c / 100

const novoId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

function validarChave(chave) {
  if (!CHAVE_MES.test(chave)) throw new Error('Mês inválido, use AAAA-MM.')
}

// valida e aplica os campos enviados; devolve o lançamento (trabalhe numa cópia)
function aplicar(lanc, dados) {
  if ('tipo' in dados) lanc.tipo = dados.tipo
  if (lanc.tipo !== 'receita' && lanc.tipo !== 'gasto') throw new Error('Tipo deve ser receita ou gasto.')

  if ('descricao' in dados) lanc.descricao = String(dados.descricao ?? '').trim()
  if (!lanc.descricao || lanc.descricao.length > 120) throw new Error('Descrição obrigatória (até 120 caracteres).')

  if ('categoria' in dados) lanc.categoria = String(dados.categoria)
  const validas = lanc.tipo === 'gasto' ? Object.keys(CATEGORIAS) : CATEGORIAS_RECEITA
  if (!validas.includes(lanc.categoria)) throw new Error('Categoria inválida.')

  if ('valor' in dados) {
    const texto = String(dados.valor ?? '').trim().replace(',', '.')
    const valor = texto === '' ? NaN : Number(texto)
    if (!Number.isFinite(valor) || valor < 0 || valor >= 1e10) throw new Error('Valor inválido.')
    lanc.valor = reais(centavos(valor))
  }
  if (lanc.valor === undefined) throw new Error('Valor obrigatório.')

  if ('dia' in dados) {
    if (dados.dia === null || dados.dia === '') {
      lanc.dia = null
    } else {
      const dia = Number(dados.dia)
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) throw new Error('Dia deve ser de 1 a 31.')
      lanc.dia = dia
    }
  }
  lanc.dia ??= null

  for (const campo of ['pago', 'fixo']) {
    if (campo in dados) lanc[campo] = Boolean(dados[campo])
    lanc[campo] ??= false
  }
  return lanc
}

function resumo(mes) {
  const soma = lista => lista.reduce((total, l) => total + centavos(l.valor), 0)
  const gastos = mes.lancamentos.filter(l => l.tipo === 'gasto')
  const receitas = soma(mes.lancamentos.filter(l => l.tipo === 'receita'))
  const totalGastos = soma(gastos)
  const pago = soma(gastos.filter(l => l.pago))

  const porCategoria = {}
  const porGrupo = { essencial: 0, desejo: 0, futuro: 0 }
  for (const l of gastos) {
    porCategoria[l.categoria] = (porCategoria[l.categoria] ?? 0) + centavos(l.valor)
    porGrupo[CATEGORIAS[l.categoria] ?? 'desejo'] += centavos(l.valor)
  }

  const saldo = receitas - totalGastos
  return {
    receitas: reais(receitas),
    gastos: reais(totalGastos),
    saldo: reais(saldo),
    pago: reais(pago),
    a_pagar: reais(totalGastos - pago),
    meta_valor: reais(Math.round((receitas * mes.meta_pct) / 100)),
    guardado: reais((porCategoria.Investimentos ?? 0) + Math.max(saldo, 0)),
    por_categoria: Object.fromEntries(Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, reais(v)])),
    por_grupo: Object.fromEntries(Object.entries(porGrupo).map(([k, v]) => [k, reais(v)])),
  }
}

const mesJson = (chave, mes) => ({
  chave,
  meta_pct: mes.meta_pct,
  obs: mes.obs,
  lancamentos: mes.lancamentos,
  resumo: resumo(mes),
  categorias: CATEGORIAS,
  categorias_receita: CATEGORIAS_RECEITA,
})

function acharLancamento(dados, id) {
  for (const mes of Object.values(dados.meses)) {
    const i = mes.lancamentos.findIndex(l => l.id === id)
    if (i >= 0) return [mes, i]
  }
  throw new Error('Lançamento não encontrado.')
}

// backup vem de fora: revalida tudo em vez de confiar no arquivo
function validarBackup(bruto) {
  if (!bruto || typeof bruto.meses !== 'object' || Array.isArray(bruto.meses)) throw new Error('Arquivo de backup inválido.')
  const meses = {}
  for (const [chave, m] of Object.entries(bruto.meses)) {
    if (!CHAVE_MES.test(chave) || !Array.isArray(m?.lancamentos)) throw new Error(`Backup inválido no mês ${chave}.`)
    const pct = Number(m.meta_pct ?? 10)
    meses[chave] = {
      meta_pct: Number.isInteger(pct) && pct >= 0 && pct <= 100 ? pct : 10,
      obs: String(m.obs ?? '').slice(0, 2000),
      lancamentos: m.lancamentos.map(l => {
        const id = typeof l?.id === 'string' || typeof l?.id === 'number' ? l.id : novoId()
        try {
          return aplicar({ id }, l ?? {})
        } catch (e) {
          throw new Error(`Backup inválido em ${chave}: ${e.message}`)
        }
      }),
    }
  }
  return { versao: 1, meses }
}

export const api = {
  async mes(chave) {
    validarChave(chave)
    return mesJson(chave, ler().meses[chave] ?? mesVazio()) // só abrir o mês não cria nada
  },

  async salvarMes(chave, body) {
    validarChave(chave)
    return alterar(dados => {
      const mes = (dados.meses[chave] ??= mesVazio())
      if ('meta_pct' in body) {
        const pct = String(body.meta_pct).trim() === '' ? NaN : Number(body.meta_pct)
        if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new Error('Meta deve ser de 0 a 100%.')
        mes.meta_pct = pct
      }
      if ('obs' in body) mes.obs = String(body.obs).slice(0, 2000)
      return mesJson(chave, mes)
    })
  },

  async criar(chave, body) {
    validarChave(chave)
    const lanc = aplicar({ id: novoId() }, body)
    return alterar(dados => {
      ;(dados.meses[chave] ??= mesVazio()).lancamentos.push(lanc)
      return lanc
    })
  },

  async editar(id, body) {
    return alterar(dados => {
      const [mes, i] = acharLancamento(dados, id)
      return (mes.lancamentos[i] = aplicar({ ...mes.lancamentos[i] }, body))
    })
  },

  async apagar(id) {
    alterar(dados => {
      const [mes, i] = acharLancamento(dados, id)
      mes.lancamentos.splice(i, 1)
    })
  },

  // traz os fixos do mês anterior sem duplicar o que já existe
  async copiarFixos(chave) {
    validarChave(chave)
    return alterar(dados => {
      const destino = (dados.meses[chave] ??= mesVazio())
      const existentes = new Set(destino.lancamentos.map(l => `${l.tipo}|${l.descricao}`))
      const novos = (dados.meses[somarMes(chave, -1)]?.lancamentos ?? [])
        .filter(l => l.fixo && !existentes.has(`${l.tipo}|${l.descricao}`))
        .map(l => ({ ...l, id: novoId(), pago: false, fixo: true }))
      destino.lancamentos.push(...novos)
      return { ...mesJson(chave, destino), copiados: novos.length }
    })
  },

  async historico() {
    return Object.entries(ler().meses)
      .filter(([, m]) => m.lancamentos.length)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([chave, m]) => {
        const r = resumo(m)
        return { chave, receitas: r.receitas, gastos: r.gastos, saldo: r.saldo }
      })
  },

  exportar: () => JSON.stringify(ler(), null, 2),

  async importar(texto) {
    let bruto
    try {
      bruto = JSON.parse(texto)
    } catch {
      throw new Error('Arquivo de backup inválido.')
    }
    gravar(validarBackup(bruto))
  },
}

export const brl = v => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const chaveDe = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const mesAtual = () => chaveDe(new Date())
export const somarMes = (chave, n) => {
  const [ano, mes] = chave.split('-').map(Number)
  return chaveDe(new Date(ano, mes - 1 + n, 1))
}
export const nomeMes = (chave, opts = { month: 'long', year: 'numeric' }) => {
  const [ano, mes] = chave.split('-').map(Number)
  const texto = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', opts)
  return texto[0].toUpperCase() + texto.slice(1) // "Setembro de 2026", não "Setembro De 2026"
}

export const GRUPOS = {
  essencial: { nome: 'Essenciais', ideal: 50, cor: 'var(--g-essencial)' },
  desejo: { nome: 'Desejos', ideal: 30, cor: 'var(--g-desejo)' },
  futuro: { nome: 'Dívidas e futuro', ideal: 20, cor: 'var(--g-futuro)' },
}
