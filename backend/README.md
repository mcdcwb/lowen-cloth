# Backend Lowen Cloth

Node.js, Express 5, TypeScript e Prisma com PostgreSQL.

## Configuração

Execute os comandos nesta pasta (`backend`).

1. Instale as dependências com `npm install`.
2. Para uma nova instalação, copie `.env.example` para `.env` e ajuste `DATABASE_URL`.
3. Gere um segredo para `JWT_SECRET`:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Copie os 64 caracteres hexadecimais para `JWT_SECRET` no `.env`. A aplicação rejeita segredo ausente ou malformado ao iniciar. O arquivo `.env` é ignorado pelo Git. Trocar o segredo invalida os tokens existentes.

4. Aplique as migrations e gere o cliente:

   ```sh
   npx prisma migrate deploy
   npx prisma generate
   ```

5. Execute `npm run dev`. Para compilar e iniciar: `npm run build` e `npm start`. A porta continua sendo 3000.

## Cadastrar um administrador

O cadastro é feito pelo terminal, sem endpoint público. Informe `ADMIN_EMAIL` e `ADMIN_PASSWORD` para o comando `npm run admin:create`. A senha deve ter de 5 a 128 caracteres e é armazenada como hash Argon2id. O e-mail é normalizado para minúsculas e deve ser único entre clientes e administradores; executar novamente não altera a conta existente.

Exemplo em PowerShell, com a senha solicitada em uma caixa de credenciais:

```powershell
$adminCredential = Get-Credential -Message "Informe o e-mail do administrador como usuário e sua senha"
$env:ADMIN_EMAIL = $adminCredential.UserName
$env:ADMIN_PASSWORD = $adminCredential.GetNetworkCredential().Password
try {
    npm run admin:create
} finally {
    Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
    $adminCredential = $null
}
```

## Rotas

| Método | Caminho | Acesso |
| --- | --- | --- |
| GET | / | Público; verifica conexão com PostgreSQL |
| GET | /produtos | Público |
| POST | /auth/register | Público; cria somente clientes |
| POST | /auth/login | Público; limitado a 10 tentativas malsucedidas por IP em 15 minutos |
| GET | /auth/me | Cliente ou administrador ativo |
| POST | /produtos | Administrador ativo |
| PUT | /produtos/:id | Administrador ativo |
| DELETE | /produtos/:id | Administrador ativo |

Login:

```http
POST /auth/login
Content-Type: application/json

{"email":"admin@example.com","password":"sua-senha"}
```

Resposta: `{ accessToken, tokenType: "Bearer", expiresIn: 900, account: { id, name, email, role } }`. Para preservar compatibilidade, administradores também recebem `admin: { id, email }`.

Envie `Authorization: Bearer <accessToken>` nas rotas protegidas. `GET /auth/me` retorna a conta validada no campo `account`.

- JWT: HS256, validade de 15 minutos, com verificação de emissor, destinatário e expiração.
- Sem token, com token inválido/expirado ou conta removida: `401`.
- Conta desativada após o login: `403`. A situação do cliente ou administrador é consultada em cada requisição protegida.
- Credenciais incorretas ou conta inativa no login: `401` com a mesma mensagem.
- Login malformado: `400`; excesso de tentativas: `429`.
- Clientes autenticados recebem `403` nas operações administrativas de produtos.
- O CRUD usa o contrato de cores abaixo, preservando a autorização de administradores ativos.
- Não há renovação automática nem endpoint de logout; após expirar o token, faça login novamente. A desativação da conta bloqueia imediatamente seus tokens.

Use HTTPS em produção. O limitador mantém contagens na memória de cada processo; reinícios zeram as contagens. A configuração atual considera conexão direta ao Express. Em uma implantação com proxy ou várias instâncias, configure os proxies confiáveis e um armazenamento compartilhado para o limitador.

## Produtos, cores e variantes

A modelagem é `Product → ProductColor → ProductVariant`. Nome, descrição, preço,
badge, público e categoria continuam no produto. Cada cor tem ID, `productId`,
`colorName`, `colorValue`, `imageUrl`, `images`, posição de exibição e variantes.
Cada variante pertence a uma cor (`colorId`); o tamanho é único dentro dessa cor.
O preço é único para todas as cores. Favoritos continuam por produto.

`POST /produtos` exige ao menos uma cor com nome não vazio, HEX de seis dígitos,
lista de imagens e lista de variantes (esta pode ser vazia):

