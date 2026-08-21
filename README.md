# Painel de Controle Financeiro - 2026

Dashboard pessoal de finanças, com os 12 meses de 2026, gráficos, tabela de lançamentos e formulário de entrada de dados. 100% front-end (HTML, CSS e JavaScript puro) — não precisa de servidor, banco de dados ou instalação de pacotes.

## Como abrir

1. Extraia o `.zip`.
2. Abra a pasta `dashboard-financeiro` no VS Code.
3. Instale a extensão **Live Server** (se ainda não tiver) e clique em "Go Live" com `index.html` aberto — ou simplesmente dê duplo clique em `index.html` para abrir direto no navegador.

Não é obrigatório usar o Live Server: o site funciona abrindo o arquivo direto, mas o Live Server evita qualquer problema de cache ao editar o código.

## Estrutura

```
dashboard-financeiro/
├── index.html          → estrutura da página e do modal de lançamento
├── assets/
│   ├── style.css        → todo o sistema visual (cores, tipografia, animações)
│   └── app.js            → estado, cálculos, gráficos (Chart.js) e CRUD dos lançamentos
└── README.md
```

## Como funciona

- **Visão geral**: totais do ano, gráfico de fluxo mensal (entradas/saídas/investido) e saldo acumulado, além de um cartão-resumo para cada um dos 12 meses.
- **Cada mês**: cartões de indicadores (entradas, saídas, investido, saldo), gráfico comparativo do mês, gráfico de saídas por categoria e a tabela de lançamentos, com filtros por tipo.
- **Novo lançamento**: botão "＋ Novo lançamento" (ou o botão flutuante dentro de um mês) abre um formulário para escolher o tipo (Entrada / Saída / Investimento), data, valor, descrição e categoria. Clicar em uma linha da tabela abre o mesmo formulário para editar ou excluir.
- **Dados**: tudo fica salvo no `localStorage` do seu navegador — ou seja, os dados persistem entre sessões automaticamente, sem precisar de login ou internet.
- **Exportar / Importar**: no rodapé da barra lateral é possível baixar um backup `.json` de todos os lançamentos, e reimportá-lo depois (útil para trocar de computador ou manter uma cópia de segurança).

## Personalizar

- **Categorias sugeridas**: edite o objeto `CATEGORIES` no topo de `assets/app.js`.
- **Cores**: todas as variáveis de cor estão no início de `assets/style.css`, dentro de `:root` (ex.: `--gold`, `--emerald`, `--rose`, `--azure`).
- **Ano**: hoje o painel está fixo em 2026 (`const YEAR = 2026` em `app.js`) — para reutilizar em outro ano, basta trocar esse valor.

## Observação sobre os dados

Como os dados ficam salvos apenas no `localStorage` do navegador em que você abriu o arquivo, limpar o cache do navegador ou abrir o site em outro navegador/computador não vai trazer os lançamentos antigos — use a opção **Exportar dados** com frequência para manter um backup seguro.
