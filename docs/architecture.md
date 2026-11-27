# LifeOS — decisões de arquitetura da Fase 0

**Status:** atualizada após a decisão de ampliar a personalização e criptografar o armazenamento. Módulos das Fases 1 a 3 presentes; implementação central da Fase 4 adicionada, aguardando validação de integração.

## 1. Requisitos que orientam a arquitetura

- Aplicação estática, responsiva, instalável como PWA e capaz de operar offline após o carregamento inicial.
- Dados principais persistidos localmente em IndexedDB, sem conta, backend, sincronização em nuvem, telemetria ou dependência de IA.
- Todo conteúdo de registros e preferências persistido pelo aplicativo deve ser criptografado antes de gravar no IndexedDB.
- Módulos evolutivos com interfaces reais, dados reais e camada de acesso a dados centralizada.
- Backups portáveis para permitir transferência manual entre dispositivos.
- Acessibilidade, segurança de conteúdo inserido pelo usuário e tratamento de erros como requisitos de base.

## 2. Arquitetura proposta

Aplicação em camadas, sem framework de interface na primeira versão:

1. **Aplicação e navegação** — inicialização, roteamento simples por History API, estado de interface e composição das páginas.
2. **Componentes compartilhados** — navegação, diálogos acessíveis, formulários, mensagens, widgets e componentes de layout.
3. **Módulos de domínio** — cada módulo expõe operações e telas próprias; não conhece os detalhes do IndexedDB.
4. **Serviços de domínio** — validações, regras de negócio, cálculo de progresso e consultas agregadas.
5. **Cofre e repositórios** — API única de leitura e escrita; serializa e criptografa registros antes de persistir, encapsulando IndexedDB.
6. **Infraestrutura** — abertura e migrações do banco, derivação de chave, backup, tratamento de erros, configuração, service worker e atualização.

Fluxo normal: interface → serviço do módulo → repositório/cofre → IndexedDB. Apenas a infraestrutura de persistência acessa o banco diretamente. Conteúdo de notas deve ser exibido como texto ou Markdown sanitizado; nunca executar HTML fornecido pelo usuário.

### Convenções

- ES Modules; um arquivo deve ter uma responsabilidade clara.
- Entidades usam identificadores estáveis UUID e datas ISO 8601 em UTC, convertidas para horário local apenas na apresentação.
- Registros incluem `createdAt` e `updatedAt`; campos de conclusão usam datas explícitas quando aplicável.
- Validação compartilhada nos serviços antes de persistir; erros devem ser compreensíveis e não descartar entrada do usuário.
- Preferências visuais e de layout também devem ser persistidas localmente, com valores padrão versionados.
- Personalização completa deve ser orientada por tokens e preferências, sem estilos avulsos por tela: tema automático/claro/escuro; paleta predefinida ou cor de destaque customizada; tipografia e escala de texto; densidade; raio de cantos; contraste; movimento reduzido; navegação reordenável; página inicial configurável; widgets do Dashboard visíveis, ordenáveis e redimensionáveis; categorias, etiquetas e cores; preferências por módulo. A Fase 1 implementa o núcleo visual persistente; disposição de widgets e navegação pode evoluir nas fases 2 e 5.
- Dependências de terceiros devem ser pequenas, justificadas e documentadas; versão travada no arquivo de lock.

## 3. Esquema inicial do IndexedDB

Banco: `lifeos`, versão inicial `1`. Usar IndexedDB nativo com chave primária `id`, índices explícitos para consultas do envelope e uma store `meta` para versão/parâmetros criptográficos. Definir upgrade functions por versão; migrações futuras devem preservar os registros existentes e nunca apagar dados automaticamente.

| Tabela | Campos essenciais iniciais | Índices iniciais sugeridos |
| --- | --- | --- |
| `records` | `id`, `collection`, `iv`, `ciphertext` | `collection` |
| `meta` | `key`, `value` | `key` (chave primária) |

