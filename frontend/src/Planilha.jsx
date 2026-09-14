import { useRef, useState } from 'react'
import { api, brl, GRUPOS } from './api'

const NOVO = { tipo: 'gasto', descricao: '', categoria: 'Moradia', valor: '', dia: '', fixo: false }

export default function Planilha({ dados, chave, acao }) {
  const [novo, setNovo] = useState(NOVO)
  const [salvando, setSalvando] = useState(false)
  const descricao = useRef()

  const categorias = novo.tipo === 'gasto' ? Object.keys(dados.categorias) : dados.categorias_receita
  const set = (campo, valor) => setNovo(n => ({ ...n, [campo]: valor }))
  const trocarTipo = tipo => setNovo(n => ({ ...n, tipo, categoria: tipo === 'gasto' ? 'Moradia' : 'Salário' }))

  const enviar = async e => {
    e.preventDefault()
    setSalvando(true)
    const ok = await acao(() => api.criar(chave, novo))
    setSalvando(false)
    if (ok) {
      setNovo(n => ({ ...NOVO, tipo: n.tipo, categoria: n.categoria, fixo: n.fixo }))
      descricao.current?.focus()
    }
  }

  const receitas = dados.lancamentos.filter(l => l.tipo === 'receita')
  const gastos = dados.lancamentos.filter(l => l.tipo === 'gasto').sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99))
  const vazio = !dados.lancamentos.length

  return (
    <div className="coluna">
      <form className="cartao lancar reveal" onSubmit={enviar}>
        <div className="lancar-topo">
          <h3>Novo lançamento</h3>
          <div className="segmento" role="radiogroup" aria-label="Tipo">
            {['gasto', 'receita'].map(t => (
              <button type="button" key={t} role="radio" aria-checked={novo.tipo === t} className={novo.tipo === t ? 'on' : ''} onClick={() => trocarTipo(t)}>
                {t === 'gasto' ? 'Vou gastar' : 'Vou receber'}
              </button>
            ))}
          </div>
        </div>
        <div className="campos">
          <label className="c-desc">Descrição
            <input ref={descricao} required maxLength={120} value={novo.descricao} onChange={e => set('descricao', e.target.value)} placeholder={novo.tipo === 'gasto' ? 'Aluguel, mercado, academia…' : 'Salário, freela…'} />
          </label>
          <label className="c-cat">Categoria
            <select value={novo.categoria} onChange={e => set('categoria', e.target.value)}>
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="c-valor">Valor (R$)
            <input required type="number" min="0" step="0.01" inputMode="decimal" value={novo.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
          </label>
          <label className="c-dia">Dia
            <input type="number" min="1" max="31" value={novo.dia} onChange={e => set('dia', e.target.value)} placeholder="—" />
          </label>
          <label className="c-fixo check">
            <input type="checkbox" checked={novo.fixo} onChange={e => set('fixo', e.target.checked)} />
            Repete todo mês
          </label>
          <button className="btn btn-luz c-enviar" disabled={salvando}>{salvando ? 'Salvando…' : 'Lançar'}</button>
        </div>
      </form>

      {vazio && (
        <div className="cartao vazio reveal">
          <p>Nada lançado em {chave.split('-').reverse().join('/')} ainda.</p>
          <p className="mudo">Comece pelo que é certo: salário, aluguel, contas. Ou puxe o que era fixo no mês passado.</p>
          <button className="btn" onClick={() => acao(() => api.copiarFixos(chave))}>Copiar fixos do mês anterior</button>
        </div>
      )}

      {!vazio && (
        <>
          <Tabela titulo="Entradas" itens={receitas} total={dados.resumo.receitas} acao={acao} cor={() => 'var(--mudo)'} />
          <Tabela titulo="Gastos do mês" itens={gastos} total={dados.resumo.gastos} acao={acao} cor={l => GRUPOS[dados.categorias[l.categoria] ?? 'desejo'].cor} gasto />
        </>
      )}
    </div>
  )
}

function Tabela({ titulo, itens, total, acao, cor, gasto }) {
  const pagos = itens.filter(l => l.pago).length
  return (
    <section className="cartao tabela reveal">
      <div className="tabela-topo">
        <h3>{titulo}</h3>
        {gasto && itens.length > 0 && <span className="mudo">{pagos} de {itens.length} pagos</span>}
      </div>
      {itens.length ? (
        <div className="rolagem">
          <table>
            <thead>
              <tr><th>Dia</th><th>Descrição</th><th className="num">Valor</th><th className="num">Status</th></tr>
            </thead>
            <tbody>
              {itens.map(l => <Linha key={`${l.id}-${l.valor}-${l.descricao}-${l.dia}`} l={l} cor={cor(l)} acao={acao} gasto={gasto} />)}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}>Total</td><td className="num">{brl(total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      ) : <p className="mudo">Nenhum lançamento aqui.</p>}
    </section>
  )
}

function Linha({ l, cor, acao, gasto }) {
  const editar = body => acao(() => api.editar(l.id, body))
  // campos editáveis direto na tabela: salva ao sair do campo, só se mudou
  const aoSair = (campo, atual) => e => {
    if (e.target.value !== String(atual ?? '')) editar({ [campo]: e.target.value })
  }

  return (
    <tr className={l.pago ? 'pago' : ''}>
      <td className="dia">
        <input type="number" min="1" max="31" defaultValue={l.dia ?? ''} placeholder="—" onBlur={aoSair('dia', l.dia)} aria-label={`Dia de ${l.descricao}`} />
      </td>
      <td className="desc-td">
        <input className="desc" defaultValue={l.descricao} maxLength={120} onBlur={aoSair('descricao', l.descricao)} aria-label="Descrição" />
        <span className="cat"><i style={{ background: cor }} />{l.categoria}{l.fixo && ' · fixo'}</span>
      </td>
      <td className="num">
        <input className="valor" type="number" min="0" step="0.01" defaultValue={l.valor.toFixed(2)} onBlur={aoSair('valor', l.valor.toFixed(2))} aria-label={`Valor de ${l.descricao}`} />
      </td>
      <td className="num">
        <div className="acoes">
        {gasto && (
          <button className={`chip ${l.pago ? 'on' : ''}`} aria-pressed={l.pago} onClick={() => editar({ pago: !l.pago })}>
            {l.pago ? '✓ Pago' : 'A pagar'}
          </button>
        )}
        <button className={`chip ${l.fixo ? 'on-fixo' : ''}`} aria-pressed={l.fixo} onClick={() => editar({ fixo: !l.fixo })} title="Fixo: copia pro próximo mês">
          Fixo
        </button>
        <button className="icone x" onClick={() => acao(() => api.apagar(l.id))} aria-label={`Apagar ${l.descricao}`}>✕</button>
        </div>
      </td>
    </tr>
  )
}
