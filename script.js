/* =========================================================
   VERDE · Educação Financeira
   Lógica da aplicação
   ---------------------------------------------------------
   Sumário
   1.  Utilitários (seletores, formatação, toast)
   2.  Armazenamento (usuários e sessão no localStorage)
   3.  Autenticação (login, cadastro, validação)
   4.  Inicialização do app após login
   5.  Navegação (menu, seção ativa, progresso de rolagem)
   6.  Animações (revelar ao rolar, contadores)
   7.  Gráficos (Chart.js)
   8.  Simulador de dívida
   9.  Conteúdo educativo (crédito fácil, endividamento, cartão)
   10. Quiz
   11. Ponto de entrada
   ========================================================= */

"use strict";

/* ---------- 1. UTILITÁRIOS ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Formata número como moeda brasileira (R$ 1.234,56). */
const formatBRL = (value, decimals = 2) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Formata número com separadores brasileiros. */
const formatNumber = (value, decimals = 0) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Limita um valor entre min e max. */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Exibe uma notificação flutuante por alguns segundos. */
let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

/* ---------- 2. ARMAZENAMENTO ---------- */
const STORAGE_USERS = "verde_users";
const STORAGE_SESSION = "verde_session";

/** Lê e grava com try/catch: o localStorage pode estar bloqueado (aba anônima, etc.). */
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignora */ }
  },
};

const getUsers = () => Store.get(STORAGE_USERS, []);
const saveUsers = (users) => Store.set(STORAGE_USERS, users);
const findUser = (email) => getUsers().find((u) => u.email === email.toLowerCase());

/** Atualiza campos de um usuário salvo (ex.: melhor pontuação no quiz). */
function updateUser(email, changes) {
  const users = getUsers().map((u) => (u.email === email ? { ...u, ...changes } : u));
  saveUsers(users);
}

/**
 * Gera um hash da senha para não guardá-la em texto puro.
 * Usa SHA-256 (Web Crypto) quando disponível; caso contrário, um hash simples.
 * Observação: é um projeto didático — autenticação real exige um servidor.
 */
async function hashPassword(password) {
  const salted = `verde::${password}`;
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(salted);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (let i = 0; i < salted.length; i++) h = (Math.imul(31, h) + salted.charCodeAt(i)) | 0;
  return `fallback-${h >>> 0}`;
}

/* ---------- 3. AUTENTICAÇÃO ---------- */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mostra (ou limpa) a mensagem de erro de um campo. */
function setFieldError(input, message = "") {
  const field = input.closest(".field");
  const errorEl = $(`[data-error-for="${input.id}"]`);
  field.classList.toggle("has-error", Boolean(message));
  field.classList.toggle("is-valid", !message && input.value.trim() !== "");
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (errorEl) errorEl.textContent = message;
}

/** Mostra a mensagem geral no topo do formulário. */
function showFormAlert(message, type = "error") {
  const alert = $("#form-alert");
  if (!message) {
    alert.hidden = true;
    return;
  }
  alert.className = `form-alert form-alert--${type}`;
  alert.textContent = message;
  alert.hidden = false;
}

/** Regras de validação por campo. Retornam a mensagem de erro ou "". */
const validators = {
  name(value) {
    const v = value.trim();
    if (!v) return "Como podemos te chamar? Digite seu nome.";
    if (v.length < 3) return "O nome precisa ter pelo menos 3 letras.";
    if (!/^[\p{L}\s'.-]+$/u.test(v)) return "Use apenas letras no nome.";
    return "";
  },
  email(value) {
    const v = value.trim();
    if (!v) return "Informe seu e-mail.";
    if (!EMAIL_REGEX.test(v)) return "Esse e-mail parece incompleto. Ex.: nome@email.com";
    return "";
  },
  password(value, { strict } = {}) {
    if (!value) return "Digite sua senha.";
    if (strict && value.length < 6) return "A senha precisa ter no mínimo 6 caracteres.";
    if (strict && !/[A-Za-z]/.test(value)) return "Inclua pelo menos uma letra na senha.";
    if (strict && !/\d/.test(value)) return "Inclua pelo menos um número na senha.";
    return "";
  },
};

/** Calcula a força da senha de 0 a 4. */
function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return pw ? Math.max(1, score) : 0;
}

/** Faz o cartão "tremer" para indicar erro. */
function shakeCard() {
  const card = $("#auth-card");
  card.classList.remove("shake");
  void card.offsetWidth; // reinicia a animação
  card.classList.add("shake");
}

/** Liga/desliga o estado de carregamento do botão. */
function setLoading(form, loading) {
  const btn = $("button[type=submit]", form);
  btn.classList.toggle("is-loading", loading);
  btn.disabled = loading;
}

/** Alterna entre as abas "Entrar" e "Criar conta". */
function switchAuthTab(tab) {
  const isLogin = tab === "login";
  $(".segmented").dataset.active = tab;
  $$("[data-auth-tab]").forEach((btn) => {
    const active = btn.dataset.authTab === tab;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", String(active));
  });
  $("#login-form").hidden = !isLogin;
  $("#register-form").hidden = isLogin;
  $("#auth-title").textContent = isLogin ? "Bem-vindo de volta" : "Crie sua conta";
  $("#auth-subtitle").textContent = isLogin
    ? "Entre para acessar seu painel financeiro."
    : "Leva menos de um minuto. Sem cartão, sem pegadinhas.";
  showFormAlert("");
  $$(".field").forEach((f) => f.classList.remove("has-error"));
  $$(".field__error").forEach((e) => (e.textContent = ""));
  const firstInput = $(isLogin ? "#login-email" : "#reg-name");
  setTimeout(() => firstInput.focus(), 50);
}

function initAuth() {
  // Abas de login/cadastro
  $$("[data-auth-tab]").forEach((btn) => btn.addEventListener("click", () => switchAuthTab(btn.dataset.authTab)));

  // Botões de mostrar/ocultar senha
  $$("[data-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.togglePassword);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-on", show);
      btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
    });
  });

  // Medidor de força da senha no cadastro
  const regPassword = $("#reg-password");
  const strengthLabels = ["Use letras, números e símbolos.", "Senha fraca", "Senha razoável", "Senha boa", "Senha forte"];
  regPassword.addEventListener("input", () => {
    const level = passwordStrength(regPassword.value);
    $(".strength").dataset.level = level;
    $("#strength-label").textContent = strengthLabels[level];
  });

  // Validação ao sair do campo (e limpeza do erro ao digitar)
  const fieldRules = {
    "reg-name": (v) => validators.name(v),
    "reg-email": (v) => validators.email(v),
    "reg-password": (v) => validators.password(v, { strict: true }),
    "login-email": (v) => validators.email(v),
    "login-password": (v) => validators.password(v),
  };
  Object.entries(fieldRules).forEach(([id, rule]) => {
    const input = document.getElementById(id);
    input.addEventListener("blur", () => input.value && setFieldError(input, rule(input.value)));
    input.addEventListener("input", () => {
      if (input.closest(".field").classList.contains("has-error")) setFieldError(input, rule(input.value));
      showFormAlert("");
    });
  });

  /** Valida um conjunto de campos e foca o primeiro com erro. */
  const validateAll = (ids) => {
    let firstInvalid = null;
    ids.forEach((id) => {
      const input = document.getElementById(id);
      const msg = fieldRules[id](input.value);
      setFieldError(input, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      shakeCard();
    }
    return !firstInvalid;
  };

  // ---- Cadastro ----
  $("#register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormAlert("");
    if (!validateAll(["reg-name", "reg-email", "reg-password"])) return;

    const name = $("#reg-name").value.trim().replace(/\s+/g, " ");
    const email = $("#reg-email").value.trim().toLowerCase();
    const password = $("#reg-password").value;

    if (findUser(email)) {
      setFieldError($("#reg-email"), "Este e-mail já está cadastrado.");
      showFormAlert("Você já tem uma conta. Que tal entrar?");
      shakeCard();
      return;
    }

    setLoading(e.target, true);
    const passHash = await hashPassword(password);
    await new Promise((r) => setTimeout(r, 600)); // pequena pausa para dar sensação de processamento

    const users = getUsers();
    users.push({ name, email, passHash, createdAt: new Date().toISOString(), bestScore: null });
    if (!saveUsers(users)) {
      setLoading(e.target, false);
      showFormAlert("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
      return;
    }

    setLoading(e.target, false);
    e.target.reset();
    $(".strength").dataset.level = 0;
    login(email, `Conta criada! Bem-vindo, ${name.split(" ")[0]}.`);
  });

  // ---- Login ----
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormAlert("");
    if (!validateAll(["login-email", "login-password"])) return;

    const email = $("#login-email").value.trim().toLowerCase();
    const password = $("#login-password").value;

    setLoading(e.target, true);
    const [passHash] = await Promise.all([hashPassword(password), new Promise((r) => setTimeout(r, 500))]);
    setLoading(e.target, false);

    const user = findUser(email);
    if (!user) {
      setFieldError($("#login-email"), "Não encontramos uma conta com este e-mail.");
      showFormAlert("Ainda não tem conta? Clique em “Criar conta” acima.");
      shakeCard();
      return;
    }
    if (user.passHash !== passHash) {
      setFieldError($("#login-password"), "Senha incorreta. Tente novamente.");
      $("#login-password").select();
      shakeCard();
      return;
    }

    e.target.reset();
    login(email, `Olá de novo, ${user.name.split(" ")[0]}!`);
  });
}