Registros de domínio são JSON dentro de `ciphertext`, agrupados logicamente em coleções como `tasks`, `events`, `habits`, `habitEntries`, `goals`, `studySubjects`, `studySessions`, `studyCards`, `studyQuestions`, `studyGrades`, `projects`, `notes`, `focusSessions`, `focusSettings`, `fitnessActivities` e `settings`. A chave e coleção ficam visíveis no envelope para localizar e substituir registros; campos e valores ficam criptografados. O índice `collection` é metadado visível. Migrações alteram a estrutura do envelope sem decifrar o conteúdo quando possível; migrações de payload são feitas após desbloqueio.

Referências internas são verificadas pelo serviço de domínio após descriptografia. IndexedDB não fornece chaves estrangeiras; exclusões relacionadas devem usar transação e política explícita de arquivamento, desvinculação ou confirmação.

### Criptografia local

- Web Crypto nativa: PBKDF2 com SHA-256 e salt aleatório por cofre para derivar uma chave AES-256-GCM não extraível; cada registro recebe IV aleatório de 96 bits, autenticação GCM e AAD derivada de seu ID/coleção.
- A chave derivada permanece somente em memória durante a sessão. Ao recarregar ou bloquear, a pessoa precisa desbloquear com a senha.
- Um verificador autenticado é armazenado em metadados para diferenciar senha incorreta sem persistir senha/chave. A aplicação não oferece redefinição capaz de recuperar os dados.
- Senha local é exigida na primeira configuração; perder a senha torna os dados irrecuperáveis. Backups da Fase 6 deverão manter criptografia e validar a política de exportação antes de escrever.
- O envelope deixa visíveis ID, coleção, IV, versão do envelope e tamanho aproximado do texto cifrado. Não há proteção contra comprometimento do navegador enquanto o cofre está desbloqueado, keylogger, malware, extensões com acesso à página ou cópia de memória.
- Erros de autenticação/descriptografia não devem resultar em gravação vazia ou substituição de dados. Nunca excluir/limpar o banco automaticamente por falha de senha ou migração.

## 4. PWA e estratégia offline

- `manifest.webmanifest` define nomes, cores, escopo, `start_url`, modo `standalone` e ícones 192×192 e 512×512, incluindo variante maskable quando disponível.
- O service worker pré-cacheia shell, CSS, módulos essenciais, fontes/ícones locais e página de fallback. Evitar CDN como dependência crítica offline.
- Recursos publicados usam nome ou estratégia de cache versionada. Atualizações são detectadas e comunicadas ao usuário; ativação não deve apagar IndexedDB.
- Navegação offline recebe fallback da aplicação; dados locais continuam sendo carregados pelo IndexedDB.
- Um aviso discreto comunica perda e retorno de conectividade. A experiência de instalação é condicionada ao suporte do navegador e não deve prometer fluxo uniforme.
- Desenvolvimento deve usar `localhost`/HTTPS. `file://` não é ambiente suportado para módulos ES ou service worker.

## 5. Riscos técnicos e mitigação

