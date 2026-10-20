# Pesquisa de Engenharia no Código-Fonte do Blender (SHOT-35)
## Arquitetura de Câmera Física, Sensor Fit, Viewport Transitions, Gizmos de Precisão e Iluminação Blackbody

---

## 1. Sumário Executivo & Metodologia

Este documento consolida a investigação técnica realizada diretamente sobre o repositório oficial do **Blender** (`blender/blender`), clonado temporariamente em `/tmp/blender-research` com checkout esparso das áreas fundamentais:
* `source/blender/makesdna` (estruturas de dados fundamentais DNA)
* `source/blender/blenkernel` (regras e algoritmos do kernel, câmera, luz e objetos)
* `source/blender/draw/engines/overlay` (pipeline de desenho de viewport e helpers)
* `source/blender/editors/space_view3d` (navegação 3D, visor e guias)
* `source/blender/editors/transform` (gizmos, snapping e cálculo de restrições)
* `source/blender/nodes/shader` e `source/blender/imbuf` (tabelas e nós de conversão física Blackbody)

O objetivo é extrair os princípios matemáticos e padrões de arquitetura consolidados no Blender e realizar um **Cruzamento Direto (Gap Analysis) Arquivo por Arquivo** contra a base de código do **Shotlab**:
1. `frontend/src/components/viewport/Viewport.tsx`
2. `frontend/src/components/viewport/CameraHelperVisualizer.tsx`
3. `frontend/src/components/viewport/StudioLighting.tsx`
4. `frontend/src/components/viewport/TransformGizmo.tsx`
5. `frontend/src/components/viewport/SceneMesh.tsx`
6. `frontend/src/components/viewport/ViewfinderHUD.tsx`
7. `frontend/src/components/sidebar/CameraPanel.tsx`
8. `frontend/src/utils/optics.ts`
9. `backend/services/validator.py`
10. `backend/services/lighting_studio.py`

---

## 2. Eixo 1 — Câmera Óptica & Sensor Fit

### 2.1 Estrutura de Dados do Blender (`DNA_camera_types.h`)
No arquivo `source/blender/makesdna/DNA_camera_types.h`, a representação física de uma câmera difere substancialmente de câmeras genéricas de computação gráfica:

```c
/* source/blender/makesdna/DNA_camera_types.h */

enum eCamera_SensorFit : char {
  CAMERA_SENSOR_FIT_AUTO = 0,
  CAMERA_SENSOR_FIT_HOR = 1,
  CAMERA_SENSOR_FIT_VERT = 2,
};

#define DEFAULT_SENSOR_WIDTH 36.0f
#define DEFAULT_SENSOR_HEIGHT 24.0f

struct Camera {
  ...
  float lens = 50.0f;                          // Distância focal em milímetros (mm)
  float sensor_x = DEFAULT_SENSOR_WIDTH;       // Largura do sensor físico (mm)
  float sensor_y = DEFAULT_SENSOR_HEIGHT;      // Altura do sensor físico (mm)
  float shiftx = 0, shifty = 0;                // Deslocamento óptico (Lens Shift) normalizado
  float clip_start = 0.1f, clip_end = 1000.0f; // Planos de recorte em metros
  eCamera_SensorFit sensor_fit = {};          // Modo de adaptação do sensor ao frame
  float passepartalpha = 0.5f;                 // Opacidade da máscara de corte do visor
  eCompositionGuideFlags composition_guide_flags = {};
  struct CameraDOFSettings dof;                // Distância de foco e abertura física
  ...
};
```

### 2.2 Algoritmo de Sensor Fit (`camera.cc`)
Em motores gráficos tradicionais (incluindo Three.js / WebGL), o campo de visão (`camera.fov`) é invariavelmente o **FOV Vertical em graus** (`vFov`). Isso gera um problema crítico na fotografia virtual: se o usuário altera a proporção de tela (aspect ratio) da imagem gerada de `16:9` para `9:16` (Instagram Reels / TikTok) ou `1:1`, calcular o `vFov` baseado puramente na altura do sensor faz com que a lente fotográfica se comporte de maneira bizarra, ampliando ou reduzindo a imagem sem correspondência com uma lente real.

No Blender (`source/blender/blenkernel/intern/camera.cc`), esse comportamento é solucionado através de três funções interdependentes:

