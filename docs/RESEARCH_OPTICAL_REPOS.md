# Pesquisa em Repositórios de Simulação Óptica, Lentes Cinematográficas e Câmeras Físicas (SHOT-36)
## Análise Comparativa, Fórmulas Matemáticas, Gap Analysis e Propostas de Engenharia para o Shotlab

---

## 1. Sumário Executivo & Metodologia

Este documento consolida a investigação técnica profunda e o engenharia reversa de 7 repositórios de referência na área de óptica fotográfica, computação gráfica, simulação de câmeras físicas e pós-processamento de imagem:

1. **`HoraceLuBFA/dof-simulator`** & Ecossistema R3F DoF — Visualização 3D de planos de foco (`Near DoF`, `Focus Plane`, `Far DoF`), frustum e shader de Bokeh no Three.js.
2. **`skatardude10/ComfyUI-Optical-Realism`** — Nós de pós-processamento óptico em PyTorch baseados no par `RGB + Depth Map`: Bokeh por convolução de disco circular, Halation de filme, aberração cromática espectral, distorção de lente, vinheta física, curva de emulsão fotográfica de granulação (grão Kodak) e highlight roll-off. **Instalado com sucesso no ComfyUI local do usuário.**
3. **`hubertlim/blender_lens_inventory`** — Catálogo mestre de fabricantes e famílias de lentes cinematográficas do mundo real (ARRI, Cooke, ZEISS, Leitz Cine, Canon), especificações públicas de distância focal (`mm`), T-stop real, distância mínima de foco (`close_focus_m`), perfis de look (distorção radial e dispersão) e calibração de focus breathing.
4. **`sidp/physical-camera`** — Motor de câmera física com ray-tracing óptico backwards via matrizes paraxiais ABCD, modelagem de lentes espessas reais a partir de patentes ópticas (Zeiss Planar, Sonnar, Cooke Triplet, Anamórficas com elementos cilíndricos X/Y e squeeze 2.0x), pupila de saída anamórfica (bokeh oval), geometria física de abertura ($N$ lâminas), vinheta $\cos^4(\theta)$, dispersão cromática espectral por número de Abbe ($V_d$) e reflexões internas secundárias (ghost flares com mira por luzes da cena).
5. **`jherr/depth-of-field`** — Simulador interativo de profundidade de campo em TypeScript/React, círculo de confusão milimétrico exato ($\text{CoC} = d / 1500$), crop factor automático para qualquer sensor, distância hiperfocal analítica e escala de proporção com sujeitos humanos e animais.
6. **`EatTheFuture/camera_shakify`** — Sistema de perfis cinéticos de tremor de câmera (*handheld camera shake*) baseado em 6-DOF motion capture de tomadas reais (capturado pelo cineasta Ian Hubert), contendo 9 perfis cinemáticos (Investigation, The Closeup, The Wedding, Walk to the Store, Handycam Run, Out Car Window, Bike, Spaceship e Zeek).
7. **`legibleguy/perspective-catcher`** — Solver matemático analítico 100% puro e sem dependências externas para calibração de câmeras pinhole a partir de linhas guias na imagem (1, 2 e 3 pontos de fuga / vanishing points), deduzindo distância focal exata ($f$), ponto principal $(c_x, c_y)$, horizonte e matriz de pose tridimensional ($R, T$).

Além de dissecar cada repositório em código e equações físicas, este relatório apresenta uma **Matriz de Gap Analysis Arquivo por Arquivo** contra a base atual do **Shotlab** e um roadmap de propostas prontas para se tornarem cards de produto e engenharia no **It's a Plan (Projeto SHOT)**.

---

## 2. Análise Detalhada dos Repositórios de Referência

### 2.1 `HoraceLuBFA/dof-simulator` & Shaders de DoF no Three.js / R3F

#### Visão Geral e Arquitetura
O simulador de DoF em React + Three.js / React Three Fiber modela a câmera fotográfica virtual não como uma caixa preta abstrata, mas como um sistema óptico com limites geométricos claros no espaço tridimensional:
1. **Frustum da Câmera**: pirâmide visual que parte da pupila de entrada da lente e abre de acordo com o FOV calculado do sensor e distância focal.
2. **Plano de Foco (`Focus Plane`)**: plano bidimensional localizado exatamente à distância de foco $s$ (`focusDistanceM`), onde qualquer geometria que intersecta a superfície atinge nitidez perfeita (círculo de confusão nulo).
3. **Plano de Limite Próximo (`Near DoF Limit Plane`)**: plano à distância $D_{\text{near}}$, indicando onde o desfoque começa a ultrapassar o limiar de tolerância da retina ou sensor.
4. **Plano de Limite Distante (`Far DoF Limit Plane`)**: plano à distância $D_{\text{far}}$, indicando onde o desfoque do fundo ultrapassa o limiar. Quando $s \ge H$ (distância hiperfocal), o plano se estende ao infinito ($D_{\text{far}} \to \infty$).
5. **Volume de Nitidez Aceitável (`DoF Volume / Sharpness Corridor`)**: o espaço tridimensional contido entre $D_{\text{near}}$ e $D_{\text{far}}$.

#### Visualização Geométrica no Three.js / R3F
Para desenhar os planos de foco no espaço do mundo relativo à câmera, a posição e dimensões de cada plano variam em função do FOV vertical e aspect ratio:

