// test-harness.js — Révision BHT v1 — harnais de tests
// Usage : node test-harness.js (à la racine du dépôt)
// Vérifie : structure index.html, cœur de données (21 thèmes, ~73 quiz), rendu des 6 onglets,
// moteur quiz (réponse immédiate + promotion d'état), progression, notes, DTP, chronos jalonnés,
// persistance localStorage, PWA (sw/manifest/version/workflow/icônes), pas de mojibake.
// Compatibilité : node >= 18 ; aussi exécutable en sandbox avec fs stubbé.

var fs = null;
if (typeof require === "function") { try { fs = require("fs"); } catch (e) {} }
if (!fs) throw new Error("Module fs indisponible — lancer avec : node test-harness.js");

function slurp(name) {
  var cands = ["./" + name, name];
  for (var i = 0; i < cands.length; i++) {
    try { return fs.readFileSync(cands[i], "utf8"); } catch (e) {}
  }
  throw new Error("fichier introuvable : " + name);
}

var PASS = 0, FAIL = 0, FAILURES = [];
function ok(name, cond) {
  if (cond) { PASS++; } else { FAIL++; FAILURES.push(name); }
}

(async function () {

  // ============================================================
  // 1. STRUCTURE index.html
  // ============================================================
  var index = slurp("index.html");
  ok("structure: doctype", index.indexOf("<!DOCTYPE html>") === 0);
  ok("structure: lang fr", index.indexOf('<html lang="fr">') !== -1);
  ok("structure: charset UTF-8", index.indexOf('charset="UTF-8"') !== -1);
  ok("structure: viewport", index.indexOf('name="viewport"') !== -1);
  ok("structure: theme-color", index.indexOf("theme-color") !== -1);
  ok("structure: manifest lié", index.indexOf('href="manifest.webmanifest"') !== -1);
  ok("structure: icon svg lié", index.indexOf('href="icon.svg"') !== -1);
  ok("structure: apple-touch-icon", index.indexOf("apple-touch-icon") !== -1);
  ok("structure: div#app", index.indexOf('id="app"') !== -1);
  ok("structure: nav#tabbar", index.indexOf('id="tabbar"') !== -1);
  ok("structure: 2 blocs script équilibrés", (index.match(/<script>/g) || []).length === 2 && (index.match(/<\/script>/g) || []).length === 2);
  ok("structure: pas de mojibake UTF-8", index.indexOf("Ã") === -1 && index.indexOf("Â") === -1);
  ok("structure: titre Révision BHT", index.indexOf("Révision BHT") !== -1);
  ok("structure: sw registration", index.indexOf("serviceWorker") !== -1);
  ok("structure: cache CSS sombre", index.indexOf("#0d1020") !== -1);
  ok("structure: tabbar bas d'écran (CSS)", index.indexOf(".tabbar") !== -1);
  ok("structure: safe-area (encoche)", index.indexOf("safe-area-inset-bottom") !== -1);
  ok("structure: focus visible (a11y)", index.indexOf(":focus-visible") !== -1);
  ok("structure: chronos jalonnés (CSS)", index.indexOf(".pbar") !== -1);

  // ============================================================
  // 2. STUBS DOM + évaluation des scripts
  // ============================================================
  var lsStore = {};
  var localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(lsStore, k) ? lsStore[k] : null; },
    setItem: function (k, v) { lsStore[k] = String(v); },
    removeItem: function (k) { delete lsStore[k]; }
  };
  var vibs = [];
  var navigator = {
    vibrate: function (p) { vibs.push(p); return true; },
    serviceWorker: null
  };
  var APP_EL = { innerHTML: "" };
  var TB_EL = { innerHTML: "" };
  var DRAW_EL = { innerHTML: "" };
  var document = {
    readyState: "complete",
    addEventListener: function (evt, cb) {},
    getElementById: function (id) {
      if (id === "app") return APP_EL;
      if (id === "tabbar") return TB_EL;
      if (id === "drawbox") return DRAW_EL;
      return null;
    }
  };
  var NOW = 0;
  var Date = { now: function () { return NOW; } };
  var intervals = [];
  var setInterval = function (fn, ms) { intervals.push(fn); return intervals.length; };
  var clearInterval = function (id) {};
  var window = { scrollTo: function () {}, D: null };
  window.window = window;

  var scripts = [];
  var sre = /<script>([\s\S]*?)<\/script>/g, sm;
  while ((sm = sre.exec(index)) !== null) scripts.push(sm[1]);
  ok("eval: 2 scripts extraits", scripts.length === 2);

  var evalErr = null;
  try {
    eval(scripts[0]);
    window.D = D; // var D du cœur exposée à window (comme dans le navigateur)
    eval(scripts[1]);
  } catch (e) { evalErr = e; }
  ok("eval: cœur + app évalués sans erreur", evalErr === null);
  if (evalErr) ok("eval: détail " + evalErr.message, false);

  var A = window.__BHT_APP;
  ok("api: window.__BHT_APP exposé", !!A);
  var D = A.D;
  var S = A.state;

  // ============================================================
  // 3. CŒUR DE DONNÉES
  // ============================================================
  ok("cœur: META version v1", D.META.version === "v1");
  ok("cœur: 21 thèmes", D.THEMES.length === 21);
  var nums = D.THEMES.map(function (t) { return t.n; });
  for (var i = 1; i <= 21; i++) ok("cœur: thème " + i + " présent", nums.indexOf(i) !== -1);
  var totQ = 0;
  D.THEMES.forEach(function (t) {
    ok("cœur: thème " + t.n + " a tous ses champs",
      !!t.titre && !!t.accroche && !!t.pb && t.parties.length >= 3 && !!t.ccl && !!t.qj.q && !!t.qj.r && t.quiz.length >= 3);
    ok("cœur: thème " + t.n + " accroche non vide (>80 car)", t.accroche.length > 80);
    t.parties.forEach(function (p) { ok("cœur: thème " + t.n + " partie avec points", p.pts.length >= 2); });
    t.quiz.forEach(function (q, qi) {
      totQ++;
      ok("cœur: quiz T" + t.n + "Q" + qi + " 4 options", Array.isArray(q.opts) && q.opts.length === 4);
      ok("cœur: quiz T" + t.n + "Q" + qi + " réponse valide + explication", q.a >= 0 && q.a < 4 && !!q.ex);
    });
  });
  ok("cœur: ~73 questions au total", totQ === 73);
  ok("cœur: 10 thèmes complets", D.THEMES.filter(function (t) { return t.full; }).length === 10);
  ok("cœur: 11 thèmes plan de secours", D.THEMES.filter(function (t) { return !t.full; }).length === 11);
  ok("cœur: états initiaux (1 fiche, 7 afaire)", S.prog[1] === "fiche" && S.prog[7] === "afaire");
  ok("cœur: états initiaux (21 fiche)", S.prog[21] === "fiche");
  ok("cœur: ALLQ construit", A.ALLQ().length === 73);
  ok("cœur: CALAGE 5 jalons", D.CALAGE.length === 5);
  ok("cœur: 6 règles d'or", D.REGLESOR.length >= 6);
  ok("cœur: liens transversaux >= 6", D.TRANSVERSAL.length >= 6);
  ok("cœur: 10 sujets surprises", D.SURPRISES.length === 10);
  ok("cœur: DTP barème 4 rubriques", D.DTP.trame.length === 4);
  ok("cœur: DTP 10 réflexes", D.DTP.reflexes.length === 10);
  ok("cœur: DTP glossaire >= 18", D.DTP.glossaire.length >= 18);
  ok("cœur: DTP exemple Parc Bellevue", D.DTP.exemple.t.indexOf("Parc Bellevue") !== -1);
  ok("cœur: CDG rôle + chiffres", D.CDG.role.length >= 5 && D.CDG.chiffres.length >= 6);
  var allCore = JSON.stringify(D);
  ok("cœur: pas de mojibake", allCore.indexOf("Ã") === -1 && allCore.indexOf("Â") === -1);

  // ============================================================
  // 4. RENDU DES 6 ONGLETS
  // ============================================================
  var tabsRendered = 0;
  ["home", "oral", "quiz", "dtp", "chrono", "cdg"].forEach(function (t) {
    var err = null;
    try { A.tab(t); } catch (e) { err = e; }
    ok("rendu: onglet " + t + " sans erreur", err === null && APP_EL.innerHTML.length > 400);
    if (!err) tabsRendered++;
  });
  ok("rendu: 6/6 onglets", tabsRendered === 6);

  A.tab("home");
  ok("rendu: accueil donut + avancement", APP_EL.innerHTML.indexOf("donut") !== -1 && APP_EL.innerHTML.indexOf("avancement") !== -1);
  ok("rendu: accueil sujet au hasard", APP_EL.innerHTML.indexOf("Sujet au hasard") !== -1);
  ok("rendu: tabbar 6 boutons", (TB_EL.innerHTML.match(/class="tb[ "]/g) || []).length === 6);

  A.tab("oral");
  ok("rendu: oral 21 thèmes listés", (APP_EL.innerHTML.match(/class="acc-h"/g) || []).length === 21);
  ok("rendu: oral badge états", (APP_EL.innerHTML.match(/class="badge"/g) || []).length === 21);
  A.openTheme(1);
  ok("rendu: thème 1 ouvert (accroche visible)", APP_EL.innerHTML.indexOf("1997") !== -1 && APP_EL.innerHTML.indexOf("Problématique") !== -1);
  ok("rendu: thème 1 question jury", APP_EL.innerHTML.indexOf("Question jury") !== -1);
  ok("rendu: thème 1 quiz + chrono proposés", APP_EL.innerHTML.indexOf("Quiz du thème") !== -1 && APP_EL.innerHTML.indexOf("Oral blanc") !== -1);
  A.openTheme(1);
  ok("rendu: thème 1 refermé", APP_EL.innerHTML.indexOf("Question jury") === -1);

  A.tab("dtp");
  ok("rendu: DTP barème visible", APP_EL.innerHTML.indexOf("alerte 4") !== -1);
  ok("rendu: DTP glossaire", APP_EL.innerHTML.indexOf("Glossaire") !== -1);
  ok("rendu: DTP 10 réflexes", APP_EL.innerHTML.indexOf("10 réflexes DTP") !== -1);
  A.dtpToggle(1);
  ok("rendu: DTP section ASLL ouverte", APP_EL.innerHTML.indexOf("B-SAHF") !== -1);
  A.exToggle();
  ok("rendu: DTP exemple ouvert", APP_EL.innerHTML.indexOf("143 rue") !== -1 || APP_EL.innerHTML.indexOf("Parc Bellevue") !== -1);
  A.dtpDone(1);
  ok("rendu: DTP section marquée révisée", Object.keys(S.dtp).some(function (k) { return S.dtp[k] === true; }));

  A.tab("chrono");
  ok("rendu: chrono 3 épreuves", APP_EL.innerHTML.indexOf("Oral 10 min") !== -1 && APP_EL.innerHTML.indexOf("DTP 2 h") !== -1);

  A.tab("cdg");
  ok("rendu: CDG rôle + chiffres", APP_EL.innerHTML.indexOf("chef de groupe") !== -1 && APP_EL.innerHTML.indexOf("2 035") !== -1);
  ok("rendu: CDG calage oral", APP_EL.innerHTML.indexOf("0:00") !== -1 && APP_EL.innerHTML.indexOf("8:30") !== -1);

  // ============================================================
  // 5. MOTEUR QUIZ (réponse immédiate)
  // ============================================================
  A.quizStart("theme", 1);
  var qs = A.qState();
  ok("quiz: séquence thème 1 lancée (4 questions)", qs.len === 4 && qs.idx === 0);
  ok("quiz: question en cours exposée", qs.cur && qs.cur.q && qs.cur.q.opts.length === 4);
  var good = qs.cur.q.a;
  A.pick(good);
  qs = A.qState();
  ok("quiz: réponse immédiate (answered)", qs.answered === true && qs.score === 1);
  ok("quiz: explication affichée", APP_EL.innerHTML.indexOf("Bonne réponse") !== -1);
  A.pick(0); // double réponse ignorée
  ok("quiz: double réponse ignorée", A.qState().score === 1);
  A.next();
  var bad = (A.qState().cur.q.a + 1) % 4;
  A.pick(bad);
  ok("quiz: mauvaise réponse comptée", A.qState().score === 1 && APP_EL.innerHTML.indexOf("Faux") !== -1);
  A.next(); A.pick(A.qState().cur.q.a);
  A.next(); A.pick(A.qState().cur.q.a);
  A.next();
  ok("quiz: séquence terminée (résultat)", A.qState().idx === 4);
  ok("quiz: résultat 3/4 affiché", APP_EL.innerHTML.indexOf("3 / 4") !== -1);
  ok("quiz: score persisté", JSON.parse(lsStore[A.keys.quiz])["1"] && JSON.parse(lsStore[A.keys.quiz])["1"][0] === true && JSON.parse(lsStore[A.keys.quiz])["1"][1] === false);

  // quiz complet d'un thème → promotion d'état
  A.quizStart("theme", 2);
  for (var k = 0; k < 4; k++) { A.pick(A.qState().cur.q.a); A.next(); }
  ok("quiz: thème 2 promu en état quiz", S.prog[2] === "quiz");

  A.quizStart("fail", 0);
  ok("quiz: mode erreurs relance les ratées", A.qState().len >= 1);

  A.quizStart("all", 0);
  ok("quiz: marathon 73 questions", A.qState().len === 73);
  A.quizEnd();
  ok("quiz: retour au menu quiz", APP_EL.innerHTML.indexOf("Par thème") !== -1);

  // ============================================================
  // 6. PROGRESSION + NOTES + TIRAGE
  // ============================================================
  var before = S.prog[7];
  A.cycle(7);
  ok("prog: cycle afaire → fiche", before === "afaire" && S.prog[7] === "fiche");
  ok("prog: persistance localStorage", JSON.parse(lsStore[A.keys.prog])["7"] === "fiche");
  A.cycle(1); // fiche → quiz (quiz du thème 1 incomplet → reste fiche)
  ok("prog: pas de promotion quiz sans quiz réussi", S.prog[1] === "fiche");
  A.cycle(2); // quiz → pret
  ok("prog: quiz → pret", S.prog[2] === "pret");
  A.cycle(2);
  ok("prog: pret protégé (tap sans effet)", S.prog[2] === "pret");
  A.resetTheme(2);
  ok("prog: reset dédié → afaire", S.prog[2] === "afaire");
  var pct = A.progPct();
  ok("prog: pourcentage avancement calculé", pct > 0);
  A.note(3, "astuce : toujours citer Prométhée");
  ok("notes: sauvegardée", JSON.parse(lsStore[A.keys.notes])["3"].indexOf("Prométhée") !== -1);

  // tirage
  var Math_random = Math.random;
  Math.random = function () { return 0.01; }; // → tirage surprise (r < 0.15)
  A.draw();
  ok("tirage: sujet surprise affiché", DRAW_EL.innerHTML.indexOf("SUJET SURPRISE") !== -1);
  Math.random = function () { return 0.5; }; // → tirage thème
  A.draw();
  ok("tirage: thème tiré + actions", DRAW_EL.innerHTML.indexOf("Ouvrir le thème") !== -1 && DRAW_EL.innerHTML.indexOf("Chrono 10 min") !== -1);
  Math.random = Math_random;

  // ============================================================
  // 7. CHRONOS JALONNÉS
  // ============================================================
  var ch = A.chronos();
  ok("chrono: oral 10 min + 5 jalons", ch.oral.total === 600 && ch.oral.jalons.length === 5);
  ok("chrono: DTP 2 h + 5 jalons", ch.dtp.total === 7200 && ch.dtp.jalons.length === 5);
  NOW = 1000000;
  A.start("oral");
  var ts = A.timerState();
  ok("chrono: oral démarré (10:00, en course)", ts.mode === "oral" && ts.left === 600 && ts.run === true);
  NOW += 91000; // 91 s écoulées → jalon 1 franchi
  A._tick();
  ts = A.timerState();
  ok("chrono: jalon 1 franchi à 91 s", ts.left === 509 && ts.next === 1);
  ok("chrono: vibreur déclenché au jalon", vibs.length >= 1);
  A.pause();
  ok("chrono: pause OK", A.timerState().run === false);
  var frozen = A.timerState().left;
  NOW += 120000;
  ok("chrono: temps figé pendant la pause", A.timerState().left === frozen);
  A.resume();
  ok("chrono: reprise OK", A.timerState().run === true);
  NOW += 509000; // fin des 10 minutes
  A._tick();
  ts = A.timerState();
  ok("chrono: 10:00 écoulées, chronomètre arrêté", ts.left === 0 && ts.run === false);
  ok("chrono: tous les jalons franchis", ts.next === 5);
  A.reset();
  ok("chrono: reset OK", A.timerState().mode === null);
  A.start("dtp");
  ok("chrono: DTP 2 h démarré", A.timerState().left === 7200);
  A.reset();

  // ============================================================
  // 8. PWA + FICHIERS DU DÉPÔT
  // ============================================================
  var sw = slurp("sw.js");
  ok("pwa: sw cache revision-bht-v1", sw.indexOf("revision-bht-v1") !== -1);
  ok("pwa: version.json jamais caché", sw.indexOf("version.json") !== -1 && sw.indexOf("TOUJOURS réseau") !== -1);
  ok("pwa: navigate-first + secours hors ligne", sw.indexOf('e.request.mode === "navigate"') !== -1);
  var ver = JSON.parse(slurp("version.json"));
  ok("pwa: version.json v1 du jour", ver.version === "v1" && ver.app === "revision-bht");
  var man = JSON.parse(slurp("manifest.webmanifest"));
  ok("pwa: manifest FR standalone", man.lang === "fr" && man.display === "standalone");
  ok("pwa: manifest 3 icônes", man.icons.length === 3);
  var icon = slurp("icon.svg");
  ok("pwa: icon.svg flamme + BHT", icon.indexOf("BHT") !== -1 && icon.indexOf("ff7a18") !== -1);
  var wf = slurp(".github/workflows/pages.yml");
  ok("pwa: workflow gen-icons + deploy-pages", wf.indexOf("gen-icons.js") !== -1 && wf.indexOf("deploy-pages") !== -1);
  var gi = slurp("tools/gen-icons.js");
  ok("pwa: gen-icons PNG writer", gi.indexOf("IHDR") !== -1 && gi.indexOf("icon-512.png") !== -1);
  ok("pwa: pas de binaire dans le dépôt (PNG ignorés)", gi.indexOf("base64") === -1);

  // ============================================================
  // BILAN
  // ============================================================
  console.log("--------------------------------------------------");
  console.log("RÉVISION BHT v1 — BILAN TESTS : " + PASS + " OK / " + FAIL + " ÉCHEC(S), " + (PASS + FAIL) + " au total");
  if (FAILURES.length) {
    console.log("ÉCHECS :");
    FAILURES.forEach(function (f) { console.log("  ✘ " + f); });
  } else {
    console.log("✅ 100% — app prête au déploiement.");
  }
  if (FAIL > 0) process.exit(1);
})().catch(function (e) {
  console.error("ERREUR FATALE DU HARNAIS :", e);
  process.exit(2);
});
