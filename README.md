# GitHub Monitor

Um aplicativo para monitorar repositórios do GitHub e gerar insights usando IA.

## Funcionalidades

- Autenticação com GitHub (OAuth)
- Listagem de repositórios do usuário
- Visualização de commits recentes
- Geração de insights usando OpenAI (GPT-4)

## Tecnologias

- Next.js (App Router)
- TypeScript
- NextAuth.js
- Octokit (API GitHub)
- OpenAI API
- TailwindCSS

## Configuração

1. Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```
GITHUB_CLIENT_ID=seu_github_client_id
GITHUB_CLIENT_SECRET=seu_github_client_secret
OPENAI_API_KEY=sua_openai_api_key
NEXTAUTH_SECRET=um_segredo_qualquer
NEXTAUTH_URL=http://localhost:3000
```

2. Para obter o Client ID e Secret do GitHub:
   - Acesse [GitHub Developer Settings](https://github.com/settings/developers)
   - Crie um novo OAuth App
   - Configure a URL de callback como `http://localhost:3000/api/auth/callback/github`

3. Para a API key da OpenAI:
   - Crie uma conta na [OpenAI](https://platform.openai.com/)
   - Gere uma API key nas configurações

## Instalação

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```

O aplicativo estará disponível em [http://localhost:3000](http://localhost:3000).
