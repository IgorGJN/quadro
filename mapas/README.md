# Editor Offline de Territórios

Editor simples para criar mapas de territórios sobre uma imagem/print do mapa.

## Como usar

1. Descompacte o `.zip`.
2. Abra `index.html` no navegador.
3. Clique em **Mapa** e escolha a imagem/print.
4. Use as ferramentas:
   - **Rua**: toque ponto por ponto e clique em **Concluir rua**.
   - **Nome/Nº**: insere textos, nomes de ruas e números separados da rua.
   - **Ponto**: adiciona referências.
   - **Área**: cria áreas/polígonos, inclusive formas côncavas.
   - **Foco**: deixa o interior limpo e aplica máscara na parte de fora.
   - **Norte**: adiciona bússola.
   - **Legenda**: cria legenda editável em múltiplas linhas.

## Melhorias incluídas

- Projeto separado em arquivos.
- Rua sem nome automático.
- Largura real da rua.
- Borda/contorno da rua.
- Pontas e junções arredondadas.
- Opção de suavizar curvas.
- Encaixe automático entre ruas e áreas.
- Área/polígono com formato livre/côncavo.
- Foco invertido com máscara externa.
- Texto com rotação.
- Legenda editável por múltiplas linhas.
- Painel contextual: mostra só campos relevantes ao item selecionado.
- Salvar e abrir projetos no localStorage.
- Exportar JSON.
- Importar JSON.
- Exportar PNG.
- Desfazer/refazer.
- Duplicar camada.
- Trazer para frente/enviar para trás.
- Interface responsiva para celular.

## Observações

- O salvamento local fica no navegador/dispositivo usado.
- O `localStorage` tem limite. Se a imagem for muito grande, use **Baixar JSON** como backup.
- Para enviar um mapa para outra pessoa, use **Baixar JSON** e envie o arquivo.
- Para imprimir ou compartilhar a imagem final, use **Exportar PNG**.
