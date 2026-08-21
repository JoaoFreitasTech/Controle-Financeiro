/* ==========================================================================
   LIVRO-RAZÃO — app.js
   Estado 100% local (localStorage) — nenhum dado sai do seu navegador.
   ========================================================================== */

const STORAGE_KEY = 'livro-razao-2026';
const YEAR = 2026;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const CATEGORIES = {
  entrada: ['Salário', 'Freelance', 'Rendimentos', 'Reembolso', 'Outros'],
  saida: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Assinaturas', 'Outros'],
  investimento: ['Renda fixa', 'Renda variável', 'Fundos imobiliários', 'Reserva de emergência', 'Criptoativos', 'Outros']
};

const TYPE_LABEL = { entrada: 'Entrada', saida: 'Saída', investimento: 'Investimento' };

/* ---------- Estado ---------- */
let state = loadState();
let currentView = 'overview'; // 'overview' | 0..11 (mês)
let currentFilter = 'todos';
let activeType = 'entrada';
let charts = {}; // instâncias Chart.js ativas, para destruir ao re-renderizar

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('Não foi possível ler os dados salvos:', e); }
  return { entries: [] };
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Utilidades ---------- */
const fmtBRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function entriesForMonth(m) {
  return state.entries.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === YEAR && d.getMonth() === m;
  });
}
function totalsFor(list) {
  const t = { entrada: 0, saida: 0, investimento: 0 };
  list.forEach(e => t[e.type] += Number(e.value));
  return { ...t, saldo: t.entrada - t.saida - t.investimento };
}
function monthTotalsAll() {
  return MONTHS.map((_, i) => totalsFor(entriesForMonth(i)));
}

/* ==========================================================================
   RENDER — Sidebar (meses)
   ========================================================================== */
function renderSidebar() {
  const nav = document.getElementById('nav-months');
  const monthTotals = monthTotalsAll();
  nav.innerHTML = MONTHS.map((name, i) => {
    const t = monthTotals[i];
    const hasData = entriesForMonth(i).length > 0;
    const saldoClass = !hasData ? '' : (t.saldo >= 0 ? 'pos' : 'neg');
    const saldoText = hasData ? fmtBRL(t.saldo) : '—';
    return `
      <button class="month-tab ${hasData ? 'has-data' : ''} ${currentView === i ? 'is-active' : ''}" data-month="${i}">
        <span class="m-name">${name}</span>
        <span class="m-saldo ${saldoClass}">${saldoText}</span>
      </button>`;
  }).join('');

  document.getElementById('nav-overview').querySelector('.ledger__tab')
    .classList.toggle('is-active', currentView === 'overview');

  nav.querySelectorAll('.month-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = Number(btn.dataset.month);
      currentFilter = 'todos';
      render();
    });
  });
}

/* ==========================================================================
   RENDER — Visão geral (ano)
   ========================================================================== */
function renderOverview() {
  const main = document.getElementById('main');
  const all = state.entries.filter(e => new Date(e.date + 'T00:00:00').getFullYear() === YEAR);
  const yearTotal = totalsFor(all);
  const monthTotals = monthTotalsAll();

  main.innerHTML = `
    <div class="page-head">
      <div>
        <p class="page-head__eyebrow">Exercício ${YEAR}</p>
        <h1>Visão geral</h1>
        <p>Panorama consolidado dos doze meses. Selecione um mês na lateral para lançar ou revisar detalhes.</p>
      </div>
      <button class="btn btn--primary" id="btn-new-overview">＋ Novo lançamento</button>
    </div>

    <div class="kpi-grid">
      ${kpiCard('entrada', 'Total de entradas', yearTotal.entrada, 'Somatório do ano')}
      ${kpiCard('saida', 'Total de saídas', yearTotal.saida, 'Somatório do ano')}
      ${kpiCard('invest', 'Total investido', yearTotal.investimento, 'Somatório do ano')}
      ${kpiCard('saldo', 'Saldo do ano', yearTotal.saldo, 'Entradas − saídas − investido')}
    </div>

    <div class="panel-grid">
      <div class="panel">
        <div class="panel__head">
          <h3>Fluxo mensal</h3>
          <span>entradas · saídas · investido</span>
        </div>
        <div class="chart-wrap"><canvas id="chart-year-flow"></canvas></div>
      </div>
      <div class="panel">
        <div class="panel__head">
          <h3>Saldo acumulado</h3>
          <span>evolução no ano</span>
        </div>
        <div class="chart-wrap"><canvas id="chart-year-balance"></canvas></div>
      </div>
    </div>

    <div class="year-grid">
      ${MONTHS.map((name, i) => monthCard(name, i, monthTotals[i])).join('')}
    </div>
  `;

  document.getElementById('btn-new-overview').addEventListener('click', () => openModal());
  document.querySelectorAll('.month-card').forEach(card => {
    card.addEventListener('click', () => {
      currentView = Number(card.dataset.month);
      currentFilter = 'todos';
      render();
    });
  });

  animateKpis();
  drawYearFlowChart(monthTotals);
  drawYearBalanceChart(monthTotals);
}

