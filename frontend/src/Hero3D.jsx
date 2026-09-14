import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, Text } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'
import { BackSide, CanvasTexture, LatheGeometry, MeshStandardMaterial, SRGBColorSpace, Uniform, Vector2 } from 'three'
import fonte from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?url'
import { brl } from './api'

const ALTURA = 0.11
const RAIO = 0.42
const MAX_MOEDAS = 22
const DEMO = [5, 11, 7, 15, 3]

// Moeda = perfil girado (lathe): face rebaixada, aro alto, chanfro e lateral.
// No lathe o UV é polar (u = volta da moeda, v = ponto do perfil), então dá pra
// desenhar anéis e serrilhado num canvas 2D, sem modelo nem textura externa.
const h = ALTURA / 2
const ARO = 0.05
const CHANFRO = 0.012
const FUNDO = 0.006
const PERFIL = [
  [0, -h + FUNDO], [RAIO - ARO - 0.006, -h + FUNDO], [RAIO - ARO, -h], [RAIO - CHANFRO, -h], [RAIO, -h + CHANFRO],
  [RAIO, h - CHANFRO], [RAIO - CHANFRO, h], [RAIO - ARO, h], [RAIO - ARO - 0.006, h - FUNDO], [0, h - FUNDO],
]
const geometria = new LatheGeometry(PERFIL.map(([x, y]) => new Vector2(x, y)), 72)

const TAM = 512
const PASSO = TAM / (PERFIL.length - 1) // altura no canvas de cada trecho do perfil
const yDoPonto = i => TAM - i * PASSO // textura vem com flipY: ponto 0 fica embaixo

function textura(desenhar, cor) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TAM
  desenhar(canvas.getContext('2d'))
  const t = new CanvasTexture(canvas)
  if (cor) t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

// faces: centro da de cima em y=0, da de baixo em y=TAM; d = distância do centro no canvas
const nasDuasFaces = (g, desenhar) => {
  desenhar(d => d)
  desenhar(d => TAM - d)
}
const faixa = (g, y1, y2, x = 0, largura = TAM) => g.fillRect(x, Math.min(y1, y2), largura, Math.abs(y2 - y1))

const relevo = textura(g => {
  g.fillStyle = '#808080'
  g.fillRect(0, 0, TAM, TAM)
  g.fillStyle = '#2a2a2a' // serrilhado da lateral
  for (let x = 0; x < TAM; x += 6) faixa(g, yDoPonto(4), yDoPonto(5), x, 3)
  nasDuasFaces(g, y => {
    g.fillStyle = '#e6e6e6' // anel de pontinhos perto do aro
    for (let x = 2; x < TAM; x += 9) faixa(g, y(PASSO * 0.8), y(PASSO * 0.87), x, 5)
    g.fillStyle = '#3a3a3a' // sulco na divisa do miolo
    faixa(g, y(PASSO * 0.56), y(PASSO * 0.6))
    g.fillStyle = '#b0b0b0' // anel alto no centro
    faixa(g, y(PASSO * 0.2), y(PASSO * 0.26))
  })
}, false)

const pintura = bimetal => textura(g => {
  g.fillStyle = '#d9a441'
  g.fillRect(0, 0, TAM, TAM)
  if (!bimetal) return
  g.fillStyle = '#c4c8cd' // miolo prateado, tipo a de R$ 1
  nasDuasFaces(g, y => faixa(g, y(0), y(PASSO * 0.58)))
}, true)

const MATERIAIS = [false, true].map(bimetal =>
  new MeshStandardMaterial({ map: pintura(bimetal), bumpMap: relevo, bumpScale: 2, metalness: 1, roughness: 0.32 }),
)
const sorte = n => {
  const s = Math.sin(n * 91.7) * 43758.5453
  return s - Math.floor(s)
}

// Grão de filme + vinheta num shader próprio, rodando dentro do EffectComposer.
// escuro = quanto a borda escurece (tema claro escurece menos pra não sujar o creme)
const fragmento = /* glsl */ `
  uniform float tempo;
  uniform float escuro;
  float ruido(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float vinheta = smoothstep(0.9, 0.25, length(uv - 0.5));
    float grao = (ruido(uv * 1024.0 + fract(tempo) * 97.0) - 0.5) * 0.05;
    outputColor = vec4(inputColor.rgb * mix(escuro, 1.0, vinheta) + grao, inputColor.a);
  }
`
class GraoVinheta extends Effect {
  constructor() {
    super('GraoVinheta', fragmento, { uniforms: new Map([['tempo', new Uniform(0)], ['escuro', new Uniform(0.45)]]) })
  }
}

function Grao({ escuro }) {
  const efeito = useMemo(() => new GraoVinheta(), [])
  efeito.uniforms.get('escuro').value = escuro
  useFrame((_, dt) => { efeito.uniforms.get('tempo').value += dt })
  return <primitive object={efeito} dispose={null} />
}

