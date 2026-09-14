async function req(url, opts = {}) {
  const resposta = await fetch(`/api${url}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body && JSON.stringify(opts.body),
  })
  const dados = resposta.status === 204 ? null : await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw new Error(dados?.erro || `Erro ${resposta.status} ao falar com o servidor.`)
  return dados
}

export const api = {
  mes: chave => req(`/meses/${chave}/`),
  salvarMes: (chave, body) => req(`/meses/${chave}/`, { method: 'PATCH', body }),
  criar: (chave, body) => req(`/meses/${chave}/lancamentos/`, { method: 'POST', body }),
  editar: (id, body) => req(`/lancamentos/${id}/`, { method: 'PATCH', body }),
  apagar: id => req(`/lancamentos/${id}/`, { method: 'DELETE' }),
  copiarFixos: chave => req(`/meses/${chave}/copiar-fixos/`, { method: 'POST' }),
  historico: () => req('/historico/'),
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
