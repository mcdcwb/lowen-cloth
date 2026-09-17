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
- O CRUD mantém seus corpos de resposta e validações anteriores para administradores autenticados.
- Não há renovação automática nem endpoint de logout; após expirar o token, faça login novamente. A desativação da conta bloqueia imediatamente seus tokens.

Use HTTPS em produção. O limitador mantém contagens na memória de cada processo; reinícios zeram as contagens. A configuração atual considera conexão direta ao Express. Em uma implantação com proxy ou várias instâncias, configure os proxies confiáveis e um armazenamento compartilhado para o limitador.

## Variantes de produtos

`POST /produtos` exige `variants`, que pode ser uma lista vazia:

```json
{
  "name": "Camiseta Löwen",
  "description": "Camiseta oversized",
  "price": 129.90,
  "public": "unissex",
  "category": "camisetas",
  "images": ["https://placehold.co/800x1000"],
  "badge": "Novo",
  "colorName": "Preto",
  "colorValue": "#171717",
  "imageUrl": "/images/camiseta.jpg",
  "variants": [
    { "value": "P", "stock": 2 },
    { "value": "M", "stock": 5 },
    { "value": "G", "stock": 3 }
  ]
}
```

`value` aceita texto livre não vazio (por exemplo, `38` como string ou `Personalizado`), remove espaços nas extremidades e deve ser único no produto, diferenciando maiúsculas e minúsculas. `stock` é obrigatório em cada variante e deve ser inteiro entre 0 e 2147483647, limite do campo PostgreSQL. Campos desconhecidos no produto são rejeitados.

`PUT /produtos/:id` aceita campos parciais. Quando `variants` é omitido, as variantes são preservadas. Quando enviado, representa a lista completa desejada: atualiza estoques por `value`, preservando IDs existentes, cria novos valores e remove os ausentes, atomicamente. Enviar `variants: []` remove todas.

`GET /produtos` e as respostas de criação/atualização incluem `variants` com `id`, `productId`, `value` e `stock`. Excluir um produto remove suas variantes pela relação `onDelete: Cascade`.

`public` e `category` são strings não vazias; `images` é uma lista de strings não vazias e aceita `[]`. Os três campos são obrigatórios na criação e opcionais na atualização. `badge`, `colorName` e `colorValue` são strings opcionais e aceitam `null` para limpar o valor. Todos são retornados na listagem, criação e atualização. Enviar `images` substitui a galeria completa; omitir preserva a galeria.

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
