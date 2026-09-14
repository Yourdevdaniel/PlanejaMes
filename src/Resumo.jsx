import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { api, brl, GRUPOS, nomeMes } from './api'

function Numero({ valor }) {
  const el = useRef()
  const atual = useRef({ v: valor })
  useEffect(() => {
    const tween = gsap.to(atual.current, {
      v: valor, ease: 'power3.out',
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.8,
      onUpdate: () => { if (el.current) el.current.textContent = brl(atual.current.v) },
    })
    return () => tween.kill()
  }, [valor])
  return <span ref={el}>{brl(valor)}</span>
}

const pct = (v, total) => (total ? Math.round((v / total) * 100) : 0)

export default function Resumo({ dados, historico, chave, acao }) {
  const r = dados.resumo
  const bateuMeta = r.guardado >= r.meta_valor
  const maiorCat = Math.max(...Object.values(r.por_categoria), 1)
  const maiorHist = Math.max(...historico.flatMap(h => [h.receitas, h.gastos]), 1)

  const salvarMes = body => acao(() => api.salvarMes(chave, body))

  return (
    <aside className="lateral">
      <section className="cartao kpis reveal">
        <div className="saldo">
          <small>Sobra do mês</small>
          <strong className={r.saldo < 0 ? 'neg' : ''}><Numero valor={r.saldo} /></strong>
        </div>
        <div className="kpi"><small>Entra</small><b><Numero valor={r.receitas} /></b></div>
        <div className="kpi"><small>Sai</small><b><Numero valor={r.gastos} /></b><em>{pct(r.gastos, r.receitas)}% da renda</em></div>
        <div className="pagamento">
          <div className="linha-rot"><span>Já pago {brl(r.pago)}</span><span>Falta {brl(r.a_pagar)}</span></div>
          <div className="trilho"><div className="enche" style={{ transform: `scaleX(${pct(r.pago, r.gastos) / 100})`, background: 'var(--pos)' }} /></div>
        </div>
      </section>

      <section className="cartao reveal">
        <div className="meta">
          <label>Meta de guardar
            <span className="meta-campo">
              <input key={`${chave}-${dados.meta_pct}`} type="number" min="0" max="100" defaultValue={dados.meta_pct}
                onBlur={e => Number(e.target.value) !== dados.meta_pct && salvarMes({ meta_pct: e.target.value })} />%
            </span>
          </label>
          <div className="meta-valor">
            <b>{brl(r.meta_valor)}</b>
            <em className={bateuMeta ? 'pos' : 'neg'}>{bateuMeta ? '✓ dá pra guardar' : `faltam ${brl(r.meta_valor - r.guardado)}`}</em>
          </div>
        </div>
      </section>

      {Object.keys(r.por_categoria).length > 0 && (
        <section className="cartao reveal">
          <h3>Para onde vai</h3>
          {Object.entries(r.por_categoria).map(([nome, v]) => {
            const cor = GRUPOS[dados.categorias[nome] ?? 'desejo'].cor
            return (
              <div className="barra" key={nome}>
                <div className="linha-rot"><span><i style={{ background: cor }} />{nome}</span><span>{brl(v)}</span></div>
                <div className="trilho"><div className="enche" style={{ transform: `scaleX(${v / maiorCat})`, background: cor }} /></div>
              </div>
            )
          })}
        </section>
      )}

      <section className="cartao reveal">
        <h3>Regra 50 · 30 · 20</h3>
        {Object.entries(GRUPOS).map(([grupo, g]) => {
          const p = pct(r.por_grupo[grupo], r.receitas)
          return (
            <div className="barra" key={grupo}>
              <div className="linha-rot">
                <span><i style={{ background: g.cor }} />{g.nome}</span>
                <span className={p > g.ideal && grupo !== 'futuro' ? 'neg' : ''}>{p}% <span className="mudo">/ {g.ideal}%</span></span>
              </div>
              <div className="trilho">
                <div className="enche" style={{ transform: `scaleX(${Math.min(p, 100) / 100})`, background: g.cor }} />
                <div className="ideal" style={{ left: `${g.ideal}%` }} />
              </div>
            </div>
          )
        })}
        <p className="nota">Traço = limite ideal, em % da renda.</p>
      </section>

      {historico.length > 1 && (
        <section className="cartao reveal">
          <h3>Últimos meses</h3>
          <div className="historico">
            {historico.map(h => (
              <div key={h.chave} className={`hist-mes ${h.chave === chave ? 'atual' : ''}`} title={`${nomeMes(h.chave)}: entrou ${brl(h.receitas)}, saiu ${brl(h.gastos)}`}>
                <div className="hist-barras">
                  <span style={{ height: `${(h.receitas / maiorHist) * 100}%` }} className="rec" />
                  <span style={{ height: `${(h.gastos / maiorHist) * 100}%` }} className="gas" />
                </div>
                <small>{nomeMes(h.chave, { month: 'short' }).replace('.', '')}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="cartao reveal">
        <label className="obs">Objetivos e anotações
          <textarea key={`${chave}-${dados.obs}`} rows={3} defaultValue={dados.obs} maxLength={2000}
            placeholder="Ex.: juntar pra viagem, não usar o cartão no delivery…"
            onBlur={e => e.target.value !== dados.obs && salvarMes({ obs: e.target.value })} />
        </label>
        {dados.lancamentos.length > 0 && (
          <button className="btn largo" onClick={() => acao(() => api.copiarFixos(chave))}>Copiar fixos do mês anterior</button>
        )}
      </section>
    </aside>
  )
}
