# LifeOS

LifeOS é um sistema pessoal de organização, planejado como uma aplicação web progressiva (PWA), responsiva e local-first. A Fase 1 estabelece a fundação navegável, as preferências visuais e o cofre local criptografado.

## Objetivo e escopo

O produto reunirá tarefas, estudos, projetos, hábitos, notas, objetivos, atividades físicas, calendário e foco. Deve funcionar sem conta ou serviço remoto, guardar os dados no dispositivo e oferecer exportação/importação para transferência manual entre dispositivos. Os módulos serão entregues em etapas, começando pela fundação e rotina pessoal.

## Decisões iniciais

- Frontend: HTML semântico, CSS e JavaScript moderno com ES Modules, sem framework de interface na primeira versão.
- Persistência: IndexedDB encapsulado por uma camada de repositórios. Na fundação, a criptografia usa Web Crypto nativa (PBKDF2-SHA-256 + AES-256-GCM), sem dependência adicional.
- PWA: manifesto e service worker com cache dos recursos versionados da aplicação. Dados pessoais ficam no IndexedDB e não no cache HTTP.
- Gráficos: Chart.js quando os módulos de acompanhamento forem implementados; avaliar D3 apenas para o grafo de conhecimento.
- Privacidade: sem contas, sincronização, telemetria ou chamadas de IA por padrão.
- Distribuição: arquivos estáticos compatíveis com hospedagem HTTPS. A execução local de desenvolvimento deve usar um servidor estático simples, pois módulos ES e service workers não funcionam corretamente em `file://`.

As decisões detalhadas, o esquema do banco, os riscos e os critérios de teste estão em [docs/architecture.md](docs/architecture.md).

## Desenvolvimento (planejado)

Para desenvolver e executar a aplicação localmente:

1. Instale Node.js 20 ou superior; não há dependências npm de terceiros.
2. A partir desta pasta, execute `npm run dev`.
3. Abra a URL local indicada (localhost) para validar o service worker e a instalação PWA.
4. Execute `npm test` para os testes unitários.

O servidor serve os próprios arquivos estáticos e é apenas uma conveniência de desenvolvimento; não é necessário em produção. Hospede esta pasta em HTTPS. Consulte o provedor escolhido sobre configuração do caminho-base e cabeçalhos de cache.

## Dados e backups

Os registros são armazenados criptografados no navegador e dispositivo atuais. A senha não é armazenada e a chave de criptografia existe somente enquanto o cofre está desbloqueado. Perder a senha significa perder o acesso aos dados. Limpar os dados do navegador pode apagá-los; instalar a PWA não cria backup e outro navegador ou dispositivo terá um banco separado. A exportação/importação validada está prevista para a Fase 6.

## Plano de implementação

1. Fase 0: arquitetura, convenções, modelo inicial, documentação e plano de testes.
2. Fase 1: navegação, sistema visual, temas, responsividade, persistência e fundação PWA.
3. Fase 2: Dashboard, tarefas, calendário, hábitos e objetivos.
4. Fase 3: estudos, projetos, notas e foco.
5. Fase 4: atividades físicas, estatísticas e grafo de conhecimento.
6. Fase 5: personalização avançada.
7. Fase 6: backups, validação, migrações e robustez.
8. Fase 7: otimização, testes de instalação/offline e publicação.
9. Fase 8: avaliação de integrações futuras, incluindo IA com autorização explícita.

## Estado atual

Fases 1 e 2 implementadas: cofre IndexedDB criptografado, preferências visuais, Dashboard, Tarefas, Calendário, Hábitos e Objetivos. A Fase 3 agora inclui Central de Estudos, Projetos, Anotações e Modo Foco. Consulte [docs/architecture.md](docs/architecture.md) para as decisões e [docs/audit-fases-1-2.md](docs/audit-fases-1-2.md) para limites da auditoria anterior. Os novos módulos precisam de validação ponta a ponta em navegador antes de serem considerados aprovados.
