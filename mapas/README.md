# Mapas de Território

Editor de cartões de território: escolha a base do mapa, desenhe ruas, áreas e referências por cima e exporte o cartão para imprimir ou compartilhar. Funciona no computador e no celular, sem servidor e sem conta.

## Como usar

1. Abra `index.html` (ou a página publicada no GitHub Pages).
2. Use **Criar pelo mapa**, o jeito mais rápido (veja abaixo). Também é possível começar do jeito manual:
   - **Imagem do mapa**: procure o endereço e capture a região do OpenStreetMap como imagem de fundo (precisa de internet);
   - **Usar um print**: imagem do Google Maps, foto ou captura de tela. Também dá para **colar com Ctrl+V** ou **arrastar o arquivo** para a tela;
   - **Em branco**: desenhar sem mapa de fundo.
3. Desenhe com as ferramentas e exporte pelo botão **Exportar**.

O mapa é salvo automaticamente neste navegador. Em **Meus mapas** (ícone de pasta) ficam todos os mapas, com miniatura.

## Criar pelo mapa

1. Busque o endereço (ou use a sua localização) e aproxime o mapa até aparecerem os contornos das quadras.
2. **Toque nas quadras do território**, na ordem em que quer numerá-las. Tocar numa quadra marcada desmarca. **Contornar** marca de uma vez todas as quadras dentro de uma linha desenhada à mão; onde não há quadras mapeadas, o contorno vira a própria área do território.
3. Dê um nome, escolha o formato e a orientação (**Norte para cima** ou **Girar para caber melhor**) e toque em **Criar cartão**.

O cartão é montado num mapa novo, com:

- as quadras do território coloridas e numeradas;
- as ruas desenhadas com os nomes, priorizando as que cercam o território e sem sobrepor números ou outros nomes;
- referências próximas (igrejas, escolas, saúde, mercados, praças, órgãos públicos), afastadas um pouco quando cobririam um número;
- prédios, praças, água e trilhos no fundo, e a seta do Norte.

Tudo vira itens normais do editor: dá para renomear, apagar, mover, mudar cores ou desenhar mais. As quadras são calculadas a partir da malha de ruas do OpenStreetMap (via tiles vetoriais da OpenFreeMap, sem chave de acesso). Se uma quadra não aparece, é porque falta alguma rua no mapa; nesse caso, use **Contornar**.

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

## Mapa geral

Em **Meus mapas › Mapa geral** (ou na aba **Mapa**) aparecem todos os territórios num mapa só, cada um com sua cor e seu nome, para ver o panorama da região:

- toque num território (no mapa ou na lista) para ver a miniatura e abrir o cartão;
- aproximando bem, aparecem os números das quadras;
- quadras que estão em mais de um cartão são avisadas, com atalho para ver onde;
- **Baixar imagem** e **Imprimir** geram o mapa grande com todos os territórios.

Entram no Mapa geral os cartões feitos com **Criar pelo mapa** e os que usam **Imagem do mapa** (capturada a partir desta versão). Mapas feitos com print ou em branco aparecem em "Sem localização". O Mapa geral mostra os mapas salvos neste navegador; para juntar os de outra pessoa, importe os backups `.json` dela.

## Ajustes em grupo

Na aba **Mapa**:

- **Ruas**: − e + mudam largura, contorno e tamanho dos nomes de todas as ruas de uma vez, mantendo avenidas mais largas que ruas; as cores (ruas, contorno, nomes) deixam todas iguais.
- **Por tipo**: avenidas, ruas principais, ruas, vielas e as desenhadas à mão têm cor, largura e tamanho do nome próprios. **Usar como padrão nos próximos cartões** guarda esses estilos para os cartões criados pelo mapa daqui em diante (**Voltar ao padrão original** desfaz).
- **Quadras**: **Numerar tocando** (toque nas quadras na nova ordem; as não tocadas seguem depois) e **Fechar buracos** (1, 2, 4, 5 vira 1, 2, 3, 4), além do tamanho dos números e das cores.

**Nome da rua fora do lugar?** Arraste o nome no mapa: ele desliza ao longo da própria rua. Com a rua selecionada, **Voltar o nome ao lugar automático** desfaz. Quando falta espaço, o nome é abreviado (Av., R., Al., Dr., Prof.…), e as ruas que cercam o território sempre mostram o nome.

Com uma rua selecionada, **Copiar o estilo desta rua** aplica cores, largura, contorno e nome às ruas da mesma cor ou a todas. Cada ajuste em grupo é desfeito com um único Ctrl+Z.

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
    mvt.js      leitor de tiles vetoriais (Mapbox Vector Tile), sem dependências
    vectormap.js  ruas, nomes, quadras (faces da malha de ruas), referências e fundo
    territory.js  janela "Criar pelo mapa" e montagem do cartão
    overview.js   Mapa geral com todos os territórios
    editor.js   ferramentas, gestos (mouse, toque, caneta) e teclado
    app.js      inicialização, salvamento automático e exportação
```

Não há etapa de build: são scripts clássicos, para que o editor abra até com dois cliques no `index.html`. Os mapas usam dados © colaboradores do OpenStreetMap (e, no "Criar pelo mapa", tiles da OpenFreeMap/OpenMapTiles). A atribuição é incluída automaticamente na imagem exportada.
