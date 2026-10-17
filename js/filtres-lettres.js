/* filtres-lettres.js — filtres par correspondant et par thème pour les séries de lettres
 *
 * Amélioration progressive : sans JavaScript, toutes les lettres restent
 * visibles. Le script ne fait que masquer, par l'attribut hidden.
 *
 * Lit :  article.lettre[data-expediteur][data-destinataire][data-themes]
 *        data-themes : liste de thèmes séparés par des espaces (ex. "roches")
 *        <script type="application/json" id="correspondants"> (noms affichés,
 *        injecté par inject_filtres_lettres dans lib/metadata.sh)
 * URL :  ?de=slug     lettres écrites par cette personne
 *        ?avec=slug   lettres écrites par elle ou qui lui sont adressées
 *        ?theme=slug  lettres portant ce thème ; se combine avec de / avec
 *        Une ancre (#l-1917-03-25) se combine avec les filtres ; si elle vise
 *        une lettre masquée, les filtres sont levés.
 */
(function () {
  "use strict";

  // Libellés des thèmes. Un libellé présent dans correspondants.json l'emporte.
  var LIBELLES_THEMES = {
    roches: "École des Roches"
  };

  function init() {
    var lettres = Array.prototype.slice.call(
      document.querySelectorAll("article.lettre[data-expediteur]"));
    if (lettres.length < 2) return;

    var noms = {};
    var bloc = document.getElementById("correspondants");
    if (bloc) {
      try { noms = JSON.parse(bloc.textContent); } catch (e) { noms = {}; }
    }
    function nom(slug) { return noms[slug] || slug; }
    function nomTheme(t) { return noms[t] || LIBELLES_THEMES[t] || t; }
    function themesDe(a) {
      return (a.getAttribute("data-themes") || "").split(/\s+/).filter(Boolean);
    }

    // Comptage des lettres par expéditeur et par thème
    var compte = {}, connus = {}, compteThemes = {};
    lettres.forEach(function (a) {
      var de = a.getAttribute("data-expediteur");
      var a_ = a.getAttribute("data-destinataire");
      compte[de] = (compte[de] || 0) + 1;
      connus[de] = true;
      if (a_) connus[a_] = true;
      themesDe(a).forEach(function (t) { compteThemes[t] = (compteThemes[t] || 0) + 1; });
    });
    var expediteurs = Object.keys(compte).sort(function (x, y) {
      if (x === "claude") return -1;
      if (y === "claude") return 1;
      return (compte[y] - compte[x]) || nom(x).localeCompare(nom(y), "fr");
    });
    var themes = Object.keys(compteThemes).sort(function (x, y) {
      return nomTheme(x).localeCompare(nomTheme(y), "fr");
    });

    // Séparateurs <hr> placés entre deux lettres
    var separateurs = lettres.map(function (a) {
      var hr = a.previousElementSibling;
      var avant = hr && hr.previousElementSibling;
      return (hr && hr.tagName === "HR" && avant && avant.matches("article.lettre")) ? hr : null;
    });

    // ---- Barre de filtres ----
    var barre = document.createElement("div");
    barre.className = "filtres-lettres no-print";
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Filtrer les lettres");

    var titre = document.createElement("p");
    titre.className = "filtres-titre";
    titre.textContent = "Afficher les lettres de :";
    barre.appendChild(titre);

    var zone = document.createElement("div");
    zone.className = "filtres-boutons";
    barre.appendChild(zone);

    function bouton(conteneur, libelle, n, action) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.appendChild(document.createTextNode(libelle + " "));
      var s = document.createElement("span");
      s.className = "nb";
      s.textContent = "(" + n + ")";
      b.appendChild(s);
      b.addEventListener("click", action);
      conteneur.appendChild(b);
      return b;
    }

    var boutons = {};
    boutons[""] = bouton(zone, "Toutes", lettres.length, function () {
      etat.slug = ""; etat.theme = "";
      appliquer(true);
    });
    expediteurs.forEach(function (s) {
      boutons[s] = bouton(zone, nom(s), compte[s], function () {
        etat.slug = (etat.slug === s) ? "" : s;
        appliquer(true);
      });
    });

    var libEchange = document.createElement("label");
    libEchange.className = "filtres-echange";
    var caseEchange = document.createElement("input");
    caseEchange.type = "checkbox";
    libEchange.appendChild(caseEchange);
    libEchange.appendChild(document.createTextNode(
      "Avec les lettres que Claude leur adresse"));
    caseEchange.addEventListener("change", function () {
      etat.echange = caseEchange.checked;
      appliquer(true);
    });
    barre.appendChild(libEchange);

    // Rangée des thèmes, seulement si la page en porte
    var boutonsThemes = {};
    if (themes.length) {
      var titreT = document.createElement("p");
      titreT.className = "filtres-titre filtres-titre-themes";
      titreT.textContent = "Thème :";
      barre.appendChild(titreT);
      var zoneT = document.createElement("div");
      zoneT.className = "filtres-boutons filtres-themes";
      barre.appendChild(zoneT);
      themes.forEach(function (t) {
        boutonsThemes[t] = bouton(zoneT, nomTheme(t), compteThemes[t], function () {
          etat.theme = (etat.theme === t) ? "" : t;
          appliquer(true);
        });
      });
    }

    var bilan = document.createElement("p");
    bilan.className = "filtres-etat";
    bilan.setAttribute("aria-live", "polite");
    barre.appendChild(bilan);

    lettres[0].parentNode.insertBefore(barre, lettres[0]);

    // ---- État et application ----
    var etat = { slug: "", echange: false, theme: "" };

    function visible(a) {
      if (etat.theme && themesDe(a).indexOf(etat.theme) < 0) return false;
      if (!etat.slug) return true;
      if (a.getAttribute("data-expediteur") === etat.slug) return true;
      return etat.echange && a.getAttribute("data-destinataire") === etat.slug;
    }

    function appliquer(majUrl) {
      var n = 0, premier = true;
      lettres.forEach(function (a, i) {
        var ok = visible(a);
        a.hidden = !ok;
        if (separateurs[i]) separateurs[i].hidden = !(ok && !premier);
        if (ok) { n++; premier = false; }
      });

      Object.keys(boutons).forEach(function (s) {
        boutons[s].setAttribute("aria-pressed",
          String(s === etat.slug && (s !== "" || !etat.theme)));
      });
      Object.keys(boutonsThemes).forEach(function (t) {
        boutonsThemes[t].setAttribute("aria-pressed", String(t === etat.theme));
      });
      var echangePossible = etat.slug && etat.slug !== "claude";
      caseEchange.disabled = !echangePossible;
      libEchange.classList.toggle("inactif", !echangePossible);
      caseEchange.checked = etat.echange && !!echangePossible;

      bilan.textContent = (etat.slug || etat.theme)
        ? n + (n > 1 ? " lettres affichées" : " lettre affichée") + " sur " + lettres.length + "."
        : "";

      if (majUrl) {
        var p = new URLSearchParams(location.search);
        p.delete("de");
        p.delete("avec");
        p.delete("theme");
        if (etat.slug) p.set(caseEchange.checked ? "avec" : "de", etat.slug);
        if (etat.theme) p.set("theme", etat.theme);
        var q = p.toString();
        history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
      }
    }

    // ---- Lecture de l'URL ----
    var params = new URLSearchParams(location.search);
    var avec = params.get("avec"), de = params.get("de"), theme = params.get("theme");
    if (avec && connus[avec]) { etat.slug = avec; etat.echange = true; }
    else if (de && connus[de]) { etat.slug = de; }
    if (theme && compteThemes[theme]) { etat.theme = theme; }
    appliquer(false);

    // ---- Ancres : ne jamais laisser une ancre pointer vers une lettre masquée ----
    function suivreAncre(defiler) {
      var id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      var cible = document.getElementById(id);
      if (!cible) return;
      var art = cible.closest("article.lettre");
      if (art && art.hidden) {
        etat.slug = "";
        etat.echange = false;
        etat.theme = "";
        appliquer(true);
        defiler = true;
      }
      if (defiler) cible.scrollIntoView();
    }
    suivreAncre(!!(etat.slug || etat.theme));
    window.addEventListener("hashchange", function () { suivreAncre(false); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
