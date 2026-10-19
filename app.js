// Coulisses : lit etat.json dans un dépôt GitHub privé (jeton en lecture seule gardé sur l'appareil)
// et l'affiche. Aucune donnée dans ce code ; tout le texte reçu est affiché avec textContent.
(function () {
  "use strict";
  var CLE = "coulisses-config", CACHE = "coulisses-etat", VUES = "coulisses-pannes-vues";
  var $ = function (id) { return document.getElementById(id); };
  var LIB = { ok: "OK", veille: "À SURVEILLER", panne: "EN PANNE", jamais: "SANS TRACE" };
  // Chaque pastille est doublée d'un mot (et d'une forme, voir style.css) : l'état ne repose jamais sur la couleur seule.
  var MOT = { ok: "ok", veille: "en retard", panne: "panne", jamais: "jamais" };
  var ORDRE = { panne: 0, veille: 1, jamais: 2, ok: 3 };

  function lire(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function oublier(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function heure(v) {
    if (!v) return "—";
    var d = /T|Z$/.test(v) ? new Date(v) : new Date(String(v).replace(" ", "T") + (String(v).length <= 16 ? ":00" : ""));
    if (isNaN(d)) return String(v);
    var auj = new Date(), hier = new Date(Date.now() - 864e5);
    var hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === auj.toDateString()) return hm;
    if (d.toDateString() === hier.toDateString()) return "hier " + hm;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " " + hm;
  }

  function ligne(x, ouvert) {
    var d = el("details"); if (ouvert) d.open = true;
    var s = el("summary"), n = el("span", "nom", x.libelle || x.nom);
    var etat = MOT[x.etat] ? x.etat : "jamais", q = el("span", "quand");
    if (x.libelle && x.libelle !== x.nom) n.append(el("span", null, x.nom));
    q.append(el("span", "mot " + etat, x.mot || MOT[etat]), el("span", null, x.depuis || heure(x.dernier)));
    var pt = el("i", "pt " + etat); pt.setAttribute("aria-hidden", "true");
    s.append(pt, n, q);
    d.append(s, el("div", "detail", x.detail || ""));
    return d;
  }

  function liste(cible, items, vide) {
    var c = $(cible); c.textContent = "";
    if (!items || !items.length) { c.append(el("p", "vide", vide)); return; }
    items.slice().sort(function (a, b) { return (ORDRE[a.etat] || 0) - (ORDRE[b.etat] || 0); })
      .forEach(function (x) { c.append(ligne(x, x.etat === "panne")); });
  }

  function afficher(e) {
    $("relier").hidden = true; $("contenu").hidden = false;
    $("quand").textContent = "État mis à jour " + heure(e.maj);
    var r = e.resume || {}, res = $("resume"); res.textContent = "";
    [["ok", "TOURNENT"], ["veille", "À SURVEILLER"], ["panne", "EN PANNE"]].forEach(function (p) {
      var cl = p[0] === "panne", t = el(cl ? "button" : "div", "tuile t-" + p[0] + (cl && r.panne ? " actif" : ""));
      if (cl) { t.type = "button"; t.setAttribute("aria-label", (r.panne || 0) + " en panne : ouvrir la liste des pannes"); t.addEventListener("click", function () { if (window.Pilotage) window.Pilotage.versPannes(); }); }
      t.append(el("b", null, String(r[p[0]] || 0)), el("small", null, p[1])); res.append(t);
    });

    $("version").textContent = e.app && e.app.version ? "V" + e.app.version : "";
    liste("listeApp", e.app && e.app.lignes, "Pas d'information sur l'app.");

    var ass = e.assistants || [], soucis = ass.filter(function (a) { return a.etat !== "ok"; });
    $("nbAss").textContent = ass.length + " SUIVIS";
    liste("listeAss", soucis, "Tous les assistants tournent.");
    var fam = {};
    ass.filter(function (a) { return a.etat === "ok"; }).forEach(function (a) { (fam[a.famille] = fam[a.famille] || []).push(a); });
    Object.keys(fam).sort().forEach(function (f) {
      var d = el("details"), s = el("summary");
      var pt = el("i", "pt ok"), q = el("span", "quand"); pt.setAttribute("aria-hidden", "true");
      q.append(el("span", "mot ok", "ok"), el("span", null, fam[f].length + " suivis"));
      s.append(pt, el("span", "nom", f), q);
      var box = el("div", "detail"); fam[f].forEach(function (a) { box.append(ligne(a)); });
      d.append(s, box); $("listeAss").append(d);
    });

    var errs = e.erreurs || [], le = $("listeErr"); le.textContent = "";
    $("nbErr").textContent = errs.length ? String(errs.length) : "";
    if (!errs.length) le.append(el("p", "vide", "Aucune erreur sur les dernières 24 h."));
    errs.forEach(function (x) { le.append(ligne({ libelle: x.workflow, nom: "erreur", etat: "veille", mot: "erreur", dernier: x.t, detail: x.message })); });

    liste("listeSauv", e.sauvegardes, "Aucune sauvegarde suivie.");
    liste("listeRout", e.routines, "Aucune routine suivie.");
    prevenir(ass.concat(e.app && e.app.lignes || [], e.routines || [], e.sauvegardes || []));
  }

  // Notification seulement pour une panne pas encore signalée sur cet appareil.
  function prevenir(items) {
    var pannes = items.filter(function (x) { return x.etat === "panne"; }).map(function (x) { return x.nom + "|" + (x.dernier || ""); });
    var vues = lire(VUES) || [], neuves = pannes.filter(function (p) { return vues.indexOf(p) < 0; });
    ecrire(VUES, pannes);
    if (!neuves.length || !("Notification" in window) || Notification.permission !== "granted" || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification("Coulisses", { body: neuves.length === 1 ? neuves[0].split("|")[0] + " est en panne." : neuves.length + " éléments en panne.", tag: "coulisses-panne", icon: "icon-192.png" });
    }).catch(function () {});
  }

  function charger(silencieux) {
    var cfg = lire(CLE);
    if (!cfg || !cfg.depot || !cfg.jeton) { $("relier").hidden = false; $("contenu").hidden = true; $("quand").textContent = Connexion.ERREUR; return Promise.resolve(); }
    if (!silencieux) $("quand").textContent = "Mise à jour…";
    return fetch("https://api.github.com/repos/" + cfg.depot + "/contents/etat.json", {
      headers: { Authorization: "Bearer " + cfg.jeton, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store"
    }).then(function (r) {
      if (r.status === 401) throw new Error(Connexion.ERREUR);
      if (r.status === 404) throw new Error("Dépôt ou état introuvable : vérifie le nom du dépôt et que le jeton y a accès.");
      if (!r.ok) throw new Error("GitHub a répondu " + r.status + ". Réessaie plus tard.");
      return r.json();
    }).then(function (e) { ecrire(CACHE, e); $("msgRelier").textContent = ""; afficher(e); })
      .catch(function (err) {
        var c = lire(CACHE);
        if (c) { afficher(c); $("quand").textContent = "Hors ligne ou erreur — état du " + heure(c.maj) + ". " + err.message; }
        else { $("relier").hidden = false; $("msgRelier").textContent = err.message; $("msgRelier").className = "msg erreur"; }
      });
  }

  Array.prototype.forEach.call(document.querySelectorAll(".ouvre-cx"), function (b) {   // les deux « Relier » renvoient vers l'écran Connexion unique
    b.addEventListener("click", function () { var d = $("cxCarte"); d.open = true; d.scrollIntoView({ block: "start" }); });
  });
  $("btnMaj").addEventListener("click", function () { charger(); });
  $("btnOublier").addEventListener("click", function () { oublier(CLE); oublier(CACHE); oublier(VUES); location.reload(); });
  $("btnNotif").addEventListener("click", function () {
    if (!("Notification" in window)) { $("msgNotif").textContent = "Cet appareil ne propose pas de notifications pour les apps web."; return; }
    Notification.requestPermission().then(function (p) {
      $("msgNotif").textContent = p === "granted" ? "Activées : tu seras prévenue d'une nouvelle panne à l'ouverture de Coulisses." : "Refusées. Tu peux les autoriser dans les réglages du navigateur.";
    });
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) charger(true); });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  var c = lire(CACHE); if (c && lire(CLE)) afficher(c);
  // Écran « Connexion » commun aux trois apps (connexion.js) : s'ouvre tout seul tant que Coulisses n'est pas relié.
  Connexion.monter($("connexion-ecran"), { nomApp: "Coulisses", github: true, carteUrl: location.origin + "/carte-de-vie/",
    qr: function (t) { var q = qrcode(0, "M"); q.addData(t); q.make(); return q.createDataURL(6, 2); },
    apres: function () { setTimeout(function () { location.reload(); }, 1500); } });
  if (!lire(CLE)) $("cxCarte").open = true;
  charger();
})();
