/* filtres-lettres.js — filtres par correspondant pour les séries de lettres
 *
 * Amélioration progressive : sans JavaScript, toutes les lettres restent
 * visibles. Le script ne fait que masquer, par l'attribut hidden.
 *
 * Lit :  article.lettre[data-expediteur][data-destinataire]
 *        <script type="application/json" id="correspondants"> (noms affichés,
 *        injecté par inject_filtres_lettres dans lib/metadata.sh)
 * URL :  ?de=slug   lettres écrites par cette personne
 *        ?avec=slug lettres écrites par elle ou qui lui sont adressées
 *        Une ancre (#l-1917-03-25) se combine avec le filtre ; si elle vise
 *        une lettre masquée, le filtre est levé.
 */
(function () {
  "use strict";

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

    // Comptage des lettres par expéditeur, et ensemble des personnes connues
    var compte = {}, connus = {};
    lettres.forEach(function (a) {
      var de = a.getAttribute("data-expediteur");
      var a_ = a.getAttribute("data-destinataire");
      compte[de] = (compte[de] || 0) + 1;
      connus[de] = true;
      if (a_) connus[a_] = true;
    });
    var expediteurs = Object.keys(compte).sort(function (x, y) {
      if (x === "claude") return -1;
      if (y === "claude") return 1;
      return (compte[y] - compte[x]) || nom(x).localeCompare(nom(y), "fr");
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
    barre.setAttribute("aria-label", "Filtrer les lettres par correspondant");

    var titre = document.createElement("p");
    titre.className = "filtres-titre";
    titre.textContent = "Afficher les lettres de :";
    barre.appendChild(titre);

    var zone = document.createElement("div");
    zone.className = "filtres-boutons";
    barre.appendChild(zone);

    var boutons = {};
    function creerBouton(slug, libelle, n) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.appendChild(document.createTextNode(libelle + " "));
      var s = document.createElement("span");
      s.className = "nb";
      s.textContent = "(" + n + ")";
      b.appendChild(s);
      b.addEventListener("click", function () {
        etat.slug = (etat.slug === slug) ? "" : slug;
        appliquer(true);
      });
      zone.appendChild(b);
      boutons[slug] = b;
    }
    creerBouton("", "Toutes", lettres.length);
    expediteurs.forEach(function (s) { creerBouton(s, nom(s), compte[s]); });

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

    var bilan = document.createElement("p");
    bilan.className = "filtres-etat";
    bilan.setAttribute("aria-live", "polite");
    barre.appendChild(bilan);

    lettres[0].parentNode.insertBefore(barre, lettres[0]);

    // ---- État et application ----
    var etat = { slug: "", echange: false };

    function visible(a) {
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
        boutons[s].setAttribute("aria-pressed", String(s === etat.slug));
      });
      var echangePossible = etat.slug && etat.slug !== "claude";
      caseEchange.disabled = !echangePossible;
      libEchange.classList.toggle("inactif", !echangePossible);
      caseEchange.checked = etat.echange && !!echangePossible;

      bilan.textContent = etat.slug
        ? n + (n > 1 ? " lettres affichées" : " lettre affichée") + " sur " + lettres.length + "."
        : "";

      if (majUrl) {
        var p = new URLSearchParams(location.search);
        p.delete("de");
        p.delete("avec");
        if (etat.slug) p.set(caseEchange.checked ? "avec" : "de", etat.slug);
        var q = p.toString();
        history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
      }
    }

    // ---- Lecture de l'URL ----
    var params = new URLSearchParams(location.search);
    var avec = params.get("avec"), de = params.get("de");
    if (avec && connus[avec]) { etat.slug = avec; etat.echange = true; }
    else if (de && connus[de]) { etat.slug = de; }
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
        appliquer(true);
        defiler = true;
      }
      if (defiler) cible.scrollIntoView();
    }
    suivreAncre(!!etat.slug);
    window.addEventListener("hashchange", function () { suivreAncre(false); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