/** Registra a sessão e abre o dashboard. */
function login(email, message) {
  Store.set(STORAGE_SESSION, { email, at: Date.now() });
  showApp(findUser(email));
  if (message) showToast(message);
}

/** Encerra a sessão e volta para a tela de login. */
function logout() {
  Store.remove(STORAGE_SESSION);
  $("#app-view").hidden = true;
  $("#auth-view").hidden = false;
  window.scrollTo({ top: 0 });
  history.replaceState(null, "", location.pathname);
  switchAuthTab("login");
  showToast("Você saiu da sua conta. Até logo!");
}

/* ---------- 4. INICIALIZAÇÃO DO APP ---------- */
let currentUser = null;
let appInitialized = false;

function showApp(user) {
  currentUser = user;
  $("#auth-view").hidden = true;
  $("#app-view").hidden = false;
  window.scrollTo({ top: 0 });

  const firstName = user.name.split(" ")[0];
  const initials = user.name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  $("#user-name").textContent = user.name;
  $("#hero-name").textContent = firstName;
  $("#user-avatar").textContent = initials;
  updateBestScoreLabel();

  // Os módulos são iniciados uma única vez (o canvas precisa estar visível para o Chart.js)
  if (!appInitialized) {
    appInitialized = true;
    initNavigation();
    initReveal();
    initCharts();
    initSimulator();
    initCustoReal();
    initCycle();
    initThermometer();
    initChecklist();
    initBill();
    initMinimum();
    initCalendar();
    initMyths();
    initQuiz();
    initCardGlow();
  } else {
    // Ao entrar novamente, reanima os contadores
    $$(".counter").forEach((el) => { el.dataset.done = ""; el.textContent = "0"; });
    initReveal();
  }
}

/* ---------- 5. NAVEGAÇÃO ---------- */
function initNavigation() {
  const nav = $("#nav");
  const links = $$(".nav__link");
  const burger = $("#nav-burger");
  const menu = $("#nav-links");
  const progress = $("#scroll-progress");

  $("#logout-btn").addEventListener("click", logout);

  // Menu mobile
  const closeMenu = () => {
    menu.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  };
  burger.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
  });
  links.forEach((l) => l.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());

  // Sombra da barra e progresso de leitura
  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Destaca o link da seção visível
  const sections = links.map((l) => document.querySelector(l.getAttribute("href")));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${entry.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => s && observer.observe(s));
}

/* ---------- 6. ANIMAÇÕES ---------- */
let revealObserver;

/** Aplica fade-in aos elementos .reveal quando entram na tela. */
function initReveal() {
  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        $$(".counter", entry.target).forEach(animateCounter);
        $$(".rate-bar", entry.target).forEach(fillRateBar);
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );
  $$(".reveal").forEach((el) => {
    // Na reentrada, os cards voltam a animar
    if (el.classList.contains("stat-card")) el.classList.remove("is-visible");
    if (el.classList.contains("is-visible")) return;
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add("is-visible");
      $$(".counter", el).forEach(animateCounter);
      $$(".rate-bar", el).forEach(fillRateBar);
    } else {
      revealObserver.observe(el);
    }
  });
}

/** Faz o número "subir" de 0 até o valor alvo, com desaceleração suave. */
function animateCounter(el) {
  if (el.dataset.done) return;
  el.dataset.done = "1";
  const target = parseFloat(el.dataset.target);
  const decimals = parseInt(el.dataset.decimals || "0", 10);
  const duration = prefersReducedMotion ? 0 : 1800;
  const start = performance.now();

  const tick = (now) => {
    const t = duration ? clamp((now - start) / duration, 0, 1) : 1;
    const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
    el.textContent = formatNumber(target * eased, decimals);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Brilho verde que segue o mouse nos cards de estatística. */
function initCardGlow() {
  $$(".stat-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      card.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
  });
}

/* ---------- 7. GRÁFICOS ---------- */
const COLORS = {
  green: "#10b981",
  greenLight: "#34d399",
  greenSoft: "rgba(16, 185, 129, 0.18)",
  greenMuted: "#1f6b52",
  neutral: "#4b5a53",
  text: "#b4bfb9",
  muted: "#7a8780",
  grid: "rgba(255, 255, 255, 0.06)",
  surface: "#0f1412",
};

const charts = {};

/** Configurações globais do Chart.js para combinar com o tema escuro. */
function setChartDefaults() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = COLORS.muted;
  Chart.defaults.borderColor = COLORS.grid;
  Chart.defaults.animation.duration = prefersReducedMotion ? 0 : 900;
  Chart.defaults.animation.easing = "easeOutQuart";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = "circle";
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.color = COLORS.text;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: "#151b18",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    titleColor: "#f4f7f5",
    bodyColor: "#b4bfb9",
    padding: 12,
    cornerRadius: 10,
    displayColors: true,
    usePointStyle: true,
    boxPadding: 6,
    titleFont: { weight: "600" },
  });
}

