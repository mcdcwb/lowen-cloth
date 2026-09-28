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

- O token e seu prazo ficam em `localStorage`, na chave `lowen-cloth_auth_v1`,
  compartilhados pelas abas da mesma origem e preservados ao reabrir o navegador.
  USER e ADMIN usam JWT com prazo fixo de 30 dias desde o login, sem renovação automática.
  Senha e identidade da conta não são persistidas.
- Recarregar a página ou voltar à aba exige validação com `/auth/me`.
  A identidade exibida vem dessa resposta, não do armazenamento local.
- O cliente envia `Authorization: Bearer <accessToken>` para `/auth/me`.
- A chave antiga `brecho_user_v1` é removida e nunca concede acesso.
- O token antigo em `sessionStorage` é descartado: após atualizar uma sessão
  antiga, entre novamente uma vez. Ele nunca restaura uma sessão após logout.
- Eventos `storage` propagam login/logout e troca de conta; foco e visibilidade
  revalidam a credencial compartilhada. Uma identidade diferente fica oculta
  até `/auth/me` confirmar. A revalidação da mesma sessão mantém formulários
  administrativos montados, inclusive durante seleção/upload de arquivo.
- Um identificador de operação em `lowen-cloth_auth_change_v1` impede que login
  ou validação atrasados sobrescrevam logout ou login posterior em outra aba.
- `expiresAt` vem do backend, em milissegundos Unix, e corresponde ao `exp` assinado.
  Não existe prazo independente no frontend. O timer apenas consulta `/auth/me`,
  com intervalos entre 60 segundos e 24 horas para evitar overflow de `setTimeout`
  e repetição imediata com relógio local adiantado. O relógio local não decide a validade.
- Rejeição por `/auth/me` (401/403) remove a sessão e propaga o logout. O Manager
  também invalida a sessão em 401/403. Carrinho e perfil exibem erros de requisição;
  a revalidação compartilhada continua responsável por confirmar a identidade.
- Falhas de rede, 5xx e 429 em `/auth/me` preservam a credencial para nova tentativa.
  Uma identidade já validada permanece montada; a restauração inicial não concede
  acesso sem resposta válida. Foco, visibilidade e recarga tentam novamente.
- Logout explícito remove a credencial imediatamente de todas as abas.
- Sair limpa a sessão deste navegador; não revoga o JWT no backend.
- A senha no login aceita de 1 a 128 caracteres; novas contas exigem de 5 a 128.
- O mesmo formulário identifica clientes e administradores pelo perfil devolvido pelo backend.
  O cadastro público cria somente clientes; administradores não têm cadastro público.

O token é acessível ao JavaScript da página. Não registre tokens em logs nem os
inclua em URLs; a aplicação deve ser servida por HTTPS em produção.

A validade maior amplia a janela de uso de um token roubado, inclusive de ADMIN.
Não há refresh token nem revogação individual: logout e troca de senha não invalidam
uma cópia do JWT. Desativar/excluir a conta bloqueia suas requisições; trocar o segredo
invalida todos os tokens. Assinatura, expiração, perfil e conta ativa continuam
sendo verificados pelo backend.

A causa anterior do logout periódico era o prazo fixo de 15 minutos, aplicado a
`exp`, `maxTokenAge` e `expiresIn`, sem extensão por atividade. O frontend também
limitava `expiresIn` a 900 segundos, calculava outro vencimento pelo relógio local
e removia a sessão no timer sem consultar o servidor. Falhas transitórias de
`/auth/me` também apagavam a credencial. A política atual fica em
`backend/src/lib/token.ts` (`tokenLifetimeSeconds`) e é usada na emissão e validação;
`auth.service.ts` devolve a duração e o vencimento exato. Tokens antigos conservam
seu `exp` original de 15 minutos; os 30 dias se aplicam ao próximo login.
Publique backend e frontend juntos: o contrato de login agora inclui `expiresAt`.

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

## Favoritos e carrinho persistentes

Para USER autenticado, o PostgreSQL é a fonte de favoritos e carrinho. O hook
`src/app/hooks/useShopping.ts` carrega os dados via API após validar a sessão e
só atualiza a interface após confirmação da gravação. Logout limpa a visão da
conta, preservando seus registros no banco; respostas de sessões anteriores
são ignoradas. Um novo login, inclusive em outro navegador, recupera os dados.

Visitantes usam `brecho_guest_cart_v2` no localStorage. No login de USER, esse
carrinho é mesclado ao da conta: variantes diferentes são mantidas e variantes
iguais usam a maior quantidade, respeitando estoque. A interface informa a
regra e eventuais indisponibilidades. Antes da requisição, o snapshot passa para
`brecho_guest_pending_v2:USER:<id>`; só essa identidade pode repetir a importação.
A confirmação remove esse snapshot; falhas preservam a tentativa sem misturar
contas. Web Locks serializa importações entre abas (HTTPS/localhost e navegador
compatível); sem essa capacidade a importação informa um erro e preserva os dados.
Eventos `lowen-cloth_shopping_change_v1` e foco recarregam os dados do backend.
ADMIN tem carrinho apenas em memória, por identidade/sessão/aba, descartado ao
trocar a sessão ou recarregar; nunca lê/importa o carrinho visitante e não usa
os endpoints de compras exclusivos de USER. Favoritos continuam exclusivos de USER.
O antigo `brecho_cart_v1` é ignorado, pois misturava ADMIN e visitante sem registrar
o proprietário. Seus itens não são importados automaticamente; carrinhos de USER
já persistidos no banco permanecem intactos.
Corações de visitantes abrem o login; `/favoritos` mostra os produtos da conta.

Os testes em `tests/shopping.spec.ts` usam API e PostgreSQL reais para verificar
persistência, outro contexto de navegador, sincronização e falhas de gravação.
`tests/session-tabs.spec.ts` cobre abas reais na mesma origem, USER/ADMIN, troca
de conta, logout, token inválido e respostas concorrentes/atrasadas.
Execute `npm test`, `npm run test:e2e`, `npm run typecheck` e `npm run build`.
Os endpoints e comandos de migration estão documentados em `backend/README.md`.

## Minha Conta

`/minha-conta` exibe o nome real somente para leitura e permite salvar e-mail,
endereço principal opcional e alterar senha. Após salvar, o e-mail é atualizado
na sessão atual sem novo login. O formulário rejeita endereços parciais, permite
limpar todo o endereço e mantém complemento opcional.

A consulta automática usa o [ViaCEP](https://viacep.com.br/) diretamente por HTTPS,
sem chave. Aguarda 350ms após completar oito dígitos, cancela consultas anteriores
e limita a espera a seis segundos. Preenche somente rua, bairro, cidade e UF;
número/complemento e correções digitadas durante a consulta são preservados.
Endereços salvos não são sobrescritos por consultas ao abrir a página. Falhas e
CEP inexistente deixam todos os campos disponíveis para preenchimento manual.

`tests/account.spec.ts` intercepta o ViaCEP para testar os fluxos sem depender
da disponibilidade externa. As gravações de perfil e senha usam a API real e
contas temporárias, removidas após a suíte. O backend cobre também isolamento,
e-mail duplicado entre User/Admin e concorrência com criação de administrador.
