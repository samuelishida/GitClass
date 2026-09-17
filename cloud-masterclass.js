(function () {
  "use strict";
  document.documentElement.classList.add("js-enabled");
  const slides = Array.from(document.querySelectorAll(".slide"));
  let currentIndex = 0;
  let previousFocus = null;
  let currentLanguage = "en-US";
  const originalText = new WeakMap();
  const translationNode = document.getElementById("i18n-data");
  let pageTranslations = {};
  try { pageTranslations = translationNode ? JSON.parse(translationNode.textContent) : {}; } catch (error) { pageTranslations = {}; }

  const UI_PT = {
    "Print": "Imprimir",
    "Back": "Voltar",
    "Present": "Apresentar",
    "Exit": "Sair",
    "Close": "Fechar",
    "Controls": "Controles",
    "navigate.": "navegue.",
    "jump.": "avance.",
    "opens help.": "abre ajuda.",
    "toggles print.": "alterna impressão.",
    "exits presentation.": "sai da apresentação.",
    "Reveal answer": "Revelar resposta",
    "Hide answer": "Ocultar resposta",
    "Copied": "Copiado",
    "Select manually": "Selecione manualmente",
    "lessons": "lições"
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function renderNav() {
    const nav = document.getElementById("slide-nav");
    if (!nav) return;
    nav.innerHTML = slides.map(function (slide, index) {
      const title = slide.querySelector("h1,h2")?.textContent || slide.id;
      return '<button class="dot" type="button" data-slide-index="' + index + '" aria-label="Go to slide ' + (index + 1) + ': ' + escapeHtml(title) + '" aria-current="' + (index === 0 ? "true" : "false") + '"></button>';
    }).join("");
  }

  function goToSlide(index, updateHash) {
    if (!slides.length) return;
    const next = Math.max(0, Math.min(index, slides.length - 1));
    currentIndex = next;
    slides.forEach(function (slide, i) {
      const active = i === next;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });
    document.querySelectorAll(".dot").forEach(function (dot, i) {
      dot.setAttribute("aria-current", i === next ? "true" : "false");
    });
    const percent = slides.length <= 1 ? 100 : (next / (slides.length - 1)) * 100;
    document.getElementById("progress-bar").style.width = percent + "%";
    updateProgressLabel(next);
    document.getElementById("prev-btn").disabled = next === 0;
    document.getElementById("next-btn").disabled = next === slides.length - 1;
    if (updateHash !== false) history.replaceState(null, "", "#" + slides[next].id);
    if (document.activeElement && document.activeElement.closest(".slide")) slides[next].focus({ preventScroll: true });
    slides[next].scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function goToHash() {
    const hash = window.location.hash.replace(/^#/, "");
    const index = slides.findIndex(function (slide) { return slide.id === hash; });
    goToSlide(index >= 0 ? index : 0, false);
  }

  function copyText(text, button) {
    const done = function () {
      const original = button.textContent;
      button.textContent = currentLanguage === "pt-BR" ? "Copiado" : "Copied";
      document.getElementById("live-status").textContent = currentLanguage === "pt-BR" ? "Código copiado" : "Code copied";
      window.setTimeout(function () { button.textContent = original; }, 1200);
    };
    const fallback = function () {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); done(); } catch (error) { button.textContent = "Select manually"; }
      area.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done).catch(fallback);
    else fallback();
  }

  function toggleAnswer(button) {
    const target = document.getElementById(button.getAttribute("aria-controls"));
    if (!target) return;
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    target.hidden = !open;
    button.textContent = open
      ? (currentLanguage === "pt-BR" ? "Ocultar resposta" : "Hide answer")
      : (currentLanguage === "pt-BR" ? "Revelar resposta" : "Reveal answer");
  }

  function updateFilter(value) {
    const query = value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll(".coverage-item").forEach(function (item) {
      const match = !query || item.getAttribute("data-search").includes(query);
      item.hidden = !match;
      if (match) visible++;
    });
    const count = document.getElementById("coverage-count");
    if (count) count.textContent = visible + " " + (currentLanguage === "pt-BR" ? "lições" : "lessons");
  }

  function updateProgressLabel(index) {
    const suffix = currentLanguage === "pt-BR" ? " de " : " of ";
    const label = "Slide " + (index + 1) + suffix + slides.length;
    document.getElementById("progress-label").textContent = label;
    document.getElementById("live-status").textContent = label;
  }

  function preserveSpacing(original, replacement) {
    const leading = (original.match(/^\s*/) || [""])[0];
    const trailing = (original.match(/\s*$/) || [""])[0];
    return leading + replacement + trailing;
  }

  function translatePage() {
    const map = Object.assign({}, UI_PT, pageTranslations.ptBR || {});
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while (node = walker.nextNode()) nodes.push(node);
    nodes.forEach(function (textNode) {
      if (textNode.parentElement && textNode.parentElement.closest("script, style, code, pre")) return;
      if (!originalText.has(textNode)) originalText.set(textNode, textNode.nodeValue);
      const source = originalText.get(textNode);
      const key = source.trim();
      const translated = currentLanguage === "pt-BR" ? map[key] : key;
      if (translated) textNode.nodeValue = preserveSpacing(source, translated);
      else if (currentLanguage === "en-US") textNode.nodeValue = source;
    });
    document.documentElement.lang = currentLanguage;
    const languageButton = document.getElementById("lang-btn");
    if (languageButton) {
      languageButton.textContent = currentLanguage === "pt-BR" ? "EN-US" : "PT-BR";
      languageButton.setAttribute("aria-pressed", String(currentLanguage === "pt-BR"));
      languageButton.setAttribute("aria-label", currentLanguage === "pt-BR" ? "Switch to US English" : "Mudar para português do Brasil");
    }
    const filter = document.getElementById("deck-filter");
    if (filter) {
      const sourcePlaceholder = filter.getAttribute("data-en-placeholder") || filter.placeholder;
      if (!filter.hasAttribute("data-en-placeholder")) filter.setAttribute("data-en-placeholder", sourcePlaceholder);
      filter.placeholder = currentLanguage === "pt-BR" ? (map[sourcePlaceholder] || sourcePlaceholder) : sourcePlaceholder;
      updateFilter(filter.value);
    }
    document.querySelectorAll(".copy-btn").forEach(function (button) { button.textContent = currentLanguage === "pt-BR" ? "Copiar" : "Copy"; });
    document.querySelectorAll(".answer-toggle").forEach(function (button) {
      const open = button.getAttribute("aria-expanded") === "true";
      button.textContent = open
        ? (currentLanguage === "pt-BR" ? "Ocultar resposta" : "Hide answer")
        : (currentLanguage === "pt-BR" ? "Revelar resposta" : "Reveal answer");
    });
    updateProgressLabel(currentIndex);
  }

  function togglePresentation(force) {
    const active = force === undefined ? !document.body.classList.contains("present-mode") : force;
    document.body.classList.toggle("present-mode", active);
    const button = document.getElementById("present-btn");
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active
      ? (currentLanguage === "pt-BR" ? "Sair" : "Exit")
      : (currentLanguage === "pt-BR" ? "Apresentar" : "Present");
    if (!active) goToSlide(currentIndex, false);
  }

  function togglePrint(force) {
    const active = force === undefined ? !document.body.classList.contains("print-preview") : force;
    document.body.classList.toggle("print-preview", active);
    const button = document.getElementById("print-btn");
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active
      ? (currentLanguage === "pt-BR" ? "Voltar" : "Back")
      : (currentLanguage === "pt-BR" ? "Imprimir" : "Print");
  }

  function toggleLanguage() {
    currentLanguage = currentLanguage === "en-US" ? "pt-BR" : "en-US";
    translatePage();
  }

  function toggleHelp(show) {
    const panel = document.getElementById("help-panel");
    const backdrop = document.getElementById("backdrop");
    panel.hidden = !show;
    backdrop.hidden = !show;
    if (show) { previousFocus = document.activeElement; document.getElementById("close-help").focus(); }
    else if (previousFocus) { previousFocus.focus(); previousFocus = null; }
  }

  function isEditable(target) {
    return target && (target.matches("input, textarea, select, [contenteditable='true']") || target.closest("input, textarea, select, [contenteditable='true']"));
  }

  document.addEventListener("click", function (event) {
    const copy = event.target.closest("[data-copy]");
    if (copy) { copyText(copy.getAttribute("data-copy"), copy); return; }
    const answer = event.target.closest(".answer-toggle");
    if (answer) { toggleAnswer(answer); return; }
    const dot = event.target.closest("[data-slide-index]");
    if (dot) { goToSlide(Number(dot.getAttribute("data-slide-index"))); return; }
    const link = event.target.closest(".coverage-item");
    if (link) {
      event.preventDefault();
      const card = document.getElementById(link.getAttribute("href").slice(1));
      const parent = card && card.closest(".slide");
      const slideIndex = slides.indexOf(parent);
      if (slideIndex >= 0) window.setTimeout(function () { goToSlide(slideIndex); if (card) card.scrollIntoView({ block: "center", behavior: "smooth" }); }, 0);
    }
  });

  document.getElementById("present-btn").addEventListener("click", function () { togglePresentation(); });
  document.getElementById("lang-btn").addEventListener("click", toggleLanguage);
  document.getElementById("print-btn").addEventListener("click", function () { togglePrint(true); window.setTimeout(function () { window.print(); }, 80); });
  document.getElementById("prev-btn").addEventListener("click", function () { goToSlide(currentIndex - 1); });
  document.getElementById("next-btn").addEventListener("click", function () { goToSlide(currentIndex + 1); });
  document.getElementById("help-btn").addEventListener("click", function () { toggleHelp(true); });
  document.getElementById("close-help").addEventListener("click", function () { toggleHelp(false); });
  document.getElementById("backdrop").addEventListener("click", function () { toggleHelp(false); });
  const filter = document.getElementById("deck-filter");
  if (filter) filter.addEventListener("input", function (event) { updateFilter(event.target.value); });

  document.addEventListener("keydown", function (event) {
    if (isEditable(event.target)) return;
    if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") { event.preventDefault(); goToSlide(currentIndex + 1); }
    else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); goToSlide(currentIndex - 1); }
    else if (event.key === "Home") { event.preventDefault(); goToSlide(0); }
    else if (event.key === "End") { event.preventDefault(); goToSlide(slides.length - 1); }
    else if (event.key === "?") { event.preventDefault(); toggleHelp(true); }
    else if (event.key.toLowerCase() === "p") { event.preventDefault(); togglePrint(); }
    else if (event.key === "Escape") {
      if (!document.getElementById("help-panel").hidden) toggleHelp(false);
      else if (document.body.classList.contains("present-mode")) togglePresentation(false);
      else if (document.body.classList.contains("print-preview")) togglePrint(false);
    }
  });

  window.addEventListener("hashchange", goToHash);
  window.addEventListener("afterprint", function () { togglePrint(false); });
  renderNav();
  document.querySelectorAll(".coverage-item").forEach(function (item) { item.setAttribute("data-search", (item.textContent + " " + item.getAttribute("data-search")).toLowerCase()); });
  updateFilter("");
  goToHash();
  translatePage();
}());