/** Cria um gradiente vertical para preencher a área sob a linha. */
function areaGradient(ctx, area) {
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, "rgba(16, 185, 129, 0.35)");
  g.addColorStop(1, "rgba(16, 185, 129, 0)");
  return g;
}

/** Eixo Y com valores em reais abreviados (R$ 1,5 mil). */
const brlTick = (v) => (Math.abs(v) >= 1000 ? `R$ ${formatNumber(v / 1000, v % 1000 ? 1 : 0)} mil` : `R$ ${formatNumber(v)}`);

const ROTATIVO_RATE = 0.14; // 14% ao mês
const ROTATIVO_PRINCIPAL = 1000;

function rotativoSeries(months) {
  const labels = [];
  const values = [];
  for (let m = 0; m <= months; m++) {
    labels.push(m === 0 ? "Início" : `Mês ${m}`);
    values.push(ROTATIVO_PRINCIPAL * Math.pow(1 + ROTATIVO_RATE, m));
  }
  return { labels, values };
}

function initCharts() {
  if (typeof Chart === "undefined") {
    $$(".chart-box").forEach((box) => {
      box.innerHTML = '<p class="muted small" style="padding:24px;text-align:center">Não foi possível carregar os gráficos. Verifique sua conexão com a internet.</p>';
    });
    return;
  }
  setChartDefaults();

  /* --- Gráfico de linha: juros do rotativo --- */
  const { labels, values } = rotativoSeries(12);
  charts.rotativo = new Chart($("#rotativoChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Saldo no rotativo",
          data: values,
          borderColor: COLORS.green,
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
          backgroundColor: (c) => (c.chart.chartArea ? areaGradient(c.chart.ctx, c.chart.chartArea) : COLORS.greenSoft),
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: COLORS.green,
          pointHoverBorderColor: COLORS.surface,
          pointHoverBorderWidth: 3,
        },
        {
          label: "Valor original",
          data: values.map(() => ROTATIVO_PRINCIPAL),
          borderColor: COLORS.neutral,
          borderWidth: 2,
          borderDash: [6, 6],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top", align: "end" },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.dataset.label}: ${formatBRL(c.parsed.y)}`,
            afterBody: (items) => {
              const v = items[0].parsed.y;
              return v > ROTATIVO_PRINCIPAL ? `\nJuros acumulados: ${formatBRL(v - ROTATIVO_PRINCIPAL)}` : "";
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 16 } },
        y: { beginAtZero: true, border: { display: false }, ticks: { callback: brlTick, maxTicksLimit: 6 } },
      },
    },
  });
  $("#rotativo-final").textContent = formatBRL(values[12]);

  // Botões 6 / 12 meses
  $$("[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("[data-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
      const s = rotativoSeries(parseInt(btn.dataset.range, 10));
      charts.rotativo.data.labels = s.labels;
      charts.rotativo.data.datasets[0].data = s.values;
      charts.rotativo.data.datasets[1].data = s.values.map(() => ROTATIVO_PRINCIPAL);
      charts.rotativo.update();
    });
  });

  /* --- Gráfico de barras: fontes de endividamento --- */
  const fontes = [
    ["Cartão de crédito", 85.4],
    ["Carnês", 16.4],
    ["Financ. de carro", 10.9],
    ["Crédito pessoal", 9.5],
    ["Financ. de casa", 8.6],
    ["Consignado", 5.6],
    ["Cheque especial", 3.9],
  ];
  charts.fontes = new Chart($("#fontesChart"), {
    type: "bar",
    data: {
      labels: fontes.map((f) => f[0]),
      datasets: [
        {
          label: "% das famílias endividadas",
          data: fontes.map((f) => f[1]),
          // O cartão de crédito recebe destaque; as demais barras ficam em tom mais discreto
          backgroundColor: fontes.map((_, i) => (i === 0 ? COLORS.green : COLORS.greenMuted)),
          hoverBackgroundColor: fontes.map((_, i) => (i === 0 ? COLORS.greenLight : "#2a8a69")),
          borderRadius: 6,
          borderSkipped: false,
          barThickness: "flex",
          maxBarThickness: 22,
          categoryPercentage: 0.8,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: (c) => `${formatNumber(c.parsed.x, 1)}% das famílias endividadas` },
        },
      },
      scales: {
        x: { beginAtZero: true, max: 100, border: { display: false }, ticks: { callback: (v) => `${v}%`, stepSize: 25 } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: COLORS.text } },
      },
    },
  });
}

