# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web que permita ao usuário enviar, listar e baixar seus documentos, mantendo os arquivos no filesystem local e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Envio de um arquivo por requisição.
- Listagem dos metadados dos documentos associados ao usuário configurado para a instância.
- Download de um documento pelo identificador.
- Interface web para envio, listagem, download e apresentação de estados de carregamento e erro.
- Backend REST em Node.js e Express, com frontend React e Vite.
- Armazenamento de arquivos em `backend/storage` e metadados em memória.

### Fora do escopo

- Armazenamento externo, em nuvem ou em banco de dados.
- Versionamento, edição, conversão ou pré-visualização de documentos.
- Autenticação, cadastro de contas e isolamento seguro entre múltiplos usuários.
- Compartilhamento, permissões por documento, busca, paginação e exclusão de documentos.
- Limpeza ou recuperação automática de arquivos sem metadados após reiniciar o backend.

### Premissas e limitações

- O MVP atende um único usuário lógico por instância. O identificador desse usuário vem de `DMS_DEFAULT_OWNER`; todos os documentos da instância pertencem a esse owner.
- A configuração do owner não autentica quem acessa a aplicação. O MVP não deve ser exposto como serviço multiusuário ou considerado um mecanismo de controle de acesso.
- O reinício do processo remove os metadados em memória. Arquivos já gravados podem permanecer no disco e não serão associados automaticamente a novos metadados.
- As rotas do backend não incluem o prefixo `/api`. No desenvolvimento, o frontend usa `/api` e o proxy do Vite remove esse prefixo ao encaminhar as requisições.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O sistema deve aceitar o envio de um documento pelo campo `file` de uma requisição `multipart/form-data`. | Uma requisição válida grava um arquivo local e responde com os metadados do documento criado. |
| RF-02 | O sistema deve rejeitar o envio quando o arquivo estiver ausente ou exceder o tamanho máximo configurado. | Arquivo ausente resulta em `400`; arquivo acima do limite resulta em `413`; nenhuma entrada de metadados é criada. |
| RF-03 | O sistema deve atribuir um identificador único e um owner a cada documento. | O identificador é um UUID gerado pelo servidor; o owner corresponde a `DMS_DEFAULT_OWNER`. |
| RF-04 | O sistema deve preservar o nome original como metadado, sem utilizá-lo como nome ou caminho físico no filesystem. | O nome físico é gerado pelo servidor; nomes enviados não podem determinar caminhos de gravação. |
| RF-05 | O usuário deve poder listar os documentos da instância. | A resposta contém somente metadados, nunca conteúdo binário ou caminho físico, e lista os documentos mantidos em memória. |
| RF-06 | O usuário deve poder baixar um documento pelo identificador. | Um identificador existente retorna o conteúdo como download; identificador sem metadados retorna `404`. |
| RF-07 | A interface deve permitir selecionar e enviar um arquivo, apresentar o resultado e atualizar a listagem após sucesso. | Durante o envio há estado de carregamento; em sucesso os metadados aparecem na lista; em erro uma mensagem em português é apresentada. |
| RF-08 | A interface deve apresentar os documentos listados e oferecer uma ação de download por documento. | Cada item mostra nome original, tamanho e data do envio, e permite baixar o arquivo correspondente. |
| RF-09 | A interface deve tratar lista vazia e falha de comunicação com o backend. | Lista vazia tem estado próprio; falhas não deixam o usuário sem indicação nem removem conteúdo sem confirmação. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | O backend deve usar Node.js, Express e JavaScript CommonJS; o frontend deve usar React, Vite e JavaScript ESM. TypeScript não faz parte desta fase. |
| RNF-02 | Os uploads devem ser gravados no filesystem local em `backend/storage`, usando Multer com `diskStorage`. Não utilizar serviços ou provedores externos. |
| RNF-03 | Os metadados devem ser mantidos em memória nesta fase. Reiniciar o processo pode tornar os metadados indisponíveis mesmo que os arquivos permaneçam no disco. |
| RNF-04 | O tamanho máximo deve ser configurável pela variável `MAX_FILE_SIZE_BYTES`, com padrão de 10 MiB (10.485.760 bytes). Não há allowlist de extensões ou tipos MIME no MVP. |
| RNF-05 | `PORT` configura a porta HTTP do backend e tem padrão `3000`. `DMS_DEFAULT_OWNER` configura o owner lógico da instância e deve ter um valor não vazio. |
| RNF-06 | O nome físico do arquivo deve ser gerado pelo servidor, por UUID, evitando colisões e traversal de diretórios. O caminho resolvido deve permanecer dentro de `backend/storage`. |
| RNF-07 | Mensagens apresentadas ao usuário devem estar em português. Respostas de erro não devem revelar caminhos locais, stack traces ou detalhes internos. |
| RNF-08 | O backend deve tratar erros de validação, Multer e filesystem no limite HTTP e responder com códigos e formato consistentes. |
| RNF-09 | O frontend deve acessar a API por `fetch` usando o prefixo `/api`; em desenvolvimento, o proxy Vite encaminha para o backend configurado. |
| RNF-10 | Testes de backend devem usar o runner nativo `node:test`. O build do frontend deve ser verificável pelo script existente do Vite. |

## 5. Modelo de dados

### Metadados públicos do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | Sim | UUID gerado pelo servidor e usado nas rotas de documento. |
| `originalName` | string | Sim | Nome original fornecido pelo cliente, preservado apenas como metadado e nome sugerido no download. |
| `size` | number | Sim | Tamanho do arquivo em bytes, como inteiro não negativo. |
| `uploadedAt` | string | Sim | Data e hora do recebimento bem-sucedido, em UTC e formato ISO 8601. |
| `owner` | string | Sim | Identificador de `DMS_DEFAULT_OWNER` associado ao documento. |