```typescript
// Dimensões do plano no espaço local da câmera à distância d:
const halfFovRad = (verticalFovDeg * Math.PI) / 360;
const planeHeight = 2 * Math.tan(halfFovRad) * distanceM;
const planeWidth = planeHeight * aspectRatio;
```

A geometria dos 3 planos no Three.js é tipicamente renderizada com materiais semi-transparentes distintos:
* **Focus Plane**: `color: #38bdf8` (azul/ciano de estúdio), `opacity: 0.35`, com mira central (retículo de foco) e contorno nítido.
* **Near DoF Plane**: `color: #f59e0b` (âmbar de aviso), `opacity: 0.20`, com linha tracejada (`dashed`).
* **Far DoF Plane**: `color: #10b981` (esmeralda), `opacity: 0.20`, com fade progressivo quando se aproxima da hiperfocal.

#### Pós-Processamento e Bokeh Shaders no Three.js
No Three.js (`three/addons/postprocessing/BokehPass.js`), a simulação do efeito DoF em tempo real sobre a imagem renderizada é calculada por um fragment shader que lê o depth buffer linearizado:

```glsl
// Linearização de profundidade no Bokeh Shader (Three.js BokehShader.js):
float linearize(float depth) {
    return -far * near / (depth * (far - near) - far);
}

// Cálculo do diâmetro do Círculo de Confusão (CoC) por fragmento:
float calculateCoC(float depth, float focus, float aperture, float maxblur) {
    float s = focus;
    float d = depth;
    float coc = abs(d - s) / (d + 1e-5) * (aperture / s);
    return clamp(coc, 0.0, maxblur);
}
```

No ecossistema **React Three Fiber (R3F)**, utiliza-se `@react-three/postprocessing` com o componente `<DepthOfField />`:
```tsx
import { EffectComposer, DepthOfField } from '@react-three/postprocessing';

<EffectComposer>
  <DepthOfField
    focusDistance={focusDistanceNormalized} // [0..1]
    focalLength={focalLengthNormalized}
    bokehScale={apertureScale}
    height={720}
  />
</EffectComposer>
```

---

### 2.2 `skatardude10/ComfyUI-Optical-Realism` (Nós de Realismo Óptico)

O repositório `ComfyUI-Optical-Realism` foi clonado, inspecionado e instalado diretamente no diretório de nós customizados local:
`/home/rukashi/Documentos/ComfyUI_windows_portable/ComfyUI/custom_nodes/ComfyUI-Optical-Realism`

#### Arquitetura dos Nós Python
O módulo registra dois nós no ComfyUI (`__init__.py`):
1. `OpticalRealism`: nó principal de pós-processamento óptico e físico (`Category: PostProcessing/Physics`).
2. `RemoveAlphaChannel`: conversor utilitário de RGBA para RGB puro (`Category: Image/Utils`).

#### Análise das Fórmulas e Pipelines de Física Óptica (`optical_realism.py`)

1. **Distorção Geométrica Radial de Lente (Barril / Almofada)**:
   Aplica distorção radial proporcional ao quadrado da distância ao centro da imagem ($r^2 = x^2 + y^2$):
   $$f(r) = 1.0 + k_{\text{distortion}} \cdot (x^2 + y^2)$$
   $$\begin{pmatrix} x' \\ y' \end{pmatrix} = f(r) \cdot \begin{pmatrix} x \\ y \end{pmatrix}$$
   *Implementação*: utiliza `torch.meshgrid` e `F.grid_sample` com `padding_mode='reflection'`, distorcendo **tanto a imagem RGB quanto o Depth Map**, garantindo que os efeitos volumétricos subsequentes permaneçam perfeitamente alinhados ao espaço 3D deformado pela lente.

2. **Balanço de Branco com Conservação de Luminância**:
   Calcula os ganhos dos canais $R, G, B$ baseados em temperatura e tonalidade (tint), normalizando pela luminosidade Rec.601 ($0.299R + 0.587G + 0.114B$) para evitar estouro de brancos (*exposure clipping*):
   $$g_R = 1.0 + 0.15 \cdot \text{temp} + 0.10 \cdot \text{tint}$$
   $$g_G = 1.0 - 0.15 \cdot \text{tint}$$
   $$g_B = 1.0 - 0.15 \cdot \text{temp} + 0.10 \cdot \text{tint}$$
   $$L = 0.299 g_R + 0.587 g_G + 0.114 g_B \implies g_i' = \frac{g_i}{L}$$