| Risco | Efeito | Mitigação proposta |
| --- | --- | --- |
| Limites e políticas de armazenamento variam por navegador/dispositivo; gravação pode falhar ou dados podem ser removidos pelo navegador | Perda ou indisponibilidade de registros | Capturar erros de quota, solicitar persistência quando suportado sem prometer concessão, informar limites, salvar operações atômicas, exibir orientação de backup e testar importação/exportação na Fase 6 |
| Senha local esquecida | Dados criptografados não podem ser recuperados | Explicar isso na configuração e desbloqueio; Fase 6 deve priorizar backup criptografado com fluxo seguro e validação clara |
| Derivação de senha consome CPU, especialmente em celulares | Desbloqueio mais lento | Usar PBKDF2 com custo documentado e feedback acessível; medir em Android/iOS; permitir apenas parâmetros versionados que não enfraqueçam derivações futuras |
| IV reutilizado ou AAD inconsistente | Risco de confidencialidade/integridade ou falha na leitura | Gerar IV criptograficamente aleatório por gravação, vincular AAD ao ID/coleção, testar leitura, alteração e tampering |
| Service worker pode manter arquivos antigos durante uma atualização | Interface e esquema podem ficar incompatíveis | Versionar cache, atualizar shell de forma coordenada, manter compatibilidade de esquema e nunca limpar dados locais como parte de atualização |
| IndexedDB e transações têm comportamento assíncrono e podem falhar/interromper | Escritas parciais ou interface inconsistente | Repositórios centralizados, transações IndexedDB, mensagens de falha e testes de integração de leitura/escrita e migração |
| Navegadores diferem em instalação PWA, notificações, armazenamento e suporte offline | Instalação ou recursos variam por plataforma | Detectar capacidades, tratar instalação como opcional, testar pelo menos Chromium desktop e Android, Safari iOS e navegador desktop alternativo antes da publicação |
| Datas locais, UTC, recorrência e horário de verão podem divergir | Eventos/tarefas aparecem em horário ou dia incorreto | Guardar instantes como ISO UTC, datas de dia inteiro como data local sem horário, definir regras de recorrência e testar bordas de fuso/horário de verão |
| Backup importado pode ser inválido, antigo ou malicioso | Corrupção ou substituição indevida | Validar formato, versão e limites antes de abrir transação; oferecer prévia e confirmação; importar atomicamente; testar arquivos inválidos e versões anteriores |
| Notas Markdown podem conter payloads HTML | XSS local ou execução de conteúdo | Sanitizar renderização, bloquear scripts/atributos ativos e testar conteúdo hostil; nunca usar `innerHTML` sem sanitização confiável |
| Muitos módulos podem tornar o escopo grande e difícil de manter | Atraso e regressões | Implementar somente uma fase por vez, definir APIs de repositório e manter critérios de aceite verificáveis |

## 6. Estrutura definitiva proposta

```text
lifeos/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── package.json
├── README.md
├── LICENSE
├── public/
│   ├── icons/
│   └── images/
├── src/
│   ├── app/                 # inicialização, rotas e estado da interface
│   ├── core/
│   │   ├── database/        # IndexedDB, schema e migrações
│   │   ├── crypto/          # derivação de chave e envelope autenticado
│   │   ├── repositories/    # acesso a dados encapsulado no cofre
│   │   ├── backup/          # serialização e validação de backup
│   │   ├── validation/      # validação compartilhada
│   │   └── utilities/
│   ├── components/          # navegação, modal, formulários, widgets
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── calendar/
│   │   ├── habits/
│   │   ├── goals/
│   │   ├── study/
│   │   ├── projects/
│   │   ├── fitness/
│   │   ├── notes/
│   │   ├── knowledge-graph/
│   │   ├── analytics/
│   │   ├── focus/
│   │   ├── assistant/
│   │   └── settings/
│   ├── styles/              # tokens, base, layout, componentes e temas
│   └── assets/
├── tests/
│   ├── unit/
│   └── integration/
└── scripts/                 # somente ferramentas realmente necessárias
```

Pastas de módulos serão criadas quando a fase correspondente começar; não criar diretórios vazios. `assistant` fica isolado e desativado sem configuração explícita. A estrutura pode ser ajustada se a implementação revelar necessidade concreta, documentando a decisão.

## 7. Critérios de teste da Fase 1

Os testes abaixo definem o que precisa ser verificado quando a Fase 1 for implementada; nenhum teste foi executado nesta entrega de planejamento.

### Testes automatizados

- Derivar a mesma chave para a mesma senha/salt e chaves diferentes para salt diferente; verificar senha errada e ciphertext/IV/AAD alterados são rejeitados.
- Criar um cofre, persistir, bloquear e desbloquear; confirmar que registros em IndexedDB não contêm texto original e que registros voltam após reabrir.
- Criar, ler, atualizar e excluir registros pelo repositório; confirmar índices e persistência após reabrir a conexão.
- Confirmar rollback ou erro explícito quando uma transação falha, sem exibir sucesso falso.
- Validar padrões, atualização e restauração de preferências de tema/densidade sem apagar dados do usuário.
- Confirmar que rotas e navegação produzem estado válido em recarga direta e que entradas são escapadas na interface.
- Validar manifesto, existência e dimensões dos ícones e registro/ativação do service worker.