function Moeda({ y, atraso, semente }) {
  const ref = useRef()
  const inicio = useRef(null)
  useFrame(({ clock }) => {
    if (inicio.current === null) inicio.current = clock.elapsedTime
    const t = Math.min(1, Math.max(0, (clock.elapsedTime - inicio.current - atraso) / 0.55))
    ref.current.visible = t > 0
    ref.current.position.y = y + (1 - t) ** 3 * 4 // cai e assenta
  })
  // pilha de verdade não é alinhada: cada moeda sai um pouco torta e girada
  const s = i => sorte(semente + i) - 0.5
  return (
    <mesh
      ref={ref}
      geometry={geometria}
      material={MATERIAIS[sorte(semente) < 0.35 ? 1 : 0]}
      visible={false}
      position={[s(1) * 0.07, y + 4, s(2) * 0.07]}
      rotation={[s(3) * 0.03, s(4) * Math.PI * 2, s(5) * 0.03]}
    />
  )
}

function Pilha({ x, n, cor, nome, valor, atraso, tema }) {
  return (
    <group position-x={x}>
      <mesh position-y={0.015}>
        <cylinderGeometry args={[RAIO + 0.12, RAIO + 0.12, 0.03, 48]} />
        <meshStandardMaterial color={cor} emissive={cor} emissiveIntensity={tema.escuro ? 1.6 : 0.6} toneMapped={false} />
      </mesh>
      {Array.from({ length: n }, (_, i) => (
        <Moeda key={i} y={0.03 + ALTURA / 2 + i * ALTURA} atraso={atraso + i * 0.045} semente={x * 17 + i * 3.1} />
      ))}
      {nome && (
        <>
          <Text font={fonte} fontSize={0.17} position={[0, -0.28, 0.6]} rotation-x={-0.5} color={tema.cores.texto} anchorX="center" maxWidth={1.1} textAlign="center">
            {nome}
          </Text>
          <Text font={fonte} fontSize={0.13} position={[0, -0.5, 0.75]} rotation-x={-0.5} color={tema.cores.mudo} anchorX="center">
            {brl(valor)}
          </Text>
        </>
      )}
    </group>
  )
}

function Cena({ chave, resumo, categorias, tema }) {
  const { viewport } = useThree()
  const grupo = useRef()

  const pilhas = useMemo(() => {
    const itens = Object.entries(resumo?.por_categoria ?? {}).slice(0, 7)
    if (!itens.length) return DEMO.map((n, i) => ({ nome: '', n, i, cor: tema.demo }))
    const base = Math.max(resumo.receitas, resumo.gastos) || 1
    return itens.map(([nome, valor], i) => ({
      nome, valor, i,
      n: Math.max(1, Math.round((valor / base) * MAX_MOEDAS)),
      cor: tema.grupos[categorias?.[nome] ?? 'desejo'],
    }))
  }, [resumo, categorias, tema])

  const largo = viewport.width > 9
  // no desktop as pilhas ocupam só a metade direita, longe do texto
  const area = largo ? viewport.width * 0.48 : viewport.width * 0.9
  const escala = Math.min(1, area / (pilhas.length * 1.3))
  const saldo = resumo?.saldo ?? 0

  useFrame(({ clock }) => {
    grupo.current.rotation.y = Math.sin(clock.elapsedTime * 0.25) * 0.12
  })

  return (
    <group position={[largo ? viewport.width * 0.23 : 0, largo ? -0.6 : -1.3, 0]}>
      <Text font={fonte} fontSize={largo ? 0.62 : 0.5} position={[0, 3.55, 0]} color={saldo < 0 ? tema.cores.neg : tema.cores.texto} anchorX="center">
        {brl(saldo)}
      </Text>
      <Text font={fonte} fontSize={0.16} letterSpacing={0.18} position={[0, 3.05, 0]} color={tema.cores.mudo} anchorX="center">
        {saldo < 0 ? 'NO VERMELHO ESTE MÊS' : 'SOBRA DO MÊS'}
      </Text>
      <group ref={grupo} scale={escala}>
        {pilhas.map(p => (
          <Pilha key={`${chave}-${p.nome}-${p.n}`} x={(p.i - (pilhas.length - 1) / 2) * 1.3} atraso={p.i * 0.12} tema={tema} {...p} />
        ))}
      </group>
      <ContactShadows position-y={0} opacity={tema.escuro ? 0.6 : 0.35} scale={14} blur={2.4} far={3} />
    </group>
  )
}

function Camera() {
  useFrame(({ camera, pointer }) => {
    camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04
    camera.position.y += (2.4 + pointer.y * 0.5 - camera.position.y) * 0.04
    camera.lookAt(0, 1.2, 0)
  })
  return null
}

export default function Hero3D(props) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [0, 2.4, 9], fov: 38 }} gl={{ antialias: false }} aria-hidden="true">
      <color attach="background" args={[props.tema.cores.bg]} />
      <Environment resolution={256}>
        {/* fundo quente no reflexo: sem ele a lateral metálica fica preta */}
        <mesh scale={30}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color="#6a5236" side={BackSide} />
        </mesh>
        <Lightformer intensity={3} position={[0, 5, -6]} scale={[12, 4, 1]} />
        <Lightformer intensity={2.2} color="#ffd9a0" position={[-6, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer intensity={1.4} color="#9fe8d0" position={[6, 1, 2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
      </Environment>
      <Cena {...props} />
      <Camera />
      <EffectComposer multisampling={4}>
        <Bloom intensity={0.7} luminanceThreshold={0.9} mipmapBlur />
        <Grao escuro={props.tema.escuro ? 0.45 : 0.88} />
      </EffectComposer>
    </Canvas>
  )
}