/* ---------- 8. SIMULADOR DE DÍVIDA ---------- */
function initSimulator() {
  const amountInput = $("#sim-amount");
  const amountRange = $("#sim-amount-range");
  const rateInput = $("#sim-rate");
  const rateRange = $("#sim-rate-range");
  const presets = $$(".preset");

  /** Atualiza o preenchimento verde do slider. */
  const paintRange = (range) => {
    const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty("--pct", `${clamp(pct, 0, 100)}%`);
  };

  // Cria o gráfico empilhado: valor original + juros acumulados
  if (typeof Chart !== "undefined") {
    charts.sim = new Chart($("#simChart"), {
      type: "bar",
      data: {
        labels: Array.from({ length: 13 }, (_, m) => (m === 0 ? "Hoje" : `${m}º`)),
        datasets: [
          { label: "Valor original", data: [], backgroundColor: COLORS.neutral, borderRadius: 4, borderSkipped: false, stack: "s" },
          { label: "Juros acumulados", data: [], backgroundColor: COLORS.green, hoverBackgroundColor: COLORS.greenLight, borderRadius: 4, borderSkipped: false, stack: "s" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: prefersReducedMotion ? 0 : 450 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "end" },
          tooltip: {
            callbacks: {
              title: (items) => (items[0].dataIndex === 0 ? "Hoje" : `Após ${items[0].dataIndex} ${items[0].dataIndex === 1 ? "mês" : "meses"}`),
              label: (c) => ` ${c.dataset.label}: ${formatBRL(c.parsed.y)}`,
              footer: (items) => `Total: ${formatBRL(items.reduce((sum, i) => sum + i.parsed.y, 0))}`,
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, title: { display: true, text: "Meses", color: COLORS.muted } },
          y: { stacked: true, beginAtZero: true, border: { display: false }, ticks: { callback: brlTick, maxTicksLimit: 6 } },
        },
      },
    });
  }

  /** Recalcula os valores e atualiza cards, gráfico e texto explicativo. */
  const update = () => {
    const principal = clamp(parseFloat(amountInput.value) || 0, 0, 1e7);
    const rate = clamp(parseFloat(rateInput.value) || 0, 0, 100) / 100;
    const totalAt = (m) => principal * Math.pow(1 + rate, m);

    // Cards de 1, 3, 6 e 12 meses
    $$("#sim-results .result").forEach((card) => {
      const m = parseInt(card.dataset.month, 10);
      const total = totalAt(m);
      const growth = principal ? ((total - principal) / principal) * 100 : 0;
      $(".result__value", card).textContent = formatBRL(total);
      $(".result__delta", card).textContent = `+${formatBRL(total - principal)} (${formatNumber(growth, growth < 10 ? 1 : 0)}%)`;
      card.classList.remove("bump");
      void card.offsetWidth;
      card.classList.add("bump");
    });

    // Gráfico
    if (charts.sim) {
      const totals = Array.from({ length: 13 }, (_, m) => totalAt(m));
      charts.sim.data.datasets[0].data = totals.map(() => principal);
      charts.sim.data.datasets[1].data = totals.map((t) => t - principal);
      charts.sim.update();
    }

    // Texto explicativo
    const total12 = totalAt(12);
    const multiple = principal ? total12 / principal : 0;
    const monthsToDouble = rate > 0 ? Math.ceil(Math.log(2) / Math.log(1 + rate)) : null;
    let insight = `Em 12 meses, sua dívida de <strong>${formatBRL(principal)}</strong> vira <strong>${formatBRL(total12)}</strong> — ${formatNumber(multiple, 1)}x o valor inicial.`;
    if (monthsToDouble && monthsToDouble <= 120) {
      insight += ` Com ${formatNumber(rate * 100, 1)}% ao mês, ela <strong>dobra a cada ${monthsToDouble} ${monthsToDouble === 1 ? "mês" : "meses"}</strong>.`;
    }
    const yearRate = (Math.pow(1 + rate, 12) - 1) * 100;
    insight += ` Isso equivale a ${formatNumber(yearRate, yearRate < 100 ? 1 : 0)}% ao ano.`;
    $("#sim-insight").innerHTML = insight;

    // Destaca o atalho correspondente à taxa atual
    presets.forEach((p) => p.classList.toggle("is-active", parseFloat(p.dataset.rate) === parseFloat(rateInput.value)));
  };

  /** Sincroniza campo numérico e slider nos dois sentidos. */
  const link = (input, range) => {
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      if (!Number.isNaN(v)) range.value = clamp(v, range.min, range.max);
      paintRange(range);
      update();
    });
    input.addEventListener("blur", () => {
      const v = clamp(parseFloat(input.value) || parseFloat(input.min), parseFloat(input.min), parseFloat(input.max));
      input.value = v;
      update();
    });
    range.addEventListener("input", () => {
      input.value = range.value;
      paintRange(range);
      update();
    });
    paintRange(range);
  };
  link(amountInput, amountRange);
  link(rateInput, rateRange);

  // Atalhos de taxa
  presets.forEach((p) =>
    p.addEventListener("click", () => {
      rateInput.value = p.dataset.rate;
      rateRange.value = p.dataset.rate;
      paintRange(rateRange);
      update();
    })
  );

  update();
}

/* ---------- 9. CONTEÚDO EDUCATIVO ---------- */

/** Preenche uma barra de taxa até o valor definido em data-value. */
function fillRateBar(bar) {
  if (bar.dataset.done) return;
  bar.dataset.done = "1";
  $(".rate-bar__fill", bar).style.width = `${bar.dataset.value}%`;
}

/** Lê um campo numérico com limites seguros. */
const readNumber = (input, min = 0, max = 1e9) => clamp(parseFloat(input.value) || 0, min, max);

/* ===== 9.1 Crédito fácil: quanto custa de verdade ===== */

/**
 * Descobre a taxa mensal de um empréstimo a partir do valor recebido,
 * da parcela e do número de parcelas (Tabela Price), por bissecção.
 */
