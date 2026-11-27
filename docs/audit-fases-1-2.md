# Auditoria LifeOS — Fases 1 e 2

**Data:** 24/11/2026  
**Escopo:** validação antes de qualquer nova fase. Nenhum dado do cofre pessoal foi usado nos testes.

## Conclusão

A auditoria encontrou evidências úteis de funcionamento da camada criptográfica, do repositório e de regras de domínio em testes isolados. Ela **não aprova integralmente** as Fases 1 e 2: não foi feita validação de ponta a ponta em navegador com IndexedDB real, reinício do aplicativo, bloqueio/desbloqueio usando o armazenamento real nem execução offline. A Fase 3 permanece suspensa até esses passos.

## Testes executados e resultados individuais

| Teste | Resultado | Evidência e limite |
|---|---|---|
| Criptografar/descriptografar com AES-GCM e AAD | Aprovado em teste unitário | O texto volta corretamente com a chave e AAD esperadas; ciphertext difere do texto original. Não é teste de navegador/IndexedDB real. |
| Derivar com salts diferentes | Aprovado em teste unitário | Chaves derivadas não autenticam o mesmo registro. |
| Alterar ciphertext ou AAD | Aprovado em teste unitário e no repositório simulado | A autenticação falha; conteúdo não é devolvido. |
| Preferências fora dos limites | Aprovado em teste unitário | Valores inválidos retornam a padrões seguros; limites de escala e raio são aplicados. |
| Datas, recorrência, vencimento e frequência de hábitos | Aprovado em teste unitário | Quatro verificações de regras locais, inclusive fim de mês e mudança de ano. |
| Salvar, ler, atualizar, listar e excluir; ID ausente e coleção incompatível | Aprovado com IndexedDB simulado | Verifica o contrato do `Vault`, mas não substitui uma execução no IndexedDB do navegador. |
| Persistência durante lock/unlock e senha incorreta | Aprovado com IndexedDB simulado | O registro foi lido após novo desbloqueio; senha errada não alterou o registro. |
| Falha de gravação simulada (QuotaExceeded) | Aprovado com IndexedDB simulado | A promessa falha e o envelope antigo continua intacto. |
| Duas criações concorrentes | Aprovado com IndexedDB simulado | Só uma configuração inicial vence; `add()` impede sobrescrita concorrente. |
| CRUD completo na interface de tarefas, eventos, hábitos, registros e objetivos | Não verificado | Não houve interação real com a interface. O teste de repositório usa uma coleção de exemplo; não comprova o CRUD de cada módulo. |
| Fechar e reabrir o aplicativo com dados reais do IndexedDB | Não verificado | Não foi executado no navegador. |
| Bloquear e desbloquear com IndexedDB real | Não verificado | Só coberto pelo repositório simulado. |
| Operações inválidas e falhas em todos os formulários/fluxos de interface | Parcial | Validação e falha de gravação foram simuladas na camada de dados. Não foi exercitado cada formulário nem falha física do navegador/quota. |
| Recarregar offline, navegar e gravar sem conexão | Não verificado | Revisão estática do service worker apenas. |
| Atualização de versão instalada e compatibilidade entre navegadores | Não verificado | Revisão estática apenas; não há matriz de dispositivos/navegadores executada. |

A suíte de unidade registrou **13 aprovações** em execução isolada anterior (4 criptografia/preferências, 4 regras de datas/domínio e 5 de armazenamento simulado). A repetição durante esta revisão excedeu o limite de tempo do executor e não gerou uma segunda confirmação; por isso, os números acima são apresentados como resultado daquela execução, não como nova execução concluída.

| Verificação adicional | Resultado | Evidência e limite |
|---|---|---|
| Revisão estática do manifesto/cache | Aprovada | Manifesto foi analisado como JSON; os 15 arquivos do shell pré-carregados existem (mais `./` resolve ao HTML inicial) e os dois SVGs correspondem às dimensões declaradas. Imports dos módulos sem dependência do DOM foram carregados no Node. Isso não verifica instalação ou cache real no navegador. |
| Abrir a aplicação no navegador | Parcial | A tela inicial abriu em `localhost:4174`, origem separada da instância pessoal. A validação parou na criação do cofre para não inserir uma nova credencial local sem o usuário assumir esse passo; nenhum registro de teste foi gravado nessa sessão. |