```json
{
  "name": "Camiseta Löwen",
  "description": "Camiseta oversized",
  "price": 99.90,
  "public": "unissex",
  "category": "camisetas",
  "badge": "Novo",
  "colors": [
    {
      "colorName": "Preto",
      "colorValue": "#171717",
      "imageUrl": "/images/preto-frente.jpg",
      "images": ["/images/preto-costas.jpg"],
      "variants": [{ "value": "P", "stock": 3 }, { "value": "GG", "stock": 0 }]
    },
    {
      "colorName": "Branco",
      "colorValue": "#FFFFFF",
      "images": ["/images/branco.jpg"],
      "variants": [{ "value": "P", "stock": 0 }, { "value": "GG", "stock": 1 }]
    }
  ]
}
```

As respostas GET/POST/PUT incluem `colors[]` com IDs e `variants[]` com IDs e
`colorId`. O formato antigo com cor, imagens e variantes na raiz foi substituído.
HEX é normalizado para maiúsculas; estoque é inteiro entre 0 e 2147483647, com
CHECK no banco contra negativos. Campos desconhecidos são rejeitados também nas
cores/variantes; não é possível atribuir preço ou badge a uma cor.

`PUT /produtos/:id` continua parcial para os campos gerais. Omitir `colors`
preserva todas as cores. Enviar `colors` representa a lista completa desejada:
mande os IDs das cores existentes e omita IDs em cores novas. Cada cor enviada
contém seus campos e a lista completa de variantes. IDs de variantes preservam
identidade mesmo ao renomear tamanhos; sem ID, o tamanho identifica uma variante
existente dentro da cor. IDs de outro produto/outra cor são rejeitados com 400.
Todas as alterações são atômicas e edições do mesmo produto são serializadas.

Cores omitidas são removidas com suas variantes. Variantes omitidas também são
removidas. O cascade remove somente os itens de carrinho referenciando essas
variantes; os demais itens e favoritos permanecem. Reduções de estoque são
reconciliadas na leitura do carrinho, com aviso. O Manager pede confirmação para
remover cores persistidas ou preenchidas e impede remover a última cor; a API
também rejeita `colors: []`.

No Manager, **+ Adicionar cor** cria uma aba independente com nome, HEX, Color
Picker/EyeDropper, URLs de imagens e variantes/estoques. Trocar de aba preserva o
rascunho das demais. A captura pendente é cancelada ao trocar de cor ou desmontar
o formulário. O armazenamento de imagens permanece por URL/caminho, sem uploads
ou serviços adicionais. Catálogo e detalhes mudam galeria e tamanhos pela cor,
voltam à primeira imagem e limpam um tamanho que ficou indisponível.

### Migration de dados existentes

`20260922000000_product_colors` é uma nova migration transacional, sem alterações
nas anteriores. Cria uma cor para cada produto, copia as imagens e os valores de
cor existentes e move as variantes mantendo seus IDs e estoques. `CartItem`
continua referenciando `variantId`: seus registros e quantidades não são recriados.
User, Admin, UserAddress e Favorite não são alterados.

Nomes/HEX legados não nulos são copiados literalmente. Quando eram nulos, a cor
recebe `Cor não informada` e `#000000`, respectivamente; galerias nulas tornam-se
`[]`. Valores legados inválidos são preservados para correção pelo administrador;
novos cadastros/edições exigem nome e HEX válidos. O banco recusa estoques negativos
em vez de corrigi-los silenciosamente. Não execute reset ou seed para migrar.

```sh
npx prisma migrate deploy
npx prisma generate
npx prisma validate
```

Prisma permanece **7.9.1**. Aplique a migration e publique frontend/backend juntos,
pois o contrato público de produtos passou a ser aninhado.

## Seed de desenvolvimento

Na pasta `backend`, execute `npm run db:seed` (ou `npx prisma db seed`). O comando exige `DATABASE_URL` apontando para `lowen_cloth` e recusa `NODE_ENV=production`.

Insere 12 produtos fictícios com 50 variantes: dois por categoria (`camisetas`, `jaquetas`, `calcas`, `bermudas`, `vestidos`, `calcados`) e três por público (`masculino`, `feminino`, `unissex`, `infantil`). Usa URLs HTTPS de placeholders, duas imagens por produto, cores, descrições e badges selecionados. Roupas adultas usam P/M/G/GG, infantis usam 4/6/8/10 e calçados usam 36–40, sempre como strings.

O prefixo reservado `[lowen-cloth:dev-seed:v1] ` na descrição identifica exclusivamente os produtos deste seed. Cada execução remove apenas esses produtos (e suas variantes por cascade) e recria o catálogo em uma transação. Produtos sem a marca, User e Admin são preservados. Não use essa marca em produtos reais. O comando consulta os registros persistidos via Prisma após o commit e exibe totais, distribuições e contagens de contas e demais produtos antes/depois.

