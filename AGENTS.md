# Diretrizes para Agentes de IA — Shotlab

Este documento define as regras fundamentais de desenvolvimento e governança para agentes e desenvolvedores operando no repositório **Shotlab**.

---

## 1. Princípios Inegociáveis

1. **API-First Estrito**:
   - A interface web (React), scripts e agentes são clientes da mesma API.
   - Nenhuma lógica de negócio de cena ou validação deve viver exclusivamente no frontend.
   - Toda alteração deve ser suportada pela API FastAPI versionada (`/v1`).

2. **Física e Medidas Reais**:
   - Todas as coordenadas e dimensões espaciais devem ser tratadas em **metros** (`m`).
   - Câmeras virtuais devem utilizar unidades fotográficas reais:
     - Distância focal: milímetros (`mm`).
     - Sensor: dimensões físicas (`36x24mm` para 35mm Full Frame por padrão).
     - Abertura: valores padrão de f-stop (`f/1.4`, `f/1.8`, `f/2.8`, `f/4`, etc.).

3. **Validação de Cena no Backend**:
   - O backend é a autoridade sobre o Scene Graph.
   - Operações que violem colisões ou contato com o piso devem retornar códigos e explicações claras.

4. **Isolamento do ComfyUI**:
   - O ComfyUI é um motor de geração externo e desacoplado.
   - O aplicativo deve funcionar perfeitamente em modo de edição 3D mesmo quando o servidor ComfyUI estiver desconectado.

---

## 2. Padrões de Código

- **Frontend**:
  - React 19 + TypeScript + Vite.
  - Three.js gerenciado através de `@react-three/fiber` e `@react-three/drei`.
  - Gerenciamento de estado leve e desacoplado com `zustand`.
  - Componentes modulares, tipagem estrita (sem `any`).
  - **Design System Estrito (`DESIGN.md`)**:
    - Estética **Vantablack & Machined Metal** (OKLCH) no tema Dark e **Daylight Studio & Brushed Silver** no tema Light.
    - **Proibido "AI Slop"**: Nunca usar azul/roxo genérico (`#3b82f6`, `#6366f1`), gradientes neon ou arredondamentos excessivos (`rounded-2xl`).
    - Toda telemetria e unidade física (`mm`, `f/`, `m`, `°`, `X/Y/Z`) deve usar fonte monoespaçada com `tabular-nums`.
  - **Internacionalização (i18n)**:
    - Suporte nativo a múltiplos idiomas (`pt-BR`, `en-US`, `es-ES`); nenhuma string de UI deve ficar hardcoded.

- **Backend**:
  - Python 3.11+ com FastAPI.
  - Modelagem de dados com Pydantic v2.
  - Persistência leve e confiável com SQLite (ou aiosqlite).
  - Comunicação assíncrona com ComfyUI via `httpx` e `websockets`.

- **Workflows ComfyUI**:
  - Workflows exportados estritamente em **API format JSON** (não o formato de grafo visual interno).

---

## 3. Gestão e Rastreabilidade

- Cada tarefa implementada deve corresponder a uma issue no **It's a Plan (Projeto SHOT)**: [http://localhost:3001/shotlab/SHOT](http://localhost:3001/shotlab/SHOT).
- Mover as tarefas para **In Progress** durante o trabalho e para **Done** ao finalizar com sucesso.
- Mensagens de commit no padrão: `SHOT-<numero> Breve resumo da alteração`.