3. **Depth of Field com Convolução de Disco Circular (True Bokeh Disc)**:
   Diferente de desfoques gaussianos que criam uma névoa borrada artificial, o nó gera um kernel convolucional em forma de **disco circular uniforme**:
   $$K(x, y) = \begin{cases} \frac{1}{\sum 1}, & x^2 + y^2 \le r^2 \\ 0, & \text{caso contrário} \end{cases}$$
   onde $r = \min(25, \max(1, \lfloor \text{intensity} \cdot 25 \rfloor))$. O kernel é aplicado via `F.conv2d(groups=3)`.
   *Auto-Focus Baseado em ROI*: analisa a região central (60% do quadro: $20\% \dots 80\%$) e calcula o percentil 10 da profundidade (`torch.quantile(roi, 0.10)`), priorizando o primeiro plano do assunto principal.
   *Tabela F-Stop*:
   * `f/1.2`: intensidade 0.80, raio de nitidez 0.05
   * `f/1.4`: intensidade 0.60, raio de nitidez 0.10
   * `f/1.8`: intensidade 0.45, raio de nitidez 0.15
   * `f/2.8`: intensidade 0.30, raio de nitidez 0.30
   * `f/4.0`: intensidade 0.20, raio de nitidez 0.45
   * `f/8.0`: intensidade 0.05, raio de nitidez 0.75
   * `f/16 - f/22`: intensidade 0.00, raio de nitidez 1.00 (tudo em foco)

4. **Halation de Filme (Dispersão Vermelha em Altas Luzes)**:
   Simula a dispersão física da luz que atravessa a base do filme analógico (como Kodak Vision3 500T) e reflete na camada antihalação:
   * Isola pixels de alta luminância: $M_{\text{hal}} = \text{clamp}((L - 0.6) \cdot 2.5, 0, 1)$.
   * Aplica blur gaussiano largo ($\text{kernel}=31, \sigma=8.0$).
   * Injeta o sangramento **exclusivamente no canal Vermelho ($R$)**, gerando o clássico halo alaranjado/vermelho ao redor de lâmpadas e bordas superexpostas.

5. **Light Wrap (Sangramento de Fundo em Bordas de Silhueta)**:
   Aplica `F.avg_pool2d` de raio 21 sobre a imagem e calcula o blend de tela (*Screen Blend*) ponderado pela máscara de proximidade ($1 - \text{depth}$), eliminando o aspecto artificial de "recorte colado" em objetos em contraluz.

6. **Aberração Cromática Espectral (Fringing Radial)**:
   Aplica escalas radiais inversas e simétricas nos canais vermelho e azul:
   $$\text{scale}_R = \frac{1}{1 + \delta}, \quad \text{scale}_B = \frac{1}{1 - \delta}$$
   Reamostrando via `F.grid_sample` bilinear com preenchimento nas bordas.

7. **Granulação Orgânica de Emulsão Fotográfica (Parábola de Haleto de Prata)**:
   Em vez de ruído digital uniforme (ruído de TV estático), a granulação de filme reage diretamente à densidade de exposição:
   $$\text{EmulsionCurve}(I) = 4.0 \cdot I \cdot (1.0 - I)$$
   Esta parábola atinge o pico exato de $100\%$ em cinza médio ($I = 0.5$) e zera suavemente em brancos puros ($I = 1.0$) e sombras profundas ($I = 0.0$). Além disso, o ruído gaussiano base é submetido a um micro-desfoque $3\times3$ ($\sigma=0.8$) para agrupar os cristais de haleto em grumos orgânicos antes da mistura.

8. **Compressão Logarítmica de Realce (Highlight Roll-Off)**:
   Evita o recorte rígido em $1.0$ (*hard clip* digital), aplicando compressão suave no ombro da curva de resposta:
   $$I_{\text{out}} = \frac{I}{1.0 + I \cdot k_{\text{rolloff}} \cdot 0.5}$$

---

### 2.3 `hubertlim/blender_lens_inventory` (Catálogo de Lentes Cinematográficas)

O repositório `blender_lens_inventory` implementa um catálogo preciso de famílias de lentes de cinema a partir de especificações públicas oficiais de fabricantes.

#### Estrutura de Dados (`cine_lenses.json`)
Cada família possui parâmetros de cobertura de sensor, distâncias focais, aberturas nominais em T-stops, distância mínima de foco e perfis de look:

| Fabricante | Família | Cobertura | Faixa Focal (`mm`) | T-Stop Máximo | Distorção Radial | Glare/Halo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ZEISS** | Compact Prime CP.3 | Full Frame (36x24mm) | 15, 18, 21, 25, 28, 35, 50, 85, 100 CF, 135 | T2.1 – T2.9 | -0.028 a +0.008 | Fog Glow (High) |
| **Cooke** | S7/i FF | Full Frame (36x24mm) | 16, 18, 21, 25, 27, 32, 40, 50, 65, 75, 100, 135, 180, 300 | T2.0 – T3.3 | Look quente característico | Cooke Look |
| **ARRI** | Signature Prime | Large Format (36.7x25.54mm) | 12, 15, 18, 21, 25, 29, 35, 40, 47, 58, 75, 95, 125, 150, 200, 280 | T1.8 – T2.8 | Controle ultra-preciso | Bokeh aveludado |
| **Leitz Cine**| Leitz Prime | Large Format (36x24mm) | 18, 21, 25, 29, 35, 40, 50, 65, 75, 100, 135, 180, 350 | T1.8 – T3.6 | Mínima aberração | Neutro / Crisp |
| **Leitz Cine**| HUGO (Leica M) | Full Frame (36x24mm) | 18, 21, 24, 28, 35, 40, 50, 75, 90, 135 (+ 50mm T1.0 Noctilux) | T1.0 – T2.1 | Micro-contraste Leica | Textura vintage |
| **Canon** | Cinema Prime CN-E | Full Frame (36x24mm) | 14, 20, 24, 35, 50, 85, 135 | T1.3 – T3.1 | Equilibrado / Suave | Tons de pele quentes |