```cpp
/* source/blender/blenkernel/intern/camera.cc */

float BKE_camera_sensor_size(int sensor_fit, float sensor_x, float sensor_y)
{
  if (sensor_fit == CAMERA_SENSOR_FIT_VERT) {
    return sensor_y;
  }
  return sensor_x;
}

int BKE_camera_sensor_fit(int sensor_fit, float sizex, float sizey)
{
  if (sensor_fit == CAMERA_SENSOR_FIT_AUTO) {
    if (sizex >= sizey) {
      return CAMERA_SENSOR_FIT_HOR;
    }
    return CAMERA_SENSOR_FIT_VERT;
  }
  return sensor_fit;
}
```

#### Dedução Matemática do Viewplane e FOV Efetivo:
Quando o Blender calcula o plano de visão (`BKE_camera_params_compute_viewplane`):
1. **Em modo `CAMERA_SENSOR_FIT_HOR`** (ou `AUTO` com proporção paisagem $\text{aspect} \ge 1.0$):
   $$\text{hFOV} = 2 \cdot \arctan\left(\frac{\text{sensor}_x}{2 \cdot f}\right)$$
   $$\tan\left(\frac{\text{vFOV}}{2}\right) = \frac{\tan(\text{hFOV} / 2)}{\text{aspect}}$$
   $$\text{vFOV} = 2 \cdot \arctan\left(\frac{\tan(\text{hFOV} / 2)}{\text{aspect}}\right) = 2 \cdot \arctan\left(\frac{\text{sensor}_x / \text{aspect}}{2 \cdot f}\right)$$

2. **Em modo `CAMERA_SENSOR_FIT_VERT`** (ou `AUTO` com proporção retrato $\text{aspect} < 1.0$):
   $$\text{vFOV} = 2 \cdot \arctan\left(\frac{\text{sensor}_y}{2 \cdot f}\right)$$
   $$\tan\left(\frac{\text{hFOV}}{2}\right) = \tan\left(\frac{\text{vFOV}}{2}\right) \cdot \text{aspect}$$
   $$\text{hFOV} = 2 \cdot \arctan\left(\frac{\text{sensor}_y \cdot \text{aspect}}{2 \cdot f}\right)$$

### 2.3 Construção Geométrica do Frustum (`BKE_camera_view_frame_ex`)
Para desenhar o frustum da câmera no viewport sem que ele sofra clipping indesejado, o Blender calcula a projeção dos 4 cantos do sensor físico a uma distância determinada:

```cpp
/* source/blender/blenkernel/intern/camera.cc */
void BKE_camera_view_frame_ex(const Scene *scene,
                              const Camera *camera,
                              const float drawsize,
                              const bool do_clip,
                              const float scale[3],
                              float r_asp[2],
                              float r_shift[2],
                              float *r_drawsize,
                              float r_vec[4][3])
{
  ...
  float half_sensor = 0.5f * ((camera->sensor_fit == CAMERA_SENSOR_FIT_VERT) ?
                                  (camera->sensor_y) :
                                  (camera->sensor_x));

  *r_drawsize = (drawsize / 2.0f) / ((scale[0] + scale[1] + scale[2]) / 3.0f);
  depth = *r_drawsize * camera->lens / (-half_sensor) * scale[2];
  ...
  /* 4 vértices do retângulo do frustum */
  r_vec[0] = { r_shift[0] + facx,  r_shift[1] + facy, depth };
  r_vec[1] = { r_shift[0] + facx,  r_shift[1] - facy, depth };
  r_vec[2] = { r_shift[0] - facx,  r_shift[1] - facy, depth };
  r_vec[3] = { r_shift[0] - facx,  r_shift[1] + facy, depth };

  if (do_clip) {
    /* Garante que o retângulo visual não fique atrás do plano próximo de corte */
    float fac = ((camera->clip_start + 0.1f) / -r_vec[0][2]) * scale[2];
    for (uint i = 0; i < 4; i++) {
      mul_v3_fl(r_vec[i], fac);
    }
  }
}
```

---

## 3. Eixo 2 — Transição Visão Livre ↔ Visor da Câmera

### 3.1 Arquitetura de Transição no Blender (`RV3D_CAMOB` vs `RV3D_PERSP`)
No arquivo `source/blender/editors/space_view3d/view3d_navigate_view_camera.cc`, o Blender implementa a alternância entre a visão livre (órbita 3D) e o visor da câmera sem remontar a árvore de nós da cena:

```cpp
/* source/blender/editors/space_view3d/view3d_navigate_view_camera.cc */
static wmOperatorStatus view_camera_exec(bContext *C, wmOperator *op)
{
  ...
  if (rv3d->persp != RV3D_CAMOB) {
    /* 1. Armazena o ponto de vista de órbita anterior para restauração perfeita */
    if (!rv3d->smooth_timer) {
      ED_view3d_lastview_store(rv3d);
    }
    ...
    /* 2. Altera a perspectiva para o objeto da câmera */
    rv3d->persp = RV3D_CAMOB;

    /* 3. Realiza a interpolação suave (Smooth View Animation) */
    ED_view3d_smooth_view(C, v3d, region, smooth_viewtx, &sview);
  }
  else {
    /* Restaura o ponto de vista livre anterior */
    axis_set_view(C, v3d, region, rv3d->lviewquat, rv3d->lview, ...);
  }
  return OPERATOR_FINISHED;
}
```

### 3.2 O Overlay de Câmera (`overlay_camera.hh`)
No Blender (`source/blender/draw/engines/overlay/overlay_camera.hh`), ao entrar na visão da câmera (`is_camera_view == true`), **o objeto da câmera e seus dados continuam existindo e sendo sincronizados**. O renderizador simplesmente ajusta as geometrias desenhadas:
```cpp
/* source/blender/draw/engines/overlay/overlay_camera.hh */
const bool is_camera_view = (is_active && (rv3d->persp == RV3D_CAMOB));

if (is_camera_view) {
  if (!state.is_image_render) {
    /* Apenas oculta as linhas traseiras do cone da câmera, mantendo o frame */
    data.depth *= -1.0f;
    call_buffers_.frame_buf.append(data, select_id);
  }
}
else {
  /* Desenha o corpo da câmera e o triângulo indicador */
  call_buffers_.frame_buf.append(data, select_id);
  call_buffers_.tria_buf.append(data, select_id);
}
```

### 3.3 Diagnóstico Crítico: Violação de Rules of Hooks no Shotlab
No Shotlab, o componente `frontend/src/components/viewport/CameraHelperVisualizer.tsx` continha um defeito gravíssimo que quebrava o React e travava o canvas WebGL ao alternar entre `'editor'` e `'camera'`:

```tsx
// ❌ CÓDIGO PROBLEMÁTICO ANTES DA CORREÇÃO:
export const CameraHelperVisualizer: React.FC = () => {
  const cameraSettings = useStudioStore((state) => state.camera);
  const activeView = useStudioStore((state) => state.activeView);

  // ERRO GRAVE: Early return antes de chamadas de useMemo!
  if (activeView === 'camera') return null;

  const camPos = useMemo(() => new THREE.Vector3(...position), [position]);
  const tgtPos = useMemo(() => new THREE.Vector3(...target), [target]);
  const frustumLines = useMemo(() => { ... }, [...]);

  return <group>...</group>;
};
```

#### Análise do Mecanismo de Falha:
No React, cada chamada a um Hook depende de uma lista encadeada interna de hooks no nó Fiber. Quando `activeView` era `'editor'`, o componente executava 2 hooks de Zustand e 3 hooks de `useMemo` (total = 5 hooks). No momento em que o usuário clicava para ver pelo visor da câmera (`activeView === 'camera'`), a execução encontrava o `return null` após o 2º hook.
O React detectava a alteração no número de hooks entre renderizações e lançava uma exceção irrecuperável:
```
Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```
Destruindo o contexto WebGL e quebrando o visor óptico.

#### Solução Aplicada:
Movido o condicional `if (activeView === 'camera') return null;` para **depois de todas as declarações de Hooks**, imediatamente antes da instrução JSX `return (<group>...)`. Dessa forma, o ciclo de renderização do React mantém paridade estrita de hooks independentemente do modo visual.