## Problemas encontrados e correções

- A API de criação do cofre agora exige senha de pelo menos 10 caracteres, além da validação da interface.
- A criação do registro de configuração usa `add()` transacional, evitando que duas abas sobrescrevam uma configuração concorrente.
- `Vault.save()` rejeita coleção/ID vazios e valores que não possam ser serializados em JSON.
- O desbloqueio valida versão, algoritmo, faixa de iterações e tamanho do salt antes de derivar a chave; configurações desconhecidas preservam os dados.
- A exclusão em lote verifica a coleção e é executada em uma transação.
- A interface agora comunica falhas de gravação em ações rápidas; preferências são revertidas na tela quando não puderem ser persistidas.
- O service worker usa cache `lifeos-shell-v3`; a aplicação detecta uma atualização já aguardando e oferece atualização explícita.

## Auditoria de criptografia

- **KDF:** PBKDF2 com HMAC-SHA-256, salt aleatório de 16 bytes, 310.000 iterações na criação atual. A leitura aceita parâmetros versionados de 310.000 a 2.000.000; abaixo/fora dessa faixa ou schema desconhecido, o cofre não desbloqueia.
- **Cifra:** AES-256-GCM via Web Crypto, chave não extraível em memória, IV aleatório de 12 bytes por cifragem e tag de autenticação de 128 bits.
- **AAD:** `lifeos:v1:${collection}:${id}` liga o ciphertext ao ID e à coleção. Mover registro ou alterar esses metadados impede a autenticação.
- **IndexedDB:** conteúdo serializado de tarefas, eventos, hábitos, registros, objetivos e preferências é cifrado antes da gravação. O envelope contém `id`, `collection`, `iv` e `ciphertext`; metadados contêm schema/KDF/iterações/salt e um verificador cifrado.
- **Teste de ausência de texto puro:** foi verificado com payload canário que o envelope retornado pelo repositório não contém o texto original. Não foi feita varredura do IndexedDB real, de snapshots de disco, caches do navegador ou memória do processo.
- **Metadados expostos:** nomes das coleções e IDs ficam em claro (IDs da aplicação são identificadores aleatórios, exceto a chave fixa `settings/appearance`). Tamanho do ciphertext também pode revelar aproximadamente o tamanho do conteúdo.
- **Senha e memória:** senha não é armazenada; a chave é descartada da referência da aplicação ao bloquear. JavaScript/Web Crypto não garantem apagamento físico imediato de cópias temporárias na memória.
- **Limitações:** perda da senha significa perda prática do acesso; sem backup, não há recuperação. XSS ou extensão maliciosa executando na origem enquanto o cofre está aberto pode ler dados já descriptografados. `file://` não é contexto seguro suficiente para Web Crypto/service worker; usar localhost ou HTTPS.

## Auditoria PWA

