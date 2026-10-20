# Design System — Shotlab (Vantablack & Machined Metal)

> **Modo Impeccable:** `Operate` (Precisão óptica, densidade técnica, zero distração cromática sobre o Viewport 3D).
> **Espaço de Cor:** 100% **OKLCH** (`oklch(L C H / alpha)`) para uniformidade perceptual, contraste APCA previsível e ausência de deriva de matiz (hue drift).

---

## 1. Filosofia Visual & Anti-Slop Rules

O **Shotlab** é um instrumento óptico e fotográfico profissional — inspirado no chassi de câmeras de cinema (**ARRI ALEXA Mini LF**, **Leica SL3**, **RED V-Raptor**) e softwares de pós-produção de referência (**DaVinci Resolve**, **Set.a.Light 3D**).

### Proibições Estritas (Anti-AI Slop)
1. **Proibido Azul/Roxo Genérico de IA**: Nunca usar `#3b82f6`, `#6366f1`, `#8b5cf6` ou gradientes roxo-para-azul/ciano neon.
2. **Proibido Arredondamento Excessivo**: Nada de `rounded-2xl` ou `rounded-full` em painéis. Componentes seguem usinagem CNC com raios técnicos de `2px` (`rounded-sm`) a `4px` (`rounded`).
3. **Neutralidade de Percepção no Viewport**: Ao redor da imagem 3D/Render, a interface nunca deve emitir matizes saturados que alterem a percepção de balanço de branco do diretor de fotografia.
4. **Alinhamento Numérico Estrito**: Qualquer número técnico (`mm`, `f/`, `m`, `°`, `K`, coordenadas `X/Y/Z`) DEVE usar fonte monoespaçada com `font-variant-numeric: tabular-nums`.

---

## 2. Arquitetura de Tokens em 3 Camadas (OKLCH)

### 2.1 Tema Dark: **Vantablack & Anodized Gunmetal** (`[data-theme="dark"]` — Padrão)

| Token Semântico | Valor OKLCH | Equivalente sRGB Aprox. | Papel Físico / Material |
| :--- | :--- | :--- | :--- |
| `--bg-void` | `oklch(0.08 0.002 260)` | `#040405` | **Vantablack** — Fundo do Viewport e Letterbox (absorção de luz 99.9%) |
| `--bg-chassis` | `oklch(0.125 0.004 260)` | `#08090b` | **Alumínio Anodizado Preto** — Estrutura principal e Topbar |
| `--bg-surface` | `oklch(0.165 0.006 260)` | `#0e1014` | **Gunmetal Usinado** — Painéis laterais (Outliner, Inspector, Óptica) |
| `--bg-elevated` | `oklch(0.215 0.008 260)` | `#171a20` | **Titânio Escovado Escuro** — Inputs, botões, seletores de lente |
| `--bg-interactive-hover` | `oklch(0.26 0.010 260)` | `#21252d` | Aço escovado sob foco/hover |
| `--border-hairline` | `oklch(0.25 0.008 260)` | `#1e2229` | Corte CNC de `1px` entre módulos |
| `--border-specular` | `oklch(0.36 0.012 260)` | `#383e4a` | Chanfro metálico especular (borda ativa/superior) |
| `--text-primary` | `oklch(0.94 0.004 260)` | `#eaecef` | **Gravação a Laser Prata** — Leitura principal (APCA > 90) |
| `--text-secondary` | `oklch(0.68 0.008 260)` | `#969ba4` | **Pewter Metálico** — Labels secundárias |
| `--text-muted` | `oklch(0.48 0.008 260)` | `#5c616b` | Unidades e metadados passivos (`mm`, `m`, `°`) |
| `--accent-optic` | `oklch(0.78 0.145 75)` | `#ebb32d` | **Cine Amber / Leica Gold** — Marcações de lente, anel de foco e estado ativo |
| `--accent-optic-muted` | `oklch(0.78 0.145 75 / 0.16)` | `rgba(235,179,45,0.16)` | Preenchimento sutil de seleção óptica |
| `--accent-tally` | `oklch(0.63 0.22 28)` | `#ec4028` | **Tally Red-Orange** — Gravação / Geração IA ComfyUI ativa |
| `--status-ok` | `oklch(0.72 0.15 155)` | `#28ba70` | LED de Telemetria Online / Validação Física OK |

### 2.2 Tema Light: **Daylight Studio & Brushed Silver** (`[data-theme="light"]`)

Pensado para ambientes de estúdio diurno claros ou revisão de diagramas técnicos de iluminação (*Set Plan*):

| Token Semântico | Valor OKLCH | Equivalente sRGB Aprox. | Papel Físico / Material |
| :--- | :--- | :--- | :--- |
| `--bg-void` | `oklch(0.90 0.004 260)` | `#dedfe2` | **Cartão Cinza 18% Daylight** — Fundo neutro de estúdio |
| `--bg-chassis` | `oklch(0.945 0.003 260)` | `#eceeef` | **Alumínio Prata Anodizado** — Chassi claro |
| `--bg-surface` | `oklch(0.975 0.002 260)` | `#f6f7f8` | **Metal Prata Acetinado** — Painéis |
| `--bg-elevated` | `oklch(1.00 0 0)` | `#ffffff` | Controles e inputs elevados |
| `--bg-interactive-hover` | `oklch(0.92 0.005 260)` | `#e3e5e8` | Hover metálico claro |
| `--border-hairline` | `oklch(0.85 0.006 260)` | `#cfd2d7` | Divisória técnica `1px` |
| `--border-specular` | `oklch(0.72 0.010 260)` | `#a5aab3` | Borda de controle destacada |
| `--text-primary` | `oklch(0.16 0.005 260)` | `#0d0f12` | **Gravação Carbono Profundo** — Contraste máximo |
| `--text-secondary` | `oklch(0.42 0.008 260)` | `#4a4e57` | Grafite técnico |
| `--text-muted` | `oklch(0.58 0.008 260)` | `#787d87` | Unidades (`mm`, `m`, `°`) |
| `--accent-optic` | `oklch(0.52 0.14 65)` | `#996200` | **Bronze Usinado / Deep Brass** — Contraste APCA seguro sobre fundo claro |
| `--accent-optic-muted` | `oklch(0.52 0.14 65 / 0.14)` | `rgba(153,98,0,0.14)` | Fundo de item óptico selecionado |
| `--accent-tally` | `oklch(0.55 0.21 28)` | `#c92a14` | Tally Red diurno |

---

## 3. Tipografia & Hierarquia de Instrumento

- **Font Sans (`--font-sans`)**: `'Inter'`, `'Geist'`, system-ui — usada em títulos de painéis, árvores de objetos e botões.
  - Section Headers: `10px` (`0.625rem`), `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.08em`.
- **Font Mono (`--font-mono`)**: `'JetBrains Mono'`, `'Geist Mono'`, `'Fira Code'`, monospace — obrigatória em:
  - Distâncias focais (`14mm`, `35mm`, `50mm`, `85mm`, `135mm`)
  - Aberturas (`f/1.4`, `f/2.8`, `f/8`)
  - Telemetria de DoF, Hiperfocal e FOV
  - Inputs de Coordenadas Métricas (`X: 0.00 m`, `Y: 1.70 m`, `Z: -2.50 m`)

---

## 4. Internacionalização (i18n)

O Shotlab suporta troca em tempo real de idioma sem recarregar a cena 3D:
- `pt-BR` (Português — Brasil)
- `en-US` (English — International Cine/Photo Standard)
- `es-ES` (Español)