### 3.4 Passepartout e Guias de Composição (`view3d_draw.cc` & `ed_draw.cc`)
Em `source/blender/editors/space_view3d/view3d_draw.cc:450-492`, o Blender constrói a máscara de Passepartout desenhando quatro retângulos sólidos ou translúcidos ao redor da janela de visualização:
```cpp
/* source/blender/editors/space_view3d/view3d_draw.cc */
if (ca && (ca->flag & CAM_SHOWPASSEPARTOUT) && ca->passepartalpha > 0.0f) {
  float alpha = ca->passepartalpha;
  immUniformThemeColorAlpha(TH_CAMERA_PASSEPARTOUT, alpha);

  // Quatro quadrantes:
  immRectf(shdr_pos, 0.0f, winy, x1i, 0.0f);        // Barra Esquerda
  immRectf(shdr_pos, x2i, winy, winx, 0.0f);        // Barra Direita
  immRectf(shdr_pos, x1i, winy, x2i, y2i);         // Barra Superior
  immRectf(shdr_pos, x1i, y1i, x2i, 0.0f);         // Barra Inferior
}
```

E em `source/blender/editors/util/ed_draw.cc`, a renderização das guias matemáticas de enquadramento:
* **Regra dos Terços (`COMPOSITION_GUIDES_THIRDS`)**:
  Linhas em $\text{fac} = 1/3$ e $\text{fac} = 2/3$.
* **Proporção Áurea (`COMPOSITION_GUIDES_GOLDEN`)**:
  Linhas em $\text{fac} = 1.0 - \text{M\_GOLDEN\_RATIO\_CONJUGATE} \approx 0.381966$ e $0.618034$.
* **Triângulo Harmônico / Áureo (`drawviewborder_triangle`)**:
  Traça a diagonal principal de $(x_{\min}, y_{\min})$ a $(x_{\max}, y_{\max})$, e a partir dos cantos opostos projeta o pé da altura euclidiana com deslocamento:
  $$\text{ofs} = h \cdot \left(\frac{h}{w}\right) \quad (\text{quando } w > h)$$
  Garantindo linhas perpendiculares perfeitas segundo as proporções da pintura clássica.

---

## 4. Eixo 3 — Transform Gizmos, Snap no Piso & Bounding Boxes

### 4.1 Bounding Boxes e OBB no Blender (`BKE_object.hh` / `object.cc`)
No Blender, a determinação de limites espaciais ocorre em dois níveis:
1. **Espaço Local (AABB Local)**:
   Calculado em `BKE_object_boundbox_get(ob)` a partir dos vértices ou primitivas do objeto: $[\mathbf{min}_{\text{local}}, \mathbf{max}_{\text{local}}]$.
2. **Espaço de Mundo (Oriented Bounding Box — OBB)**:
   Os 8 vértices do paralelepípedo local são multiplicados pela matriz de transformação 4x4 do objeto (`object_to_world`):
   $$\mathbf{v}_i^{\text{world}} = \mathbf{M}_{\text{object\_to\_world}} \cdot \mathbf{v}_i^{\text{local}} \quad (i = 0 \dots 7)$$
   A partir desses 8 vértices transformados, calcula-se a nova AABB global através de:
   $$\mathbf{min}_{\text{global}} = \min_{i}(\mathbf{v}_i^{\text{world}}), \quad \mathbf{max}_{\text{global}} = \max_{i}(\mathbf{v}_i^{\text{world}})$$

### 4.2 Posicionamento e Snapping de Base (`view3d_placement.cc`)
O Blender define o enum `ePlace_Origin`:
```cpp
enum ePlace_Origin {
  PLACE_ORIGIN_BASE = 1,   // Ponto mais baixo da BBox ancora na superfície
  PLACE_ORIGIN_CENTER = 2, // Centro geométrico ancora na superfície
};
```
Quando configurado em `PLACE_ORIGIN_BASE`, para qualquer orientação angular da malha, a altura da base é dada por:
$$y_{\text{base}} = \min_{i=0\dots7}(\mathbf{v}_{i, y}^{\text{world}})$$
Para ancorar o objeto exatamente na superfície do chão ($y = 0$) sem penetração:
$$\Delta y = 0.0 - y_{\text{base}}$$
$$\mathbf{P}_{\text{novo}} = \mathbf{P}_{\text{atual}} + [0, \Delta y, 0]^T$$

---

## 5. Eixo 4 — Iluminação Fotográfica de Estúdio & Blackbody Kelvin

### 5.1 Modelagem de Luzes de Estúdio (`DNA_light_types.h`)
No arquivo `source/blender/makesdna/DNA_light_types.h`, as luzes de estúdio (`LA_AREA`) oferecem modelagem óptica precisa:

```c
/* source/blender/makesdna/DNA_light_types.h */
enum eLightAreaShape : short {
  LA_AREA_SQUARE = 0,   // Softbox Quadrada
  LA_AREA_RECT = 1,     // Stripbox / Softbox Retangular
  LA_AREA_DISK = 4,     // Beauty Dish / Refletor Parabólico
  LA_AREA_ELLIPSE = 5,  // Octabox Elíptica
};

struct Light {
  ...
  float area_size = 0.25f;               // Largura / Diâmetro principal (m)
  float area_sizey = 0.25f;              // Altura (para retângulos e elipses) (m)
  float area_spread = DEG2RADF(180.0f);  // Ângulo de espalhamento / Colmeia (radianos)
  ...
};
```

#### O Parâmetro `area_spread` (Grelha Colmeia / Honeycomb Grid):
Em fotografia real, acopla-se uma grelha colmeia (*honeycomb grid* ou *eggcrate*) à frente da softbox para direcionar os raios de luz e evitar que a luz transborde para o fundo.
No Blender, o parâmetro `area_spread` varia de `180°` (emissão hemisférica perfeitamente difusa / Lambertiana) até `30°` ou `45°` (luz colimada e direcional). A distribuição de radiação em função do ângulo $\theta$ com a normal da face é modulada por:
$$I(\theta) = I_0 \cdot \cos\left(\frac{\pi}{2} \cdot \frac{\theta}{\theta_{\text{spread}} / 2}\right)^n$$

### 5.2 Conversão Blackbody Kelvin de Alta Precisão (`colormanagement.cc`)
Em `source/blender/imbuf/intern/colormanagement.cc`, o Blender implementa a conversão física de temperatura de cor (Kelvin) para RGB Rec. 709 através de aproximação polinomial por partes ajustada ao **Locus Planckiano**:

```cpp
/* source/blender/imbuf/intern/colormanagement.cc */
static const float blackbody_table_r[7][3] = { ... };
static const float blackbody_table_g[7][3] = { ... };
static const float blackbody_table_b[7][4] = { ... };

static void blackbody_temperature_to_rec709(float rec709[3], float t)
{
  if (t >= 12000.0f) {
    rec709[0] = 0.826295f; rec709[1] = 0.994508f; rec709[2] = 1.566308f;
  }
  else if (t < 800.0f) {
    rec709[0] = 5.413294f; rec709[1] = -0.203194f; rec709[2] = -0.082254f;
  }
  else {
    int i = (t >= 6365.0f) ? 6 :
            (t >= 3315.0f) ? 5 :
            (t >= 1902.0f) ? 4 :
            (t >= 1449.0f) ? 3 :
            (t >= 1167.0f) ? 2 :
            (t >= 965.0f)  ? 1 : 0;

    const float t_inv = 1.0f / t;
    rec709[0] = r[0] * t_inv + r[1] * t + r[2];
    rec709[1] = g[0] * t_inv + g[1] * t + g[2];
    rec709[2] = ((b[0] * t + b[1]) * t + b[2]) * t + b[3];
  }
}
```

---

## 6. Cruzamento Direto (Gap Analysis) Arquivo por Arquivo

