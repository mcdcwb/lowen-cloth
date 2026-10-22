# Backend — Lowen Cloth

API da loja, implementada com Node.js, Express 5, TypeScript, Prisma 7 e PostgreSQL. O backend valida as entradas, aplica autorização por conta e perfil e persiste catálogo, estoque, contas, carrinhos, favoritos, configurações e pedidos.

## Requisitos e instalação

Execute estes comandos na pasta `backend/`:

```sh
npm ci
```

É necessário Node.js/npm compatível com as dependências do projeto e um PostgreSQL acessível para executar a API. Os manifests não fixam a versão do Node. O arquivo `.env.example` lista as variáveis usadas pelo backend; crie seu `.env` local a partir dele e substitua os exemplos por valores do ambiente local. Não compartilhe nem versiona o `.env`.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL usada pelo Prisma. Exemplo fictício: `postgresql://usuario:senha@localhost:5432/lowen_dev?schema=public`. |
| `JWT_SECRET` | Segredo de 32 bytes em 64 caracteres hexadecimais; obrigatório ao criar a aplicação. |
| `FRONTEND_ORIGIN` | Lista opcional de origens frontend permitidas pelo CORS, separadas por vírgula. Use origens completas, sem barra final. |
| `PORT` | Porta HTTP; padrão local `3000`. |
| `NODE_ENV` | Modo da aplicação. Origens locais adicionais de CORS são habilitadas fora de `production`. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciais necessárias para upload remoto de imagens; opcionais para iniciar a API. |

Gere um segredo JWT local sem reutilizar o exemplo:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

As credenciais Cloudinary e o segredo JWT pertencem apenas ao ambiente backend. Qualquer variável `VITE_*` é pública no bundle do frontend.

## Banco de dados e migrations

O schema fica em `prisma/schema.prisma`; migrations versionadas ficam em `prisma/migrations/`. Para preparar um banco de desenvolvimento vazio ou atualizado, confirme cuidadosamente que `DATABASE_URL` aponta para esse banco e execute:

```sh
npx prisma migrate deploy
npx prisma generate
```

`migrate deploy` altera o banco indicado pela variável. Não use comandos de reset em dados que devam ser preservados e nunca aponte comandos locais para um banco de produção por engano. A aplicação não executa migrations ao iniciar.

O modelo de catálogo é `Product → ProductColor → ProductVariant`: preço e informações gerais pertencem ao produto; imagens, nome/valor de cor pertencem à cor; tamanho e estoque pertencem à variante daquela cor. Carrinho e pedidos referenciam variantes. Outras entidades persistem categorias, contas, endereço, favoritos, configurações da loja, estados e histórico operacional de pedidos.

Para popular o catálogo de desenvolvimento, existe `npm run db:seed`. O script recusa `NODE_ENV=production` e só permite o banco local chamado `lowen_cloth`; cada execução substitui apenas os produtos marcados pelo seed. Inspecione a URL e o nome do banco antes de usar. Não é necessário seed para iniciar uma instalação vazia se as migrations e configurações necessárias já estiverem disponíveis.

## Executar e compilar

```sh
npm run dev       # servidor de desenvolvimento com reinício por alteração
npm run build     # gera cliente Prisma e compila TypeScript para dist/
npm start         # inicia dist/server.js após o build
```

O servidor escuta em `0.0.0.0`, usando `PORT` ou `3000`. A rota `GET /` é um health check que consulta o PostgreSQL; ela não substitui monitoramento externo.

## API e fluxos

As rotas são montadas em `src/app.ts`. Os caminhos abaixo são relativos à raiz da API; no frontend local, o Vite encaminha `/api/*` removendo o prefixo `/api`.

| Grupo | Caminhos principais | Acesso |
| --- | --- | --- |
| Autenticação | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | Cadastro e login públicos; `/me` exige Bearer JWT válido. Registro público cria clientes. |
| Catálogo | `GET /produtos`, `GET /produtos/carrossel`, `/produtos/admin`, `POST /produtos`, `PUT /produtos/:id`, `DELETE /produtos/:id`, `PATCH /produtos/:id/carrossel` | Leituras públicas indicadas; operações administrativas exigem ADMIN ativo. |
| Categorias | `GET /categorias/disponiveis`, `GET/POST /categorias`, `PUT/DELETE /categorias/:id` | Lista disponível pública; gerenciamento exige ADMIN. |
| Conta | `GET/PATCH /conta`, `PUT /conta/senha`; caminhos `/conta/admin` e `/conta/admin/senha` | Rotas separadas para cliente e administrador autenticados. |
| Favoritos e carrinho | `/favoritos`, `/carrinho` e subrotas de item/conferência/sincronização | Exigem autenticação; carrinho é exclusivo de USER. |
| Checkout | `GET /checkout`, `POST /checkout/whatsapp` | USER autenticado. Revisa dados/estoque e prepara pedido/mensagem para WhatsApp; sem cobrança online. |
| Pedidos | `GET /orders/mine`; demais listagem, relatórios, detalhes e operações em `/orders` e `/orders/:id/*` | `/mine` é exclusivo de USER; operações de gestão exigem ADMIN. |
| Configurações | `GET /settings/public`; `/settings`, `/settings/store` | Leitura pública limitada; leitura/edição administrativa exige ADMIN. |
| Imagens | `POST /uploads/produtos` | ADMIN autenticado; depende de Cloudinary configurado. |

