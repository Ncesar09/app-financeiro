'use strict';

/* ===== Configurações ===== */
const CHAVE = 'fismo.v1';
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const COR_ENTRADA = '#2e7d32';
const COR_SAIDA = '#c62828';
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const brl = (centavos) => moeda.format(centavos / 100);

/* ===== Dados (valores guardados em CENTAVOS, para não ter erro de arredondamento) ===== */
let estado = carregar();
const agora = new Date();
let vis = { ano: agora.getFullYear(), mes: agora.getMonth() };  // mês exibido na tela "Mês"
let anoResumo = agora.getFullYear();
let telaAtual = 'lancar';

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && Array.isArray(d.lancamentos)) {
      return { saldoInicial: Number.isInteger(d.saldoInicial) ? d.saldoInicial : 0, lancamentos: d.lancamentos };
    }
  } catch (e) { /* sem dados ainda */ }
  return { saldoInicial: 0, lancamentos: [] };
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch (e) {
    alert('Não foi possível salvar neste aparelho: ' + e.message);
    return false;
  }
}

function novoId() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function dataHoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/* "1.234,56" ou "1234,56" ou "1234.56"  ->  123456 (centavos). Devolve null se for inválido. */
function parseValor(texto) {
  let t = String(texto).trim().replace(/\s|R\$/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

/* ===== Cálculos ===== */
const prefixo = (ano, mes) => ano + '-' + pad(mes + 1);          // "2026-04"
const sinal = (l) => (l.tipo === 'in' ? l.valor : -l.valor);

function saldoAntes(ano, mes) {
  const p = prefixo(ano, mes);
  return estado.saldoInicial + estado.lancamentos
    .filter((l) => l.data.slice(0, 7) < p)
    .reduce((soma, l) => soma + sinal(l), 0);
}

function totaisMes(ano, mes) {
  const p = prefixo(ano, mes);
  let ent = 0, sai = 0;
  for (const l of estado.lancamentos) {
    if (l.data.slice(0, 7) !== p) continue;
    if (l.tipo === 'in') ent += l.valor; else sai += l.valor;
  }
  const ini = saldoAntes(ano, mes);
  return { ini, ent, sai, fim: ini + ent - sai };
}

/* ===== Telas ===== */
function mostrarTela(nome) {
  telaAtual = nome;
  document.querySelectorAll('.tela').forEach((s) => s.classList.toggle('ativa', s.id === 'tela-' + nome));
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('ativa', b.dataset.tela === nome));
  if (nome === 'mes') renderMes();
  if (nome === 'resumo') renderResumo();
  if (nome === 'ajustes') renderAjustes();
  window.scrollTo(0, 0);
}

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

let temporizadorAviso;
function aviso(msg, erro) {
  const p = $('aviso');
  p.textContent = msg;
  p.className = erro ? 'erro' : '';
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { p.textContent = ''; }, 4000);
}

/* ----- Tela: Lançar ----- */
$('form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const data = $('data').value;
  const desc = $('desc').value.trim();
  const valor = parseValor($('valor').value);
  const tipo = document.querySelector('input[name="tipo"]:checked').value;

  if (!data || !desc) return aviso('Preencha a data e a descrição.', true);
  if (valor === null || valor === 0) return aviso('Valor inválido. Exemplo: 1234,56', true);

  estado.lancamentos.push({ id: novoId(), data, desc, tipo, valor });
  if (!salvar()) return;

  $('desc').value = '';
  $('valor').value = '';
  aviso('Lançamento salvo em ' + MESES[Number(data.slice(5, 7)) - 1] + '!', false);
  $('desc').focus();
});

/* ----- Tela: Mês ----- */
function renderMes() {
  $('mes-titulo').textContent = MESES[vis.mes] + ' de ' + vis.ano;
  const t = totaisMes(vis.ano, vis.mes);
  $('m-ini').textContent = brl(t.ini);
  $('m-ent').textContent = brl(t.ent);
  $('m-sai').textContent = brl(t.sai);
  $('m-fim').textContent = brl(t.fim);

  const p = prefixo(vis.ano, vis.mes);
  const itens = estado.lancamentos
    .filter((l) => l.data.slice(0, 7) === p)
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)));

  const ul = $('lista');
  ul.replaceChildren();
  $('vazio').hidden = itens.length > 0;

  for (const l of itens) {
    const li = el('li', l.tipo === 'in' ? 'in' : 'out');
    const btn = el('button', 'x', '✕');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Excluir lançamento');
    btn.addEventListener('click', () => excluir(l.id));
    li.append(
      el('span', 'dia', l.data.slice(8, 10) + '/' + l.data.slice(5, 7)),
      el('span', 'desc', l.desc),
      el('span', 'val', (l.tipo === 'in' ? '+ ' : '− ') + brl(l.valor)),
      btn
    );
    ul.append(li);
  }
}

function excluir(id) {
  const l = estado.lancamentos.find((x) => x.id === id);
  if (!l) return;
  if (!confirm('Excluir "' + l.desc + '" (' + brl(l.valor) + ')?')) return;
  estado.lancamentos = estado.lancamentos.filter((x) => x.id !== id);
  salvar();
  renderMes();
}

function mudarMes(delta) {
  let m = vis.mes + delta, a = vis.ano;
  if (m < 0) { m = 11; a--; }
  if (m > 11) { m = 0; a++; }
  vis = { ano: a, mes: m };
  renderMes();
}