#### Mecanismos de Calibração & Focus Breathing
O addon inclui suporte a curvas de **Focus Breathing** (variação da distância focal efetiva em função da distância de foco do assunto):
$$f_{\text{effective}} = f_{\text{nominal}} \cdot \text{multiplier}(s)$$
onde o multiplicador é interpolado linearmente a partir de dados medidos de calibração (`breathing_curve`). Além disso, permite espelhar o valor do **T-stop diretamente no F-stop da câmera virtual** como proxy de profundidade de campo.

---

### 2.4 `sidp/physical-camera` (Óptica Paraxial, ABCD e Ray Tracing Físico)

O `physical-camera` é uma extensão em Open Shading Language (OSL) para o Cycles no Blender que substitui o modelo de câmera pinhole padrão por um modelo físico espesso com ray-tracing reverso (*backward ray tracing*) baseado em prescrições ópticas reais de patentes mundiais.

#### Conceitos-Chave e Formulações Matemáticas

1. **Matrizes Paraxiais ABCD**:
   Rastreia os raios paraxiais da superfície frontal até a superfície traseira do conjunto óptico para derivar:
   * A posição exata do plano do sensor para uma determinada distância de foco:
     $$\begin{pmatrix} y' \\ \theta' \end{pmatrix} = \begin{pmatrix} A & B \\ C & D \end{pmatrix} \begin{pmatrix} y \\ \theta \end{pmatrix}$$
   * Posição e magnificação da pupila de saída (*Exit Pupil*): essencial para determinar a vinheta mecânica natural e o formato do disco de bokeh.

2. **Lentes Anamórficas & Elementos Cilíndricos**:
   Suporta elementos com curvatura em apenas um dos eixos:
   * `cylindrical_x`: curvatura no plano X-Z (comprime a luz horizontalmente).
   * `cylindrical_y`: curvatura no plano Y-Z (estica verticalmente).
   * Implementa matrizes ABCD duplas separadas ($X$ e $Y$). O sensor calcula a posição com base no meridiano esférico ($Y$), gerando a clássica **pupila de saída elíptica com bokeh oval e descompressão de squeeze** ($2.0\times, 1.5\times, 1.33\times$).

3. **Geometria Física da Abertura do Diafragma**:
   Simula lâminas físicas reais ($N$-gon aperture de 5 a 18 lâminas):
   $$\text{AperturePolygon}(x, y, N, r) = \max_{k \in [0, N-1]} \left( x \cos\frac{2\pi k}{N} + y \sin\frac{2\pi k}{N} \right) \le r \cos\frac{\pi}{N}$$
   permitindo bokeh poligonal característico em aberturas mais fechadas.

4. **Vinheta Radiométrica Natural ($\cos^4 \theta$)**:
   A intensidade da luz que atinge o sensor cai naturalmente com a quarta potência do cosseno do ângulo de incidência em relação ao eixo óptico:
   $$E(\theta) = E_0 \cos^4 \theta$$

5. **Dispersão Cromática Espectral & Número de Abbe**:
   Rastreia comprimentos de onda contínuos entre $400\text{ nm}$ e $700\text{ nm}$. O índice de refração $n(\lambda)$ de cada elemento vítreo é calculado pela equação de dispersão baseada no número de Abbe $V_d$:
   $$V_d = \frac{n_d - 1}{n_F - n_C}$$

6. **Revestimento de Lente (Coating) & Reflexões de Flare (Ghosting)**:
   Calcula a refletância de filme fino de fluoreto de magnésio ($\text{MgF}_2$, $n=1.38$) na espessura de quarto de onda ($\lambda_0 = 550\text{ nm}$) pela fórmula de interferência de Airy. Rastreia pares de superfícies vítreas para simular halos e reflexos fantasma (*ghost flares*) reais direcionados às lâmpadas da cena.

---

### 2.5 `jherr/depth-of-field` (Cálculo Interativo e Escala Humana)

O repositório `depth-of-field` de Jack Herrington é uma aplicação React + TypeScript focada no cálculo em tempo real e visualização em SVG da profundidade de campo e proporção de câmera.

#### Fórmulas Ópticas Utilizadas
1. **Círculo de Confusão ($\text{CoC}$) e Crop Factor Automático**:
   $$\text{Diagonal} = \sqrt{W^2 + H^2}$$
   $$\text{CoC} = \frac{\text{Diagonal}}{1500}$$
   $$\text{CropFactor} = \frac{43.27}{\text{Diagonal}} \quad (43.27\text{ mm} = \text{diagonal do Full Frame 35mm})$$

2. **Distância Hiperfocal Analítica**:
   $$H = f + \frac{f^2}{N \cdot \text{CoC}}$$

3. **Limites de Profundidade de Campo**:
   $$D_{\text{near}} = \frac{H \cdot s}{H + (s - f)}$$
   $$D_{\text{far}} = \begin{cases} \frac{H \cdot s}{H - (s - f)}, & s < H \\ \infty, & s \ge H \end{cases}$$
   $$\text{TotalDoF} = D_{\text{far}} - D_{\text{near}}$$