function monthCard(name, i, t) {
  const hasData = t.entrada || t.saida || t.investimento;
  const max = Math.max(t.entrada, t.saida, t.investimento, 1);
  return `
    <div class="month-card" data-month="${i}">
      <div class="month-card__head">
        <h4>${name}</h4>
        <span>${hasData ? fmtBRL(t.saldo) : 'sem lançamentos'}</span>
      </div>
      <div class="month-card__row entrada"><span>Entradas</span><b>${fmtBRL(t.entrada)}</b></div>
      <div class="month-card__row saida"><span>Saídas</span><b>${fmtBRL(t.saida)}</b></div>
      <div class="month-card__row invest"><span>Investido</span><b>${fmtBRL(t.investimento)}</b></div>
      <div class="month-card__bar">
        <span style="width:${t.entrada / max * 100}%; background:var(--emerald)"></span>
        <span style="width:${t.saida / max * 100}%; background:var(--rose)"></span>
        <span style="width:${t.investimento / max * 100}%; background:var(--azure)"></span>
      </div>
    </div>`;
}

/* ==========================================================================
   RENDER — Página de um mês
   ========================================================================== */
function renderMonth(m) {
  const main = document.getElementById('main');
  const list = entriesForMonth(m);
  const t = totalsFor(list);

  main.innerHTML = `
    <div class="page-head">
      <div>
        <p class="page-head__eyebrow">${YEAR}</p>
        <h1>${MONTHS[m]}</h1>
        <p>${list.length ? `${list.length} lançamento${list.length > 1 ? 's' : ''} registrado${list.length > 1 ? 's' : ''} neste mês.` : 'Nenhum lançamento registrado ainda neste mês.'}</p>
      </div>
      <button class="btn btn--primary" id="btn-new-month">＋ Novo lançamento</button>
    </div>

    <div class="kpi-grid">
      ${kpiCard('entrada', 'Entradas', t.entrada, 'no mês')}
      ${kpiCard('saida', 'Saídas', t.saida, 'no mês')}
      ${kpiCard('invest', 'Investido', t.investimento, 'no mês')}
      ${kpiCard('saldo', 'Saldo', t.saldo, 'entradas − saídas − investido')}
    </div>

    <div class="panel-grid">
      <div class="panel">
        <div class="panel__head">
          <h3>Comparativo do mês</h3>
          <span>por tipo</span>
        </div>
        <div class="chart-wrap">
          ${list.length ? '<canvas id="chart-month-bar"></canvas>' : emptyNote('Sem dados para exibir', 'Adicione um lançamento para ver o gráfico.')}
        </div>
      </div>
      <div class="panel">
        <div class="panel__head">
          <h3>Saídas por categoria</h3>
          <span>distribuição</span>
        </div>
        <div class="chart-wrap donut">
          ${t.saida > 0 ? '<canvas id="chart-month-donut"></canvas>' : emptyNote('Nenhuma saída no mês', 'Registre uma saída para ver a distribuição por categoria.')}
        </div>
      </div>
    </div>

    <div class="table-panel">
      <div class="table-panel__head">
        <h3>Lançamentos de ${MONTHS[m]}</h3>
        <div class="filters">
          ${filterChip('todos', 'Todos')}
          ${filterChip('entrada', 'Entradas')}
          ${filterChip('saida', 'Saídas')}
          ${filterChip('investimento', 'Investimentos')}
        </div>
      </div>
      ${renderTable(list)}
    </div>

    <button class="fab" id="fab-add" title="Novo lançamento">＋</button>
  `;

  document.getElementById('btn-new-month').addEventListener('click', () => openModal(null, m));
  document.getElementById('fab-add').addEventListener('click', () => openModal(null, m));

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentFilter = chip.dataset.filter;
      render();
    });
  });

  document.querySelectorAll('tbody tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.id, m));
  });

  animateKpis();
  if (list.length) drawMonthBarChart(t);
  if (t.saida > 0) drawMonthDonutChart(list);
}

