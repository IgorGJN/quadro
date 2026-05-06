# Editor Offline de Territórios

Editor offline para criar mapas de territórios sobre uma imagem/print do mapa. Não usa servidor, API de mapa ou internet depois de aberto.

## Como abrir

1. Descompacte o arquivo `.zip`.
2. Abra `index.html` no navegador.
3. Clique em **Mapa** para carregar o print/imagem base.
4. Use **Salvar local** para guardar no navegador ou **Baixar JSON** para criar uma cópia de segurança.

## Ferramentas

### Selecionar
- Seleciona e move itens.
- Em ruas/áreas, os pontos aparecem como nós.
- Arrastar área vazia move o mapa.

### Editar pts
- Selecione uma rua ou área.
- Toque/arraste um nó para mover aquele ponto.
- Toque em um segmento para inserir um novo ponto no meio da rua/área.
- Use **Remover ponto** para apagar o ponto selecionado.
- Use **Dividir rua** em um ponto intermediário para cortar uma rua em duas.

### Conectar
- Toque em um nó de uma rua.
- Toque em outro nó.
- Os dois passam a ser uma junção real compartilhada.
- Nós verdes indicam conexão real entre duas ou mais ruas/áreas.
- O número acima do nó mostra quantos pontos estão conectados ali.

### Rua
- Toque ponto por ponto.
- Use **Concluir rua** ou dê duplo clique para finalizar.
- Se tocar perto de um nó, a rua encaixa nele.
- Se tocar perto de um segmento de rua existente, o editor cria um nó naquele segmento e conecta nele.

### Área
- Cria polígonos e territórios côncavos/irregulares.
- Também encaixa em nós e segmentos próximos.

### Foco
- Cria máscara externa: a área interna fica limpa e o lado de fora fica esbranquiçado.
- Pode ser retangular ou circular/oval.
- Use **Centralizar foco** para aproximar o mapa da área marcada.

### Nome/Nº
- Insere nomes de ruas, números e observações como texto separado da rua.
- Permite rotação, tamanho, cor e borda.

### Ponto
- Insere referência com ícone e texto.

### Norte
- Insere bússola com rotação e tamanho.

### Legenda
- Insere uma legenda editável.
- Selecione a legenda e edite o texto no painel. Cada linha vira uma linha da legenda.

## Melhorias principais desta versão

- Projeto separado em arquivos.
- Modelo de junção com nós reais compartilhados.
- Nós visíveis e contagem de conexões.
- Ferramenta manual **Conectar**.
- Encaixe em nós e segmentos de ruas/áreas existentes.
- Comando **Criar interseções** para transformar cruzamentos visuais em nós reais.
- Edição de pontos: mover, inserir, remover e dividir rua.
- Ruas com largura real, borda, pontas arredondadas e suavização.
- Áreas/polígonos côncavos.
- Foco invertido com máscara externa e opção retangular/circular.
- Texto/número com rotação.
- Legenda editável em múltiplas linhas.
- Painel contextual por tipo de item.
- Camadas agrupadas por tipo, com mostrar/ocultar e bloquear/desbloquear.
- Salvamento local, JSON, PNG, autosave e versões.
- Desfazer/refazer.

## Arquivos

```text
editor-territorios/
  index.html
  styles.css
  js/
    utils.js
    state.js
    drawing.js
    storage.js
    exporter.js
    ui.js
    app.js
  README.md
```

## Observações

- O salvamento local fica no navegador/dispositivo usado.
- O `localStorage` tem limite. Imagens muito grandes podem impedir salvar localmente.
- Para backup, use **Baixar JSON**.
- Para compartilhar o mapa final, use **Exportar PNG**.


## Ajuste visual de junção de ruas

As ruas agora são renderizadas em duas passadas: primeiro todas as bordas e depois todos os miolos. Isso evita que a borda de uma rua corte visualmente outra rua conectada. Em nós compartilhados, o editor também aplica um acabamento circular para fechar pequenas falhas nas junções.

## Correção v2.1

Esta versão corrige a incompatibilidade entre `index.html`, `app.js` e `ui.js` que podia gerar erros como:

- `Cannot read properties of null (reading 'addEventListener')`
- `Cannot set properties of null (setting 'checked')`

Foram adicionados ao `index.html` os controles usados pelo JavaScript:

- Editar nós
- Conectar
- Mostrar nós de conexão
- Mostrar número de conexões
- Criar interseções reais
- Remover ponto
- Dividir rua
- Visibilidade/bloqueio de camada
- Formato do foco
- Versões salvas