Envie o token nas rotas protegidas como `Authorization: Bearer <token>`. O backend emite JWT HS256 para USER e ADMIN com validade fixa de 30 dias e verifica assinatura, emissor, público, expiração, perfil e estado da conta. Não há refresh token nem revogação individual; logout no frontend remove a sessão local, e a desativação/exclusão da conta bloqueia as próximas requisições autenticadas.

### Limites e proteções HTTP

- Helmet adiciona cabeçalhos de segurança; CSP e COEP estão desativados na configuração atual.
- `express.json()` aceita até 1 MiB. JSON malformado retorna 400 e corpo excessivo retorna 413 sem detalhes internos.
- CORS permite origens listadas em `FRONTEND_ORIGIN`; em ambiente diferente de produção, também permite origens locais de desenvolvimento definidas no código.
- Login limita falhas a 10 por IP em 15 minutos; cadastro limita requisições a 10 por IP no período; senha e upload têm limites adicionais por conta.
- Novas finalizações em `POST /checkout/whatsapp` são limitadas a 20 por conta a cada 15 minutos. Respostas de falha não consomem o limite (`skipFailedRequests`). Recuperar pedido existente com chave de idempotência vinculada à mesma conta não conta como nova finalização.
- Os limitadores usam memória do processo: reiniciar limpa as contagens e processos/instâncias diferentes não compartilham estado. O código não configura armazenamento distribuído nem comprova comportamento da hospedagem. O Express está configurado para confiar em um proxy; valide a topologia de proxy da implantação antes de depender de limites por IP.

Logs HTTP e erros usam JSON com campos permitidos e request ID; corpo, query string, credenciais e objetos de erro completos não devem ser enviados ao logger. Erros inesperados recebem resposta genérica em produção; respostas de domínio mantêm seus contratos definidos pelos handlers.

### Upload

`POST /uploads/produtos` recebe um único JPEG, PNG ou WebP de até 5 MiB no campo multipart `file`. O arquivo é processado por Cloudinary; o banco armazena a URL. O buffer é mantido temporariamente em memória. A aplicação não remove automaticamente assets remotos quando uma imagem é retirada do catálogo, pois uma URL pode continuar referenciada.

## Administrador

Não existe cadastro administrativo público. Configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` apenas no processo local e execute:

```sh
npm run admin:create
```

A senha precisa ter de 5 a 128 caracteres e é armazenada como hash Argon2id. E-mail deve ser único, sem distinção de maiúsculas/minúsculas. No PowerShell, uma forma de fornecer a senha interativamente e removê-la do ambiente do processo ao final é:

```powershell
$adminCredential = Get-Credential -Message "E-mail e senha do administrador"
$env:ADMIN_EMAIL = $adminCredential.UserName
$env:ADMIN_PASSWORD = $adminCredential.GetNetworkCredential().Password
try {
    npm run admin:create
} finally {
    Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
    $adminCredential = $null
}
```

## Testes

`npm test` na raiz executa testes unitários do frontend. No backend, os testes precisam de um PostgreSQL local com permissão para criar bancos descartáveis. O helper recusa hosts que não sejam `localhost`, `127.0.0.1` ou `::1`; conecta ao banco de referência indicado por `DATABASE_URL`, cria um banco `lowen_test_<id>` separado, aplica nele as migrations, executa os testes e tenta removê-lo com `DROP DATABASE ... WITH (FORCE)` ao terminar.

Configure `DATABASE_URL` no ambiente do processo para uma conexão local (pode usar um banco de referência vazio, não produtivo) e confirme host, porta e usuário antes de executar. O helper não lê nem usa um host remoto como fallback e não deve receber URL do Neon ou de outro serviço compartilhado. Não conceda permissões nem tente credenciais por tentativa e erro; o usuário PostgreSQL precisa ter `CREATEDB` para o ciclo de banco descartável.

Para a suíte backend completa, execute a partir desta pasta:

```sh
npm test
```

O helper aceita arquivos específicos após o script. Para integração de navegador com banco isolado, use o mesmo helper:

```sh
node tests/helpers/run-isolated.mjs browser
node tests/helpers/run-isolated.mjs browser tests/checkout.spec.ts
```

O helper de navegador sem argumentos executa a seleção definida em `playwright.config.ts`; também prepara dados de catálogo no banco temporário. Essa execução é preferível a `npm run test:e2e` direto na raiz para isolamento. O comando Playwright direto usa `DATABASE_URL` para criar e apagar fixtures e não cria por si só um banco descartável; nunca o execute apontando para produção.

Testes unitários do backend que não usam banco podem ser executados diretamente com o executor Node, por exemplo:

```sh
node --import tsx --test tests/http-security.test.ts tests/error-handling.test.ts
```

O build do backend é `npm run build`. Testes de integração aplicam migrations exclusivamente ao banco aleatório criado pelo helper; as migrations não são executadas no Neon por esse procedimento. A limpeza ocorre em bloco `finally`; se o processo for encerrado abruptamente ou a remoção falhar, confirme manualmente o nome exato do `lowen_test_<id>` antes de qualquer ação — não remova outros bancos.

## Documentos relacionados

- [README principal](../README.md): instalação e fluxos do produto.
- `prisma/schema.prisma`: modelo relacional atual.
- `prisma/migrations/`: histórico de alterações do schema.
- `tests/helpers/run-isolated.mjs`: implementação do banco descartável.