### Verificações manuais e de integração

- Fluxo de primeira abertura, navegação por teclado, foco visível, rótulos, estados vazios e erros.
- Layout em larguras de celular, tablet e desktop; sem rolagem horizontal indevida e com áreas de toque utilizáveis.
- Alternar temas claro/escuro/automático e densidade; fechar e reabrir para confirmar preferências persistidas.
- Criar registros, fechar e abrir o app e confirmar que permanecem no mesmo navegador/dispositivo.
- Instalar onde o navegador oferece suporte e abrir a versão instalada.
- Depois do primeiro carregamento, ficar offline, recarregar e confirmar que o shell abre e dados locais podem ser consultados/editados; voltar online e confirmar estado de conectividade.
- Publicar em caminho HTTPS de teste e verificar `start_url`, escopo, recursos, service worker e atualização sem perda de IndexedDB.
- Cobrir ao menos um navegador Chromium desktop, um navegador Android e Safari no iOS, registrando limitações de suporte observadas.

## 8. Fase 2 e próximos passos

Fase 1 entrega a fundação navegável, preferências visuais persistidas, acesso local criptografado, manifesto e cache offline básico. Fase 2 adiciona Dashboard baseado em registros reais, operações de tarefas, eventos de calendário, check-ins de hábitos e objetivos/marcos, todos acessando o cofre via API compartilhada.

Os módulos das Fases 2 e 3 usam coleções cifradas na store genérica existente. Isso evita alteração de versão/esquema do IndexedDB e preserva compatibilidade com os dados já armazenados. A Fase 3 adiciona disciplinas/conteúdos, sessões e metas de estudo, cartões de revisão espaçada, banco de questões, avaliações, projetos com marcos/tarefas vinculadas/diário/decisões, notas com Markdown básico e favoritos, e cronômetro de foco com histórico e associação a tarefa/projeto/disciplina. Nenhuma coleção armazena conteúdo em texto puro no IndexedDB.

### Fase 3 — implementação inicial

- `study.js` concentra disciplinas, conteúdos, sessões de estudo, metas semanais, flashcards, revisão, questões e avaliações.
- `projects.js` gerencia projetos, status, datas, cor, marcos, relações com tarefas e registros de andamento/decisões.
- `notes.js` fornece CRUD, busca, pastas, etiquetas, favoritos, modelos e links wiki `[[título]]`, além de prévia Markdown básica. A prévia transforma texto escapado em marcação simples e não habilita HTML ou links arbitrários.
- `focus.js` implementa cronômetro configurável, pausas, vínculo opcional com tarefa/projeto/disciplina e histórico; bloquear o cofre pausa o cronômetro.
- A navegação adiciona as quatro rotas; o service worker avança para `lifeos-shell-v4` e pré-carrega os módulos novos.
- A visualização Lista/Quadro/Calendário de tarefas ocupa uma linha dedicada do toolbar: alinhada à direita em desktop e abaixo da busca/filtros em telas estreitas.
- Os imports dos quatro módulos passaram por carregamento no Node. O DOM não foi simulado, e CRUD de interface, persistência após reinício, experiência visual em diferentes larguras e ciclo do cronômetro ainda requerem testes de integração no navegador. Anexos, histórico de edição de notas e sons do Modo Foco seguem pendentes.

### Fase 4 — implementação central

