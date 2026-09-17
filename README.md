  ##

  Demo: https://lowen-cloth.vercel.app/
  
  
  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  

## Autenticação da loja

O frontend usa `POST /auth/login` e valida o token retornado com `GET /auth/me`.
O login só termina após as duas respostas serem válidas. Credenciais incorretas,
falhas de conexão e indisponibilidade do serviço não criam uma sessão.

### Desenvolvimento local

1. Inicie PostgreSQL e o backend conforme [backend/README.md](backend/README.md).
2. Administradores continuam sendo cadastrados pelo comando do backend. Clientes usam `Criar conta` no mesmo modal de login.
3. Na raiz do projeto, execute `npm run dev`.

O frontend chama `/api/auth/register`, `/api/auth/login` e `/api/auth/me` na mesma origem.
O proxy do Vite encaminha `/api/*` para `http://127.0.0.1:3000/*`.
Se necessário, `API_PROXY_TARGET` no ambiente do processo Vite altera esse destino.
Não é preciso habilitar CORS para esse fluxo local.

`.env.example` documenta a variável pública opcional `VITE_API_URL`, cujo padrão é
`/api`. Nunca coloque `JWT_SECRET`, senha de administrador ou conexão PostgreSQL
no ambiente do frontend.

### Sessão e validação

- O token e seu prazo ficam em `sessionStorage`, na chave `lowen-cloth_auth_v1`.
  Senha e identidade da conta não são persistidas.
- Recarregar a página ou voltar à aba exige validação com `/auth/me`.
  A identidade exibida vem dessa resposta, não do armazenamento local.
- O cliente envia `Authorization: Bearer <accessToken>` para `/auth/me`.
- A chave antiga `brecho_user_v1` é removida e nunca concede acesso.
- Ao expirar o prazo, sair da conta ou falhar a validação da sessão, o token é removido.
- Sair limpa a sessão deste navegador; não revoga o JWT no backend.
- A senha no login aceita de 1 a 128 caracteres; novas contas exigem de 5 a 128.
- O mesmo formulário identifica clientes e administradores pelo perfil devolvido pelo backend.
  O cadastro público cria somente clientes; administradores não têm cadastro público.
- Não foi implementada sincronização de carrinho com o backend.

O token é acessível ao JavaScript da página. Não registre tokens em logs nem os
inclua em URLs; a aplicação deve ser servida por HTTPS em produção.

### Publicação

O proxy do Vite atende ao desenvolvimento. No ambiente publicado, configure um
proxy/rewrite que encaminhe `/api/*` ao backend, retirando o prefixo `/api`.
Se optar por `VITE_API_URL` com outra origem, será necessário configurar CORS
restrito à origem do frontend no backend. A configuração de hospedagem não é
alterada por este trabalho. Sem um backend acessível, o login será recusado.

### Testes

Requer Node.js 24 para o executor dos testes unitários:

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes de navegador iniciam frontend e backend isolados nas portas 4178 e
3187. Usam PostgreSQL configurado em `backend/.env`, criam contas temporárias
de cliente e administrador com credenciais aleatórias e removem as contas ao terminar.
Execute em banco de desenvolvimento/testes com as migrations aplicadas.
Falhas de rede e respostas 500/401 são simuladas no navegador; o login válido
e o caso de senha incorreta usam o backend e o PostgreSQL reais.

A regressão do backend permanece disponível com `npm test` na pasta `backend`.

## Painel administrativo

O login existente direciona contas ADMIN para `/manager` depois de validar `/auth/me`.
Contas USER continuam no fluxo da loja. O painel não aparece durante a validação da
sessão e recusa acesso de clientes. Respostas administrativas 401/403 encerram a sessão
local e removem o acesso ao painel; a autorização no backend permanece obrigatória.

- `/manager`: dashboard com totais reais de produtos, variantes e disponibilidade.
- `/manager/produtos`: catálogo administrativo com busca, filtros e exclusão confirmada.
- `/manager/produtos/novo`: cadastro com imagens por URL/caminho e variantes livres.
- `/manager/produtos/:id/editar`: o mesmo formulário, preenchido com dados atuais.

O estoque total é a soma das variantes. O limite de estoque baixo está centralizado em
`LOW_STOCK_LIMIT`, em `src/app/manager/products.ts` (padrão: 5 unidades).
O formulário envia a lista completa de variantes: remover todas envia `variants: []`.
As gravações usam POST/PUT/DELETE de `/produtos` com Bearer JWT, e os resultados
atualizam a listagem e o catálogo público sem recarregamento manual. Não há upload de
imagens, criação de contas administrativas ou funcionalidades de pedidos nesta versão.

Os testes de manager cobrem CRUD real no PostgreSQL, variantes, bloqueio de USER,
sessão em validação, 401/403, falhas de gravação e responsividade. Produtos criados
pelos testes são removidos ao terminar.
