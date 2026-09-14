// Cada tema vira variáveis CSS (--bg, --g-essencial…) e também alimenta a cena 3D.
export const TEMAS = {
  papel: {
    nome: 'Papel',
    escuro: false,
    cores: {
      bg: '#f4efe6', card: '#fffdf8', card2: '#f9f5ee', linha: '#e3dccf', hover: '#efe8dc', trilho: '#ece5d8',
      texto: '#1c1b19', mudo: '#766e62', destaque: '#b84a33', 'destaque-texto': '#ffffff', neg: '#b8433a', pos: '#5f7f45',
    },
    grupos: { essencial: '#5f7f45', desejo: '#d49a2a', futuro: '#3d5a80' },
    demo: '#d9cfbf',
  },
  noite: {
    nome: 'Noite',
    escuro: true,
    cores: {
      bg: '#0e1320', card: '#151c2c', card2: '#1b2336', linha: '#263047', hover: '#1f2940', trilho: '#222b40',
      texto: '#eef1f8', mudo: '#8e98ad', destaque: '#e3b457', 'destaque-texto': '#1a1405', neg: '#ff8a7a', pos: '#5ec4b6',
    },
    grupos: { essencial: '#5ec4b6', desejo: '#f08a6c', futuro: '#a79bff' },
    demo: '#2a3348',
  },
  limpo: {
    nome: 'Limpo',
    escuro: false,
    cores: {
      bg: '#f6f7f4', card: '#ffffff', card2: '#f3f5f1', linha: '#e2e6df', hover: '#eef1ec', trilho: '#e9ede6',
      texto: '#101310', mudo: '#666d66', destaque: '#0f8a4c', 'destaque-texto': '#ffffff', neg: '#d8412f', pos: '#17a05d',
    },
    grupos: { essencial: '#17a05d', desejo: '#ff8a3d', futuro: '#3b6cff' },
    demo: '#dde3da',
  },
}

export function aplicarTema(tema) {
  const raiz = document.documentElement
  Object.entries(tema.cores).forEach(([k, v]) => raiz.style.setProperty(`--${k}`, v))
  Object.entries(tema.grupos).forEach(([k, v]) => raiz.style.setProperty(`--g-${k}`, v))
  raiz.style.colorScheme = tema.escuro ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.cores.bg)
}

// preferência do navegador; se o storage estiver bloqueado, só usa o padrão
export function lembrar(chave, padrao, validos) {
  try {
    const v = localStorage.getItem(chave)
    return validos.includes(v) ? v : padrao
  } catch {
    return padrao
  }
}
export function guardar(chave, valor) {
  try { localStorage.setItem(chave, valor) } catch { /* sem storage, segue sem lembrar */ }
}