/* ----- Tela: Resumo ----- */
function linhaTabela(nome, ent, sai, fim, total) {
  const tr = document.createElement('tr');
  if (total) tr.className = 'total';
  [nome, brl(ent), brl(sai), brl(fim)].forEach((texto, i) => {
    const td = el('td', i === 1 ? 'in' : i === 2 ? 'out' : '', texto);
    tr.append(td);
  });
  return tr;
}

function renderResumo() {
  $('ano-titulo').textContent = anoResumo;
  const dados = MESES.map((nome, i) => Object.assign({ nome }, totaisMes(anoResumo, i)));
  const tb = $('tabela-resumo');
  tb.replaceChildren();
  dados.forEach((d) => tb.append(linhaTabela(d.nome, d.ent, d.sai, d.fim, false)));
  const totEnt = dados.reduce((s, d) => s + d.ent, 0);
  const totSai = dados.reduce((s, d) => s + d.sai, 0);
  tb.append(linhaTabela('Total do ano', totEnt, totSai, dados[11].fim, true));
  desenharGrafico(dados);
}

function passoBonito(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function desenharGrafico(dados) {
  const cv = $('grafico');
  const w = cv.clientWidth;
  const h = 260;
  if (!w) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const esq = 52, dir = 8, topo = 12, base = 26;
  const alt = h - topo - base;
  const maxReais = Math.max(1, ...dados.map((d) => Math.max(d.ent, d.sai))) / 100;
  const passo = passoBonito(maxReais / 4);
  const topoReais = Math.ceil(maxReais / passo) * passo;

  g.font = '11px system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (let v = 0; v <= topoReais + 1e-9; v += passo) {
    const y = topo + alt - (v / topoReais) * alt;
    g.strokeStyle = '#e3e3e3';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(esq, y); g.lineTo(w - dir, y); g.stroke();
    g.fillStyle = '#666';
    g.fillText(v.toLocaleString('pt-BR'), esq - 6, y);
  }

  const larg = (w - esq - dir) / 12;
  const bw = Math.max(3, larg * 0.32);
  dados.forEach((d, i) => {
    const centro = esq + i * larg + larg / 2;
    const barra = (centavos, cor, x) => {
      const hh = (centavos / 100 / topoReais) * alt;
      g.fillStyle = cor;
      g.fillRect(x, topo + alt - hh, bw, hh);
    };
    barra(d.ent, COR_ENTRADA, centro - bw - 1);
    barra(d.sai, COR_SAIDA, centro + 1);
    g.fillStyle = '#444';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText(MESES_CURTOS[i], centro, topo + alt + 6);
  });
}

/* ----- Tela: Ajustes ----- */
function renderAjustes() {
  $('saldo-ini').value = (estado.saldoInicial / 100).toFixed(2).replace('.', ',');
  const n = estado.lancamentos.length;
  $('contagem').textContent = n + (n === 1 ? ' lançamento guardado neste aparelho.' : ' lançamentos guardados neste aparelho.');
}

function exportar() {
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'backup-financeiro-' + dataHoje() + '.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importar(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const d = JSON.parse(leitor.result);
      if (!d || !Array.isArray(d.lancamentos)) throw new Error('arquivo inválido');
      const lista = d.lancamentos.map((l) => {
        const ok = /^\d{4}-\d{2}-\d{2}$/.test(l.data) && (l.tipo === 'in' || l.tipo === 'out') &&
                   Number.isInteger(l.valor) && l.valor > 0;
        if (!ok) throw new Error('lançamento inválido: ' + JSON.stringify(l));
        return { id: novoId(), data: l.data, desc: String(l.desc || '').slice(0, 80), tipo: l.tipo, valor: l.valor };
      });
      const ini = Number.isInteger(d.saldoInicial) ? d.saldoInicial : 0;
      if (!confirm('Importar ' + lista.length + ' lançamentos? Isso SUBSTITUI os dados atuais deste aparelho.')) return;
      estado = { saldoInicial: ini, lancamentos: lista };
      salvar();
      renderAjustes();
      alert('Importação concluída!');
    } catch (e) {
      alert('Não foi possível importar: ' + e.message);
    }
  };
  leitor.readAsText(arquivo);
}

/* ===== Ligações dos botões ===== */
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => mostrarTela(b.dataset.tela)));
$('mes-ant').addEventListener('click', () => mudarMes(-1));
$('mes-prox').addEventListener('click', () => mudarMes(1));
$('ano-ant').addEventListener('click', () => { anoResumo--; renderResumo(); });
$('ano-prox').addEventListener('click', () => { anoResumo++; renderResumo(); });
$('salvar-saldo').addEventListener('click', () => {
  const v = parseValor($('saldo-ini').value);
  if (v === null) return alert('Valor inválido. Exemplo: 1234,56');
  estado.saldoInicial = v;
  if (salvar()) alert('Saldo inicial salvo!');
});
$('exportar').addEventListener('click', exportar);
$('importar').addEventListener('change', (ev) => {
  if (ev.target.files[0]) importar(ev.target.files[0]);
  ev.target.value = '';
});
window.addEventListener('resize', () => { if (telaAtual === 'resumo') renderResumo(); });

/* ===== Início ===== */
$('data').value = dataHoje();
mostrarTela('lancar');

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sem modo offline, o app segue funcionando */ });
}