## Estrutura

`routes → middleware de autenticação → controllers → services → Prisma`

Os controllers tratam entradas e respostas HTTP; os services acessam o banco. `app.ts` configura o Express e `server.ts` inicia o servidor. O catálogo público e a autenticação usam a mesma aplicação nos testes.

## Testes

Com um PostgreSQL de desenvolvimento/testes disponível em `DATABASE_URL` e as migrations aplicadas:

```sh
npm test
npm run build
```

Os testes usam HTTP real, chaves JWT temporárias e PostgreSQL. Criam contas e produtos temporários e removem esses registros ao terminar. Execute em um banco de desenvolvimento/testes.

Cobertura: cadastro e duplicidade de e-mail, hash da senha, login, validação de configuração, limite de tentativas, JWT adulterado/expirado e com algoritmo ou claims incorretos, conta inativa/removida, GET público e CRUD autenticado com respostas 400/404.

Dependências adicionadas: `argon2`, `jose` e `express-rate-limit`.

## Favoritos e carrinho da conta

As rotas abaixo exigem Bearer JWT de USER ativo. A identidade vem exclusivamente
do token verificado pelo middleware existente. ADMIN recebe 403 nestas rotas.

| Método | Rota | Operação |
| --- | --- | --- |
| GET | `/favoritos` | Lista favoritos com os produtos e variantes atuais |
| PUT | `/favoritos/:productId` | Adiciona sem duplicar |
| DELETE | `/favoritos/:productId` | Remove favorito |
| GET | `/carrinho` | Carrega e ajusta quantidades ao estoque atual |
| POST | `/carrinho` | Soma quantidade de uma variante |
| PATCH | `/carrinho` | Define a quantidade de uma variante |
| DELETE | `/carrinho/item` | Remove uma variante |
| DELETE | `/carrinho` | Esvazia o carrinho da conta |
| POST | `/carrinho/sincronizar` | Mescla o carrinho visitante |

POST/PATCH recebem `{ "productId": 1, "colorId": 10, "size": "P", "quantity": 2 }`.
DELETE de item recebe `{ "productId": 1, "colorId": 10, "size": "P" }`.
A sincronização recebe `{ "items": [...] }` com o mesmo formato do POST.
O servidor verifica a relação produto/cor e resolve cor/tamanho para `ProductVariant.id`; o banco impõe
unicidade de favorito por usuário/produto e de item por usuário/variante.

As respostas de carrinho contêm `{ items, notices }`; cada item inclui `product`,
`colorId`, `variantId`, `size` e `quantity`. O carrinho visitante também guarda
`colorId`, diferenciando duas cores do mesmo produto/tamanho. Itens legados sem
`colorId` são associados à primeira cor do produto (a cor original após a
migration), inclusive na sincronização; itens que já têm ID de cor removida não
são redirecionados para outra cor.

As respostas de carrinho contêm `{ items, notices }`. A mesclagem usa a maior
quantidade entre visitante e conta, limitada ao estoque; repeti-la não soma
itens novamente. Variantes indisponíveis e cortes de quantidade geram avisos.
Alterações normais acima do estoque retornam 409. Transações serializáveis,
com repetição em conflitos, protegem operações concorrentes. Carrinho não
reserva nem debita estoque. Produtos/variantes excluídos removem suas relações.

Migration: `20260917222856_persist_user_shopping`. Para outro ambiente, execute
`npx prisma migrate deploy` e `npx prisma generate` em `backend`, usando Prisma 7.9.1.

## Minha Conta

As rotas `/conta` exigem o JWT de um USER ativo, com a mesma autenticação de
`/auth/me`. ADMIN recebe 403. A identidade não é recebida no corpo nem na URL.

- `GET /conta`: retorna `{ account: { id, name, email, role }, address }`.
- `PATCH /conta`: recebe `{ email, address }`. `address: null` remove o endereço.
  Um endereço preenchido contém `cep`, `street`, `number`, `neighborhood`, `city`
  e `state`; `complement` é opcional. O CEP é salvo com oito dígitos e a UF em
  maiúsculas. O e-mail é normalizado pelo schema existente e sua exclusividade
  entre User e Admin usa a mesma transação serializável do cadastro. Duplicidade
  retorna 409. Nome, `userId`, role e demais campos desconhecidos são rejeitados.
- `PUT /conta/senha`: recebe `currentPassword`, `newPassword` e `confirmPassword`.
  Verifica a senha atual com Argon2, exige confirmação igual e nova senha de
  5 a 128 caracteres, conforme o cadastro existente. Erros de senha retornam
  400; falhas repetidas são limitadas por conta. Nenhuma senha/hash é retornada
  ou registrada em logs. O mecanismo JWT permanece igual, com a validade atual
  dos tokens; mudar a senha não revoga tokens já emitidos.