Exemplo de representação JSON:

```json
{
  "id": "2f5c29d1-e30c-4c69-8c80-2275eddfbabe",
  "originalName": "relatorio.pdf",
  "size": 24831,
  "uploadedAt": "2026-11-10T12:30:00.000Z",
  "owner": "local-user"
}
```

### Dados internos de persistência

O repositório mantém os metadados em uma coleção em memória indexada por `id`. Para localizar o arquivo, cada registro também associa o identificador a um nome físico gerado pelo servidor (UUID). Esse nome/caminho interno não é incluído nas respostas públicas. O repositório não persiste dados em banco, não reconstrói índices ao iniciar e não expõe caminhos arbitrários fornecidos pelo cliente.

## 6. Contratos de API

### Convenções

- Base das rotas: raiz do backend (`/`). O prefixo `/api` é usado pelo frontend e removido pelo proxy de desenvolvimento.
- Corpo de erro JSON: `{"error":{"code":"CODIGO","message":"Mensagem em português."}}`.
- Respostas de listagem e upload incluem apenas os campos públicos definidos no modelo de dados.
- O backend não confia em `owner`, identificador, nome físico ou caminho enviados pelo cliente.

### `POST /upload`

- Entrada: `multipart/form-data` com exatamente um arquivo no campo `file`.
- Limite: `MAX_FILE_SIZE_BYTES`, padrão de 10 MiB. Não há validação por extensão ou tipo MIME.
- Sucesso: `201 Created`, corpo JSON com os metadados públicos do documento.
- Erros:
  - `400 Bad Request`, `FILE_REQUIRED`, se o campo estiver ausente, ou `INVALID_UPLOAD`, se o multipart estiver inválido ou usar campo inesperado.
  - `413 Payload Too Large`, `FILE_TOO_LARGE`, se o limite configurado for excedido.
  - `500 Internal Server Error`, `STORAGE_ERROR`, se não for possível gravar o arquivo ou registrar os metadados. A mensagem não deve revelar detalhes internos; arquivo parcial deve ser removido quando possível.

### `GET /documents`

- Entrada: sem corpo ou parâmetros obrigatórios.
- Sucesso: `200 OK`, corpo JSON como array dos metadados em memória pertencentes a `DMS_DEFAULT_OWNER`. Retorna `[]` quando não houver documentos.
- Erro: `500 Internal Server Error`, `DOCUMENT_LIST_ERROR`, se não for possível obter a lista.

### `GET /documents/:id/download`

- Entrada: `id` do documento na URL.
- Sucesso: `200 OK`, conteúdo binário com `Content-Disposition: attachment` e o nome original como nome sugerido, devidamente codificado para cabeçalho HTTP. Usar `X-Content-Type-Options: nosniff`; não interpretar o nome original como caminho.
- Erros:
  - `404 Not Found`, `DOCUMENT_NOT_FOUND`, se não existir metadado para o identificador.
  - `500 Internal Server Error`, `STORAGE_ERROR`, se o metadado existir, mas o arquivo não puder ser lido. Não expor o caminho local.

## 7. Decisões arquiteturais

- Backend organizado em `routes/`, `controllers/`, `services/` e `repositories/`, com fluxo de dependência `routes → controllers → services → repositories`.
- `routes/` declara caminhos e encadeia middlewares; Multer processa o multipart com `diskStorage` e limite configurado.
- `controllers/` adapta requisições/respostas HTTP, aplica validação básica e converte erros conhecidos em respostas do contrato.
- `services/` concentra regras de negócio, owner, metadados e coordenação de operações de envio, listagem e download.
- `repositories/` mantém os metadados em memória e fornece acesso ao arquivo local associado ao documento. Camadas internas não dependem de Express.
- O armazenamento físico fica exclusivamente em `backend/storage`. O nome original do usuário não é usado para compor o destino do arquivo.
- O frontend usa componentes React funcionais e Hooks, organizados nas áreas existentes de páginas, componentes e serviços; a comunicação ocorre por `fetch`.
- A configuração operacional ocorre por variáveis de ambiente (`PORT`, `DMS_DEFAULT_OWNER` e `MAX_FILE_SIZE_BYTES`). A pasta de armazenamento permanece definida pela restrição do projeto.
- O endpoint existente `GET /health` deve continuar disponível.

## 8. Plano de execução

As etapas abaixo descrevem trabalho futuro. Esta especificação não implementa nem executa alterações nos arquivos de backend ou frontend.

1. Definir e validar configuração do backend, formato de erros, contratos HTTP e modelo público/interno do documento.
2. Implementar repositório em memória e configuração de Multer com `diskStorage` em `backend/storage`, nome físico gerado e limite configurável.
3. Implementar serviços para registrar, listar por owner e recuperar documentos, incluindo tratamento de falhas de filesystem e limpeza de upload parcial.
4. Implementar controllers e routes para os três endpoints; manter `GET /health` e mapear validações e erros para os contratos definidos.
5. Criar testes backend para upload válido/inválido, limite de tamanho, listagem vazia e preenchida, download, documento inexistente e falhas de armazenamento.
6. Implementar a interface React para enviar, listar e baixar documentos, com estados de carregamento, vazio e erro em português, usando os serviços `fetch` e o proxy `/api`.
7. Validar o fluxo integrado, executar os testes backend e o build frontend, revisar que uploads ficam somente em `backend/storage` e atualizar a documentação operacional.