# Painel de Sites

Painel visual que monitora seus sites sozinho: Pixel da Meta, players VTurb, outros pixels (GTM, GA4, Google Ads, TikTok, Kwai, Pinterest, Snap, Taboola, Clarity, Hotjar, Utmify, TrackHunter, LinkedIn, X, Microsoft Ads, Reddit, Outbrain, RedTrack, ClickMagick, Hyros, Stape), a lista de **todos os scripts externos** da página, links de checkout, status do site e métricas de carregamento (PageSpeed).

Tema claro, escuro ou automático pelo botão ◐ no topo (cada pessoa escolhe o seu).

## Como funciona

- **A cada 30 min** a Vercel relê o HTML de todos os sites e compara com a verificação anterior. Se um pixel, player, link de checkout ou título mudar, aparece em **Mudanças recentes** e no histórico do site.
- **De hora em hora** mede o desempenho (PageSpeed mobile e desktop) dos sites que não foram medidos nas últimas 24h.
- Ao cadastrar um site você pode informar os **pixels e players esperados**. Se algum sumir ou aparecer outro no lugar, o card fica vermelho/amarelo.
- Qualquer pessoa com acesso pode clicar em **Verificar agora** / **Medir desempenho**. Só administradores cadastram, editam e excluem.
- A busca encontra sites por ID de pixel — útil para saber "em quais sites está o pixel X".

## Deploy na Vercel (uns 10 minutos)

1. **Suba a pasta para um repositório no GitHub** e, na Vercel, clique em *Add New → Project* e importe o repositório. Framework: **Other**. Não precisa de comando de build.
2. **Banco de dados:** no projeto, abra **Storage → Create Database → Upstash (Redis)**, escolha o plano gratuito e conecte ao projeto. As variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` são criadas automaticamente.
3. **Variáveis de ambiente** (*Settings → Environment Variables*):

   | Variável | Obrigatória | Para que serve |
   |---|---|---|
   | `ADMIN_PASSWORD` | sim | Senha para cadastrar/editar/excluir sites |
   | `CRON_SECRET` | sim | Qualquer texto longo e aleatório; protege as verificações automáticas |
   | `VIEWER_PASSWORD` | não | Se definida, o painel pede senha até para visualizar. Sem ela, quem tiver o link vê o painel (sem poder editar) |
   | `PSI_API_KEY` | recomendada | Chave gratuita do Google para o PageSpeed. Sem ela o Google limita as medições e várias podem falhar |
   | `PSI_INTERVAL_HOURS` | não | De quantas em quantas horas medir o desempenho (padrão 24) |

   Para gerar a `PSI_API_KEY`: no [Google Cloud Console](https://console.cloud.google.com/), crie um projeto, ative a **PageSpeed Insights API** e crie uma **chave de API** em *APIs e serviços → Credenciais*.
4. **Faça um novo deploy** (*Deployments → Redeploy*) para as variáveis valerem.
5. Abra o site, clique em **Entrar como admin**, digite a `ADMIN_PASSWORD` e cadastre os sites (um por um ou em **Adicionar vários**).

Os agendamentos aparecem em *Settings → Cron Jobs* no projeto.

## Limites que vale saber

- **Pixels carregados pelo GTM** não aparecem no HTML da página, então o painel não consegue lê-los. Nesse caso ele avisa "pode estar dentro do GTM" — cadastre o ID nas informações extras se quiser deixá-lo visível.
- **Sites com cloaker ou proteção anti-bot** podem mostrar uma página diferente para o verificador (ou bloquear com 403). Se acontecer, cadastre a URL com os parâmetros que liberam a página real (ex.: `?utm_source=facebook`) ou troque "Verificar como" entre celular e computador.
- O PageSpeed mede a página como o Google a vê; a nota pode variar alguns pontos entre medições.

## Estrutura

```
public/index.html        o painel (HTML + CSS + JS, sem build)
api/sites.js             listar / cadastrar
api/sites/[id].js        ver / editar / excluir
api/scan.js              "Verificar agora" e "Medir desempenho"
api/cron/scan.js         verificação automática do HTML (30 min)
api/cron/pagespeed.js    medição automática de desempenho (1 h)
lib/scanner.js           detecção de pixels, VTurb, checkouts e plataforma — adicione padrões novos aqui
lib/pagespeed.js         integração com o PageSpeed Insights
```

Para detectar um rastreador novo, adicione um item em `TRACKERS` no `lib/scanner.js` e o rótulo/cor correspondente em `TM` no `public/index.html`.
