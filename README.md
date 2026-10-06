# Créditto · Educação Financeira

Site interativo sobre **crédito fácil, endividamento e cartão de crédito**, feito para uma apresentação escolar (Colégio IP Arujá).

## Como abrir

Abra o `index.html` no navegador. Para os gráficos aparecerem é preciso estar conectado à internet, porque o Chart.js e a fonte Inter são carregados por CDN.
Se preferir rodar com um servidor local:

```bash
python3 -m http.server 8000
# acesse http://localhost:8000
```

## O que tem no site

1. **Login e cadastro**: as contas ficam no `localStorage` e a senha é salva como hash SHA-256. Os campos são validados, há medidor de força da senha e mensagens de erro claras.
2. **Painel**: cards com números que sobem ao carregar, gráfico de linha dos juros do rotativo e gráfico de barras com as principais fontes de dívida.
3. **Parte 1 · Crédito fácil**: o que é e por que é uma armadilha, os 6 tipos mais comuns com taxa e nível de risco, a calculadora **"Quanto custa de verdade?"** (descobre os juros escondidos de uma oferta parcelada) e o comparativo crédito saudável x perigoso.
4. **Parte 2 · Endividamento**: o ciclo do endividamento (interativo), o simulador **bola de neve** (1, 3, 6 e 12 meses), o **termômetro** (quanto da renda vai para parcelas), a lista de **sinais de alerta**, o passo a passo para sair das dívidas e os direitos do consumidor.
5. **Parte 3 · Cartão de crédito**: uma **fatura explicada** parte por parte, o comparador **mínimo x total**, a ferramenta do **melhor dia de compra**, 6 regras de uso e cartões de **mito ou verdade**.
6. **Quiz**: 5 perguntas sorteadas entre 10, com pontuação, barra de progresso, explicação de cada resposta e feedback final. A melhor pontuação fica salva.

## Arquivos

| Arquivo      | Conteúdo                                    |
|--------------|---------------------------------------------|
| `index.html` | Estrutura das telas e seções                |
| `style.css`  | Identidade visual, animações e layout responsivo |
| `script.js`  | Autenticação, gráficos, simulador, abas e quiz |

> Os dados são aproximados e vêm de CNC (Peic), Serasa e Banco Central. O conteúdo é educativo. Por ser um projeto didático, o login funciona só no navegador e não substitui uma autenticação real feita em servidor.