4. **Field of View Vertical**:
   $$\text{VFOV} = 2 \cdot \arctan\left(\frac{H_{\text{sensor}}}{2 \cdot f}\right) \cdot \frac{180}{\pi}$$

5. **Silhuetas de Referência de Sujeito em Escala Métrica**:
   O visualizador SVG mapeia a proporção do cone visual da câmera em relação a silhuetas antropométricas:
   * Humano em pé (altura: $72" \approx 1.83\text{ m}$)
   * Humano sentado à mesa ($54" \approx 1.37\text{ m}$)
   * Cão grande ($40" \approx 1.02\text{ m}$)
   * Cão médio ($30" \approx 0.76\text{ m}$)
   * Cão pequeno ($20" \approx 0.51\text{ m}$)

---

### 2.6 `EatTheFuture/camera_shakify` (Perfis Cinemáticos de Handheld Camera Shake)

Criado pelo artista VFX Ian Hubert e desenvolvido por Nathan Vegdahl, o `camera_shakify` é a referência definitiva para tremido de câmera orgânico no cinema digital.

#### Estrutura dos Dados 6-DOF (`shake_data.py`)
Em vez de utilizar ruído Perlin artificial (que parece um tremor de robô flutuante), o addon contém **trajetórias 6-DOF capturadas via motion-tracking de câmeras reais** operadas em 24 fps:
* Translação em metros: `('location', 0)` ($X$), `('location', 1)` ($Y$), `('location', 2)` ($Z$).
* Rotação em radianos: `('rotation_euler', 0)` (Pitch), `('rotation_euler', 1)` (Yaw), `('rotation_euler', 2)` (Roll).

#### Catálogo dos 9 Perfis de Tremor Disponíveis
1. `INVESTIGATION` ("Investigation", 24 fps): câmera na mão em passos lentos e observacionais, com compensação do operador em tracking cuidadoso.
2. `THE_CLOSEUP` ("The Closeup", 24 fps): micro-movimentos e respiração sutil do operador em planos fechados e macro, ideal para retratos.
3. `THE_WEDDING` ("The Wedding", 24 fps): operador de pé com câmera pesada no ombro/peito, oscilação natural de equilíbrio bípede.
4. `WALK_TO_THE_STORE` ("Walk to the Store", 24 fps): cadência rítmica de passos com impacto de calcanhar e momentum de marcha.
5. `HANDYCAM_RUN` ("Handycam Run", 24 fps): corrida intensa estilo câmera na mão / documentário de ação, com solavancos verticais fortes.
6. `OUT_CAR_WINDOW` ("Out Car Window", 24 fps): vibração de alta frequência de chassi automotivo combinada com empuxo de vento.
7. `BIKE_ON_GRAVEL_2D` ("Bike on Gravel 2D", 24 fps): trepidação miúda e constante de terreno acidentado.
8. `SPACESHIP_SHAKE_2D` ("Spaceship Shake 2D", 24 fps): ressonância mecânica profunda de motores pesados e turbinas.
9. `THE_ZEEK_2D` ("The Zeek 2D", 24 fps): solavancos rápidos e repentinos com estabilização elástica.

O sistema permite interpolação temporal, loop suave de quadros, ajuste de escala de influência ($0.0 \dots 4.0$) e mistura de múltiplas camadas de tremor.

---

### 2.7 `legibleguy/perspective-catcher` (Calibração Geométrica de Perspectiva)

O `perspective-catcher` implementa um solver analítico em Python puro sem dependências externas (`numpy` ou `scipy`) para calibrar parâmetros de câmeras virtuais a partir de fotos de referência no espaço projetivo.

#### Algoritmo Matemático do Solver (`perspective_catcher/solver.py`)
1. **Representação Homogênea de Linhas e Pontos de Fuga**:
   As coordenadas de entrada UV da imagem são convertidas para o espaço métrico centrado:
   $$\mathbf{p}_{\text{metric}} = \left( (u - 0.5) \cdot \text{aspect}, \, v - 0.5, \, 1.0 \right)$$
   A reta formada por dois pontos $a, b$ é dada pelo produto vetorial $\mathbf{l} = \mathbf{a} \times \mathbf{b}$.
   O ponto de fuga $\mathbf{v}$ de duas retas convergentes $\mathbf{l}_1, \mathbf{l}_2$ é o produto vetorial $\mathbf{v} = \mathbf{l}_1 \times \mathbf{l}_2$.

2. **Dedução da Distância Focal a partir de 2 Pontos de Fuga Ortogonais**:
   Pela geometria projetiva euclidiana, se dois pontos de fuga correspondem a eixos ortogonais no mundo (ex: eixos $X$ e $Y$), o produto escalar de seus raios óticos em relação ao ponto principal $\mathbf{c}$ deve ser zero:
   $$(\mathbf{v}_1 - \mathbf{c}) \cdot (\mathbf{v}_2 - \mathbf{c}) + f^2 = 0 \implies f = \sqrt{- (\mathbf{v}_1 - \mathbf{c}) \cdot (\mathbf{v}_2 - \mathbf{c})}$$
   A distância focal em milímetros é então extraída diretamente em função do sensor físico:
   $$f_{\text{mm}} = f \cdot \frac{W_{\text{sensor}}}{\text{aspect}}$$

3. **Cálculo Automático do Ponto Principal a partir de 3 Pontos de Fuga**:
   Com 3 pontos de fuga ortogonais ($X, Y, Z$), o ponto principal $\mathbf{c}$ coincide exatamente com o **Ortocentro** do triângulo formado pelos 3 pontos de fuga no plano da imagem.

4. **Matriz de Rotação da Câmera**:
   Os raios unitários em direção aos pontos de fuga $\mathbf{r}_i = \frac{(\mathbf{v}_i - \mathbf{c}, -f)}{\|(\mathbf{v}_i - \mathbf{c}, -f)\|}$ formam as colunas da matriz de rotação da câmera no mundo ($R = [\mathbf{r}_x, \mathbf{r}_y, \mathbf{r}_z]$), ortonormalizadas via Gram-Schmidt.

5. **Recuperação de Posição Tridimensional da Câmera**:
   Dada a marcação de um ponto de origem no chão e uma distância ou tamanho de referência no mundo (em metros), o solver triangula a posição tridimensional absoluta $(X, Y, Z)$ da câmera em relação ao piso e às paredes.

---

## 3. Matriz Comparativa: Shotlab Atual vs. Repositórios de Referência

A tabela abaixo sintetiza a análise de maturidade atual do Shotlab contra o estado da arte dos 7 repositórios pesquisados:

| Dimensão Técnica | Estado Atual do Shotlab | Repositório de Referência | O que Falta / Oportunidade de Upgrade |
| :--- | :--- | :--- | :--- |
| **Planos 3D de Foco** | Apenas um retângulo de wireframe na distância de foco (`focusDistanceM`). | `HoraceLuBFA/dof-simulator` | Falta desenhar o plano de Near DoF, Far DoF, malhas semi-transparentes coloridas e volume 3D sombreado de nitidez. |
| **Shader de Bokeh em Tempo Real** | Sem visualização de desfoque de lente no Viewport 3D do Three.js. | `dof-simulator` / Three.js `BokehPass` | Falta integrar passe de pós-processamento de profundidade no R3F com controle de f-stop e foco. |
| **Pós-Processamento Óptico IA** | Gera apenas RGB bruto + exporta Depth/Normal pass sem pós-processamento de lente. | `ComfyUI-Optical-Realism` | Falta conectar o Depth Map ao nó `OpticalRealism` para adicionar halation, granulação Kodak, distorção e bokeh disc. |
| **Catálogo de Lentes Cinematográficas** | 6 distâncias focais genéricas (24, 35, 50, 85, 105, 135) e 4 sensores. | `blender_lens_inventory` | Falta catálogo de marcas (ARRI, Cooke, Zeiss, Leitz, Canon), T-stops reais, distâncias mínimas e focus breathing. |
| **Parâmetros Físicos Avançados** | Lente ideal fina (thin lens); sem lâminas de diafragma, sem anamórfico. | `sidp/physical-camera` | Falta squeeze anamórfico (bokeh oval 2x), número de lâminas de diafragma ($N$), vinheta $\cos^4\theta$ e flares. |
| **Escala e Ergonomia Visual de Sujeito** | Sujeito não possui silhuetas de proporção visual e enquadramento. | `jherr/depth-of-field` | Falta adicionar silhuetas anatômicas em escala (humano em pé, sentado, animais) e cálculo de crop factor automático. |
| **Tremor Orgânico de Câmera (Handheld)** | Câmera estática no espaço; sem dinâmica de operação manual. | `EatTheFuture/camera_shakify` | Falta biblioteca de curvas 6-DOF com perfis de câmera na mão (Investigation, Closeup, Walk, Run, Car, etc.). |
| **Calibração de Perspectiva por Foto** | O usuário deve posicionar a câmera 3D manualmente por tentativa e erro. | `legibleguy/perspective-catcher` | Falta solver interativo de 2/3 pontos de fuga para calibrar lente e posição a partir de uma foto de referência. |

---

## 4. Cruzamento Direto (Gap Analysis) Arquivo por Arquivo no Shotlab

### 4.1 `frontend/src/components/viewport/CameraHelperVisualizer.tsx`
* **Código Atual**: Constrói um `THREE.BufferGeometry` estático com 8 linhas conectando a câmera a um retângulo plano único posicionado em `Math.min(focusDistanceM, 3.5)`. Não renderiza planos de Near DoF ou Far DoF.
* **Gaps Identificados**:
  1. Ausência de plano de **Near DoF** (`dofNear_m`) e **Far DoF** (`dofFar_m`).
  2. Ausência de preenchimento volumétrico (*depth of field corridor*) translúcido para visualizar a fatia de nitidez do cenário.
  3. A distância de foco do frustum está artificialmente travada no teto de `3.5m` no código atual (`Math.min(focusDistanceM, 3.5)`), distorcendo a visualização de teleobjetivas (85mm, 135mm focadas a 5m ou 10m).
  4. Falta etiqueta de telemetria 3D no plano de foco (ex: `"FOCUS: 2.50m | DoF: 0.42m"`).

### 4.2 `frontend/src/utils/optics.ts` & `backend/services/optics.py`
* **Código Atual**: Implementa funções matemáticas sólidas para cálculo de FOV horizontal/vertical/diagonal, CoC ($d/1500$), distância hiperfocal e limites de DoF.
* **Gaps Identificados**:
  1. Não possui suporte a **fatores de compressão anamórfica** (`anamorphicSqueeze`: 1.33x, 1.5x, 1.8x, 2.0x), o que altera o FOV horizontal efetivo e a geometria de bokeh.
  2. Não possui suporte a **T-stops** (transmitância fotométrica real vs. f-stop geométrico).
  3. Não calcula **focus breathing** (expansão do enquadramento ao focar em objetos próximos).
  4. Não calcula diâmetro da pupila de entrada/saída ($E_p = f / N$).

### 4.3 `frontend/src/components/sidebar/CameraPanel.tsx`
* **Código Atual**: Possui botões estáticos para 4 sensores e 6 distâncias focais, além de sliders manuais.
* **Gaps Identificados**:
  1. Falta seletor de **Famílias de Lentes Cinematográficas Reais** (ex: *ARRI Signature Prime*, *Cooke S7/i*, *Zeiss CP.3*, *Leitz HUGO*).
  2. Falta seletor de **Lâminas do Diafragma** (Circular, 7 lâminas, 9 lâminas, 11 lâminas) e modo **Anamórfico**.
  3. Falta ferramenta de **Autofoco Interativo / Click-to-Focus** (ao clicar em qualquer mesh no viewport, atualizar o `focusDistanceM` com a distância exata da câmera até o ponto de impacto).
  4. Falta aba de **Handheld Camera Shake** para selecionar e dosar perfis de movimento.

### 4.4 `frontend/src/components/viewport/Viewport.tsx`
* **Código Atual**: Canvas R3F com iluminação de estúdio, OrbitControls, transform gizmos e malhas de cena.
* **Gaps Identificados**:
  1. Não possui passe de pós-processamento com shader de DoF em tempo real para pré-visualização de bokeh antes do envio para renderização de IA.
  2. Não possui suporte a animação de câmera ou aplicação de curvas de vibração 6-DOF de `camera_shakify`.

### 4.5 `backend/models/scene.py` & `frontend/src/types/scene.ts`
* **Código Atual**: `CameraModel` armazena `focal_length_mm`, `sensor_width_mm`, `sensor_height_mm`, `f_stop`, `focus_distance_m`, `position`, `target`, `aspect_ratio`.
* **Gaps Identificados**:
  1. Não possui campos para:
     * `lens_brand`: fabricante da lente cinematográfica
     * `lens_model`: modelo da lente (ex: "Cooke S7/i 50mm T2.0")
     * `aperture_blades`: número de lâminas do diafragma (default: 0 = circular)
     * `anamorphic_squeeze`: fator anamórfico (default: 1.0)
     * `camera_shake_profile`: perfil de tremor (default: "none")
     * `camera_shake_intensity`: multiplicador de intensidade do tremor
     * `optical_realism`: dicionário com parâmetros físicos de pós-processamento (halation, grain, pro-mist, distortion).

### 4.6 `backend/services/comfyui_client.py` & Workflows ComfyUI
* **Código Atual**: Constrói prompts textuais ricos e envia blockout RGB para Qwen Image 2.1 e layout JSON para MOSS-Image. Exporta passes RGB e Depth Map.
* **Gaps Identificados**:
  1. A imagem gerada pela IA e o mapa de profundidade não são encadeados no nó `OpticalRealism` recém-instalado, perdendo a oportunidade de unificar a renderização 3D com desfoque óptico disc bokeh e granulação analógica em um único fluxo automatizado.

---

## 5. Propostas Detalhadas de Melhorias e Roadmap de Engenharia

Com base nas conclusões da pesquisa, estruturamos os seguintes blocos acionáveis de evolução técnica para o Shotlab:

### 🎯 Proposta 1: Viewport 3D Óptico com Planos de Foco Volumétricos (`SHOT-37`)
* **Implementação**:
  1. Reformular o `CameraHelperVisualizer.tsx` para desenhar:
     * **Plano de Foco (`Focus Plane`)**: malha retangular em `focusDistanceM` com material `MeshBasicMaterial` (ciano translúcido, opacity 0.25, `depthWrite: false`), borda com retículo central e etiqueta com distância formatada em metros.
     * **Plano de Limite Próximo (`Near DoF`)**: malha em `dofNear_m` (cor âmbar, opacity 0.15) com bordas tracejadas.
     * **Plano de Limite Distante (`Far DoF`)**: malha em `dofFar_m` (cor esmeralda, opacity 0.15). Se `isInfiniteFar == true`, o plano é ocultado ou desenhado no limite do grid de estúdio com gradiente de fade.
     * **Volume de Nitidez (DoF Corridor)**: malha volumétrica conectando o Near DoF ao Far DoF, destacando o volume espacial nítido.
  2. Implementar recurso de **Click-to-Focus (Autofoco)**:
     * Ao ativar o modo de foco ou usar o atalho `F`, um raycaster detecta o ponto do objeto sob o cursor do mouse e calcula a distância Euclidiana $\| \mathbf{p}_{\text{hit}} - \mathbf{p}_{\text{cam}} \|$, atualizando `focusDistanceM` instantaneamente no store.
  3. Adicionar **Preview de Bokeh em Tempo Real no R3F**:
     * Habilitar opcionalmente via toggle no Viewfinder HUD o passe de pós-processamento de profundidade com Bokeh circular para visualização imediata do desfoque no Three.js.

### 🎯 Proposta 2: Catálogo de Lentes Cinematográficas Reais e Parâmetros Físicos (`SHOT-38`)
* **Implementação**:
  1. Criar o catálogo estruturado em JSON/TypeScript (`frontend/src/data/cineLensCatalog.ts` e `backend/data/cine_lenses.json`) com os dados extraídos de `blender_lens_inventory` e `physical-camera`:
     * **ARRI Signature Primes** (12mm a 280mm T1.8–T2.8)
     * **Cooke S7/i FF** (16mm a 300mm T2.0–T3.3)
     * **ZEISS CP.3** (15mm a 135mm T2.1–T2.9)
     * **Leitz HUGO & Noctilux** (18mm a 135mm T1.0–T2.1)
     * **Canon Cinema Primes** (14mm a 135mm T1.3–T3.1)
     * **Panavision / Hawk Anamorphic** (squeeze 2.0x e 1.33x)
  2. Expandir o `CameraPanel.tsx` com uma aba de lentes:
     * Dropdown de Fabricante / Família de Lente.
     * Lista de distâncias focais reais da família selecionada com exibição de T-stop e distância mínima de foco.
     * Configuração de lâminas de diafragma ($N$) e fator anamórfico (com visualização do formato oval do bokeh).

### 🎯 Proposta 3: Integração do Nó `OpticalRealism` no Workflow ComfyUI (`SHOT-39`)
* **Implementação**:
  1. Criar templates de workflow ComfyUI API JSON que recebam:
     * O render gerado pela IA (Qwen Image 2.1 ou MOSS-Image).
     * O Depth Map renderizado pelo Shotlab (`SHOT-14`).
  2. Encadear a saída no nó `OpticalRealism` configurado com os parâmetros ópticos da cena:
     * `f_stop`: f-stop configurado na câmera 3D do Shotlab.
     * `dof_focus_point`: profundidade relativa normalizada derivada do `focusDistanceM`.
     * `promist_strength`: configurável no painel de render (ex: 0.15 para simular Tiffen Black Pro-Mist 1/4).
     * `halation_strength`: configurável (ex: 0.20 para emulação de película Kodak Vision3).
     * `grain_power`: granulação analógica com curva de emulsão de haleto de prata.
     * `lens_distortion`: distorção calculada a partir do perfil da lente escolhida.

### 🎯 Proposta 4: Calibração de Perspectiva por Foto de Referência (`perspective-catcher`)
* **Implementação**:
  1. Portar o solver analítico de `perspective_catcher/solver.py` para um serviço no backend FastAPI (`backend/services/perspective_solver.py` e rota `/v1/optics/solve-perspective`).
  2. Criar no frontend uma ferramenta de calibração interativa na UI:
     * O usuário faz upload de uma foto de locação ou conceito de estúdio como imagem de referência.
     * Posiciona 2 pares de linhas guias nos eixos da imagem (ex: quinas de parede, linhas do teto/chão).
     * O backend executa o solver e recalcula automaticamente:
       * Distância focal da câmera em mm ($f$).
       * Posição tridimensional no estúdio ($X, Y, Z$).
       * Ângulos de rotação (Pitch, Yaw, Roll).
       * Horizonte da cena.
     * A câmera do Shotlab é reorientada automaticamente para coincidir perfeitamente com a perspectiva da foto de referência!

### 🎯 Proposta 5: Handheld Camera Shake & Cinematografia Virtual (`camera_shakify`)
* **Implementação**:
  1. Extrair os dados 6-DOF de `camera_shakify/shake_data.py` para um módulo JSON leve (`frontend/src/data/cameraShakeProfiles.json`).
  2. Implementar no Viewport um hook `useCameraShake()` que aplica pequenos offsets de translação e rotação em tempo de execução:
     * Perfis selecionáveis: *Subtle Handheld / The Closeup* (micro-respiração), *Operator Standing / The Wedding* (equilíbrio natural), *Walking Shot* (passos), *Action / Running* (solavancos).
     * Slider de intensidade (`influence`: 0% a 100%).
  3. Permitir congelar ou sortear um take de tremor para envio no prompt de geração de IA (ex: `"subtle natural handheld camera framing, slight organic documentary tilt"`).

---

## 6. Conclusão & Próximos Passos

A investigação nos 7 repositórios comprovou que a base matemática já desenvolvida no Shotlab (`optics.ts` e `services/optics.py`) está no caminho correto, mas possui um enorme potencial de enriquecimento:
1. O **Viewport 3D** pode saltar de um simples wireframe para um visor óptico profissional com planos visíveis de Near/Focus/Far DoF e foco interativo por clique.
2. A inclusão do catálogo de **Cine Lenses Reais** e do nó **ComfyUI-Optical-Realism** posiciona o Shotlab como uma ponte definitiva entre cinematografia real e difusão de IA foto-realista.
3. Todas as dependências externas temporárias em `/tmp/optics-repos-research` foram integralmente analisadas e extraídas, prontas para implementação imediata nas tarefas sequenciais (`SHOT-37`, `SHOT-38`, `SHOT-39`).