- O manifesto define nome, idioma, `start_url`, escopo, `standalone`, cores e ícones SVG declarados como 192×192 e 512×512.
- O service worker pré-carrega o shell (HTML, CSS, módulos e ícones), remove caches antigos da família `lifeos-shell-*`, serve cache primeiro e usa `index.html` como fallback para navegação offline. Não armazena conteúdo do cofre no Cache Storage por desenho do código.
- Atualização aguarda confirmação explícita na interface (`SKIP_WAITING`) e a página recarrega quando o novo worker assume o controle.
- **Limite de compatibilidade:** membros do manifesto e instalação PWA variam por navegador/SO; SVG escalável é documentado, mas suporte de instalação/ícones não é uniforme em todos os clientes. A declaração `maskable` está no SVG de 512. Recomenda-se acrescentar PNG raster como fallback após definir a matriz de navegadores. [Referência MDN sobre ícones do manifesto](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons) e [instalabilidade de PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
- **Não demonstrado:** instalação, funcionamento sem rede após primeira instalação, quota/evicção de cache, ciclo de atualização e navegadores Safari/iOS, Firefox/Android e Chromium/desktop.

## Personalização

**Implementada no código:** tema automático/claro/escuro; cinco cores predefinidas e seletor livre; quatro famílias tipográficas; densidade confortável/compacta; escala de texto 90–125%; raio de cantos 8–24 px; contraste reforçado; redução de movimento; prévia visual. Preferências são gravadas cifradas em `settings/appearance` e normalizadas após leitura.

**Pendente:** teste de persistência após reinício real; contraste calculado/garantia de acessibilidade para toda cor personalizada; cobertura visual em dispositivos e navegadores; editor visual avançado (explicitamente fora de escopo nesta auditoria).

## Problemas ainda existentes

- Exclusão de objetivo desvincula tarefas em gravações sequenciais e depois remove o objetivo; uma falha intermediária pode deixar apenas parte das tarefas desvinculada. Necessita operação atômica conjunta e teste de falha.
- Os testes usam IndexedDB simulado. Sem integração em navegador, ainda há risco de diferenças em transações, eventos, quota e ciclo de vida.
- Falhas de persistência em controles rápidos agora são exibidas, porém o fluxo de UI não foi exercitado após a correção.
- CRUD integral de cada entidade, reinício real, recarga offline e atualização PWA continuam sem validação observacional.

## Funcionalidades comprovadamente operacionais

Apenas no nível coberto por testes isolados: cifragem/autenticação, rejeição de ciphertext/AAD incorretos, operações de repositório simuladas, preservação após lock/unlock simulado, rejeição de senha incorreta, recusa de uma escrita simulada sem substituir o envelope anterior, prevenção da corrida de configuração e regras básicas de datas/recorrência. Isso não equivale à aprovação funcional da aplicação ponta a ponta.

## Formato e implementação de backup da Fase 6

1. Implementado o arquivo versionado `application/vnd.lifeos.backup+json`, com `{format, version, createdAt, kdf, iterations, salt, cipher, iv, ciphertext}`. Usa chave de backup independente via PBKDF2-SHA-256 (310.000 iterações, salt novo de 16 bytes), AES-256-GCM (IV de 12 bytes, tag de 128 bits) e AAD `lifeos-backup:v1`. A senha não é incluída no arquivo.
2. O snapshot lógico tem schema 1, coleção e ID por registro. A importação valida tamanho máximo de 50 MB, contagem máxima de 100.000 registros, cabeçalho/versão, faixa KDF, Base64 canônico, tamanhos de salt/IV, ciphertext mínimo, autenticação GCM e IDs repetidos antes de aceitar os dados.
3. A restauração substitui o conteúdo atual depois de validação completa e confirmação explícita. Os registros são cifrados com a chave do cofre já desbloqueado e então substituídos em uma transação atômica `clear + put`; falha de quota aborta a transação e conserva o conjunto anterior. Não há mesclagem implícita. Essa operação é coberta por IndexedDB simulado; a atomicidade precisa de confirmação adicional em navegador real.
4. Testes automatizados cobrem senha errada, ciphertext adulterado, JSON inválido, versão incompatível, IV inválido, excesso de tamanho, IDs duplicados e rollback simulado após falha de quota. A aplicação processa arquivos localmente e não os envia à rede. Truncamento e varredura/recuperação em browser real permanecem por verificar.

As opções de armazenamento mostram estimativa/quota quando o navegador oferece, persistência disponível/concedida e contagem por coleção. “Validar dados locais” autentica e analisa o JSON de cada envelope sem exibir conteúdo. A migração do banco IndexedDB é aditiva para versão 2 e não altera os metadados criptográficos schema 1 do cofre. Atualizações de IndexedDB reais e comportamento de quota de cada navegador continuam pendentes de teste em perfil isolado.

## Próximas decisões técnicas necessárias

1. Escolher navegadores/SOs mínimos a suportar e decidir se ícones PNG de fallback são requisito.
2. Implementar e testar operação atômica para excluir objetivo e desvincular tarefas.
3. Executar teste de integração isolado em perfil limpo de navegador: CRUD de cada módulo, reinício, bloqueio/desbloqueio, senha errada, ciphertext alterado e quota/falha controlada, sem dados pessoais.
4. Executar teste PWA após aquecimento do cache: desconectar rede, recarregar, navegar, criar/editar/excluir dados de teste, reconectar e confirmar atualização controlada.
5. Escolher navegadores/SOs mínimos para validar os fluxos da Fase 6 antes de declarar a confiabilidade verificada.

**Decisão desta auditoria:** Fases 1 e 2 ainda não estão integralmente validadas; não iniciar Fase 3 até concluir os testes de integração pendentes.
