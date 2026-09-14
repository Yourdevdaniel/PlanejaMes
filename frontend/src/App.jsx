import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { api, mesAtual, nomeMes, somarMes } from './api'
import { aplicarTema, guardar, lembrar, TEMAS } from './temas'
import Hero3D from './Hero3D'
import Planilha from './Planilha'
import Resumo from './Resumo'

gsap.registerPlugin(ScrollTrigger)
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const ORIENTACOES = { vertical: 'Vertical', horizontal: 'Horizontal' }

export default function App() {
  const [chave, setChave] = useState(mesAtual)
  const [dados, setDados] = useState(null)
  const [historico, setHistorico] = useState([])
  const [erro, setErro] = useState('')
  const [tema, setTema] = useState(() => lembrar('tema', 'papel', Object.keys(TEMAS)))
  const [orientacao, setOrientacao] = useState(() => lembrar('orientacao', 'vertical', Object.keys(ORIENTACOES)))
  const pedido = useRef(chave)
  const lenis = useRef(null)

  useLayoutEffect(() => {
    aplicarTema(TEMAS[tema])
    guardar('tema', tema)
  }, [tema])

  useEffect(() => {
    document.documentElement.dataset.orientacao = orientacao
    guardar('orientacao', orientacao)
  }, [orientacao])

  const carregar = useCallback(async () => {
    pedido.current = chave
    try {
      const [mes, hist] = await Promise.all([api.mes(chave), api.historico()])
      if (pedido.current !== chave) return // trocou de mês no meio: descarta resposta velha
      setDados(mes)
      setHistorico(hist)
      setErro('')
    } catch (e) {
      setErro(e.message)
    }
  }, [chave])

  useEffect(() => { carregar() }, [carregar])

  // roda uma alteração e recarrega; devolve true se deu certo
  const acao = useCallback(async fn => {
    try {
      await fn()
      await carregar()
      return true
    } catch (e) {
      setErro(e.message)
      return false
    }
  }, [carregar])

  // Lenis dirigido pelo ticker do GSAP, pra ScrollTrigger e scroll andarem juntos
  useEffect(() => {
    if (semMovimento()) return
    const l = new Lenis({ lerp: 0.09 })
    lenis.current = l
    l.on('scroll', ScrollTrigger.update)
    const tick = t => l.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(tick); l.destroy(); lenis.current = null }
  }, [])

  const carregou = dados !== null
  useEffect(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.hero-copy > *', { y: 48, opacity: 0, duration: 1.1, stagger: 0.09, ease: 'power4.out', delay: 0.15 })
      gsap.to('.hero-canvas', {
        yPercent: 18, opacity: 0.25, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
      })
      gsap.utils.toArray('.reveal').forEach(el =>
        gsap.from(el, { y: 56, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }),
      )
    })
    return () => mm.revert()
  }, [carregou])

  const irParaPainel = e => {
    if (!lenis.current) return
    e.preventDefault()
    lenis.current.scrollTo('#painel', { duration: 1.4 })
  }

  return (
    <>
      {/* orientação da folha só existe via @page, então o CSS muda junto com a escolha */}
      <style>{`@page { size: A4 ${orientacao === 'horizontal' ? 'landscape' : 'portrait'}; margin: 12mm; }`}</style>

      <div className="temas" role="radiogroup" aria-label="Tema de cores">
        {Object.entries(TEMAS).map(([id, t]) => (
          <button key={id} role="radio" aria-checked={tema === id} className={tema === id ? 'on' : ''} onClick={() => setTema(id)} title={t.nome}>
            <span className="amostra" style={{ background: t.cores.bg }}>
              <i style={{ background: t.cores.destaque }} />
              <i style={{ background: t.grupos.desejo }} />
            </span>
            <span className="tema-nome">{t.nome}</span>
          </button>
        ))}
      </div>

      <section className="hero">
        <div className="hero-canvas">
          <Hero3D chave={chave} resumo={dados?.resumo} categorias={dados?.categorias} tema={TEMAS[tema]} />
        </div>
        <div className="hero-copy">
          <p className="kicker">Controle financeiro mensal</p>
          <h1>Seu dinheiro,<br />mês a mês.</h1>
          <p className="lead">
            Lance o que vai entrar e o que vai sair. Cada pilha de moedas é uma categoria de gasto em {nomeMes(chave, { month: 'long' })}.
          </p>
          <a href="#painel" className="btn btn-luz" onClick={irParaPainel}>Abrir minha planilha</a>
        </div>
      </section>

      <main id="painel" className="painel">
        <header className="barra-mes reveal">
          <div className="troca-mes">
            <button className="icone" onClick={() => setChave(somarMes(chave, -1))} aria-label="Mês anterior">←</button>
            <h2>{nomeMes(chave)}</h2>
            <button className="icone" onClick={() => setChave(somarMes(chave, 1))} aria-label="Próximo mês">→</button>
          </div>
          <div className="barra-acoes">
            <input type="month" value={chave} onChange={e => e.target.value && setChave(e.target.value)} aria-label="Escolher mês" />
            {chave !== mesAtual() && <button className="btn" onClick={() => setChave(mesAtual())}>Hoje</button>}
            <div className="imprimir">
              <div className="segmento" role="radiogroup" aria-label="Orientação da impressão">
                {Object.entries(ORIENTACOES).map(([id, nome]) => (
                  <button key={id} type="button" role="radio" aria-checked={orientacao === id} className={orientacao === id ? 'on' : ''} onClick={() => setOrientacao(id)}>
                    <span className={`folha ${id}`} aria-hidden="true" />{nome}
                  </button>
                ))}
              </div>
              <button className="btn" onClick={() => window.print()}>Imprimir</button>
            </div>
          </div>
        </header>

        {erro && (
          <p className="erro" role="alert">
            {erro} <button className="btn" onClick={() => { setErro(''); carregar() }}>Tentar de novo</button>
          </p>
        )}

        {carregou ? (
          <div className="grade">
            <Planilha dados={dados} chave={chave} acao={acao} />
            <Resumo dados={dados} historico={historico} chave={chave} acao={acao} />
          </div>
        ) : !erro && <p className="carregando">Carregando…</p>}
      </main>
    </>
  )
}