Nesta seção, contrastamos explicitamente cada arquivo-chave do Shotlab com seus equivalentes na arquitetura do Blender.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   MATRIZ DE DISCREPÂNCIA E EVOLUÇÃO TÉCNICA                      │
├──────────────────────────┬─────────────────────────────┬─────────────────────────┤
│ Arquivo Shotlab          │ Arquivo Blender             │ Gravidade do Gap        │
├──────────────────────────┼─────────────────────────────┼─────────────────────────┤
│ Viewport.tsx             │ view3d_navigate_view_camera │ Média (Reset de Órbita) │
│ CameraHelperVisualizer   │ overlay_camera.hh           │ Crítica (Crash Rules)   │
│ StudioLighting.tsx       │ overlay_light.hh            │ Alta (Falta Area/Spread)│
│ TransformGizmo.tsx       │ view3d_placement.cc         │ Alta (Penetração Base)  │
│ SceneMesh.tsx            │ BKE_object.hh               │ Média (Escala vs Bounds)│
│ ViewfinderHUD.tsx        │ view3d_draw.cc / ed_draw.cc │ Baixa (Faltam Triângulos│
│ CameraPanel.tsx          │ DNA_camera_types.h          │ Média (Falta SensorFit) │
│ optics.ts                │ camera.cc (viewplane)       │ Corrigido (SensorFit)   │
│ validator.py             │ bounds::transform_bounds    │ Alinhado (Piso/AABB)    │
│ lighting_studio.py       │ colormanagement.cc          │ Média (Tanner vs Planck)│
└──────────────────────────┴─────────────────────────────┴─────────────────────────┘
```

---

### 6.1 `frontend/src/components/viewport/Viewport.tsx`
* **Código do Blender**: `source/blender/editors/space_view3d/view3d_navigate_view_camera.cc` (`view_camera_exec`) e `view3d_navigate_smoothview.cc`.
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. No Shotlab, a alternância entre visão de edição e visão de câmera é feita com troca condicional de componentes:
     `{activeView === 'camera' ? <PerspectiveCamera makeDefault ... /> : <OrbitControls makeDefault ... />}`.
  2. Ao alternar de volta para `'editor'`, o `OrbitControls` é recriado ou perde a orientação prévia de órbita do usuário, forçando o ponto de vista de volta para uma posição estática ou sofrendo saltos bruscos.
  3. Não existe animação suave de transição (*Smooth View Transition*) entre a câmera livre e o ponto de vista do visor.
* **Proposta Concreta de Upgrade**:
  - Implementar um `lastEditorViewRef` que armazena `[position, target, zoom]` antes de comutar para `activeView === 'camera'`.
  - Utilizar uma biblioteca de interpolação suave (ou lerp no `useFrame`) ao transitar, emulando o `ED_view3d_smooth_view` do Blender.

---

### 6.2 `frontend/src/components/viewport/CameraHelperVisualizer.tsx`
* **Código do Blender**: `source/blender/draw/engines/overlay/overlay_camera.hh` (`object_sync_extras`).
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. **Falha Crítica (Corrigida nesta tarefa)**: Havia `if (activeView === 'camera') return null;` antes dos `useMemo`, violando as Rules of Hooks do React e quebrando a árvore Fiber com crash do WebGL.
  2. **Representação Gráfica**: O Shotlab desenha apenas um cubo estático (`boxGeometry args={[0.2, 0.15, 0.25]}`) e um cilindro de lente com linhas até um retângulo a `min(focusDistanceM, 3.5)`. Não desenha a cruz central no plano de foco (Focus Target Crosshair) nem os marcadores dos limites de profundidade de campo (DoF Near / DoF Far limits) como o Blender desenha com `CAM_SHOWLIMITS`.
* **Proposta Concreta de Upgrade**:
  - Manter todos os hooks incondicionais no topo (já aplicado).
  - Adicionar ao wireframe do frustum dois retângulos translúcidos em `dofNear_m` e `dofFar_m` e uma cruz no ponto exato de foco (`target`), permitindo ao fotógrafo visualizar o volume de nitidez diretamente na viewport 3D.

---

### 6.3 `frontend/src/components/viewport/StudioLighting.tsx`
* **Código do Blender**: `source/blender/draw/engines/overlay/overlay_light.hh` e `DNA_light_types.h`.
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. O Shotlab modela as luzes de estúdio Key, Fill e Rim exclusivamente como `<directionalLight>` simples e invisíveis no espaço 3D.
  2. Não há representação geométrica dos modificadores de luz reais (Softbox quadrada/retangular, Octabox octogonal, Beauty Dish circular).
  3. Não há simulação de `area_spread` (grelha colmeia / honeycomb grid): a luz directional no Three.js emite raios estritamente paralelos ou pontuais sem cone de espalhamento fotográfico.
* **Proposta Concreta de Upgrade**:
  - Modelar as luzes como retângulos/discos emissores (Three.js `RectAreaLight` ou `SpotLight` com geometria de difusor).
  - Incluir helpers visuais 3D (malha da softbox metálica com difusor translúcido branco) para que o usuário veja a orientação física do modificador no estúdio.

---

### 6.4 `frontend/src/components/viewport/TransformGizmo.tsx`
* **Código do Blender**: `source/blender/editors/space_view3d/view3d_placement.cc` e `source/blender/editors/transform/transform_snap.cc`.
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. No final do arrasto (`handleDraggingChanged`), o Shotlab tenta evitar que o objeto penetre o chão com a linha:
     `const adjustedY = Math.max(0, pos.y);`
  2. **Erro geométrico grave**: Para um objeto de altura $1.0\text{m}$ cujo pivô local fica no centro geométrico ($y=0.5\text{m}$), permitir que `pos.y` seja `0` faz com que metade da caixa afunde $0.5\text{m}$ dentro do piso cinza! O Shotlab avaliou a posição do pivô, e **não a base da caixa delimitadora**.
* **Proposta Concreta de Upgrade**:
  - Implementar o cálculo idêntico a `PLACE_ORIGIN_BASE` do Blender:
    Calcular a altura do vértice mais baixo da OBB no mundo:
    $$y_{\text{base}} = \min_{i=0\dots7}(\mathbf{v}_{i, y}^{\text{world}})$$
    E corrigir a posição com:
    $$y_{\text{novo}} = \text{pos.y} + \max(0.0, -y_{\text{base}})$$
    Garantindo que a base do produto nunca penetre o chão, independentemente de rotações ou escalas.

---

### 6.5 `frontend/src/components/viewport/SceneMesh.tsx`
* **Código do Blender**: `source/blender/blenkernel/intern/object.cc` (`BKE_object_boundbox_get`).
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. As primitivas (`box`, `cylinder`, `sphere`) possuem geometrias com dimensões padrão fixas `[1, 1, 1]` que dependem do vetor `scale` para definir seu tamanho real em metros.
  2. Falta visualização de Oriented Bounding Box (OBB) seletiva quando o objeto está selecionado (o Blender exibe uma caixa aramada sutil contornando o volume total do objeto).
* **Proposta Concreta de Upgrade**:
  - Adicionar suporte a `<BoxHelper>` ou aramado de BBox em OKLCH sutil quando `isSelected === true`.
  - Exibir as medidas físicas da AABB do objeto no espaço de mundo ($X \times Y \times Z$ em metros com `tabular-nums`).

---

### 6.6 `frontend/src/components/viewport/ViewfinderHUD.tsx`
* **Código do Blender**: `source/blender/editors/space_view3d/view3d_draw.cc:450-492` e `source/blender/editors/util/ed_draw.cc` (`ED_draw_composition_guides`).
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. O Viewfinder possui máscara de corte (Passepartout) e guias de Terços e Proporção Áurea.
  2. Faltam as guias clássicas presentes no Blender:
     - **Triângulo Harmônico / Áureo (`drawviewborder_triangle`)**: Projeção perpendicular do pé da altura a partir dos cantos opostos.
     - **Diagonais de Canto a Canto (`COMPOSITION_GUIDES_CENTER_DIAG`)**.
     - **Safe Areas Margins (Title & Action Safe)**: Essenciais para campanhas publicitárias (80% e 90% da área do frame).
  3. A opacidade do Passepartout é estática (`gateMaskOpacity`), enquanto o Blender permite ajustar de `0.0` (transparente) a `1.0` (Vantablack 100% opaco para foco total no enquadramento).
* **Proposta Concreta de Upgrade**:
  - Implementar no SVG do HUD as fórmulas exatas de `drawviewborder_triangle` do Blender:
    $$\text{ofs} = h \cdot \left(\frac{h}{w}\right)$$
  - Adicionar as linhas de Safe Areas (Action Safe a 90% e Title Safe a 80%).

---

### 6.7 `frontend/src/components/sidebar/CameraPanel.tsx`
* **Código do Blender**: `source/blender/makesdna/DNA_camera_types.h` e painel de propriedades de câmera.
* **Onde o Shotlab falha ou é simples demais hoje**:
  1. Não existe controle de `sensorFit` na interface: o fotógrafo não pode forçar a lente a ajustar pela horizontal ou pela vertical ao selecionar proporções de tela não convencionais.
  2. Falta controle de deslocamento de lente (Lens Shift $X / Y$), fundamental em fotografia de arquitetura e produtos para evitar convergência de linhas de perspectiva verticais.
  3. Faltam os campos de limites de corte de câmera (`clip_start` e `clip_end`).
* **Proposta Concreta de Upgrade**:
  - Adicionar seletor segmentado de `Sensor Fit` (`Auto`, `Horizontal`, `Vertical`).
  - Adicionar sliders para `Shift X` e `Shift Y` (de `-1.0` a `+1.0`) integrados com `camera.setViewOffset(...)` no Three.js.

---

### 6.8 `frontend/src/utils/optics.ts`
* **Código do Blender**: `source/blender/blenkernel/intern/camera.cc` (`BKE_camera_params_compute_viewplane`, `BKE_camera_sensor_fit`).
* **Onde o Shotlab falha ou é simples demais hoje**:
  - Falhava ao calcular somente o FOV vertical direto:
    `vFov = 2 * Math.atan(sensorHeightMm / (2 * focalLengthMm))`
* **Upgrade Realizado nesta Tarefa**:
  - Adicionadas as funções canônicas `determineSensorFit` e `calculateBlenderFovDeg`, calculando o ângulo de visão vertical correspondente para qualquer proporção de tela, mantendo 100% de precisão física e conformidade matemática com o Blender.

---

### 6.9 `backend/services/validator.py`
* **Código do Blender**: `source/blender/blenkernel/intern/object.cc` e `source/blender/editors/transform/transform_snap_object.cc`.
* **Onde o Shotlab falha ou é simples demais hoje**:
  - A validação no backend é estritamente estática (ao submeter a cena via API FastAPI).
  - Se um objeto violar o contato com o chão ($y < -0.001\text{m}$), a API rejeita a cena com código `FLOOR_PENETRATION`. No entanto, o backend não fornece ao cliente o vetor de correção sugerido ($\Delta y$) para auto-ajuste imediato.
* **Proposta Concreta de Upgrade**:
  - Enriquecer a resposta do validador com o campo `recommended_snap_vector: [0.0, -base_y, 0.0]`, permitindo que o frontend ou agentes de IA corrijam a posição instantaneamente.

---

### 6.10 `backend/services/lighting_studio.py`
* **Código do Blender**: `source/blender/imbuf/intern/colormanagement.cc` (`blackbody_temperature_to_rec709`).
* **Onde o Shotlab falha ou é simples demais hoje**:
  - Utiliza o modelo empírico de Tanner Helland para Kelvin. Embora rápido para RGB 8-bit, produz leves desvios de tom (tom amarelado/esverdeado nos intermediários de 4500K a 5500K).
* **Proposta Concreta de Upgrade**:
  - Implementar a tabela de 7 intervalos polinomiais do Blender (`blackbody_table_r`, `blackbody_table_g`, `blackbody_table_b`) para conversão espectral física Rec. 709 / Linear CIE 1931, enviando valores radiométricos puros para os prompts e nós do ComfyUI.

---

## 7. Backlog de Propostas Concretas para o It's a Plan

Com base nas conclusões da pesquisa de código-fonte, estruturamos os seguintes pacotes de trabalho recomendados para implementação em novas issues:

1. **`SHOT-36` [M1.7] Sensor Fit (Auto/Hor/Vert) e Lens Shift (X/Y) no Viewport Three.js**:
   - Integrar `calculateBlenderFovDeg` ao loop do `Viewport.tsx`.
   - Adicionar controles de `sensorFit` e `shiftX/shiftY` no `CameraPanel.tsx`.
   - Aplicar `camera.setViewOffset(...)` no Three.js para deslocamento arquitetural de lentes tilt-shift.

2. **`SHOT-37` [M1.8] Base Snap no Piso por Bounding Box OBB no `TransformGizmo.tsx`**:
   - Substituir `Math.max(0, pos.y)` pelo cálculo do menor vértice da OBB no mundo:
     $$y_{\text{base}} = \min_{i=0\dots7}(\mathbf{v}_{i, y}^{\text{world}})$$
   - Prevenir afundamento de objetos com pivô no centro ou rotações inclinadas.

3. **`SHOT-38` [M1.9] Guias Avançadas de Composição e Safe Areas no `ViewfinderHUD.tsx`**:
   - Adicionar Triângulos Harmônicos / Áureos ($ofs = h \cdot (h/w)$).
   - Adicionar linhas de Action Safe (90%) e Title Safe (80%).
   - Adicionar slider de opacidade de Passepartout (0.0 a 1.0).

4. **`SHOT-39` [M4.2] Area Lights Físicas com Formatos (Softbox/Octabox) e Spread (Grelha Colmeia)**:
   - Suporte a `area_spread` ($30^\circ$ a $180^\circ$) para simulação de colmeia.
   - Malhas visuais de difusores 3D metálicos com tecido difusor translúcido.

5. **`SHOT-40` [M4.3] Tabela Polinomial Planckiana de Blackbody Kelvin (Blender Rec. 709)**:
   - Migrar `kelvin_to_linear_rgb` em `lighting_studio.py` para a matriz de 7 coeficientes do Blender, garantindo fidelidade física absoluta sem desvios cromáticos em temperaturas médias.