function filterChip(key, label) {
  return `<button class="filter-chip ${currentFilter === key ? 'is-active' : ''}" data-filter="${key}">${label}</button>`;
}

function renderTable(list) {
  const filtered = currentFilter === 'todos' ? list : list.filter(e => e.type === currentFilter);
  if (filtered.length === 0) {
    return `<div class="table-empty">
      <strong>Nada por aqui ainda</strong>
      <p>${list.length ? 'Nenhum lançamento corresponde a este filtro.' : 'Clique em "Novo lançamento" para começar a organizar o mês.'}</p>
    </div>`;
  }
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Tipo</th>
          <th class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map((e, idx) => `
          <tr data-id="${e.id}" style="animation-delay:${idx * 22}ms">
            <td class="mono">${formatDate(e.date)}</td>
            <td class="desc">${escapeHtml(e.desc)}</td>
            <td><span class="cat-pill">${escapeHtml(e.cat)}</span></td>
            <td><span class="tag tag--${e.type}">${TYPE_LABEL[e.type]}</span></td>
            <td class="num mono">${e.type === 'saida' ? '−' : '+'} ${fmtBRL(Number(e.value))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function emptyNote(title, sub) {
  return `<div class="empty-note"><strong>${title}</strong><span>${sub}</span></div>`;
}

/* ---------- KPI card + contagem animada ---------- */
function kpiCard(cls, label, value, sub) {
  return `
    <div class="kpi kpi--${cls}">
      <div class="kpi__label"><span class="kpi__dot"></span>${label}</div>
      <div class="kpi__value" data-count="${value}">R$ 0,00</div>
      <div class="kpi__sub">${sub}</div>
    </div>`;
}
function animateKpis() {
  document.querySelectorAll('.kpi__value').forEach(el => {
    const target = Number(el.dataset.count);
    const duration = 650;
    const start = performance.now();
    const isNeg = target < 0;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = target * eased;
      el.textContent = fmtBRL(current);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmtBRL(target);
    }
    requestAnimationFrame(tick);
    el.style.color = isNeg ? 'var(--rose)' : '';
  });
}

/* ==========================================================================
   GRÁFICOS (Chart.js)
   ========================================================================== */
const CHARTS_AVAILABLE = typeof Chart !== 'undefined';
if (!CHARTS_AVAILABLE) {
  console.warn('Chart.js não foi encontrado — o painel funcionará normalmente, mas sem os gráficos.');
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}
if (CHARTS_AVAILABLE) {
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.color = '#7c8ba0';
}

function drawYearFlowChart(monthTotals) {
  if (!CHARTS_AVAILABLE) return;
  destroyChart('yearFlow');
  const ctx = document.getElementById('chart-year-flow');
  if (!ctx) return;
  charts.yearFlow = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS.map(m => m.slice(0, 3)),
      datasets: [
        { label: 'Entradas', data: monthTotals.map(t => t.entrada), backgroundColor: '#34c19c', borderRadius: 4, maxBarThickness: 14 },
        { label: 'Saídas', data: monthTotals.map(t => t.saida), backgroundColor: '#e1667f', borderRadius: 4, maxBarThickness: 14 },
        { label: 'Investido', data: monthTotals.map(t => t.investimento), backgroundColor: '#5b9bd8', borderRadius: 4, maxBarThickness: 14 },
      ]
    },
    options: chartBaseOptions({ stacked: false, currency: true })
  });
}

function drawYearBalanceChart(monthTotals) {
  if (!CHARTS_AVAILABLE) return;
  destroyChart('yearBalance');
  const ctx = document.getElementById('chart-year-balance');
  if (!ctx) return;
  let acc = 0;
  const data = monthTotals.map(t => acc += t.saldo);
  charts.yearBalance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MONTHS.map(m => m.slice(0, 3)),
      datasets: [{
        label: 'Saldo acumulado',
        data,
        borderColor: '#d4af6a',
        backgroundColor: 'rgba(212,175,106,0.12)',
        pointBackgroundColor: '#d4af6a',
        pointBorderColor: '#0b1420',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
        borderWidth: 2.4
      }]
    },
    options: chartBaseOptions({ currency: true, legend: false })
  });
}

function drawMonthBarChart(t) {
  if (!CHARTS_AVAILABLE) return;
  destroyChart('monthBar');
  const ctx = document.getElementById('chart-month-bar');
  if (!ctx) return;
  charts.monthBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Entradas', 'Saídas', 'Investido'],
      datasets: [{
        data: [t.entrada, t.saida, t.investimento],
        backgroundColor: ['#34c19c', '#e1667f', '#5b9bd8'],
        borderRadius: 6,
        maxBarThickness: 56
      }]
    },
    options: chartBaseOptions({ currency: true, legend: false, indexAxis: 'y' })
  });
}

function drawMonthDonutChart(list) {
  if (!CHARTS_AVAILABLE) return;
  destroyChart('monthDonut');
  const ctx = document.getElementById('chart-month-donut');
  if (!ctx) return;
  const byCat = {};
  list.filter(e => e.type === 'saida').forEach(e => byCat[e.cat] = (byCat[e.cat] || 0) + Number(e.value));
  const labels = Object.keys(byCat);
  const palette = ['#e1667f', '#d4af6a', '#5b9bd8', '#34c19c', '#c17ed8', '#e8a15c', '#7c8ba0', '#b45a70'];
  charts.monthDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: Object.values(byCat),
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderColor: '#121f30',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 12, font: { size: 11.5 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtBRL(c.parsed)}` } }
      }
    }
  });
}

