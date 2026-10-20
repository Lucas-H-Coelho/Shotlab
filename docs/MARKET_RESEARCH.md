# Pesquisa de Mercado & Benchmarking de Features — Shotlab (`SHOT-6`)

Este documento consolida a análise de mercado dos principais softwares de **estúdio fotográfico virtual**, **pré-visualização cinematográfica (Previs)** e **geração de imagem controlada por 3D**, identificando as funcionalidades essenciais para diferenciar o **Shotlab**.

---

## 1. Análise de Concorrentes e Referências do Mercado

### 1.1 Set.a.Light 3D (elixxier) — *Líder em Simulação de Estúdio Fotográfico*
- **Pontos Fortes**:
  - Biblioteca de modificadores de luz reais (Softboxes retangulares, Octaboxes, Stripboxes com grid, Beauty Dishes, Refletores Parabólicos, Snoots, Gelatinas CTO/CTB e RGB).
  - **Set Plan (Diagrama de Iluminação Top-Down)**: Exporta automaticamente a planta baixa do estúdio com distâncias exatas em metros, alturas dos tripés, potência das luzes e configurações da câmera.
  - Controle de linha de olhar (*Eye Target*) do modelo humano (olhar para a lente ou para um ponto específico).
- **Limitação**: Renderização tradicional via motor 3D interno (aspecto de boneco 3D / uncanny valley em pele e tecidos), sem motor de difusão fotorrealista nativo.
- **O que trazemos para o Shotlab**:
  - **Modificadores de Luz Reais + Temperatura Kelvin (`2700K`–`6500K`)** (`SHOT-21`).
  - **Visão Set Plan Top-Down** para fotógrafos que usam o Shotlab tanto para gerar fotos finais com IA quanto para planejar sessões reais (`SHOT-21`).

### 1.2 Cine Tracer & FrameForge Storyboard Studio — *Líderes em Previs Cinematográfico*
- **Pontos Fortes**:
  - Matemática rigorosa de sensores (Full Frame 35mm, Super 35, ARRI ALEXA Mini LF, RED V-Raptor, Médio Formato 645) e kits de lentes Prime reais (`14mm`, `24mm`, `35mm`, `50mm`, `85mm`, `135mm`).
  - **Aspect Ratio Gate Masks (Safe Frames)** e **Guias de Composição** (Regra dos Terços, Proporção Áurea, Crosshair, Zona de Segurança de TV/Social `9:16`, `4:5`, `2.39:1` Anamórfico).
- **Limitação**: Pesados (Unreal Engine dedicada), caros e sem pipeline direto com modelos de edição por referência como Qwen Image 2.1.
- **O que trazemos para o Shotlab**:
  - **Viewfinder HUD estilo ARRI/Leica** com cálculo em tempo real de FOV, Distância Hiperfocal e limites Near/Far de Profundidade de Campo (`SHOT-12`, `SHOT-13`, `SHOT-14`).
  - **Gate Masks & Composition Overlays** selecionáveis direto na barra do visor (`SHOT-14`).

### 1.3 Vizcom, Krea.ai & ControlNet Studio — *Líderes em 3D-to-AI Rendering*
- **Pontos Fortes**:
  - **Split-View / Curtain Slider**: Comparação interativa arrastando uma cortina entre o modelo 3D (Blockout/Clay) e o resultado renderizado pela IA.
  - Controle de **Structure Fidelity / Denoise Strength** (quanto a IA deve obedecer estritamente à silhueta 3D vs. ter liberdade criativa).
  - Exportação de múltiplos passes (RGB Clay, Depth Map normalizado, Normal Map, Canny/Lineart) para alimentar o modelo generativo sem ambiguidade espacial.
- **Limitação**: Câmera 3D simplória (apenas um slider genérico de "zoom" ou FOV abstrato, sem relação com lentes em `mm`, sensores ou `f-stop`).
- **O que trazemos para o Shotlab**:
  - **Curtain Slider 3D ↔ Render IA 2K** no próprio viewport (`SHOT-20`).
  - **Exportação automática de Passes (Beauty RGB + Depth Map)** diretamente do câmera óptica real para o workflow do ComfyUI (`SHOT-14`, `SHOT-19`).

---

## 2. Matriz Comparativa dePosicionamento

| Capacidade | Set.a.Light 3D | Cine Tracer | Vizcom / Krea | **Shotlab** |
| :--- | :---: | :---: | :---: | :---: |
| **Física Real de Lentes (`mm`, Sensor, `f-stop`, DoF)** | ✅ | ✅ | ❌ | ✅ |
| **Escala Estrita em Metros (`m`) & Validação de Piso** | ✅ | ✅ | ❌ | ✅ |
| **Renderização Fotorrealista via IA (Qwen Image 2.1 / ComfyUI)** | ❌ | ❌ | ✅ | ✅ |
| **Arquitetura 100% API-First (Web + CLI + Agentes MCP)** | ❌ | ❌ | ❌ | ✅ |
| **Curtain Slider (Comparação 3D Blockout ↔ Foto IA)** | ❌ | ❌ | ✅ | ✅ |
| **Safe Frames & Guias Ópticos (ARRI/Leica HUD)** | ⚠️ Parcial | ✅ | ❌ | ✅ |
| **Estética Vantablack & Metal + Multi-tema (Dark/Light) + i18n** | ❌ | ❌ | ⚠️ Parcial | ✅ |

---

## 3. Rastreabilidade no Backlog (`It's a Plan`)

- **SHOT-6** (`[M0.1]`): Pesquisa de Mercado & Benchmarking (este documento).
- **SHOT-7** (`[M0.2]`): Design System OKLCH **Vantablack & Metal** + Temas Dark/Light.
- **SHOT-8** (`[M0.3]`): Internacionalização Multi-idioma (`pt-BR`, `en-US`, `es-ES`).
- **SHOT-12 / SHOT-13 / SHOT-14** (`[M1.3a-c]`): Matemática Óptica, Painel ARRI/Leica, Viewfinder HUD, Safe Frames e Passes RGB+Depth.
- **SHOT-20** (`[M3.1c]`): Comparador Curtain Slider (3D ↔ IA 2K) e Galeria de Takes.
- **SHOT-21** (`[M4.1]`): Modificadores de Luz de Estúdio & Diagrama Set Plan Top-Down.
