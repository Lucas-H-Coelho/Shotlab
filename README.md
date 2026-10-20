# Shotlab — Estúdio Fotográfico Virtual com IA

> Monte cenas em 3D simples com controle real de lentes e deixe o **ComfyUI** + **Qwen Image 2.1** transformar a composição em fotos fotorrealistas.

---

## 📸 Visão Geral

O **Shotlab** é um estúdio fotográfico virtual focado em fotógrafos, diretores de arte e criadores. O 3D atua estritamente como **camada de controle composicional** (posição, escala, perspectiva, enquadramento e oclusão), enquanto a renderização final é executada por modelos de difusão modernos.

O usuário não precisa saber modelar ou texturizar. A câmera virtual respeita a física e a matemática exata de lentes fotográficas reais (distância focal em mm, dimensões do sensor, abertura f-stop e profundidade de campo), eliminando os erros clássicos de perspectiva que a IA generativa costuma cometer.

---

## 🏛️ Princípio API-First

O Shotlab é construído sob uma premissa estrita de **API-First**:

1. **Mesma porta para todos**: O editor web (React + Three.js), a CLI (Typer) e qualquer agente de IA consomem exatamente os mesmos endpoints REST e WebSockets da API FastAPI. A UI não tem poderes que a API não ofereça.
2. **IA opcional**: O editor 3D funciona 100% de forma manual sem necessidade de chaves ou GPUs. A IA é tratada como um cliente/serviço externo plugável.
3. **Estado no Backend**: O Scene Graph vive no servidor (persistido em SQLite). Qualquer alteração disparada por automações ou scripts sincroniza a interface em tempo real via WebSocket.
4. **Validações físicas e métricas**: Dimensões sempre em metros, contato com o chão e limites de escala são validados na camada da API.

---

## ⚙️ Arquitetura

```
┌────────────────────────────────────────────────────────┐
│                   Clientes da API                      │
│                                                        │
│  [ Editor React / 3D ]    [ CLI Typer ]    [ Agente /  │
│    (Three.js / R3F)       (Automação)         MCP ]    │
└───────────────┬─────────────────┬───────────────┬──────┘
                │                 │               │
                ▼                 ▼               ▼
┌────────────────────────────────────────────────────────┐
│                 Backend FastAPI (/v1)                  │
│                                                        │
│  • Scene Graph (Pydantic)   • Validação em Metros      │
│  • Câmera Óptica (mm/f-stop)• WebSocket Event Stream   │
│  • Persistência SQLite      • Proxy de Execução        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / WS (/prompt, /ws)
                           ▼
┌────────────────────────────────────────────────────────┐
│             Motor de Difusão (ComfyUI)                 │
│                                                        │
│  • Qwen Image 2.1 (Edição por Referência Visual)       │
│  • Exportação 2K nativo com suporte a Canal Alfa       │
│  • Passes opcionais: Render, Depth, Normais            │
└────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Pastas

```text
Shotlab/
├── .env.example        # Modelo de variáveis de ambiente da raiz
├── backend/            # API FastAPI, Scene Graph, SQLite e WebSockets
│   ├── .env.example    # Modelo de variáveis de ambiente do backend
│   ├── app/            # Pacote modular da aplicação (uvicorn app.main:app)
│   │   ├── api/        # Endpoints e rotas versionadas (/v1)
│   │   ├── core/       # Configurações tipadas (Settings) e CORS seguro
│   │   ├── db/         # Conexão e inicialização SQLite
│   │   ├── models/     # Schemas Pydantic do Scene Graph e Câmera Óptica
│   │   └── services/   # Cliente ComfyUI e validação física
│   ├── core/           # Módulo core (Settings e re-exports)
│   ├── db/             # Camada de banco de dados
│   ├── models/         # Modelos de dados
│   ├── routers/        # Rotas da API
│   ├── services/       # Serviços e integrações ComfyUI
│   └── tests/          # Testes automatizados pytest
├── frontend/           # Interface React + TypeScript + Vite + Three.js
│   ├── src/
│   │   ├── components/ # Viewport 3D, controles e painéis
│   │   ├── hooks/      # Hooks de câmera e sincronização
│   │   └── store/      # Estado global com Zustand
├── workflows/          # Workflows JSON do ComfyUI (formato API)
│   └── qwen-image-2-1-edit.json
├── assets/             # Catálogo de modelos glTF CC0 e formas paramétricas
├── cli/                # Interface de linha de comando com Typer
└── docs/               # Documentação técnica e matemática de lentes
```

---

## 🚀 Como Executar e Comandos Principais

### 1. Pré-requisitos
- **Python**: 3.11 ou superior
- **Node.js**: 20 ou superior (npm)
- *(Opcional)*: Instância ComfyUI ativa com Qwen Image 2.1 / MOSS-Image (o estúdio 3D opera perfeitamente em modo offline)

### 2. Configuração de Variáveis de Ambiente
Copie o arquivo de exemplo para inicializar as variáveis locais:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `COMFYUI_URL` | `http://localhost:8188` | URL base do servidor ComfyUI |
| `DATABASE_PATH` | `shotlab.db` | Caminho do banco SQLite de persistência de cenas |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173` | Origens seguras permitidas para requisições com credenciais |

### 3. Automação via Makefile

O repositório inclui um `Makefile` com atalhos padronizados para lint, testes e build:

```bash
# Executa todos os testes (backend pytest + frontend vitest)
make test

