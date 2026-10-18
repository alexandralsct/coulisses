// Coulisses — « Piloter » : des boutons pour Cocon, sans IA (plan validé le 18/10/2026).
// État en direct, relancer, pause, reprendre, journal d'un flux, alertes sur l'appareil. Aucune commande d'activation :
// un flux jamais lancé s'active dans l'éditeur de Cocon. Adresse et clé sont saisies sur l'appareil et y restent ;
// aucune adresse ni donnée dans ce code. Tout texte reçu est affiché avec textContent.
(function () {
  "use strict";
  var CLE = "coulisses-pilote", $ = function (id) { return document.getElementById(id); };
  var MOT = { actif: "actif", pause: "en pause", desactive: "désactivé" }, FORME = { actif: "ok", pause: "veille", desactive: "jamais" };
  var dernierEtat = null, enCours = false;

  function lire() { try { return JSON.parse(localStorage.getItem(CLE)); } catch (e) { return null; } }
  function ecrire(v) { try { localStorage.setItem(CLE, JSON.stringify(v)); } catch (e) {} }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
  function msg(id, t, erreur) { $(id).textContent = t || ""; $(id).className = "msg" + (erreur ? " erreur" : ""); }

  // Règle de sécurité resserrée : une fois l'adresse connue, la page ne peut plus parler qu'à GitHub et à Cocon.
  function serrer(origine) {
    if (!origine || document.querySelector("meta[data-serre]")) return;
    var m = document.createElement("meta");
    m.httpEquiv = "Content-Security-Policy"; m.content = "connect-src https://api.github.com " + origine; m.setAttribute("data-serre", "1");
    document.head.appendChild(m);
  }

  // ─── Vues : sur téléphone, un onglet à la fois ; sur ordinateur, les deux colonnes (style.css) ───
  function vue(v) {
    document.body.classList.toggle("v-piloter", v === "piloter");
    $("vueEtat").setAttribute("aria-pressed", String(v !== "piloter"));
    $("vuePiloter").setAttribute("aria-pressed", String(v === "piloter"));
    if (v === "piloter" && !dernierEtat) charger();
  }
  $("vueEtat").addEventListener("click", function () { vue("etat"); history.replaceState(null, "", "#etat"); });
  $("vuePiloter").addEventListener("click", function () { vue("piloter"); history.replaceState(null, "", "#piloter"); });

  // ─── Appel à Cocon ───
  function appeler(corps) {
    var c = lire();
    if (!c) return Promise.reject(new Error("Pas encore relié."));
    return fetch(c.adresse + "/crochets/pilote", { method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { "content-type": "application/json", "x-cle-pilote": c.cle }, body: JSON.stringify(corps) })
      .catch(function () { throw new Error("Cocon injoignable (réseau, ou serveur arrêté)."); })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 403) throw Object.assign(new Error("Clé de pilotage refusée."), { cle: true });
          if (r.status === 429) throw new Error("Trop d'essais : réessaie dans quelques minutes.");
          if (r.status === 404 && !j.reponse) throw new Error("Le pilotage n'est pas activé sur Cocon (onglet « Pilotage » désactivé).");
          if (!r.ok || j.ok === false) throw new Error(j.reponse || ("Cocon a répondu " + r.status + "."));
          return j;
        });
      });
  }

  // ─── Affichage ───
  function heure(v) {
    if (!v) return "jamais passé";
    var d = new Date(String(v).replace(" ", "T"));
    if (isNaN(d)) return String(v);
    var hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === new Date().toDateString()) return hm;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + hm;
  }

  function bouton(txt, cls, f) { var b = el("button", "bouton " + (cls || ""), txt); b.type = "button"; b.addEventListener("click", f); return b; }

  function geste(x, commande, question, d) {
    if (enCours) return;
    if (question && !window.confirm(question)) return;
    enCours = true; d.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    msg("msgP", "…");
    appeler({ commande: commande, onglet: x.id }).then(function (j) { msg("msgP", x.nom + " : " + (j.reponse || "fait")); })
      .catch(function (e) { msg("msgP", x.nom + " : " + e.message, true); })
      .then(function () { enCours = false; charger(true, x.id); });
  }

  function journal(x, boite, b) {
    b.disabled = true; boite.textContent = ""; boite.append(el("p", "vide", "Lecture du journal…"));
    appeler({ commande: "journal", onglet: x.id }).then(function (j) {
      boite.textContent = "";
      if (!j.lignes || !j.lignes.length) { boite.append(el("p", "vide", "Aucun passage au journal.")); return; }
      var l = el("ol", "journal");
      j.lignes.forEach(function (y) {
        var li = el("li", /^(ÉCHEC|REFUS)/.test(y.message) || y.niveau === "erreur" ? "ko" : "");
        li.append(el("span", "t", heure(y.t)), el("span", null, y.message)); l.append(li);
      });
      boite.append(l);
    }).catch(function (e) { boite.textContent = ""; boite.append(el("p", "msg erreur", e.message)); })
      .then(function () { b.disabled = false; });
  }

  function flux(x, ouvert) {
    var d = el("details", "flux"); d.dataset.id = x.id; if (ouvert) d.open = true;
    var s = el("summary"), pt = el("i", "pt " + (x.erreurs && x.erreurs.length && x.etat === "actif" ? "panne" : FORME[x.etat]));
    pt.setAttribute("aria-hidden", "true");
    var q = el("span", "quand");
    q.append(el("span", "mot " + FORME[x.etat], MOT[x.etat] || x.etat), el("span", null, heure(x.dernier)));
    s.append(pt, el("span", "nom", x.nom), q);
    var box = el("div", "detail");
    (x.erreurs || []).forEach(function (e) { box.append(el("p", "msg erreur", "Erreur " + heure(e.t) + " : " + e.message)); });
    var actions = el("div", "ligne-actions");
    if (x.peut.relancer) actions.append(bouton("Relancer maintenant", "plein", function () { geste(x, "relancer", "Relancer « " + x.nom + " » maintenant ?", d); }));
    if (x.peut.pause) actions.append(bouton("Mettre en pause", "", function () { geste(x, "pause", "Mettre « " + x.nom + " » en pause ? Il ne tournera plus jusqu'à ce que tu le reprennes.", d); }));
    if (x.peut.reprendre) actions.append(bouton("Reprendre", "plein", function () { geste(x, "reprendre", null, d); }));
    var boite = el("div", "boite-journal"), bj = bouton("Journal", "discret", function () { journal(x, boite, bj); });
    actions.append(bj);
    if (x.etat === "desactive") box.append(el("p", "vide", "Jamais activé ou arrêté dans l'éditeur : il s'active dans l'éditeur de Cocon, pas d'ici."));
    else if (!x.peut.pause && x.etat === "actif") box.append(el("p", "vide", "Flux protégé : il ne se met pas en pause d'ici."));
    box.append(actions, boite);
    d.append(s, box);
    return d;
  }

  function groupe(cible, titre, items, ouvertId, replie) {
    if (!items.length) return;
    if (replie) {
      var d = el("details", "groupe-replie"), s = el("summary"), pt = el("i", "pt jamais"); pt.setAttribute("aria-hidden", "true");
      var q = el("span", "quand"); q.append(el("span", "mot jamais", items.length + " onglets"));
      s.append(pt, el("span", "nom", titre), q); d.append(s);
      var box = el("div", "detail"); items.forEach(function (x) { box.append(flux(x, x.id === ouvertId)); }); d.append(box);
      if (items.some(function (x) { return x.id === ouvertId; })) d.open = true;
      cible.append(d); return;
    }
    cible.append(el("p", "groupe", titre));
    items.forEach(function (x) { cible.append(flux(x, x.id === ouvertId)); });
  }

  function afficher(e, ouvertId) {
    dernierEtat = e;
    $("pRelier").hidden = true; $("pContenu").hidden = false;
    $("pQuand").textContent = "EN DIRECT · " + heure(e.maj);
    var l = $("pListe"); l.textContent = "";
    if (!e.journal_lu) l.append(el("p", "msg erreur", "Journal illisible pour l'instant : les derniers passages ne s'affichent pas."));
    var o = e.onglets || [], par = function (f) { return o.filter(f).sort(function (a, b) { return a.nom.localeCompare(b.nom, "fr"); }); };
    var souci = par(function (x) { return x.etat === "actif" && x.erreurs && x.erreurs.length; });
    groupe(l, "En panne", souci, ouvertId);
    groupe(l, "En pause", par(function (x) { return x.etat === "pause"; }), ouvertId);
    var actifs = par(function (x) { return x.etat === "actif" && !(x.erreurs && x.erreurs.length); }), fam = {};
    actifs.forEach(function (x) { (fam[x.famille] = fam[x.famille] || []).push(x); });
    Object.keys(fam).sort().forEach(function (f) { groupe(l, f + " · " + fam[f].length + " actifs", fam[f], ouvertId); });
    groupe(l, "Désactivés", par(function (x) { return x.etat === "desactive"; }), ouvertId, true);
    if (!o.length) l.append(el("p", "vide", "Aucun onglet lu."));
  }

  function charger(silencieux, ouvertId) {
    var c = lire();
    if (!c) { $("pRelier").hidden = false; $("pContenu").hidden = true; return Promise.resolve(); }
    serrer(c.adresse);
    if (!silencieux) msg("msgP", "Lecture de l'état…");
    return appeler({ commande: "etat" }).then(function (e) { if (!silencieux) msg("msgP", ""); afficher(e, ouvertId); })
      .catch(function (err) {
        if (err.cle || !dernierEtat) { $("pRelier").hidden = false; $("pContenu").hidden = !dernierEtat; msg("msgPRelier", err.message, true); }
        msg("msgP", err.message, true);
      });
  }

  // ─── Relier, oublier ───
  $("btnPRelier").addEventListener("click", function () {
    var a = $("champAdresse").value.trim().replace(/\/+$/, ""), k = $("champCle").value.trim(), u;
    try { u = new URL(a); } catch (e) { u = null; }
    if (!u || u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash) { msg("msgPRelier", "Écris l'adresse sous la forme https://nom-du-serveur, sans chemin.", true); return; }
    if (!/^[0-9a-f]{32,128}$/i.test(k)) { msg("msgPRelier", "La clé semble incomplète (lettres a-f et chiffres).", true); return; }
    ecrire({ adresse: u.origin, cle: k }); $("champCle").value = "";
    msg("msgPRelier", "Vérification…");
    charger();
  });
  $("btnPMaj").addEventListener("click", function () { charger(); });
  $("btnPOublier").addEventListener("click", function () {
    if (!window.confirm("Oublier la clé de pilotage sur cet appareil ?")) return;
    try { localStorage.removeItem(CLE); } catch (e) {}
    location.reload();
  });

  // ─── Alertes (Web Push envoyé par Cocon) ───
  function cleOctets(b64) { var s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4)), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
  $("btnAlertes").addEventListener("click", function () {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { msg("msgAlertes", "Cet appareil ne reçoit pas les alertes des apps web. Sur iPhone : ajoute d'abord Coulisses à l'écran d'accueil.", true); return; }
    msg("msgAlertes", "…");
    Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("Notifications refusées : autorise-les dans les réglages du navigateur.");
      return Promise.all([appeler({ action: "push_cle" }), navigator.serviceWorker.ready]);
    }).then(function (r) {
      return r[1].pushManager.getSubscription().then(function (a) { return a || r[1].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleOctets(r[0].cle) }); });
    }).then(function (ab) {
      return appeler({ action: "push_abonne", app: "coulisses", abonnement: ab.toJSON(), appareil: matchMedia("(min-width:900px) and (pointer:fine)").matches ? "ordinateur" : "telephone" });
    }).then(function () { msg("msgAlertes", "Alertes activées sur cet appareil."); })
      .catch(function (e) { msg("msgAlertes", e.message, true); });
  });

  // ─── Départ ───
  if (location.hash === "#piloter") vue("piloter"); else vue("etat");
  document.addEventListener("visibilitychange", function () { if (!document.hidden && dernierEtat) charger(true); });
  if (matchMedia("(min-width:900px) and (pointer:fine)").matches) charger();
})();