- `fitness.js` grava atividades de corrida, ciclismo, jiu-jitsu, força ou modalidade personalizada, com duração, data, distância opcional e métrica complementar.
- `analytics.js` agrega tarefas, sessões, foco, hábitos, atividades, objetivos e projetos no período selecionado. Compara tarefas e minutos de foco/estudo com o período imediatamente anterior, inclui atrasos atuais e mostra distribuições reais por disciplina/modalidade. Os gráficos SVG inline não fazem chamadas de rede; essa escolha mantém o funcionamento offline e evita uma dependência de runtime adicional. Não foram inventados pontos para dias sem registros.
- `knowledge-graph.js` constrói relações a partir dos IDs de `notes.links` e da sintaxe `[[título]]`; oferece filtro por pasta/etiqueta, seleção com teclado, destaque de vizinhos, controles de zoom/deslocamento e lista alternativa. O desenho limita-se a 80 nós e usa SVG nativo; D3 fica reservado para uma necessidade futura de layout de força com grafos maiores.
- `dom.js` foi adicionado manualmente para centralizar seletores DOM e passou a ser importado pelos módulos; foi incluído no pré-cache do service worker. O cache subiu para `lifeos-shell-v5` e o shell inclui os três módulos novos.
- Os imports podem ser carregados pelo runtime Node, mas CRUD de interface, IndexedDB real, atualização offline e adaptação visual ainda não foram validados no navegador. A Fase 4 não está aprovada até essa validação.

### Fase 5 — personalização avançada

- `customization.js` configura seis widgets do painel (visibilidade, ordenação por setas e arrastar/soltar), categorias próprias por módulo e preferências iniciais de Tarefas, Estatísticas, Atividades físicas e Mapa de conhecimento.
- As opções são registros cifrados na coleção `settings`: `dashboardLayout`, `customCategories` e `modulePreferences`. As categorias atuam como sugestões nos formulários; categorias já atribuídas aos registros são preservadas quando uma sugestão é removida.
- Preferências de aparência agora incluem três densidades (ampla, confortável e compacta) e superfície de painel padrão/suave, aplicadas por tokens CSS.
- O service worker avança para `lifeos-shell-v6` e inclui o novo módulo. Persistência no cofre real, reabertura após bloqueio, interação por toque e layouts responsivos da Fase 5 ainda requerem validação integrada.
- A barra lateral usa a altura da viewport (`100dvh`, com fallback), com rolagem apenas na navegação. Em telas móveis, botão X, overlay e Escape fecham o painel, restauram o foco no acionador e mantêm a rota atual; o service worker passa para `lifeos-shell-v7` para distribuir a correção.

### Acessibilidade transversal

- `accessibility.js` reúne escala de texto (90–200%), contraste reforçado, movimento reduzido e interface simplificada. As opções são persistidas no registro cifrado `settings/appearance`, reaproveitando as preferências existentes.
- O fator de escala altera fontes tipográficas em pixels e dimensões das principais áreas de toque; o modo simplificado remove elementos decorativos, preservando rótulos e dados.
- A aplicação oferece link para pular ao conteúdo principal, foco visível, foco transferido ao conteúdo em mudanças de rota e navegação da sidebar por teclado. A região completa da página não é anunciada como live region para evitar anúncios repetitivos; o status da página usa `role=status`.
- O service worker passa para `lifeos-shell-v8` e pré-carrega o centro. Os critérios WCAG 2.2 AA ainda não foram declarados atendidos: faltam verificações abrangentes por módulo, leitor de tela e reflow em 200%.

### Validação realizada nas Fases 1 e 2

- **8 testes unitários passaram**: cifra/decifra autenticadas; separação de chaves por salt; rejeição de ciphertext/contexto alterado; normalização das preferências; datas locais; recorrência diária/semanal/mensal; ocorrência de eventos; frequência de hábitos e identificação de tarefas atrasadas.
- **17 recursos responderam HTTP 200** em servidor estático local e os dez módulos JavaScript passaram pela verificação de sintaxe; os cinco módulos da Fase 2 também foram importados pelo runtime Node para validar dependências.
- Na validação visual anterior, a tela inicial abriu em navegador de desktop e exibiu o fluxo de criação do cofre sem erros de console.
- **Ainda não verificado manualmente**: CRUD dos cinco módulos depois de desbloquear, persistência após recarga, recarga offline e instalação em Android/iOS. Esses fluxos devem ser exercitados no LifeOS com uma senha escolhida pela pessoa antes de considerar a fase validada em todas as plataformas.