function chartBaseOptions({ currency = false, legend = true, indexAxis = 'x' } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend, position: 'top', align: 'end', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, padding: 16, font: { size: 11.5 } } },
      tooltip: {
        backgroundColor: '#17293d',
        borderColor: 'rgba(233,237,241,0.12)',
        borderWidth: 1,
        titleFont: { family: "'IBM Plex Mono', monospace", size: 11 },
        bodyFont: { family: "'IBM Plex Mono', monospace", size: 11.5 },
        padding: 10,
        callbacks: currency ? { label: (c) => ` ${c.dataset.label || ''}: ${fmtBRL(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } : undefined
      }
    },
    scales: {
      x: { grid: { color: 'rgba(233,237,241,0.06)', drawTicks: false }, border: { display: false } },
      y: {
        grid: { color: 'rgba(233,237,241,0.06)', drawTicks: false }, border: { display: false },
        ticks: currency ? { callback: (v) => 'R$ ' + Number(v).toLocaleString('pt-BR') } : undefined
      }
    }
  };
}

/* ==========================================================================
   MODAL — novo / editar lançamento
   ========================================================================== */
const modal = document.getElementById('entry-modal');
const form = document.getElementById('entry-form');

function openModal(entryId = null, presetMonth = null) {
  form.reset();
  document.getElementById('entry-id').value = entryId || '';
  document.getElementById('entry-delete').hidden = !entryId;

  if (entryId) {
    const e = state.entries.find(x => x.id === entryId);
    document.getElementById('modal-title').textContent = 'Editar lançamento';
    setActiveType(e.type);
    document.getElementById('entry-date').value = e.date;
    document.getElementById('entry-value').value = e.value;
    document.getElementById('entry-desc').value = e.desc;
    document.getElementById('entry-cat').value = e.cat;
  } else {
    document.getElementById('modal-title').textContent = 'Novo lançamento';
    setActiveType('entrada');
    const m = presetMonth !== null ? presetMonth : (typeof currentView === 'number' ? currentView : new Date().getMonth());
    const day = new Date().getDate().toString().padStart(2, '0');
    const safeDay = Math.min(Number(day), 28).toString().padStart(2, '0');
    document.getElementById('entry-date').value = `${YEAR}-${String(m + 1).padStart(2, '0')}-${safeDay}`;
  }
  updateCategoryList();
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('entry-desc').focus(), 60);
}
function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}
function setActiveType(type) {
  activeType = type;
  document.querySelectorAll('.segmented__opt').forEach(b => b.classList.toggle('is-active', b.dataset.type === type));
  updateCategoryList();
}
function updateCategoryList() {
  const dl = document.getElementById('cat-list');
  dl.innerHTML = CATEGORIES[activeType].map(c => `<option value="${c}">`).join('');
  document.getElementById('entry-cat-hint').textContent = `(sugestões para ${TYPE_LABEL[activeType].toLowerCase()})`;
}

document.getElementById('type-segmented').addEventListener('click', (ev) => {
  const btn = ev.target.closest('.segmented__opt');
  if (btn) setActiveType(btn.dataset.type);
});
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const id = document.getElementById('entry-id').value;
  const payload = {
    type: activeType,
    date: document.getElementById('entry-date').value,
    value: Number(document.getElementById('entry-value').value),
    desc: document.getElementById('entry-desc').value.trim(),
    cat: document.getElementById('entry-cat').value.trim(),
  };
  if (!payload.date || !payload.value || !payload.desc || !payload.cat) return;

  if (id) {
    const idx = state.entries.findIndex(e => e.id === id);
    state.entries[idx] = { ...state.entries[idx], ...payload };
    showToast('Lançamento atualizado');
  } else {
    state.entries.push({ id: uid(), ...payload });
    showToast('Lançamento adicionado');
  }
  saveState();
  const m = new Date(payload.date + 'T00:00:00').getMonth();
  currentView = m;
  closeModal();
  render();
});

document.getElementById('entry-delete').addEventListener('click', () => {
  const id = document.getElementById('entry-id').value;
  if (!id) return;
  if (confirm('Remover este lançamento?')) {
    state.entries = state.entries.filter(e => e.id !== id);
    saveState();
    closeModal();
    showToast('Lançamento removido');
    render();
  }
});

/* ==========================================================================
   Toast
   ========================================================================== */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = '';
  const el = document.createElement('span');
  el.textContent = msg;
  t.appendChild(el);
  t.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-show'), 2400);
}

/* ==========================================================================
   Export / Import
   ========================================================================== */
document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `livro-razao-${YEAR}-backup.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado');
});
document.getElementById('btn-import').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error('formato inválido');
      state = data;
      saveState();
      render();
      showToast('Dados importados com sucesso');
    } catch (e) {
      alert('Não foi possível importar este arquivo. Verifique se é um backup válido do Livro-Razão.');
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
});

/* ==========================================================================
   Helpers diversos
   ========================================================================== */
function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================================
   Render principal
   ========================================================================== */
function render() {
  renderSidebar();
  if (currentView === 'overview') renderOverview();
  else renderMonth(currentView);
}

document.getElementById('nav-overview').addEventListener('click', () => {
  currentView = 'overview';
  render();
});

try {
  render();
} catch (err) {
  console.error('Erro ao renderizar o painel:', err);
  document.getElementById('main').innerHTML = `
    <div class="page-head"><div>
      <h1>Algo deu errado ao carregar o painel</h1>
      <p>Abra o console do navegador (F12) para ver o erro completo: <strong>${escapeHtml(err.message)}</strong></p>
    </div></div>`;
}

/* Reforço: garante que os gráficos ativos recalculem o tamanho ao redimensionar a janela */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    Object.values(charts).forEach(ch => ch.resize());
  }, 120);
});
