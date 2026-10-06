# Manager → Pedidos

A rota `/manager/pedidos` usa a navegação, proteção ADMIN, cards, tokens de cor e
notificações Sonner do Manager existente. Não houve mudança de schema, migration,
numeração ou confirmação transacional de estoque.

## Listagem e API

`GET /orders` é exclusivo ADMIN (GUEST 401, USER 403). Parâmetros Zod strict:

| Parâmetro | Valores / padrão |
| --- | --- |
| search | Texto até 100 caracteres, padrão vazio |
| status | Um dos cinco OrderStatus existentes, opcional |
| sort | date ou number; padrão date |
| direction | asc ou desc; padrão desc |
| page | Inteiro entre 1 e 1.000.000; padrão 1 |
| pageSize | Inteiro entre 1 e 50; padrão 20 |

Parâmetros extras, arrays, enums desconhecidos e limites inválidos retornam 400.
Pesquisa parcial por número (aceita # inicial) ou nome histórico customerName,
case-insensitive para nomes. Status combina com a pesquisa por AND. Número usa
sequence, não comparação textual; data usa createdAt com sequence como desempate.

A resposta é `{ items, total, page, pageSize, totalPages }`. Cada item contém
id, number, sequence, customerName, createdAt, total, fulfillmentMethod, status.
Não inclui endereços, credenciais, chave de idempotência ou hash de checkout.
Contagem e página são lidas na mesma transação RepeatableRead. Página além do
limite retorna a última página disponível; lista vazia informa página 1 de 1.
São duas consultas por página, sem leitura de relações por registro e sem N+1.

## Interface

Pesquisa sem botão, com debounce de 300ms apenas quando o texto muda. Requisições
anteriores são abortadas e respostas antigas ignoradas. Filtro e ordenação são
imediatos. Alterar pesquisa, status ou ordenação volta à primeira página. O padrão
é Todos e pedidos mais recentes primeiro. Setas de Número/Data alternam crescente
e decrescente; trocar o critério começa crescente.

Cards mostram número, cliente, data comercial, valor, Entrega/Retirada e badge com
texto do status. Paginação possui Anterior/Próxima e contagem de páginas/resultados.
Há estados próprios de carregamento, falha com retry e ausência de resultados.
O layout adapta-se a desktop, tablet, 390px e 320px sem tabela horizontal.

O enum vem dos tipos Prisma já existentes. O mapa português é apenas apresentação,
não cria enum paralelo. Datas usam BUSINESS_TIME_ZONE existente e valores Decimal
são formatados por strings/BigInt, sem conversão financeira insegura para float.

## Detalhes e confirmação

`GET /orders/:id` é ADMIN-only e retorna os campos da listagem, updatedAt,
deliveryAddress, pickupAddress e os snapshots dos itens. ID inválido retorna 400;
inexistente, 404. Seleções explícitas omitem campos internos de checkout/segurança.
Não consulta Product nem UserAddress para representar o histórico.

Os detalhes abrem no Dialog Radix existente, com título/descrição acessíveis,
controle de foco e rolagem vertical. DELIVERY mostra deliveryAddress; PICKUP mostra
"Retirada na loja" e pickupAddress. Itens mostram quantidade, produto, cor,
tamanho, preço unitário e subtotal; o total é apenas dos produtos.

Somente PENDING_CONFIRMATION oferece "Confirmar pedido". Antes de qualquer POST,
AlertDialog exige confirmação explícita e informa a baixa de estoque. Cancelar
fecha o alerta sem enviar requisição. Durante o envio, o botão mostra
"Confirmando...", um ref bloqueia submits repetidos e fechar/navegar pelo Manager
fica impedido.

A interface chama exclusivamente o `POST /orders/:id/confirm` já existente. Sucesso
atualiza os detalhes para o status retornado pelo servidor, remove a ação, recarrega
a página atual (mantendo filtros), atualiza o catálogo administrativo e exibe toast.
Nenhum decremento ou cálculo de estoque é executado no frontend.

Erros de estoque exibem todos os conflicts retornados, com produto/cor/tamanho,
solicitado e disponível. O status permanece pendente. Erros sem conflicts, inclusive
resposta perdida após commit ou status atualizado por outro ADMIN, causam nova
leitura dos detalhes antes de oferecer outra confirmação. Falhas de leitura têm
retry. Respostas 401/403 usam a revogação de acesso já existente no Manager.

## Escopo e testes

Mantêm-se intactos Order, OrderItem, OrderCounter, enums, timezone, formato AAMMNNNN
e transação de confirmação. Criar pedido, carrinho, checkout e WhatsApp continuam
sem baixa ou reserva. Somente confirmar como ADMIN baixa estoque.

Ficam adiados cancelar/reposição, marcar enviado/pronto, finalizar, pagamento,
frete, rastreamento, editar itens, excluir pedidos e acompanhamento público.

Testes da API verificam autorização, pesquisa, os cinco status, filtros combinados,
quatro ordenações, paginação, parâmetros inválidos e snapshots. Playwright verifica
navegação, busca, filtros, paginação, detalhes, confirmação explícita, submit único,
sucesso, conflitos múltiplos, falhas/retry, vazio, USER e quatro larguras.
Fixtures de banco rodam somente em lowen_test_* pelo helper temporário existente.

## Resultado da validação desta etapa

- Backend: 90 testes passaram no banco temporário.
- Frontend: 57 testes passaram.
- Playwright: 115 cenários passaram, incluindo Pedidos, Manager, checkout,
  Configurações, Minha Conta, autenticação, categorias, catálogo, carrinho e favoritos.
- Typecheck, build frontend, build backend e git diff --check passaram.
- Verificação por comparação com HEAD: função confirmOrder e transação de estoque
  permanecem idênticas; schema, migrations, timezone, numeração e checkout sem diff.
- Screenshots de detalhes foram verificados em 320px; testes cobrem também 390px,
  768px e 1440px, com retorno de foco ao botão que abriu o modal.

Na primeira execução backend houve conflito de criação na fixture compartilhada de
categorias; as duas execuções seguintes completas passaram. O teste antigo do
Dashboard também foi alinhado ao título já existente "Total de variantes
(cor/tamanho)". Não houve alteração de comportamento do Dashboard.

Arquivos criados: src/app/manager/OrdersPage.tsx, src/app/manager/orders.ts,
backend/tests/orders.integration.test.ts, backend/tests/helpers/orders-browser-fixture.ts,
tests/orders.spec.ts e docs/manager-orders.md.

Arquivos modificados: backend/src/controllers/order.controller.ts,
backend/src/routes/order.routes.ts, backend/src/schemas/order.schema.ts,
backend/src/services/order.service.ts, src/app/manager/Manager.tsx,
src/app/manager/api.ts, playwright.config.ts, tests/manager.spec.ts,
tests/manager.test.mjs e docs/orders.md.
