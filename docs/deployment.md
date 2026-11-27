# LifeOS 1.0 — publicação e manutenção

## Estado

O código está preparado como **1.0.0 release candidate**. Não está publicado: falta escolher um host/domínio e executar os testes de instalação nos dispositivos e navegadores alvo. Não use a instância com dados pessoais para testes de release.

## Requisitos do host

- Servir o diretório do projeto como site estático pela raiz, sem reescritas que removam os caminhos `src/` e `public/`.
- Exigir HTTPS em produção (Service Worker e Web Crypto dependem de contexto seguro; `localhost` é exceção para desenvolvimento).
- Entregar `.webmanifest` com `Content-Type: application/manifest+json`, JavaScript como `text/javascript`, e SVG como `image/svg+xml`.
- Não armazenar em cache o `index.html` e `service-worker.js` no CDN; os próprios service worker e cache versionado controlam a atualização. Arquivos sem versão podem usar revalidação. Não cachear rotas contendo respostas privadas.
- Se habilitar CSP, permitir scripts apenas da própria origem; o CSS atual usa atributos `style` para cores dinâmicas, então a política de estilos precisa contemplar isso ou a aplicação deve migrar esses estilos para classes/tokens antes de uma política estrita.
- Habilitar `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `frame-ancestors 'none'` quando compatível com o host.

## Publicação

1. Executar `node --test tests/*.test.mjs` e conferir todos os testes aprovados.
2. Servir o diretório raiz em uma origem HTTPS de teste. Confirmar que manifesto, ícones, módulos e CSS retornam com status 200 e tipos MIME corretos.
3. Instalar e validar em Android/Chrome, iOS/Safari e desktop (Chromium e ao menos um navegador alternativo): criação/desbloqueio de cofre, backup/restauração, atualização e layout responsivo. Usar perfil limpo e dados fictícios.
4. Com o app carregado e cacheado, desligar a rede; recarregar, navegar e fazer CRUD. Reconectar, publicar uma versão de cache nova e validar a oferta de atualização sem perda de dados.
5. Configurar HTTPS, domínio, cabeçalhos, cache e redirecionamento HTTP→HTTPS no host escolhido. Abrir a origem final e repetir os fluxos essenciais antes de anunciar a versão.

## Manutenção e recuperação

- Incrementar `CACHE_NAME` em `service-worker.js` ao mudar os arquivos do shell e testar atualização com uma cópia de dados fictícios.
- A migração IndexedDB deve ser aditiva e conservar os dados. Nunca limpar o banco como correção automática.
- Orientar usuários a manter cópias do arquivo de backup e da senha de backup em locais separados e seguros. O LifeOS não tem sincronização nem recuperação de senha.
- Registrar versão, data e mudanças do schema em notas de versão; manter procedimento de retorno de arquivos estáticos à versão anterior sem reverter migrações destrutivas.
- Não coletar conteúdo, credenciais ou arquivos de backup em logs do host.

## Itens de lançamento ainda pendentes

- Escolha de host/domínio e configuração HTTPS real.
- Testes de instalação e update em Android, iOS e desktop real.
- Recarga offline e operações IndexedDB sem conexão em navegadores alvo.
- Verificação de ícones e comportamento instalável em Safari/iOS e Chromium/Android.
- Validação da política final de cabeçalhos no host escolhido.