# Executa apenas testes do backend
make test-backend

# Executa apenas testes do frontend
make test-frontend

# Executa linters e verificação de tipagem (ruff no backend + tsc no frontend)
make lint

# Executa apenas o linter do backend
make lint-backend

# Executa apenas a verificação de tipos do frontend
make lint-frontend

# Gera o bundle de produção do frontend
make build
```

### 4. Execução Manual dos Serviços

#### Backend (FastAPI)
O backend suporta a inicialização moderna no layout `backend/app/` mantendo 100% de compatibilidade retroativa:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate no Windows
pip install -r requirements.txt

# Execução recomendada (layout modular backend/app/):
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Execução compatível retroativa:
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- **Documentação OpenAPI interativa (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Healthcheck**: [http://localhost:8000/healthz](http://localhost:8000/healthz)

#### Frontend (React + Vite + Three.js)
```bash
cd frontend
npm install
npm run dev
```
- **Interface Web**: [http://localhost:5173](http://localhost:5173)

---

## 🎯 Fluxo de Operação

1. **Criação da Cena:** Arraste primitivas paramétricas (caixa, cilindro, prateleiras, bancadas) ou importe modelos glTF CC0.
2. **Posicionamento de Pessoas:** Insira um manequim posável com proporções reais e anexe fotos de referência.
3. **Câmera Real:** Escolha distância focal (ex: `85mm`), abertura (ex: `f/1.8`), sensor Full Frame (36x24mm) e foque no assunto.
4. **Definição de Estilo:** Defina iluminação (golden hour, softbox de estúdio) e um prompt descritivo.
5. **Geração via Qwen Image 2.1:** O backend envia o passe composicional para o ComfyUI em modo de edição e recebe a imagem final em 2K.
6. **Exportação:** Baixe a imagem final ou com fundo transparente (canal alfa).

---

## 🗺️ Roadmap & Marcos

- [x] **M1.1 — Setup de Arquitetura & Governança** (`SHOT-1`)
- [ ] **M1.2 — Viewport 3D com Three.js & Controles de Transformação** (`SHOT-2`)
- [ ] **M1.3 — Painel de Câmera Óptica com Cálculo de FOV/DoF** (`SHOT-3`)
- [ ] **M2.1 — API FastAPI, Scene Graph Pydantic & OpenAPI** (`SHOT-4`)
- [ ] **M3.1 — Workflow Qwen Image 2.1 no ComfyUI & Validação de Fidelidade** (`SHOT-5`)
- [ ] **M4.1 — Formas Paramétricas & Biblioteca glTF CC0**

O backlog completo e tarefas ativas são gerenciados no [It's a Plan (Projeto SHOT)](http://localhost:3001/shotlab/SHOT).

---

## 📄 Licença

Distribuído sob licença [MIT](./LICENSE). Assets e rigs 3D seguem licenças comerciais permissivas (CC0).
