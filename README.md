# verde. · Educação Financeira

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
3. **Simulador "bola de neve"**: você informa o valor e os juros ao mês e vê o total em 1, 3, 6 e 12 meses. O gráfico atualiza em tempo real.
4. **Aprenda**: abas sobre crédito fácil, o ciclo do endividamento (diagrama interativo), uso consciente do cartão e crédito saudável x perigoso.
5. **Quiz**: 5 perguntas com pontuação, barra de progresso, explicação de cada resposta e feedback final. A melhor pontuação fica salva.

## Arquivos

| Arquivo      | Conteúdo                                    |
|--------------|---------------------------------------------|
| `index.html` | Estrutura das telas e seções                |
| `style.css`  | Identidade visual, animações e layout responsivo |
| `script.js`  | Autenticação, gráficos, simulador, abas e quiz |

> Os dados são aproximados e vêm de CNC (Peic), Serasa e Banco Central. O conteúdo é educativo. Por ser um projeto didático, o login funciona só no navegador e não substitui uma autenticação real feita em servidor.