function impliedMonthlyRate(principal, installment, count) {
  if (principal <= 0 || installment * count <= principal) return 0;
  const pv = (i) => installment * (1 - Math.pow(1 + i, -count)) / i;
  let lo = 1e-9;
  let hi = 5; // 500% ao mês: limite superior seguro
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > principal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function initCustoReal() {
  const amount = $("#cf-amount");
  const installment = $("#cf-installment");
  const count = $("#cf-count");

  const update = () => {
    const p = readNumber(amount, 0, 1e7);
    const pmt = readNumber(installment, 0, 1e7);
    const n = Math.round(readNumber(count, 1, 120));
    const total = pmt * n;
    const interest = Math.max(0, total - p);
    const rate = impliedMonthlyRate(p, pmt, n);
    const yearRate = Math.pow(1 + rate, 12) - 1;

    $("#cf-ad").textContent = `“Pegue ${formatBRL(p, 0)} hoje e pague só ${n}x de ${formatBRL(pmt)}!”`;
    $("#cf-total").textContent = formatBRL(total);
    $("#cf-interest").textContent = formatBRL(interest);
    $("#cf-rate-m").textContent = `${formatNumber(rate * 100, 1)}%`;
    $("#cf-rate-y").textContent = `${formatNumber(yearRate * 100, yearRate < 10 ? 1 : 0)}%`;

    const share = total > 0 ? (interest / Math.max(total, p)) * 100 : 0;
    $("#cf-bar-principal").style.width = `${100 - share}%`;
    $("#cf-bar-interest").style.width = `${share}%`;

    let verdict;
    if (total <= p) verdict = "Essa oferta não cobra juros. Mesmo assim, confira se não há tarifas ou seguros embutidos no CET.";
    else if (rate < 0.02) verdict = `Juros de ${formatNumber(rate * 100, 1)}% ao mês estão na faixa de créditos mais baratos, como o consignado. Mesmo assim, você paga ${formatBRL(interest)} a mais.`;
    else if (rate < 0.06) verdict = `Você devolve ${formatNumber(total / p, 2)}x o que recebeu. É um crédito caro: compare com outras opções antes de aceitar.`;
    else verdict = `Cuidado: ${formatNumber((interest / p) * 100, 0)}% do valor recebido vai só para juros. Essa taxa é típica do crédito fácil.`;
    $("#cf-verdict").textContent = verdict;
  };

  [amount, installment, count].forEach((el) => el.addEventListener("input", update));
  update();
}

/* ===== 9.2 Endividamento: ciclo, termômetro e sinais de alerta ===== */
const CYCLE_STEPS = [
  { title: "Gasto acima da renda", text: "Compras por impulso ou emergências sem reserva fazem os gastos ultrapassarem o salário." },
  { title: "Uso do crédito fácil", text: "Para cobrir a diferença, a pessoa recorre ao cartão, ao cheque especial ou a empréstimos rápidos." },
  { title: "Pagamento do mínimo", text: "Sem dinheiro para quitar a fatura, paga-se só o mínimo. O restante vai para o rotativo." },
  { title: "Juros sobre juros", text: "Os juros compostos fazem o saldo crescer todo mês, mesmo sem novas compras." },
  { title: "Nova dívida", text: "Para pagar a dívida antiga, faz-se uma nova. O orçamento fica ainda menor e o ciclo recomeça." },
];

function initCycle() {
  const nodes = $$(".cycle__node");
  const items = $$("#cycle-list li");
  const center = $(".cycle__center");
  let current = 0;
  let timer;

  const show = (index) => {
    current = index;
    nodes.forEach((n, i) => n.classList.toggle("is-active", i === index));
    items.forEach((n, i) => n.classList.toggle("is-active", i === index));
    $("#cycle-num").textContent = `ETAPA ${String(index + 1).padStart(2, "0")}`;
    $("#cycle-title").textContent = CYCLE_STEPS[index].title;
    $("#cycle-text").textContent = CYCLE_STEPS[index].text;
    center.classList.remove("swap");
    void center.offsetWidth;
    center.classList.add("swap");
  };

  const startAuto = () => {
    clearInterval(timer);
    if (!prefersReducedMotion) timer = setInterval(() => show((current + 1) % nodes.length), 3500);
  };

  [...nodes, ...items].forEach((el) => {
    const i = parseInt(el.dataset.step, 10);
    const pick = () => { clearInterval(timer); show(i); };
    el.addEventListener("mouseenter", pick);
    el.addEventListener("focus", pick);
    el.addEventListener("click", pick);
    el.addEventListener("mouseleave", startAuto);
  });

  show(0);
  startAuto();
}

/** Converte uma porcentagem (0–100) em ponto do arco do termômetro. */
function gaugePoint(pct, radius) {
  const angle = Math.PI - (pct / 100) * Math.PI;
  return { x: 110 + radius * Math.cos(angle), y: 110 - radius * Math.sin(angle) };
}

function initThermometer() {
  const income = $("#th-income");
  const debts = $("#th-debts");
  const fill = $("#gauge-fill");
  const length = fill.getTotalLength();
  fill.style.strokeDasharray = `${length}`;

  // Marcas de 0%, 30%, 50% e 100% no arco
  const ticks = $("#gauge-ticks");
  ticks.innerHTML = [0, 30, 50, 100]
    .map((t) => {
      const a = gaugePoint(t, 80);
      const b = gaugePoint(t, 100);
      const label = gaugePoint(t, 112);
      return `<line class="gauge__tick-line" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />` +
        `<text class="gauge__tick" x="${label.x}" y="${label.y + 3}" text-anchor="middle">${t}%</text>`;
    })
    .join("");

  const update = () => {
    const r = readNumber(income, 0, 1e9);
    const d = readNumber(debts, 0, 1e9);
    const pct = r > 0 ? (d / r) * 100 : d > 0 ? 100 : 0;
    const shown = clamp(pct, 0, 100);

    let zone;
    if (pct <= 30) zone = { cls: "good", color: "var(--green-500)", label: "Saudável", msg: `Ótimo! Sobram ${formatBRL(Math.max(0, r - d))} para gastos essenciais, lazer e reserva. Mantenha as parcelas abaixo de 30% da renda.` };
    else if (pct <= 50) zone = { cls: "warning", color: "var(--warn)", label: "Atenção", msg: `Atenção: ${formatNumber(pct, 0)}% da renda já está comprometida. Evite novas parcelas e tente quitar primeiro as dívidas com juros mais altos.` };
    else zone = { cls: "critical", color: "var(--danger)", label: "Risco de superendividamento", msg: `Mais da metade da renda vai para dívidas. Sobra pouco para viver. Procure renegociar: a Lei do Superendividamento garante um plano que preserva o mínimo para viver.` };

    fill.style.strokeDashoffset = `${length * (1 - shown / 100)}`;
    fill.style.stroke = zone.color;
    $("#th-pct").textContent = `${formatNumber(pct, 0)}%`;
    const status = $("#th-status");
    status.className = `status status--${zone.cls}`;
    status.textContent = zone.label;
    $("#th-message").textContent = zone.msg;
  };

  [income, debts].forEach((el) => el.addEventListener("input", update));
  update();
}

function initChecklist() {
  const boxes = $$("#checklist input");
  const update = () => {
    const n = boxes.filter((b) => b.checked).length;
    let level;
    if (n === 0) level = { cls: "good", label: "Tudo tranquilo", text: "Nenhum sinal marcado. Continue acompanhando seus gastos.", color: "var(--green-500)" };
    else if (n <= 2) level = { cls: "good", label: "Fique de olho", text: `${n} sinal${n > 1 ? "is" : ""} de alerta. Ainda dá para ajustar com pequenas mudanças no orçamento.`, color: "var(--green-500)" };
    else if (n <= 4) level = { cls: "warning", label: "Atenção", text: `${n} sinais de alerta. É hora de listar as dívidas e cortar o uso do crédito caro.`, color: "var(--warn)" };
    else level = { cls: "critical", label: "Alerta", text: `${n} sinais de alerta. Siga o passo a passo abaixo e procure renegociar o quanto antes.`, color: "var(--danger)" };

    const bar = $("#alert-bar");
    bar.style.width = `${(n / boxes.length) * 100}%`;
    bar.style.background = level.color;
    const status = $("#alert-status");
    status.className = `status status--${level.cls}`;
    status.textContent = level.label;
    $("#alert-text").textContent = level.text;
  };
  boxes.forEach((b) => b.addEventListener("change", update));
  update();
}

/* ===== 9.3 Cartão: fatura, mínimo x total, melhor dia e mitos ===== */
const BILL_SPOTS = [
  { title: "Total da fatura", text: "É a soma de todas as compras do mês, incluindo as parcelas que vencem agora.", tip: "Pague sempre este valor. Assim você não paga nenhum centavo de juros." },
  { title: "Pagamento mínimo", text: "O menor valor que o banco aceita para você não ficar inadimplente. Aqui, 15% do total.", tip: "Pagar só o mínimo faz os outros R$ 1.566,46 irem para o rotativo, com juros de 13,9% ao mês." },
  { title: "Vencimento", text: "Data limite para pagar. Depois dela, além dos juros, há multa de 2% e juros de mora de 1% ao mês.", tip: "Coloque a fatura no débito automático ou crie um lembrete alguns dias antes." },
  { title: "Fechamento e melhor dia de compra", text: "Compras feitas a partir do fechamento só entram na fatura do mês seguinte.", tip: "Comprar no dia do fechamento dá o maior prazo para pagar, cerca de 37 dias." },
  { title: "Parcelas das próximas faturas", text: "Compras parceladas já comprometem as faturas dos próximos meses, mesmo que você não compre mais nada.", tip: "Some sempre as parcelas futuras antes de parcelar algo novo." },
  { title: "Limite disponível", text: "O parcelado ocupa o limite pelo valor total da compra. Por isso, sobram só R$ 370,30 de R$ 4.000.", tip: "Limite é dinheiro do banco, não seu. Use no máximo 30% dele." },
  { title: "Juros do rotativo e CET", text: "A fatura é obrigada a informar a taxa do rotativo e o Custo Efetivo Total (CET), que inclui juros, tarifas e impostos.", tip: "13,9% ao mês viram mais de 400% ao ano. Compare esse número antes de usar o crédito." },
];

function initBill() {
  const spots = $$(".hotspot");
  const panel = $("#bill-explain");
  let current = 0;

  const show = (i) => {
    current = (i + BILL_SPOTS.length) % BILL_SPOTS.length;
    const s = BILL_SPOTS[current];
    $("#spot-num").textContent = current + 1;
    $("#spot-title").textContent = s.title;
    $("#spot-text").textContent = s.text;
    $("#spot-tip").textContent = s.tip;
    spots.forEach((b) => b.classList.toggle("is-active", parseInt(b.dataset.spot, 10) === current));
    panel.classList.remove("swap");
    void panel.offsetWidth;
    panel.classList.add("swap");
  };

  spots.forEach((b) => b.addEventListener("click", () => show(parseInt(b.dataset.spot, 10))));
  $("#spot-prev").addEventListener("click", () => show(current - 1));
  $("#spot-next").addEventListener("click", () => show(current + 1));
  show(0);
}

/**
 * Simula a fatura pagando só o mínimo todo mês, sem novas compras.
 * Com o teto legal, o total de juros não passa de 100% do valor original.
 */
function simulateMinimum(bill, rate, minPct, cap) {
  const MIN_FLOOR = 50; // valor mínimo em reais, como fazem os bancos
  const MAX_MONTHS = 240;
  let balance = bill;
  let paid = 0;
  let interestTotal = 0;
  const series = { balance: [bill], paid: [0] };
  let months = 0;

  while (balance > 0.005 && months < MAX_MONTHS) {
    months++;
    const payment = Math.min(balance, Math.max(balance * minPct, MIN_FLOOR));
    paid += payment;
    balance -= payment;
    if (balance > 0.005) {
      let interest = balance * rate;
      if (cap) interest = Math.min(interest, Math.max(0, bill - interestTotal));
      balance += interest;
      interestTotal += interest;
    }
    series.balance.push(Math.max(0, balance));
    series.paid.push(paid);
  }
  return { months, paid, interestTotal, unfinished: balance > 0.005, series };
}

function initMinimum() {
  const bill = $("#mt-bill");
  const rate = $("#mt-rate");
  const min = $("#mt-min");
  const cap = $("#mt-cap");

  if (typeof Chart !== "undefined") {
    charts.min = new Chart($("#minChart"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Total já pago", data: [], borderColor: COLORS.green, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, tension: 0.25, fill: false },
          { label: "Saldo devedor", data: [], borderColor: "#f87171", borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.25, fill: false },
          { label: "Valor da fatura", data: [], borderColor: COLORS.neutral, borderWidth: 2, borderDash: [6, 6], pointRadius: 0, pointHoverRadius: 0, fill: false },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: prefersReducedMotion ? 0 : 450 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "end" },
          tooltip: {
            filter: (item) => item.datasetIndex !== 2,
            callbacks: {
              title: (items) => (items[0].dataIndex === 0 ? "Hoje" : `Mês ${items[0].dataIndex}`),
              label: (c) => ` ${c.dataset.label}: ${formatBRL(c.parsed.y)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 18 }, title: { display: true, text: "Meses", color: COLORS.muted } },
          y: { beginAtZero: true, border: { display: false }, ticks: { callback: brlTick, maxTicksLimit: 6 } },
        },
      },
    });
  }

  const update = () => {
    const b = readNumber(bill, 0, 1e7);
    const r = readNumber(rate, 0, 100) / 100;
    const m = readNumber(min, 1, 100) / 100;
    const sim = simulateMinimum(b, r, m, cap.checked);

    $("#mt-total-paid").textContent = formatBRL(b);
    $("#mt-min-paid").textContent = sim.unfinished ? `+ de ${formatBRL(sim.paid, 0)}` : formatBRL(sim.paid);
    const years = sim.months / 12;
    const timeText = sim.unfinished ? "mais de 20 anos" : sim.months < 12 ? `${sim.months} meses` : `${sim.months} meses (${formatNumber(years, 1)} anos)`;
    $("#mt-min-info").textContent = `em ${timeText}, com ${formatBRL(sim.interestTotal)} de juros`;

    if (charts.min) {
      charts.min.data.labels = sim.series.paid.map((_, i) => (i === 0 ? "Hoje" : `${i}`));
      charts.min.data.datasets[0].data = sim.series.paid;
      charts.min.data.datasets[1].data = sim.series.balance;
      charts.min.data.datasets[2].data = sim.series.paid.map(() => b);
      charts.min.update();
    }

    const extra = sim.paid - b;
    $("#mt-insight").innerHTML = b > 0
      ? `Pagando só o mínimo, você leva <strong>${timeText}</strong> para quitar e paga <strong>${formatBRL(extra)} a mais</strong> do que se pagasse a fatura inteira hoje${cap.checked ? ", mesmo com o teto da lei" : ""}.`
      : "Informe o valor da fatura para simular.";
  };

  [bill, rate, min].forEach((el) => el.addEventListener("input", update));
  cap.addEventListener("change", update);
  update();
}

function initCalendar() {
  const close = $("#cal-close");
  const buy = $("#cal-buy");
  const DUE_OFFSET = 7; // dias entre fechamento e vencimento
  const DAY = 86400000;

  close.innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">Dia ${i + 1}</option>`).join("");
  close.value = "8";

  const fmt = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const update = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const closeDay = parseInt(close.value, 10);
    const buyDay = parseInt(buy.value, 10);

    const purchase = new Date(y, m, buyDay);
    // Compras a partir do dia do fechamento entram na fatura seguinte
    let closing = new Date(y, m, closeDay);
    if (purchase >= closing) closing = new Date(y, m + 1, closeDay);
    const due = new Date(closing.getTime() + DUE_OFFSET * DAY);
    const days = Math.round((due - purchase) / DAY);

    // Linha do tempo: escala de 0 a 40 dias a partir da compra
    const SPAN = 40;
    const pos = (d) => `${clamp(((d - purchase) / DAY / SPAN) * 100, 0, 100)}%`;
    $("#cal-buy-label").textContent = buyDay;
    $("#tl-buy").style.left = "0%";
    $("#tl-close").style.left = pos(closing);
    $("#tl-due").style.left = pos(due);
    $("#tl-fill").style.width = pos(due);
    $("#tl-buy strong").textContent = fmt(purchase);
    $("#tl-close strong").textContent = fmt(closing);
    $("#tl-due strong").textContent = fmt(due);
    $("#cal-days").textContent = days;

    let text;
    if (days >= 30) text = `Ótimo momento! A compra entra só na fatura que fecha em ${fmt(closing)}, e você tem ${days} dias para pagar sem juros.`;
    else if (days >= 15) text = `Prazo razoável. Se puder esperar até o dia ${closeDay}, você ganha ${DUE_OFFSET + 30 - days} dias a mais.`;
    else text = `Pior momento para comprar: faltam poucos dias para o fechamento, e a conta chega em ${days} dias. Espere até o dia ${closeDay}, o melhor dia de compra.`;
    $("#cal-text").textContent = text;
  };

  close.addEventListener("change", update);
  buy.addEventListener("input", () => {
    buy.style.setProperty("--pct", `${((buy.value - buy.min) / (buy.max - buy.min)) * 100}%`);
    update();
  });
  buy.style.setProperty("--pct", `${((buy.value - buy.min) / (buy.max - buy.min)) * 100}%`);
  update();
}

function initMyths() {
  $$(".myth").forEach((card) => {
    card.setAttribute("aria-pressed", "false");
    card.addEventListener("click", () => {
      const flipped = card.classList.toggle("is-flipped");
      card.setAttribute("aria-pressed", String(flipped));
    });
  });
}

/* ---------- 10. QUIZ ---------- */
/** Banco de perguntas: a cada rodada, 5 são sorteadas. */
const QUIZ_BANK = [
  {
    q: "Se você paga apenas o valor mínimo da fatura do cartão, o que acontece com o restante?",
    options: ["É perdoado pelo banco", "Vai para o crédito rotativo, com juros altíssimos", "É dividido sem juros na próxima fatura", "Fica congelado até você ter dinheiro"],
    answer: 1,
    explain: "O saldo não pago entra no rotativo, uma das linhas de crédito mais caras do Brasil. Sempre que possível, pague o valor total.",
  },
  {
    q: "O limite do cartão de crédito representa:",
    options: ["Um dinheiro extra que faz parte da sua renda", "O valor que você ganhou do banco", "Um empréstimo que o banco oferece e que precisa ser pago", "O quanto você deve gastar por mês"],
    answer: 2,
    explain: "Limite não é renda! É dinheiro emprestado. O ideal é usar no máximo cerca de 30% do limite e nunca mais do que você ganha.",
  },
  {
    q: "Qual destas opções costuma ter os juros MAIS BAIXOS?",
    options: ["Rotativo do cartão", "Cheque especial", "Saque com o cartão de crédito", "Empréstimo consignado"],
    answer: 3,
    explain: "O consignado é descontado direto do salário ou benefício, o que reduz o risco para o banco e, por isso, tem juros bem menores.",
  },
  {
    q: "Ao comparar empréstimos, o que significa a sigla CET?",
    options: ["Crédito Especial Temporário", "Custo Efetivo Total", "Cobrança de Encargos e Taxas", "Cadastro de Empréstimo Tributado"],
    answer: 1,
    explain: "O CET reúne juros, tarifas, seguros e impostos. É o número certo para comparar quanto um crédito realmente custa.",
  },
  {
    q: "Você percebeu que tem várias dívidas. Qual é a melhor primeira atitude?",
    options: ["Pegar um novo empréstimo rápido para pagar tudo", "Listar todas as dívidas, cortar gastos e negociar", "Ignorar as cobranças até elas sumirem", "Usar outro cartão para pagar a fatura do primeiro"],
    answer: 1,
    explain: "Conhecer o tamanho do problema é o primeiro passo. Depois, priorize as dívidas com juros mais altos e negocie descontos.",
  },
  {
    q: "Um app oferece R$ 1.000 na hora, para pagar em 12x de R$ 150. Quanto você pagaria de juros?",
    options: ["R$ 150", "R$ 500", "R$ 800", "Nada, porque é parcelado"],
    answer: 2,
    explain: "12 × R$ 150 = R$ 1.800. Você recebe R$ 1.000 e devolve R$ 1.800: são R$ 800 só de juros, uma taxa de cerca de 10% ao mês.",
  },
  {
    q: "Uma empresa pede um “depósito de taxa” para liberar seu empréstimo. Isso indica:",
    options: ["Que o empréstimo foi aprovado", "Uma prática normal dos bancos", "Um provável golpe", "Que os juros serão menores"],
    answer: 2,
    explain: "Instituições sérias nunca cobram valores antecipados para liberar crédito. Esse é um dos golpes mais comuns.",
  },
  {
    q: "Qual é o melhor dia para fazer uma compra no cartão?",
    options: ["O dia do vencimento", "O dia do fechamento da fatura", "Um dia antes do fechamento", "Qualquer dia, tanto faz"],
    answer: 1,
    explain: "Compras feitas no dia do fechamento só entram na fatura seguinte. Assim você ganha cerca de 37 dias para pagar sem juros.",
  },
  {
    q: "Segundo educadores financeiros, as parcelas de dívidas não deveriam passar de quanto da renda?",
    options: ["Cerca de 10%", "Cerca de 30%", "Cerca de 60%", "Não existe limite"],
    answer: 1,
    explain: "Até 30% da renda é a referência para manter o orçamento saudável. Acima de 50%, há risco de superendividamento.",
  },
  {
    q: "O que a Lei 14.690/2023 mudou no rotativo do cartão?",
    options: ["Proibiu o uso do cartão de crédito", "Limitou juros e encargos a 100% do valor da dívida", "Acabou com o pagamento mínimo", "Zerou os juros do cartão"],
    answer: 1,
    explain: "Desde 2024, os juros e encargos do rotativo e do parcelamento da fatura não podem passar do valor original da dívida. Ainda assim, é muito caro.",
  },
];
const QUIZ_SIZE = 5;

/** Embaralha uma cópia de um array (Fisher–Yates). */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sorteia as perguntas da rodada e embaralha as alternativas de cada uma. */
function pickQuestions() {
  return shuffle(QUIZ_BANK).slice(0, QUIZ_SIZE).map((item) => {
    const order = shuffle(item.options.map((_, i) => i));
    return { ...item, options: order.map((i) => item.options[i]), answer: order.indexOf(item.answer) };
  });
}

/** Feedback final de acordo com a pontuação. */
const QUIZ_FEEDBACK = [
  { min: 100, title: "Mestre das finanças! 🏆", text: "Você acertou tudo. Já tem a base para usar o crédito com inteligência — compartilhe esse conhecimento com a família e os amigos." },
  { min: 80, title: "Muito bem! 💚", text: "Você está no caminho certo. Revise a explicação da questão que errou e você estará pronto para qualquer armadilha." },
  { min: 60, title: "Bom começo! 📈", text: "Você conhece o básico, mas alguns pontos merecem atenção. Releia a seção “Aprenda” e use o simulador para fixar os conceitos." },
  { min: 0, title: "Hora de aprender! 📚", text: "Não se preocupe: todo mundo começa de algum lugar. Explore a seção “Aprenda” e tente o quiz de novo — você vai se surpreender." },
];

function initQuiz() {
  const screens = { start: $("#quiz-start"), question: $("#quiz-question"), result: $("#quiz-result") };
  const optionsEl = $("#quiz-options");
  const feedbackEl = $("#quiz-feedback");
  const nextBtn = $("#quiz-next");
  const LETTERS = ["A", "B", "C", "D"];

  let questions = [];
  let index = 0;
  let score = 0;
  let answers = [];

  const showScreen = (name) => Object.entries(screens).forEach(([k, el]) => (el.hidden = k !== name));

  const setProgress = (done) => {
    const pct = (done / questions.length) * 100;
    $("#quiz-progress-fill").style.width = `${pct}%`;
    $("#quiz-progress").setAttribute("aria-valuenow", String(Math.round(pct)));
  };

  const renderQuestion = () => {
    const item = questions[index];
    $("#quiz-count").textContent = `Pergunta ${index + 1} de ${questions.length}`;
    $("#quiz-score").textContent = score;
    $("#quiz-q").textContent = item.q;
    feedbackEl.hidden = true;
    nextBtn.disabled = true;
    nextBtn.textContent = index === questions.length - 1 ? "Ver resultado" : "Próxima";
    setProgress(index);

    optionsEl.innerHTML = "";
    item.options.forEach((text, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.innerHTML = `<span class="option__key">${LETTERS[i]}</span><span></span>`;
      btn.lastChild.textContent = text;
      btn.addEventListener("click", () => choose(i));
      optionsEl.appendChild(btn);
    });

    // Reinicia a animação da tela
    screens.question.style.animation = "none";
    void screens.question.offsetWidth;
    screens.question.style.animation = "";
  };

  const choose = (i) => {
    const item = questions[index];
    const correct = i === item.answer;
    const buttons = $$(".option", optionsEl);

    buttons.forEach((b, j) => {
      b.disabled = true;
      if (j === item.answer) b.classList.add("is-correct");
      else if (j === i) b.classList.add("is-wrong");
      else b.classList.add("is-dim");
    });

    if (correct) score += 20;
    answers.push(correct);
    $("#quiz-score").textContent = score;
    setProgress(index + 1);

    feedbackEl.className = `quiz__feedback quiz__feedback--${correct ? "ok" : "bad"}`;
    feedbackEl.innerHTML = `<strong>${correct ? "Resposta certa! +20 pontos" : `Não foi dessa vez. A resposta é ${LETTERS[item.answer]}.`}</strong>`;
    feedbackEl.appendChild(document.createTextNode(item.explain));
    feedbackEl.hidden = false;
    nextBtn.disabled = false;
    nextBtn.focus({ preventScroll: true });
  };

  const showResult = () => {
    showScreen("result");
    const fb = QUIZ_FEEDBACK.find((f) => score >= f.min);
    $("#result-title").textContent = fb.title;
    $("#result-text").textContent = fb.text;
    $("#result-review").innerHTML = answers
      .map((ok, i) => `<span class="${ok ? "ok" : "bad"}" title="Pergunta ${i + 1}: ${ok ? "acertou" : "errou"}">${i + 1}</span>`)
      .join("");

    // Anel de pontuação + número subindo
    const ring = $("#score-ring-fill");
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDashoffset = circumference;
    ring.style.stroke = score >= 60 ? "" : "var(--warn)";
    requestAnimationFrame(() => setTimeout(() => (ring.style.strokeDashoffset = circumference * (1 - score / 100)), 60));
    const scoreEl = $("#result-score");
    scoreEl.dataset.target = score;
    scoreEl.dataset.done = "";
    animateCounter(scoreEl);

    // Guarda a melhor pontuação do usuário
    if (currentUser && (currentUser.bestScore == null || score > currentUser.bestScore)) {
      currentUser.bestScore = score;
      updateUser(currentUser.email, { bestScore: score });
      if (score > 0) showToast(`Novo recorde pessoal: ${score} pontos!`);
    }
    updateBestScoreLabel();
  };

  const start = () => {
    questions = pickQuestions();
    index = 0;
    score = 0;
    answers = [];
    showScreen("question");
    renderQuestion();
  };

  $("#quiz-start-btn").addEventListener("click", start);
  $("#quiz-restart").addEventListener("click", start);
  nextBtn.addEventListener("click", () => {
    index++;
    if (index < questions.length) renderQuestion();
    else showResult();
  });

  // Atalhos de teclado: A–D (ou 1–4) para responder, Enter para avançar
  document.addEventListener("keydown", (e) => {
    if (screens.question.hidden || e.target.matches("input")) return;
    const key = e.key.toUpperCase();
    const idx = LETTERS.indexOf(key) !== -1 ? LETTERS.indexOf(key) : ["1", "2", "3", "4"].indexOf(key);
    const buttons = $$(".option", optionsEl);
    if (idx !== -1 && buttons[idx] && !buttons[idx].disabled) {
      const rect = screens.question.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) buttons[idx].click();
    }
  });
}

/** Mostra a melhor pontuação do usuário na tela inicial do quiz. */
function updateBestScoreLabel() {
  const best = currentUser?.bestScore;
  $("#quiz-best").textContent = best != null ? `Sua melhor pontuação: ${best}/100` : "";
}

/* ---------- 11. PONTO DE ENTRADA ---------- */
document.addEventListener("DOMContentLoaded", () => {
  initAuth();

  // Se já houver sessão salva, entra direto no dashboard
  const session = Store.get(STORAGE_SESSION, null);
  const user = session && findUser(session.email);
  if (user) {
    showApp(user);
  } else {
    Store.remove(STORAGE_SESSION);
    $("#auth-view").hidden = false;
  }
});