A migration `20260917230132_add_user_address` cria `UserAddress`, uma relação
opcional de um endereço por User, sem alterar registros de usuários existentes.
Favoritos e carrinho continuam vinculados ao mesmo ID após mudar e-mail/senha.

## Validação isolada de regressões

Para executar as suítes sem modificar produtos/carrinhos locais, use os helpers
abaixo a partir de `backend`. Eles criam um banco temporário com nome aleatório,
aplicam as migrations e o removem ao terminar. A conexão configurada precisa ter
permissão de criar/remover bancos; nenhuma tabela do banco original é apagada.

```sh
node tests/helpers/run-isolated.mjs
node tests/helpers/run-isolated.mjs browser
```

O primeiro executa todos os testes backend, incluindo uma migration sobre dados
legados com carrinho preenchido. O segundo executa toda a suíte Playwright com
fixtures próprias. Para filtrar: `node tests/helpers/run-isolated.mjs browser tests/colors.spec.ts`.
No frontend execute também `npm test`, `npm run typecheck` e `npm run build`;
no backend, `npm run build`. Finalize com `git diff --check`.

## Upload de imagens por cor

Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`
somente em `backend/.env` (ignorado pelo Git). O `.env.example` contém apenas os
nomes vazios. A configuração é centralizada em `src/config/cloudinary.ts`.
O SDK oficial usa `upload_stream`; não há credenciais Cloudinary no React.

`POST /uploads/produtos` exige Bearer JWT de ADMIN ativo antes de receber o
arquivo. Visitante recebe 401, USER recebe 403. Envie `multipart/form-data` com
um único arquivo no campo `file`, sem outros campos. São aceitos JPEG, PNG e
WebP de até **5 MiB (5.242.880 bytes)**. O backend verifica MIME e assinatura dos
bytes, e o Cloudinary decodifica a imagem com `allowed_formats`. O buffer fica
temporariamente em memória; o PostgreSQL continua armazenando somente URLs.
Há limite de 30 solicitações por ADMIN a cada 15 minutos por instância.

Uploads usam `lowen-cloth/products`, UUID aleatório e `overwrite: false`.
Sucesso retorna 201 com apenas `{ "url": "https://res.cloudinary.com/..." }`.
Arquivo ausente/inválido retorna 400, acima do limite 413, excesso de tentativas
429, configuração ausente 503 e falha do provedor 502. Erros do SDK não são
registrados nem devolvidos ao cliente. Timeout do provedor: 60 segundos.

No Manager, **Selecionar imagem** abre o seletor local e envia o arquivo via
backend. Salvar e repetir upload ficam bloqueados durante o envio; trocar de
cor continua permitido. A URL pertence à cor que iniciou o upload, inclusive
antes de o produto ter ID. A primeira imagem ocupa o campo principal quando a
cor ainda está vazia; envios seguintes são anexados às adicionais, mantendo a
ordem e evitando referências duplicadas. Previews e entradas manuais por URL
continuam disponíveis. Criar/editar usa o CRUD atual, sem migration ou mudança
de Prisma (7.9.1).

Remover uma imagem significa limpar sua URL no campo principal/adicionais.
Cancelar o formulário ou remover a cor ignora resultados pendentes; interromper
o navegador não garante cancelamento de um upload já recebido pelo provedor.
**Não há exclusão remota automática**: assets podem continuar referenciados em
outros produtos, ou o usuário pode cancelar uma edição. Limpeza futura deve
verificar todas as referências persistidas, uploads pendentes e um período de
carência antes de excluir assets órfãos.

Testes normais usam um uploader injetado no backend e respostas interceptadas
no navegador; nenhuma credencial real é necessária. Há também um teste real
opt-in, que cria dados em banco temporário e deixa **um asset remoto**:

```powershell
# Em backend, com credenciais Cloudinary locais configuradas:
$env:E2E_REAL_UPLOAD = "1"
try { node tests/helpers/run-isolated.mjs browser uploads.spec.ts --grep "real Cloudinary" }
finally { Remove-Item Env:E2E_REAL_UPLOAD }
```

Ele usa o seletor de arquivos do navegador via Playwright, envia uma imagem
local, verifica prévia, criação, edição, reload, isolamento por cor, catálogo e
detalhes. As capturas e a URL retornada ficam em `test-results` (ignorado).
O teste real é ignorado por padrão para evitar uploads involuntários.
