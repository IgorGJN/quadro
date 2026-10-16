# Mapas de Território

Editor de cartões de território: escolha a base do mapa, desenhe ruas, áreas e referências por cima e exporte o cartão para imprimir ou compartilhar. Funciona no computador e no celular, sem servidor e sem conta.

## Como usar

1. Abra `index.html` (ou a página publicada no GitHub Pages).
2. Escolha a base do mapa:
   - **Buscar no mapa**: procure o endereço e capture a região do OpenStreetMap (precisa de internet);
   - **Usar um print**: imagem do Google Maps, foto ou captura de tela. Também dá para **colar com Ctrl+V** ou **arrastar o arquivo** para a tela;
   - **Em branco**: desenhar sem mapa de fundo.
3. Desenhe com as ferramentas e exporte pelo botão **Exportar**.

O mapa é salvo automaticamente neste navegador. Em **Meus mapas** (ícone de pasta) ficam todos os mapas, com miniatura.

## Conceitos

- **Cartão**: o retângulo com o rótulo "14 × 5,8 cm" é exatamente o que será exportado e impresso. O zoom do editor não muda a exportação. Use a ferramenta **Cartão** para mover ou redimensionar o retângulo, ou troque o formato (A4, A5, quadrado…) na aba **Mapa**.
- **Junções**: ruas e áreas compartilham pontos reais. Ao desenhar perto de um ponto ou de uma rua, o ponto encaixa. Ao concluir uma rua, os cruzamentos viram junções automaticamente. Para conectar dois pontos, solte um sobre o outro. Pontos verdes são junções.

## Ferramentas

| Ferramenta | Atalho | Como usar |
|---|---|---|
| Selecionar | V | Toque para selecionar e arraste para mover. Em ruas e áreas, arraste os pontos e use os pontos menores do meio para criar curvas. |
| Mover | H ou Espaço | Move o mapa. A roda do mouse ou dois dedos dão zoom. |
| Rua | R | Toque ponto a ponto. Enter, duplo clique ou um toque no último ponto concluem. Shift trava ângulos de 15°; Alt desliga o encaixe. |
| Área | A | Contorna o território. Toque no primeiro ponto para fechar. |
| Texto | T | Nomes, números de casas e observações, com rotação pela alça. |
| Ponto | P | Referências (escola, igreja, comércio, "não visitar"…), com rótulo. |
| Foco | F | Destaca uma região e clareia o restante (retângulo ou oval). |
| Norte | N | Seta do norte com rotação. |
| Legenda | L | Montada automaticamente a partir das áreas, ruas e pontos do mapa, com linhas extras opcionais. |
| Cartão | C | Ajusta a área exportada. |

Outros atalhos: Ctrl+Z / Ctrl+Shift+Z (desfazer/refazer), Delete (excluir item ou ponto), Ctrl+D (duplicar), setas (mover; Shift = 10×), Ctrl+S (salvar versão), 0 (ver o cartão inteiro), ? (lista de atalhos).

## Exportar

- **Imagem PNG** em 2800 px ou em alta resolução;
- **Copiar imagem** para colar no WhatsApp, num documento ou num e-mail;
- **Compartilhar** (no celular);
- **Imprimir no tamanho real** do formato escolhido (ex.: 14 × 5,8 cm);
- **Backup (.json)**: arquivo completo com a imagem, para guardar ou abrir em outro aparelho.

## Salvamento e versões

- Os mapas ficam no IndexedDB do navegador, sem o limite de ~5 MB do `localStorage`.
- Uma **versão** é criada a cada 10 minutos de edição, e você pode salvar versões nomeadas. Restaure pela aba **Mapa**.
- Os mapas salvos pela versão anterior do editor são importados automaticamente na primeira abertura. Arquivos `.json` antigos também abrem normalmente.
- Os dados ficam só neste navegador. Para trocar de aparelho, use o backup `.json`.

## Estrutura

```text
mapas/
  index.html            estrutura da página
  styles.css            visual (tema claro/escuro automático, layout de celular)
  manifest.webmanifest  instalação como app (PWA)
  sw.js                 funcionamento offline quando publicado em https
  icon.svg
  js/
    util.js     utilidades e geometria
    model.js    documento, tipos, histórico (desfazer) e operações com junções
    render.js   desenho do mapa e testes de clique
    storage.js  IndexedDB, versões, backup e migração do formato antigo
    ui.js       ícones, avisos, inspetor, camadas, ajustes e galeria
    osm.js      captura de mapa do OpenStreetMap (carrega o Leaflet sob demanda)
    editor.js   ferramentas, gestos (mouse, toque, caneta) e teclado
    app.js      inicialização, salvamento automático e exportação
```

Não há etapa de build: são scripts clássicos, para que o editor abra até com dois cliques no `index.html`. O mapa do OpenStreetMap usa dados © colaboradores do OpenStreetMap, e a atribuição é incluída automaticamente na imagem exportada.
