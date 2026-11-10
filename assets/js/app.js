/* HE.CO STOP — maquette du front (v2). Données : assets/data/catalogue.json (extraction du 08/11/2026). */
(function () {
  'use strict';

  var FRANCO_HT = 120, PORT_HT = 14;
  var IMG = 'assets/img/produits/';
  // Meilleures ventes 2026 (statistiques du back-office, relevées le 10/11/2026)
  var TOP_2026 = ['couverture de survie', 'coussin hémostatique he.co stop', 'trousse de secours btp 20', 'garrot tourniquet', 'tampons chlorhexidine', 'pochette de froid instantané', 'gants vinyle', 'boite de 36 pansements assortis'];
  var CAT_LABEL = { 'Trousses & Box PRO': 'Trousses pro', 'Trousses & Box VIDES': 'Trousses vides', 'Trousses & Box PERSO': 'Trousses perso', 'Trousses & Box SPECIFIQUES': 'Trousses spécifiques', 'Ethylotests et tests drogues': 'Éthylotests et dépistage' };
  var CAT_INTRO = {
    'Trousses & Armoires': 'Trousses de secours pleines ou vides, par métier et par nombre de personnes, armoires à pharmacie et sacs d\'intervention.',
    'Premiers soins': 'Les consommables du quotidien : pansements, compresses, bandes, désinfection, froid instantané, brûlures et petits accessoires.',
    'Urgence': 'Matériel d\'intervention : attelles, brancards, oxygénothérapie et soins d\'urgence.',
    'Ethylotests et tests drogues': 'Éthylotests chimiques et tests salivaires de dépistage des drogues.'
  };
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var data = null, byId = {}, topIds = {};
  var app = document.getElementById('app');
  var timers = [];

  // ---------- stockage local ----------
  function load(k, f) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var state = { session: load('hs_session', null), cart: load('hs_cart', []) };

  // ---------- utilitaires ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function eur(n) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function label(n) { return CAT_LABEL[n] || n; }
  function logged() { return !!state.session; }
  function prodUrl(p) { return '#/produit/' + p.id + '-' + p.slug; }
  function catUrl(c, s) { return '#/catalogue/' + slug(c) + (s ? '/' + slug(s) : ''); }
  function photo(p, i) { return p.photos && p.photos.length ? IMG + p.photos[Math.min(i || 0, p.photos.length - 1)] : 'assets/img/logo-actuel.png'; }
  function find(k) { var n = norm(k); return data.produits.find(function (p) { return norm(p.nom).indexOf(n) > -1 || norm(p.nomOrigine).indexOf(n) > -1; }); }
  function byRef(r) { return data.produits.find(function (p) { return p.ref === r; }); }
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2400); }
  function setTitle(t) { document.title = t ? t + ' — HE.CO STOP' : 'HE.CO STOP — Premiers secours pour pharmacies et revendeurs'; }
  function later(fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  var ARROW = '<span class="arrow" aria-hidden="true">→</span>';

  function priceBlock(p, v) {
    v = v != null ? v : p.prixHT;
    if (v == null) return '<p class="muted">Prix sur devis</p>';
    if (!logged()) return '<div class="price-lock"><span class="blur" aria-hidden="true">' + eur(v) + '</span><a class="lock-link" href="#/connexion">Voir mon prix revendeur</a></div>';
    return '<p class="price tnum">' + eur(v) + ' <small>HT</small></p>';
  }

  function card(p) {
    var tags = (topIds[p.id] ? '<span class="badge hot">Meilleure vente</span>' : '') + (p.marquePropre ? '<span class="badge fr">Marque HE.CO STOP</span>' : '');
    var add = logged() ? '<div class="add"><label class="sr" for="q' + p.id + '">Quantité</label><input class="qty" id="q' + p.id + '" type="number" min="1" value="1" inputmode="numeric"><button class="btn btn-primary btn-sm" data-add="' + p.id + '">Ajouter</button></div>' : '';
    return '<article class="card">' +
      '<div class="thumb">' + (tags ? '<div class="tags">' + tags + '</div>' : '') + '<img loading="lazy" src="' + photo(p) + '" alt=""></div>' +
      '<div class="body"><a class="name" href="' + prodUrl(p) + '">' + esc(p.nom) + '</a><span class="ref">Réf. ' + esc(p.ref || '—') + '</span>' + priceBlock(p) + add + '</div></article>';
  }

  // ---------- panier ----------
  function lineInfo(l) {
    var p = byId[l.id]; if (!p) return null;
    var price = p.prixHT, name = p.nom, ref = p.ref;
    if (l.v) { var d = p.declinaisons.find(function (x) { return x.ref === l.v; }); if (d) { price = d.prixHT; name = p.nom + ' — ' + d.nom; ref = d.ref; } }
    return { p: p, price: price || 0, name: name, ref: ref, total: (price || 0) * l.q };
  }
  function totals() {
    var ht = 0, tva = 0;
    state.cart.forEach(function (l) { var i = lineInfo(l); if (i) { ht += i.total; tva += i.total * i.p.tva / 100; } });
    var port = ht === 0 || ht >= FRANCO_HT ? 0 : PORT_HT; tva += port * 0.2;
    return { ht: ht, port: port, tva: tva, ttc: ht + port + tva };
  }
  function cartAdd(id, qty, v, fromEl) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var line = state.cart.find(function (l) { return l.id === id && (l.v || null) === (v || null); });
    if (line) line.q += qty; else state.cart.push({ id: id, q: qty, v: v || null });
    save('hs_cart', state.cart);
    renderCartCount(false);
    flyToCart(fromEl, byId[id], function () { renderCartCount(true); });
  }
  function renderCartCount(bump) {
    var n = state.cart.reduce(function (a, l) { return a + l.q; }, 0);
    document.getElementById('cart-count').textContent = n;
    var qs = document.getElementById('qo-summary'); if (qs) qs.innerHTML = qoSummary();
    if (bump) { var b = document.getElementById('cart-btn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  }
  function flyToCart(fromEl, p, done) {
    var target = document.getElementById('cart-btn');
    var src = fromEl && fromEl.closest ? (fromEl.closest('.card,.buybox,.pdp') || fromEl) : null;
    var img = src && (src.querySelector('.thumb img,.gallery .main img') || document.querySelector('.gallery .main img'));
    if (REDUCED || !img || !target.animate) { done(); return; }
    var a = img.getBoundingClientRect(), b = target.getBoundingClientRect();
    var f = document.createElement('div'); f.className = 'fly'; f.innerHTML = '<img src="' + photo(p) + '" alt="">';
    f.style.left = (a.left + a.width / 2 - 40) + 'px'; f.style.top = (a.top + a.height / 2 - 40) + 'px';
    document.body.appendChild(f);
    var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    f.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 120) + 'px) scale(.8)', opacity: 1, offset: .5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: .3 }],
      { duration: 800, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = function () { f.remove(); done(); };
  }

  // ---------- panier coulissant ----------
  function renderDrawer() {
    var body = document.getElementById('drawer-body'), foot = document.getElementById('drawer-foot'), t = totals();
    if (!state.cart.length) {
      body.innerHTML = '<div class="empty" style="box-shadow:none"><h3>Votre panier est vide</h3><p class="muted">Commandez par référence en quelques secondes.</p><a class="btn btn-primary" href="#/commande-rapide">Commande rapide ' + ARROW + '</a></div>';
      foot.innerHTML = ''; return;
    }
    body.innerHTML = state.cart.map(function (l, i) {
      var inf = lineInfo(l); if (!inf) return '';
      return '<div class="drawer-line"><img src="' + photo(inf.p) + '" alt=""><div><b>' + esc(inf.name) + '</b><span class="tnum">' + l.q + ' × ' + (logged() ? eur(inf.price) + ' HT' : 'prix revendeur') + '</span></div><button class="link-btn" data-remove="' + i + '" aria-label="Retirer ' + esc(inf.name) + '">Retirer</button></div>';
    }).join('');
    var rest = Math.max(0, FRANCO_HT - t.ht);
    foot.innerHTML = '<div class="franco' + (rest ? '' : ' done') + '">' + (rest ? '<span>Plus que <b class="tnum">' + eur(rest) + ' HT</b> pour la livraison offerte</span>' : '<span><b>Livraison offerte</b> sur cette commande</span>') + '<div class="bar"><span style="width:' + Math.min(100, t.ht / FRANCO_HT * 100) + '%"></span></div></div>' +
      (logged() ? '<div class="row"><span>Total HT</span><span class="tnum">' + eur(t.ht) + '</span></div>' : '') +
      '<a class="btn btn-primary" href="#/panier">Voir le panier et commander ' + ARROW + '</a>';
  }
  function openDrawer() { renderDrawer(); var d = document.getElementById('drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); document.getElementById('drawer-veil').classList.add('open'); document.getElementById('drawer-close').focus(); }
  function closeDrawer() { var d = document.getElementById('drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); document.getElementById('drawer-veil').classList.remove('open'); }

  function renderAccountLink() {
    var a = document.getElementById('account-link');
    a.textContent = logged() ? 'Mon compte' : 'Se connecter';
    a.setAttribute('href', logged() ? '#/compte' : '#/connexion');
  }
  function renderCatnav(active) {
    var html = data.categories.filter(function (c) { return c.nom !== 'Divers'; }).map(function (c) {
      return '<a href="' + catUrl(c.nom) + '"' + (active === c.slug ? ' class="on"' : '') + '>' + esc(label(c.nom)) + '</a>';
    }).join('');
    html += '<a href="#/catalogue"' + (active === 'tout' ? ' class="on"' : '') + '>Tout le catalogue</a>';
    html += '<a href="#/aides-a-la-vente"' + (active === 'aides' ? ' class="on"' : '') + '>Aides à la vente</a>';
    html += '<a href="#/devenir-revendeur">Devenir revendeur</a>';
    html += '<a class="only-mobile" href="#/commande-rapide">Commande rapide</a>';
    html += '<a class="only-mobile" href="' + (logged() ? '#/compte">Mon compte' : '#/connexion">Se connecter') + '</a>';
    document.getElementById('catnav-list').innerHTML = html;
  }

  // ======================= ACCUEIL =======================
  function pageHome() {
    setTitle('');
    var top = TOP_2026.map(find).filter(Boolean);
    var btp = find('trousse de secours btp 20'), coussin = find('coussin hémostatique he.co stop');
    var compo = btp ? (btp.description.split(/Composition\s*:/i)[1] || '').split('•').map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var cats = data.categories.filter(function (c) { return c.nom !== 'Divers'; });
    var count = function (c) { return data.produits.filter(function (p) { return p.cat[0] === c.nom; }).length; };
    var marq = ['Trousses assemblées en France', 'Livraison offerte dès ' + FRANCO_HT + ' € HT', data.produits.length + ' références', 'Commande par référence ou code-barres', 'Prix revendeur dédiés', 'Conseillers du lundi au vendredi'];
    var marqHtml = marq.concat(marq).map(function (m) { return '<span>' + esc(m) + '</span>'; }).join('');

    return '' +
    /* HERO */
    '<section class="hero">' +
      '<svg class="ecg" viewBox="0 0 1600 160" preserveAspectRatio="none" aria-hidden="true"><path class="ghost" d="' + ecgPath() + '"/><path d="' + ecgPath() + '"/></svg>' +
      '<div class="container hero-in">' +
        '<div data-reveal>' +
          '<span class="eyebrow">Espace réservé aux professionnels</span>' +
          '<h1 style="margin-top:16px">Le fournisseur premiers secours des <em>pharmacies et revendeurs<svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M2 14 C 80 6, 200 6, 298 12"/></svg></em>.</h1>' +
          '<p class="lead">Trousses de secours assemblées en France, consommables et matériel d\'urgence, aux conditions revendeur. Commande par référence ou code-barres, factures et historique dans votre espace.</p>' +
          '<div class="actions">' +
            (logged() ? '<a class="btn btn-primary" href="#/commande-rapide">Passer une commande rapide ' + ARROW + '</a><a class="btn btn-ghost" href="#/compte">Recommander ma dernière commande</a>'
                      : '<a class="btn btn-primary" href="#/devenir-revendeur">Ouvrir mon compte revendeur ' + ARROW + '</a><a class="btn btn-ghost" href="#/catalogue">Découvrir le catalogue</a>') +
          '</div>' +
          '<div class="hero-mini"><div><b class="tnum" data-count="' + data.produits.length + '">0</b><span>références au catalogue</span></div><div><b class="tnum">' + FRANCO_HT + ' € HT</b><span>franco de port</span></div><div><b>Marquage CE</b><span>sur nos dispositifs médicaux</span></div></div>' +
        '</div>' +
        '<div class="stage" data-reveal style="--d:.15s">' +
          '<div class="stage-blob"></div>' +
          (btp ? '<a class="stage-card" href="' + prodUrl(btp) + '" aria-label="' + esc(btp.nom) + '"><img src="' + photo(btp, 1) + '" alt="Trousse de secours BTP 20 ouverte"></a>' : '') +
          '<div class="stage-cross" aria-hidden="true"></div>' +
          '<div class="chip c1"><i>' + compo.length + '</i><div><b>Trousse BTP 20</b>' + compo.length + ' éléments · liste médecine du travail</div></div>' +
          '<div class="chip c2"><i>FR</i><div><b>Assemblage</b>dans nos ateliers en France</div></div>' +
          '<div class="chip c3"><i>EAN</i><div><b>Commande rapide</b>par référence ou code-barres</div></div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<div class="assure"><div class="container assure-in">' +
      '<div><i>FR</i><p><b>Assemblage en France</b><span>Trousses composées dans nos ateliers</span></p></div>' +
      '<div><i>CE</i><p><b>Dispositifs médicaux</b><span>Conformes à la réglementation européenne</span></p></div>' +
      '<div><i>' + FRANCO_HT + '€</i><p><b>Franco dès ' + FRANCO_HT + ' € HT</b><span>Forfait de ' + PORT_HT + ' € HT en dessous</span></p></div>' +
      '<div><i>9-18</i><p><b>Conseillers dédiés</b><span>Du lundi au vendredi, 03 45 86 92 85</span></p></div>' +
    '</div></div>' +

    /* POUR QUI */
    '<section class="section" style="padding-bottom:0"><div class="container">' +
      '<div class="section-head" data-reveal><div class="stack"><span class="eyebrow">Nos clients</span><h2>Un espace pro pensé pour votre métier.</h2></div></div>' +
      '<div class="who">' +
        '<a class="who-card" href="#/devenir-revendeur" data-reveal><h3>Pharmacies et parapharmacies</h3><ul><li>Produits de comptoir à l\'unité et en boîtes</li><li>Réassort par référence ou code-barres</li><li>Recommande de vos produits habituels en un clic</li></ul><span class="go">Ouvrir un compte pharmacie →</span></a>' +
        '<a class="who-card" href="#/devenir-revendeur" data-reveal style="--d:.08s"><h3>Grossistes et distributeurs</h3><ul><li>Tarifs dégressifs selon les volumes</li><li>Trousses composées à la demande</li><li>Un conseiller pour vos commandes importantes</li></ul><span class="go">Demander un tarif volume →</span></a>' +
        '<a class="who-card" href="#/devenir-revendeur" data-reveal style="--d:.16s"><h3>Revendeurs spécialisés</h3><ul><li>Secourisme, équipements de protection, sécurité</li><li>Trousses par métier prêtes à revendre</li><li>Fiches produits et compositions détaillées</li></ul><span class="go">Devenir revendeur →</span></a>' +
      '</div>' +
    '</div></section>' +

    /* MEILLEURES VENTES */
    '<section class="section"><div class="container">' +
      '<div class="section-head" data-reveal><div class="stack"><span class="eyebrow">Les plus commandés en 2026</span><h2>Les références que nos clients recommandent.</h2></div>' +
        '<div class="rail-nav"><button class="btn btn-ghost btn-icon" data-rail="-1" aria-label="Produits précédents">←</button><button class="btn btn-ghost btn-icon" data-rail="1" aria-label="Produits suivants">→</button></div></div>' +
      '<div class="rail" id="rail">' + top.map(function (p, i) { return '<div data-reveal style="--d:' + (i * 0.06) + 's">' + card(p) + '</div>'; }).join('') + '</div>' +
    '</div></section>' +

    /* TROUSSE DÉTAILLÉE */
    (btp ? '<section class="section" style="padding-top:0"><div class="container"><div class="kit" data-reveal><div class="kit-in">' +
      '<div class="kit-visual"><img loading="lazy" src="' + photo(btp, 1) + '" alt="Contenu de la trousse BTP 20"></div>' +
      '<div class="kit-text"><span class="eyebrow">Assemblée en France</span><h2>Une trousse BTP 20, pièce par pièce.</h2>' +
        '<p class="lead">' + compo.length + ' éléments, dont notre coussin hémostatique, pour équiper une équipe de 20 personnes. Conforme aux listes des médecines du travail.</p>' +
        '<ul class="kit-list" id="kit-list">' + compo.slice(0, 12).map(function (c, i) { return '<li style="transition-delay:' + (i * 0.07) + 's">' + esc(c) + '</li>'; }).join('') + '</ul>' +
        '<div><a class="btn btn-primary" href="' + prodUrl(btp) + '">Voir la trousse et ses ' + compo.length + ' éléments ' + ARROW + '</a></div>' +
      '</div></div></div></div></section>' : '') +

    /* CATÉGORIES */
    '<section class="section" style="padding-top:0"><div class="container">' +
      '<div class="section-head" data-reveal><div class="stack"><span class="eyebrow">Le catalogue</span><h2>Le catalogue.</h2></div><a class="btn btn-ghost" href="#/catalogue">Tout le catalogue ' + ARROW + '</a></div>' +
      '<div class="cat-grid">' + cats.map(function (c, i) {
        var pic = data.produits.find(function (p) { return p.cat[0] === c.nom && p.photos.length && p.visible && p.prixHT > 3; }) || data.produits.find(function (p) { return p.cat[0] === c.nom && p.photos.length; });
        return '<a class="cat-card" href="' + catUrl(c.nom) + '" data-reveal style="--d:' + (i * 0.08) + 's">' + (pic ? '<span class="cat-pic"><img loading="lazy" src="' + photo(pic) + '" alt=""></span>' : '') +
          '<span class="muted tnum">' + count(c) + ' produits</span><h3>' + esc(label(c.nom)) + '</h3><span class="go">Explorer <span>→</span></span></a>';
      }).join('') + '</div>' +
    '</div></section>' +

    /* DÉMO COMMANDE RAPIDE */
    '<section class="section" style="background:var(--paper)"><div class="container demo">' +
      '<div class="stack" data-reveal><span class="eyebrow">Commande rapide</span><h2>Un réassort sans ressaisie.</h2>' +
        '<p class="lead">Tapez une référence ou scannez un code-barres. Le panier vous dit ce qu\'il manque pour la livraison offerte.</p>' +
        '<div class="steps" style="margin-top:10px"><div class="step"><div><h3>Saisissez vos références</h3><p class="muted">Une par une, ou collez votre liste habituelle.</p></div></div>' +
        '<div class="step"><div><h3>Visez la livraison offerte</h3><p class="muted">La barre se remplit jusqu\'à ' + FRANCO_HT + ' € HT.</p></div></div>' +
        '<div class="step"><div><h3>Recommandez en un clic</h3><p class="muted">Votre dernière commande se recharge depuis votre compte.</p></div></div></div>' +
        '<div><a class="btn btn-navy" href="#/commande-rapide">Essayer la commande rapide ' + ARROW + '</a></div></div>' +
      '<div class="demo-screen" data-reveal style="--d:.1s" aria-label="Démonstration animée de la commande rapide" role="img"><div class="demo-bar"><i></i><i></i><i></i></div><div class="demo-body">' +
        '<div class="demo-input"><span id="demo-typed"></span><span class="caret"></span></div>' +
        '<div class="demo-rows" id="demo-rows"></div>' +
        '<div class="franco" id="demo-franco"><span id="demo-franco-txt">Livraison offerte dès ' + FRANCO_HT + ' € HT</span><div class="bar"><span id="demo-bar"></span></div></div>' +
      '</div></div>' +
    '</div></section>' +

    /* MISE EN AVANT */
    (coussin ? '<section class="section"><div class="container spot">' +
      '<div class="spot-visual' + (coussin.photos.indexOf('ART0270_3.jpg') > -1 ? ' cover' : '') + '" data-reveal><img loading="lazy" src="' + (coussin.photos.indexOf('ART0270_3.jpg') > -1 ? IMG + 'ART0270_3.jpg' : photo(coussin)) + '" alt="Coussin hémostatique posé sur un avant-bras"></div>' +
      '<div class="stack" data-reveal style="--d:.1s"><span class="eyebrow">Notre fabrication</span><h2>Le coussin hémostatique HE.CO STOP.</h2>' +
        '<p class="lead">Conçu pour les plaies hémorragiques importantes, il remplace la compression manuelle du sauveteur. Conseillé par les médecines du travail et utilisé par les pompiers.</p>' +
        '<div style="display:flex;gap:18px;align-items:end;flex-wrap:wrap;margin-block:8px"><span class="counter tnum" data-count="183">0</span><span class="muted" style="max-width:22ch;padding-bottom:12px">coussins commandés en ligne en 2026</span></div>' +
        '<div><a class="btn btn-primary" href="' + prodUrl(coussin) + '">Voir le coussin ' + ARROW + '</a></div></div>' +
    '</div></section>' : '') +

    /* AIDES À LA VENTE */
    '<section class="section" style="padding-top:0"><div class="container">' +
      '<div class="section-head" data-reveal><div class="stack"><span class="eyebrow">Aides à la vente</span><h2>Des fiches pour conseiller au comptoir.</h2><p class="muted">Les questions à poser, les références à proposer, les compléments qui vont avec.</p></div><a class="btn btn-ghost" href="#/aides-a-la-vente">Toutes les fiches ' + ARROW + '</a></div>' +
      '<div class="fiche-grid three">' + FICHES.slice(0, 3).map(function (f, i) { var lead = prods(f.offre || (f.table && f.table[0][1]))[0]; return '<a class="fiche-card" href="#/aides-a-la-vente/' + f.slug + '" data-reveal style="--d:' + (i * 0.06) + 's">' + (lead ? '<span class="fiche-pic"><img loading="lazy" src="' + photo(lead) + '" alt=""></span>' : '') + '<h3>' + esc(f.titre) + '</h3><p class="muted">' + esc(f.pour) + '</p><span class="go">Ouvrir la fiche →</span></a>'; }).join('') + '</div>' +
    '</div></section>' +

    /* PROS */
    '<section class="section" style="padding-top:0"><div class="container duo">' +
      '<div class="panel navy" data-reveal><span class="eyebrow">Grossistes et distributeurs</span><h3>Commandes en volume et trousses sur mesure.</h3><p>Tarifs dégressifs et compositions spécifiques sur devis. Nos conseillers vous répondent du lundi au vendredi, de 9 h à 18 h.</p><p class="phone tnum">03 45 86 92 85</p><p>contact@hecostop.fr</p></div>' +
      '<div class="panel orange" data-reveal style="--d:.1s"><span class="eyebrow">Entreprises et particuliers</span><h3>Vous équipez vos équipes ou votre véhicule ?</h3><p class="muted">Trousses par métier et gestion automatisée de vos trousses : c\'est sur MyPharmacieBox, notre site pour les entreprises et les particuliers.</p><div><a class="btn btn-ghost" href="https://www.mypharmaciebox.com/" rel="noopener">Aller sur MyPharmacieBox ' + ARROW + '</a></div></div>' +
    '</div></section>' +

    /* APPEL FINAL */
    '<section class="section" style="padding-top:0"><div class="container"><div class="final" data-reveal>' +
      '<div><h2>Ouvrez votre compte professionnel.</h2><p>Envoyez votre demande avec votre SIRET. Nous vérifions votre activité et activons vos conditions revendeur.</p></div>' +
      '<a class="btn btn-navy" href="#/devenir-revendeur">Faire ma demande ' + ARROW + '</a>' +
      '<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="#fff" d="M35 0h30v35h35v30H65v35H35V65H0V35h35z"/></svg>' +
    '</div></div></section>';
  }

  function ecgPath() {
    var d = 'M0 90', x = 0;
    while (x < 1600) { d += ' L' + (x + 120) + ' 90 L' + (x + 135) + ' 80 L' + (x + 150) + ' 90 L' + (x + 165) + ' 90 L' + (x + 175) + ' 20 L' + (x + 188) + ' 150 L' + (x + 200) + ' 90 L' + (x + 230) + ' 90 L' + (x + 250) + ' 76 L' + (x + 270) + ' 90'; x += 400; }
    return d;
  }

  function startDemo() {
    var typed = document.getElementById('demo-typed'), rows = document.getElementById('demo-rows'), bar = document.getElementById('demo-bar'), txt = document.getElementById('demo-franco-txt'), fr = document.getElementById('demo-franco');
    if (!typed) return;
    var seq = [['ART0274', 20], ['ART0270', 5], ['ART0094', 6], ['ART0511', 2]].map(function (x) { return { p: byRef(x[0]), q: x[1] }; }).filter(function (x) { return x.p; });
    var total = 0, i = 0;
    function reset() { rows.innerHTML = ''; total = 0; i = 0; bar.style.width = '0'; fr.classList.remove('done'); txt.textContent = 'Livraison offerte dès ' + FRANCO_HT + ' € HT'; next(); }
    function next() {
      if (!document.body.contains(typed)) return;
      if (i >= seq.length) { later(reset, 3200); return; }
      var it = seq[i], ref = it.p.ref, k = 0; typed.textContent = '';
      (function type() {
        typed.textContent = ref.slice(0, ++k);
        if (k < ref.length) later(type, 90); else later(function () {
          typed.textContent = '';
          total += (it.p.prixHT || 0) * it.q;
          var r = document.createElement('div'); r.className = 'demo-row';
          r.innerHTML = '<img src="' + photo(it.p) + '" alt=""><div><b>' + esc(it.p.nom) + '</b><br><span>Réf. ' + esc(ref) + '</span></div><b class="tnum">× ' + it.q + '</b>';
          rows.appendChild(r);
          bar.style.width = Math.min(100, total / FRANCO_HT * 100) + '%';
          if (total >= FRANCO_HT) { fr.classList.add('done'); txt.innerHTML = '<b>Livraison offerte</b> : ' + eur(total) + ' HT'; }
          else txt.innerHTML = 'Plus que <b class="tnum">' + eur(FRANCO_HT - total) + ' HT</b> pour la livraison offerte';
          i++; later(next, 900);
        }, 450);
      })();
    }
    next();
  }

  // ======================= CATALOGUE =======================
  function pageCatalogue(catSlug, subSlug, query) {
    var cat = catSlug ? data.categories.find(function (c) { return c.slug === catSlug; }) : null;
    var sub = cat && subSlug ? cat.sous.find(function (s) { return s.slug === subSlug; }) : null;
    var list = data.produits.filter(function (p) {
      if (cat && p.cat[0] !== cat.nom) return false;
      if (sub && p.cat[1] !== sub.nom) return false;
      if (query) return norm(p.nom + ' ' + (p.nomOrigine || '') + ' ' + p.ref + ' ' + p.ean + ' ' + p.resume).indexOf(norm(query)) > -1;
      return true;
    });
    var sort = load('hs_sort', 'pertinence');
    if (sort === 'pertinence') list.sort(function (a, b) { return (topIds[b.id] ? 1 : 0) - (topIds[a.id] ? 1 : 0) || (b.photos.length ? 1 : 0) - (a.photos.length ? 1 : 0); });
    if (sort === 'prix-asc') list.sort(function (a, b) { return (a.prixHT || 0) - (b.prixHT || 0); });
    if (sort === 'prix-desc') list.sort(function (a, b) { return (b.prixHT || 0) - (a.prixHT || 0); });
    if (sort === 'nom') list.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var title = query ? 'Résultats pour « ' + query + ' »' : sub ? label(sub.nom) : cat ? label(cat.nom) : 'Tout le catalogue';
    setTitle(title);
    var chips = cat
      ? '<a href="' + catUrl(cat.nom) + '"' + (!sub ? ' class="on"' : '') + '>Tout <span>' + data.produits.filter(function (p) { return p.cat[0] === cat.nom; }).length + '</span></a>' + cat.sous.map(function (s) { return '<a href="' + catUrl(cat.nom, s.nom) + '"' + (sub && sub.slug === s.slug ? ' class="on"' : '') + '>' + esc(label(s.nom)) + ' <span>' + s.n + '</span></a>'; }).join('')
      : data.categories.filter(function (c) { return c.nom !== 'Divers'; }).map(function (c) { return '<a href="' + catUrl(c.nom) + '">' + esc(label(c.nom)) + '</a>'; }).join('');
    var intro = query ? 'Recherche dans le nom, la référence, le code-barres et la description des produits.' : (CAT_INTRO[cat ? cat.nom : ''] || 'Trousses, consommables, matériel d\'urgence et dépistage, aux conditions revendeur.');
    return '<div class="cat-band"><div class="container cat-band-in"><div class="stack" style="gap:10px">' +
      '<nav class="crumbs" aria-label="Fil d\'Ariane"><a href="#/">Accueil</a><span>/</span><a href="#/catalogue">Catalogue</a>' + (cat ? '<span>/</span><a href="' + catUrl(cat.nom) + '">' + esc(label(cat.nom)) + '</a>' : '') + (sub ? '<span>/</span>' + esc(label(sub.nom)) : '') + '</nav>' +
      '<h1>' + esc(title) + '</h1><p class="muted">' + esc(intro) + '</p></div>' +
      '<a class="qo-teaser" href="#/commande-rapide"><b>Vous connaissez vos références ?</b><span>Commande rapide par référence ou code-barres →</span></a>' +
      '</div></div><div class="container">' +
      '<nav class="chips" aria-label="Sous-catégories" style="margin-top:22px">' + chips + '</nav>' +
      '<div class="toolbar"><span class="muted tnum">' + list.length + ' produit' + (list.length > 1 ? 's' : '') + (logged() ? '' : ' · <a href="#/connexion">connectez-vous</a> pour voir vos prix') + '</span><label>Trier par <select id="sort"><option value="pertinence">Les plus commandés</option><option value="nom">Nom</option><option value="prix-asc">Prix croissant</option><option value="prix-desc">Prix décroissant</option></select></label></div>' +
      (list.length ? '<div class="grid">' + list.map(function (p, i) { return '<div data-reveal style="--d:' + Math.min(i, 8) * 0.04 + 's">' + card(p) + '</div>'; }).join('') + '</div>'
                   : '<div class="empty"><h3>Aucun produit trouvé</h3><p class="muted">Essayez une référence (par exemple ART0181) ou un mot plus court.</p><a class="btn btn-navy" href="#/catalogue">Voir tout le catalogue</a></div>') +
      '</div>';
  }

  // ======================= FICHE PRODUIT =======================
  function pageProduct(id) {
    var p = byId[id]; if (!p) return pageNotFound();
    setTitle(p.nom);
    var related = data.produits.filter(function (x) { return x.id !== p.id && x.cat[1] && x.cat[1] === p.cat[1] && x.photos.length; }).slice(0, 4);
    var variants = p.declinaisons.length ? '<div class="field"><label for="variant">Modèle</label><select id="variant">' + p.declinaisons.map(function (d) { return '<option value="' + esc(d.ref) + '" data-price="' + d.prixHT + '">' + esc(d.nom) + ' (réf. ' + esc(d.ref) + ')</option>'; }).join('') + '</select></div>' : '';
    var first = p.declinaisons.length ? p.declinaisons[0].prixHT : p.prixHT;
    return '<section class="section" style="padding-top:36px"><div class="container stack" style="gap:48px">' +
      '<div class="pdp">' +
        '<div class="gallery" data-reveal><div class="main"><img id="main-img" src="' + photo(p) + '" alt="' + esc(p.nom) + '"></div>' +
          (p.photos.length > 1 ? '<div class="thumbs">' + p.photos.map(function (f, i) { return '<button type="button" data-img="' + IMG + f + '"' + (i === 0 ? ' class="on"' : '') + ' aria-label="Photo ' + (i + 1) + '"><img src="' + IMG + f + '" alt=""></button>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="buybox" data-reveal style="--d:.08s">' +
          '<nav class="crumbs" aria-label="Fil d\'Ariane" style="margin:0"><a href="#/">Accueil</a><span>/</span><a href="' + catUrl(p.cat[0]) + '">' + esc(label(p.cat[0])) + '</a>' + (p.cat[1] ? '<span>/</span><a href="' + catUrl(p.cat[0], p.cat[1]) + '">' + esc(label(p.cat[1])) + '</a>' : '') + '</nav>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (topIds[p.id] ? '<span class="badge hot">Meilleure vente</span>' : '') + (p.marquePropre ? '<span class="badge fr">Marque HE.CO STOP</span>' : '') + '</div>' +
          '<h1>' + esc(p.nom) + '</h1>' +
          (p.resume ? '<p class="lead" style="font-size:17px">' + esc((function () { var ls = p.resume.split(/\n|•/).map(function (s) { return s.trim(); }).filter(Boolean); return (ls.length > 1 ? ls.slice(1, 3) : ls).join(' · '); })()) + '</p>' : '') +
          '<dl class="facts"><dt>Référence</dt><dd class="mono" id="ref-val">' + esc(p.declinaisons.length ? p.declinaisons[0].ref : (p.ref || '—')) + '</dd><dt>Code-barres (EAN)</dt><dd class="mono">' + esc(p.ean || '—') + '</dd>' +
            (pack(p) ? '<dt>Conditionnement</dt><dd>' + esc(pack(p)) + '</dd>' : '') + '<dt>TVA</dt><dd>' + p.tva + ' %</dd></dl>' +
          '<div class="buy-card"><div id="price-zone">' + priceBlock(p, first) + '</div>' + variants +
            (logged() ? '<div style="display:flex;gap:10px"><label class="sr" for="pq">Quantité</label><input class="qty" id="pq" type="number" min="1" value="1" inputmode="numeric"><button class="btn btn-primary" id="pdp-add" style="flex:1">Ajouter au panier</button></div>'
                      : '<a class="btn btn-primary" href="#/devenir-revendeur">Ouvrir un compte pour commander ' + ARROW + '</a><a href="#/connexion" style="text-align:center">Déjà client ? Se connecter</a>') +
          '</div>' +
          '<div class="trust"><div><i>✓</i>Livraison offerte dès ' + FRANCO_HT + ' € HT</div><div><i>✓</i>Conseillers du lundi au vendredi, 9 h – 18 h</div><div><i>✓</i>Facture et suivi de commande dans votre compte</div></div>' +
          '<p class="muted" style="font-size:15px">Commande en volume ou composition spécifique ? Appelez le <b class="tnum">03 45 86 92 85</b> ou écrivez à contact@hecostop.fr.</p>' +
        '</div>' +
      '</div>' +
      descBlock(p) +
      (logged() ? '<div class="buybar" aria-hidden="true"><div><b>' + esc(p.nom) + '</b><span class="tnum" id="buybar-price">' + (first != null ? eur(first) + ' HT' : '') + '</span></div><button class="btn btn-primary" type="button" data-scrollbuy>Ajouter</button></div>' : '') +
      (related.length ? '<div class="stack"><h2 style="font-size:32px">Souvent commandés avec</h2><div class="grid">' + related.map(card).join('') + '</div></div>' : '') +
    '</div></section>';
  }

  function pack(p) {
    var m = p.nom.match(/(bo[iî]te|lot|sachet|paquet|pr[ée]sentoir|rouleau)\s+de\s+\d+[^,]*/i);
    return m ? m[0].charAt(0).toUpperCase() + m[0].slice(1) : null;
  }
  function descBlock(p) {
    var d = (p.description || '').trim();
    if (!d || d === p.resume) return '';
    var parts = d.split(/Composition\s*(?:de la trousse pleine)?\s*:/i);
    var head = parts[0].trim(), compo = parts[1] ? parts[1].split(/•/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var headItems = head.split(/\n|•/).map(function (s) { return s.trim(); }).filter(Boolean);
    return '<div class="desc-grid">' +
      '<div class="stack"><h2 style="font-size:28px">Caractéristiques</h2><ul class="spec-list">' + headItems.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
      (compo.length ? '<div class="stack"><h2 style="font-size:28px">Composition <span class="muted" style="font-size:18px;font-weight:500">' + compo.length + ' éléments</span></h2><ul class="compo-list">' + compo.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' : '') +
    '</div>';
  }

  // ======================= AIDES À LA VENTE =======================
  // Fiches comptoir : uniquement des produits réels du catalogue (par identifiant).
  var FICHES = [
    { slug: 'quelle-trousse', titre: 'Quelle trousse pour quel client ?', pour: 'Tous les clients qui demandent « une trousse de secours »',
      intro: 'Trois questions suffisent pour proposer la bonne trousse, au lieu de la moins chère du rayon.',
      questions: ['Pour qui : la famille, un sportif, un véhicule, une entreprise ?', 'Combien de personnes doit-elle couvrir ?', 'Où sera-t-elle rangée : à la maison, dans un sac, dans un véhicule, au mur ?'],
      table: [['Maison, famille', [18]], ['Voiture', [1]], ['Sport', [58]], ['Randonnée', [60, 63]], ['Artisan, commerçant', [20]], ['Bureau', [21]], ['Chantier : 5, 10 ou 20 personnes', [237, 238, 239]], ['Cuisine, agroalimentaire', [166]]],
      plus: [16, 274, 55] },
    { slug: 'obligations-entreprises', titre: 'Vos clients professionnels ont une obligation', pour: 'Artisans, commerçants, chefs d\'entreprise, collectivités',
      intro: 'Le Code du travail impose du matériel de premiers secours sur les lieux de travail. Vos clients professionnels ne le savent pas toujours : c\'est un argument de vente simple et juste.',
      points: ['Les lieux de travail doivent être équipés d\'un matériel de premiers secours adapté à la nature des risques et facilement accessible (article R4224-14 du Code du travail).', 'Il n\'existe pas de liste officielle du contenu : l\'employeur le définit, en lien avec le médecin du travail.', 'L\'emplacement du matériel doit être signalé (article R4224-23).', 'Pensez au réassort : les produits périssables doivent être remplacés avant leur date de péremption.'],
      source: { t: 'INRS, matériel de premiers secours', u: 'https://www.inrs.fr/demarche/organisation-secours/materiel-premiers-secours.html' },
      questions: ['Quel est votre métier, et quels sont les risques principaux (coupures, brûlures, chutes) ?', 'Combien de salariés, et sur combien de sites ou de véhicules ?', 'Qui vérifie le contenu, et à quelle fréquence ?'],
      offre: [237, 238, 239, 20, 21, 166, 114, 116],
      plus: [87, 248, 93] },
    { slug: 'ete', titre: 'L\'été au comptoir', pour: 'Vacances, randonnée, jardin, activités de plein air',
      intro: 'Les petits incidents de l\'été reviennent chaque année. Un rayon prêt dès le printemps évite de manquer des ventes.',
      questions: ['Où partez-vous, et pour quelles activités ?', 'Avec des enfants ?', 'Avez-vous déjà une trousse pour le sac ou la voiture ?'],
      offre: [11, 8, 279, 33, 48, 121, 219, 60],
      plus: [16, 274, 70] },
    { slug: 'brulures-petites-plaies', titre: 'Brûlures et petites plaies', pour: 'Cuisine, bricolage, jardin, enfants',
      intro: 'Un rayon brûlures complet rassure le client et se vend en complément : la compresse spécifique, le tulle gras, l\'eau gélifiée.',
      questions: ['Est-ce pour la maison, la cuisine d\'un restaurant ou un atelier ?', 'Faut-il une trousse complète ou un réassort ?', 'Combien de personnes à équiper ?'],
      offre: [30, 139, 169, 167, 168, 86, 274, 131],
      plus: [55, 83, 166] },
    { slug: 'hemorragies', titre: 'Hémorragies : le kit qui complète la trousse', pour: 'Entreprises à risque de coupure, BTP, ateliers, clubs, secouristes',
      intro: 'Le coussin hémostatique HE.CO STOP est notre fabrication. Il remplace la compression manuelle du sauveteur. Proposez-le à tout client qui équipe un atelier ou un chantier.',
      questions: ['Quels outils coupants sont utilisés sur place ?', 'Y a-t-il un sauveteur secouriste du travail dans l\'équipe ?', 'La trousse actuelle contient-elle un coussin hémostatique ?'],
      offre: [87, 88, 248, 89, 243, 26, 118],
      plus: [55, 16, 93],
      note: 'Les gestes de secours s\'apprennent en formation. Orientez vos clients vers une formation de sauveteur secouriste du travail.' },
    { slug: 'depistage', titre: 'Le rayon dépistage', pour: 'Conducteurs, employeurs, fêtes et soirées',
      intro: 'Les éthylotests en présentoir se vendent seuls, près de la caisse. Les tests salivaires répondent à une demande des employeurs et des parents.',
      questions: ['Pour un usage personnel ou pour une entreprise ?', 'Alcool, drogues, ou les deux ?', 'Conducteur novice (seuil 0,2 g/L) ou confirmé (0,5 g/L) ?'],
      offre: [282, 283, 280, 281, 285, 286, 287],
      plus: [1, 16] }
  ];
  function prods(ids) { return (ids || []).map(function (i) { return byId[i]; }).filter(Boolean); }
  function pageAides(slugF) {
    if (slugF) return pageFiche(FICHES.find(function (f) { return f.slug === slugF; }));
    setTitle('Aides à la vente');
    return '<div class="cat-band"><div class="container cat-band-in"><div class="stack" style="gap:10px"><nav class="crumbs"><a href="#/">Accueil</a><span>/</span>Aides à la vente</nav><h1>Aides à la vente</h1><p class="muted">Des fiches comptoir pour conseiller vos clients et vendre les bons produits : les questions à poser, les références à proposer, les compléments qui vont avec. À consulter ici ou à imprimer.</p></div></div></div>' +
      '<section class="section" style="padding-top:32px"><div class="container"><div class="fiche-grid">' + FICHES.map(function (f, i) {
        var lead = prods(f.offre || (f.table && f.table[0][1]))[0];
        return '<a class="fiche-card" href="#/aides-a-la-vente/' + f.slug + '" data-reveal style="--d:' + (i * 0.05) + 's">' + (lead ? '<span class="fiche-pic"><img loading="lazy" src="' + photo(lead) + '" alt=""></span>' : '') + '<span class="eyebrow">Fiche ' + (i + 1) + '</span><h3>' + esc(f.titre) + '</h3><p class="muted">' + esc(f.pour) + '</p><span class="go">Ouvrir la fiche →</span></a>';
      }).join('') + '</div></div></section>';
  }
  function pageFiche(f) {
    if (!f) return pageNotFound();
    setTitle(f.titre);
    var n = FICHES.indexOf(f) + 1;
    return '<div class="cat-band"><div class="container cat-band-in"><div class="stack" style="gap:10px"><nav class="crumbs"><a href="#/">Accueil</a><span>/</span><a href="#/aides-a-la-vente">Aides à la vente</a><span>/</span>Fiche ' + n + '</nav><h1>' + esc(f.titre) + '</h1><p class="muted"><b>Pour :</b> ' + esc(f.pour) + '</p></div><button class="btn btn-ghost" type="button" id="print-fiche">Imprimer la fiche</button></div></div>' +
      '<section class="section fiche" style="padding-top:32px"><div class="container stack" style="gap:28px">' +
        '<p class="lead" style="max-width:70ch">' + esc(f.intro) + '</p>' +
        (f.points ? '<div class="fiche-box"><h2>Ce que dit la réglementation</h2><ul class="spec-list">' + f.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' + (f.source ? '<p class="muted" style="font-size:14px;margin-top:10px">Source : <a href="' + f.source.u + '" rel="noopener">' + esc(f.source.t) + '</a>. Informations données à titre indicatif.</p>' : '') + '</div>' : '') +
        '<div class="fiche-box"><h2>À demander au client</h2><ol class="fiche-q">' + f.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol></div>' +
        (f.table ? '<div class="fiche-box"><h2>Le bon choix selon le besoin</h2><div class="tbl" style="box-shadow:none"><table><thead><tr><th>Le client</th><th>À proposer</th><th>Référence</th></tr></thead><tbody>' +
          f.table.map(function (row) { var ps = prods(row[1]); return '<tr><td><b>' + esc(row[0]) + '</b></td><td>' + ps.map(function (p) { return '<a href="' + prodUrl(p) + '">' + esc(p.nom) + '</a>'; }).join('<br>') + '</td><td class="mono">' + ps.map(function (p) { return esc(p.ref); }).join('<br>') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' : '') +
        (f.offre ? '<div class="stack"><h2 style="font-size:28px">À proposer</h2><div class="grid">' + prods(f.offre).map(card).join('') + '</div></div>' : '') +
        '<div class="stack"><h2 style="font-size:24px">À ajouter souvent</h2><div class="grid">' + prods(f.plus).map(card).join('') + '</div></div>' +
        (f.note ? '<div class="notice warn">' + esc(f.note) + '</div>' : '') +
        '<nav class="fiche-nav">' + (n > 1 ? '<a class="btn btn-ghost" href="#/aides-a-la-vente/' + FICHES[n - 2].slug + '">← ' + esc(FICHES[n - 2].titre) + '</a>' : '<span></span>') + (n < FICHES.length ? '<a class="btn btn-ghost" href="#/aides-a-la-vente/' + FICHES[n].slug + '">' + esc(FICHES[n].titre) + ' →</a>' : '') + '</nav>' +
      '</div></section>';
  }

  // ---------- suggestions de recherche ----------
  var sugIdx = -1, sugTimer = null;
  function mark(text, q) {
    var t = esc(text), n = norm(text), k = norm(q).trim(); if (!k) return t;
    var i = n.indexOf(k); if (i < 0) return t;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + k.length)) + '</mark>' + esc(text.slice(i + k.length));
  }
  function suggestions(q) {
    var k = norm(q).trim(); if (k.length < 2) return null;
    var scored = data.produits.map(function (p) {
      var nm = norm(p.nom), s = 0;
      if (norm(p.ref) === k || norm(p.ean) === k) s = 100;
      else if (norm(p.ref).indexOf(k) === 0 || String(p.ean || '').indexOf(k) === 0) s = 80;
      else if (nm.indexOf(k) === 0) s = 60;
      else if ((' ' + nm).indexOf(' ' + k) > -1) s = 45;
      else if (nm.indexOf(k) > -1) s = 30;
      else if (norm(p.nomOrigine).indexOf(k) > -1 || norm(p.resume).indexOf(k) > -1) s = 12;
      if (s && topIds[p.id]) s += 5;
      return { p: p, s: s };
    }).filter(function (x) { return x.s; }).sort(function (a, b) { return b.s - a.s; });
    var cats = [];
    data.categories.forEach(function (c) { if (norm(label(c.nom)).indexOf(k) > -1) cats.push({ n: label(c.nom), u: catUrl(c.nom) }); c.sous.forEach(function (s) { if (norm(label(s.nom)).indexOf(k) > -1) cats.push({ n: label(s.nom), u: catUrl(c.nom, s.nom) }); }); });
    return { list: scored.slice(0, 6), total: scored.length, cats: cats.slice(0, 3) };
  }
  function renderSuggest(q) {
    var box = document.getElementById('suggest'), inp = document.getElementById('search-input'), r = suggestions(q);
    sugIdx = -1;
    if (!r) { box.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
    if (!r.total && !r.cats.length) { box.innerHTML = '<p class="sug-empty">Aucun produit pour « ' + esc(q) + ' ». Essayez une référence (ART0274) ou un code-barres.</p>'; box.hidden = false; return; }
    box.innerHTML =
      (r.cats.length ? '<div class="sug-cats">' + r.cats.map(function (c) { return '<a class="sug-cat" href="' + c.u + '">' + mark(c.n, q) + '</a>'; }).join('') + '</div>' : '') +
      r.list.map(function (x, i) { var p = x.p; return '<a class="sug-item" role="option" id="sug-' + i + '" href="' + prodUrl(p) + '"><img src="' + photo(p) + '" alt=""><span><b>' + mark(p.nom, q) + '</b><small>Réf. ' + mark(p.ref || '', q) + (p.ean ? ' · ' + mark(p.ean, q) : '') + '</small></span><em>' + (logged() && p.prixHT != null ? eur(p.prixHT) + ' HT' : '') + '</em></a>'; }).join('') +
      (r.total > r.list.length ? '<a class="sug-all" href="#/catalogue?q=' + encodeURIComponent(q) + '">Voir les ' + r.total + ' résultats →</a>' : '');
    box.hidden = false; inp.setAttribute('aria-expanded', 'true');
  }
  function closeSuggest() { var b = document.getElementById('suggest'); if (b) b.hidden = true; var i = document.getElementById('search-input'); if (i) i.setAttribute('aria-expanded', 'false'); }

  // ---------- annuaire des entreprises (API publique recherche-entreprises.api.gouv.fr) ----------
  var NAF = { '47.73Z': 'Pharmacie (commerce de détail de produits pharmaceutiques)', '46.46Z': 'Commerce de gros de produits pharmaceutiques', '47.74Z': 'Commerce de détail d\'articles médicaux et orthopédiques', '46.69B': 'Commerce de gros de fournitures et équipements industriels', '47.78C': 'Autres commerces de détail spécialisés', '46.18Z': 'Intermédiaires spécialisés du commerce', '86.90A': 'Ambulances', '85.59A': 'Formation continue d\'adultes' };
  var sirenTimer = null, sirenData = [];
  function luhn(n) { n = String(n).replace(/\s/g, ''); if (!/^\d{14}$/.test(n)) return false; var s = 0; for (var i = 0; i < 14; i++) { var d = +n[13 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return s % 10 === 0 || /^356000000/.test(n); }
  function sirenSearch(q) {
    var box = document.getElementById('r-results'); if (!box) return;
    q = q.trim(); if (q.replace(/\s/g, '').length < 3) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<p class="muted siren-msg">Recherche dans l\'annuaire…</p>';
    fetch('https://recherche-entreprises.api.gouv.fr/search?per_page=6&q=' + encodeURIComponent(q))
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        sirenData = d.results || [];
        if (!sirenData.length) { box.innerHTML = '<p class="muted siren-msg">Aucune entreprise trouvée. Vérifiez l\'orthographe, ou saisissez votre SIRET.</p>'; return; }
        box.innerHTML = sirenData.map(function (r, i) {
          var e = (r.matching_etablissements && r.matching_etablissements[0]) || r.siege || {};
          return '<button type="button" role="option" class="siren-item" data-siren="' + i + '"><b>' + esc(r.nom_complet) + '</b><span>' + esc([e.libelle_commune || '', e.siret ? 'SIRET ' + e.siret : '', NAF[r.activite_principale] || r.activite_principale || ''].filter(Boolean).join(' · ')) + '</span>' + (r.etat_administratif === 'C' ? '<em>Cessée</em>' : '') + '</button>';
        }).join('');
      })
      .catch(function () { box.innerHTML = '<p class="muted siren-msg">L\'annuaire ne répond pas pour le moment. Remplissez les champs à la main.</p>'; });
  }
  function sirenPick(i) {
    var r = sirenData[i]; if (!r) return;
    var e = (r.matching_etablissements && r.matching_etablissements[0]) || r.siege || {};
    document.getElementById('r-company').value = r.nom_complet || '';
    document.getElementById('r-siret').value = e.siret || '';
    var type = document.getElementById('r-type');
    if (r.activite_principale === '47.73Z') type.value = 'Pharmacie ou parapharmacie';
    else if (r.activite_principale === '46.46Z') type.value = 'Grossiste ou distributeur';
    document.getElementById('r-results').hidden = true;
    document.getElementById('r-search').value = r.nom_complet || '';
    var closed = r.etat_administratif === 'C' || e.etat_administratif === 'F';
    document.getElementById('r-verified').innerHTML = '<div class="verified' + (closed ? ' ko' : '') + '"><b>' + (closed ? 'Établissement fermé dans l\'annuaire' : 'Entreprise trouvée dans l\'annuaire') + '</b><span>' + esc(r.nom_complet) + ' · SIRET ' + esc(e.siret || '—') + '</span><span>' + esc(e.adresse || '') + '</span><span>' + esc(NAF[r.activite_principale] || ('Activité ' + (r.activite_principale || 'non renseignée'))) + '</span></div>';
  }

  // ======================= AUTRES PAGES =======================
  function pageQuickOrder() {
    setTitle('Commande rapide');
    if (!logged()) return gate('Commande rapide', 'La commande rapide est réservée aux revendeurs connectés.');
    var opts = data.produits.map(function (p) { return '<option value="' + esc(p.ref) + '">' + esc(p.nom) + '</option>'; }).join('') +
      data.produits.reduce(function (a, p) { return a + p.declinaisons.map(function (d) { return '<option value="' + esc(d.ref) + '">' + esc(p.nom + ' — ' + d.nom) + '</option>'; }).join(''); }, '');
    return '<section class="section" style="padding-top:40px"><div class="container qo-layout"><div class="stack" style="gap:22px">' +
      '<div data-reveal><span class="eyebrow">Espace pro</span><h1 style="font-size:clamp(30px,3.4vw,44px);margin-top:10px">Commande rapide</h1><p class="lead" style="margin-top:12px">Saisissez une référence ou un code-barres, puis la quantité. Ou collez votre liste habituelle.</p></div>' +
      '<datalist id="refs">' + opts + '</datalist>' +
      '<form class="form" id="qo-form" data-reveal>' +
        '<div class="qo-row"><label class="sr" for="qo-ref">Référence</label><input id="qo-ref" list="refs" placeholder="Ex. ART0181 ou 3044252701817" autocomplete="off"><label class="sr" for="qo-q">Quantité</label><input id="qo-q" type="number" min="1" value="1" inputmode="numeric"><button class="btn btn-primary" type="submit">Ajouter</button></div>' +
        '<p class="muted" id="qo-msg" aria-live="polite"></p></form>' +
      '<form class="form" id="qo-paste" data-reveal><div class="field"><label for="qo-list">Coller une liste (une ligne par produit : référence ; quantité)</label><textarea id="qo-list" placeholder="ART0181;10&#10;ART0154;2&#10;3044252701817;5"></textarea></div><div><button class="btn btn-navy" type="submit">Ajouter la liste au panier</button></div><p class="muted" id="qo-paste-msg" aria-live="polite"></p></form>' +
      '</div><aside class="summary qo-summary" id="qo-summary" aria-label="Votre sélection">' + qoSummary() + '</aside></div></section>';
  }
  function qoSummary() {
    var t = totals(), rest = Math.max(0, FRANCO_HT - t.ht);
    var lines = state.cart.slice(-6).reverse().map(function (l) { var i = lineInfo(l); return i ? '<div class="qo-line"><span>' + esc(i.name) + '</span><b class="tnum">× ' + l.q + '</b></div>' : ''; }).join('');
    return '<h2 style="font-size:22px">Votre sélection</h2>' +
      (state.cart.length ? '<div class="qo-lines">' + lines + '</div>' + (state.cart.length > 6 ? '<p class="muted" style="font-size:14px">et ' + (state.cart.length - 6) + ' autre(s) ligne(s)</p>' : '') : '<p class="muted">Les produits ajoutés apparaissent ici.</p>') +
      '<div class="franco' + (rest || !t.ht ? '' : ' done') + '">' + (t.ht && !rest ? '<span><b>Livraison offerte</b></span>' : '<span>Plus que <b class="tnum">' + eur(rest) + ' HT</b> pour la livraison offerte</span>') + '<div class="bar"><span style="width:' + Math.min(100, t.ht / FRANCO_HT * 100) + '%"></span></div></div>' +
      '<div class="row total"><span>Total HT</span><span>' + eur(t.ht) + '</span></div>' +
      '<a class="btn btn-primary" href="#/panier">Voir le panier ' + ARROW + '</a>';
  }
  function findByCode(code) {
    var c = norm(code).trim(); if (!c) return null;
    for (var i = 0; i < data.produits.length; i++) {
      var p = data.produits[i];
      if (norm(p.ref) === c || norm(p.ean) === c) return { p: p, v: null };
      var d = p.declinaisons.find(function (x) { return norm(x.ref) === c; });
      if (d) return { p: p, v: d.ref };
    }
    return null;
  }
  function pageCart() {
    setTitle('Panier');
    if (!state.cart.length) return '<section class="section"><div class="container"><div class="empty"><h1 style="font-size:36px">Votre panier est vide</h1><p class="muted">Ajoutez des produits depuis le catalogue, ou utilisez la commande rapide.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary" href="#/commande-rapide">Commande rapide ' + ARROW + '</a><a class="btn btn-ghost" href="#/catalogue">Parcourir le catalogue</a></div></div></div></section>';
    var t = totals(), rest = Math.max(0, FRANCO_HT - t.ht);
    var rows = state.cart.map(function (l, i) {
      var inf = lineInfo(l); if (!inf) return '';
      return '<tr><td><img class="mini" src="' + photo(inf.p) + '" alt=""></td><td><a href="' + prodUrl(inf.p) + '">' + esc(inf.name) + '</a><div class="ref">Réf. ' + esc(inf.ref) + '</div></td>' +
        '<td class="n">' + (logged() ? eur(inf.price) : '—') + '</td><td class="n"><label class="sr" for="cq' + i + '">Quantité</label><input class="qty" id="cq' + i + '" type="number" min="0" value="' + l.q + '" data-line="' + i + '"></td>' +
        '<td class="n">' + (logged() ? eur(inf.total) : '—') + '</td><td><button class="link-btn" data-remove="' + i + '">Retirer</button></td></tr>';
    }).join('');
    var inCart = {}; state.cart.forEach(function (l) { inCart[l.id] = 1; });
    var sugg = rest > 0 ? TOP_2026.map(find).filter(function (p) { return p && !inCart[p.id]; }).slice(0, 4) : [];
    return '<section class="section" style="padding-top:40px"><div class="container stack" style="gap:24px"><h1 style="font-size:clamp(30px,3.4vw,44px)">Panier</h1>' +
      '<div class="cart-layout"><div class="stack" style="gap:20px"><div class="tbl"><table><thead><tr><th></th><th>Produit</th><th class="n">Prix HT</th><th class="n">Qté</th><th class="n">Total HT</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      (logged() ? '<form class="inline-add" id="cart-add-form"><label for="cart-ref">Ajouter une référence</label><input id="cart-ref" list="refs-cart" placeholder="Ex. ART0274" autocomplete="off"><input id="cart-q" class="qty" type="number" min="1" value="1" aria-label="Quantité"><button class="btn btn-navy btn-sm" type="submit">Ajouter</button><datalist id="refs-cart">' + data.produits.map(function (p) { return '<option value="' + esc(p.ref) + '">' + esc(p.nom) + '</option>'; }).join('') + '</datalist><span class="muted" id="cart-add-msg" aria-live="polite"></span></form>' : '') +
      (sugg.length ? '<div class="stack" style="gap:12px"><h2 style="font-size:24px">Pour atteindre la livraison offerte</h2><p class="muted">Les références les plus commandées par nos clients en 2026.</p><div class="grid">' + sugg.map(card).join('') + '</div></div>' : '') +
      '</div>' +
      '<aside class="summary" aria-label="Récapitulatif">' +
        '<div class="franco' + (rest ? '' : ' done') + '">' + (rest ? '<span>Plus que <b>' + eur(rest) + ' HT</b> pour la livraison offerte</span>' : '<span><b>Livraison offerte</b></span>') + '<div class="bar"><span style="width:' + Math.min(100, t.ht / FRANCO_HT * 100) + '%"></span></div></div>' +
        (logged() ? '<div class="row"><span>Total produits HT</span><span>' + eur(t.ht) + '</span></div><div class="row"><span>Livraison HT</span><span>' + (t.port ? eur(t.port) : 'Offerte') + '</span></div><div class="row"><span>TVA</span><span>' + eur(t.tva) + '</span></div><div class="row total"><span>Total TTC</span><span>' + eur(t.ttc) + '</span></div><button class="btn btn-primary" id="checkout">Valider la commande ' + ARROW + '</button><p class="muted" style="font-size:14px">Paiement par carte, virement, ou à 30 jours pour les comptes autorisés.</p>'
                  : '<p class="muted">Connectez-vous pour voir vos prix revendeur et valider.</p><a class="btn btn-primary" href="#/connexion">Se connecter ' + ARROW + '</a>') +
        '<p class="muted" id="checkout-msg" aria-live="polite"></p>' +
      '</aside></div></div></section>';
  }
  function pageRegister() {
    setTitle('Devenir revendeur');
    return '<section class="section" style="padding-top:48px"><div class="container form-layout">' +
      '<div class="stack" data-reveal><span class="eyebrow">Espace pro</span><h1 style="font-size:clamp(36px,5vw,58px)">Devenez revendeur HE.CO STOP.</h1><p class="lead">Pharmacies, parapharmacies, grossistes et distributeurs : ouvrez votre compte pour accéder à vos prix revendeur et commander en ligne.</p>' +
        '<div class="steps" style="margin-top:12px"><div class="step"><div><h3>Votre demande</h3><p class="muted">Deux minutes, avec votre SIRET.</p></div></div><div class="step"><div><h3>Notre vérification</h3><p class="muted">Nous contrôlons votre activité et activons vos tarifs.</p></div></div><div class="step"><div><h3>Vos commandes</h3><p class="muted">En ligne, par référence, ou en recommandant.</p></div></div></div></div>' +
      '<form class="form" id="register-form" novalidate data-reveal style="--d:.1s">' +
        '<div class="field siren-field"><label for="r-search">Retrouvez votre établissement</label><input id="r-search" type="search" autocomplete="off" placeholder="Nom de la pharmacie, SIRET ou SIREN" aria-describedby="r-search-hint" aria-controls="r-results"><span class="hint" id="r-search-hint">Recherche dans l\'annuaire officiel des entreprises : les champs se remplissent tout seuls.</span><div class="siren-results" id="r-results" role="listbox" hidden></div></div>' +
        '<div id="r-verified" aria-live="polite"></div>' +
        '<div class="field"><label for="r-type">Vous êtes</label><select id="r-type" required><option value="">Choisir…</option><option>Pharmacie ou parapharmacie</option><option>Grossiste ou distributeur</option><option>Revendeur spécialisé (secourisme, EPI)</option><option>Autre professionnel</option></select></div>' +
        '<div class="two-col"><div class="field"><label for="r-company">Raison sociale</label><input id="r-company" required autocomplete="organization"></div><div class="field"><label for="r-siret">SIRET</label><input id="r-siret" required inputmode="numeric" pattern="[0-9 ]{14,17}" placeholder="14 chiffres"><span class="hint">Il sert à vérifier votre activité.</span></div></div>' +
        '<div class="two-col"><div class="field"><label for="r-name">Nom et prénom</label><input id="r-name" required autocomplete="name"></div><div class="field"><label for="r-phone">Téléphone</label><input id="r-phone" required type="tel" autocomplete="tel"></div></div>' +
        '<div class="field"><label for="r-email">Email professionnel</label><input id="r-email" required type="email" autocomplete="email"></div>' +
        '<div class="field"><label for="r-volume">Volume d\'achat estimé par mois</label><select id="r-volume"><option>Moins de 120 € HT</option><option>120 à 500 € HT</option><option>500 à 2 000 € HT</option><option>Plus de 2 000 € HT</option></select></div>' +
        '<div><button class="btn btn-primary" type="submit">Envoyer ma demande ' + ARROW + '</button></div><div id="register-msg" aria-live="polite"></div>' +
        '<p class="muted" style="font-size:14px">Vous équipez une entreprise ou votre famille ? <a href="https://www.mypharmaciebox.com/" rel="noopener">Commandez sur MyPharmacieBox</a>.</p>' +
      '</form></div></section>';
  }
  function pageLogin() {
    setTitle('Connexion');
    if (logged()) { location.hash = '#/compte'; return ''; }
    return '<section class="section" style="padding-top:48px"><div class="container" style="max-width:560px"><div class="stack" data-reveal>' +
      '<h1 style="font-size:clamp(36px,5vw,52px)">Bon retour parmi nous.</h1><p class="lead">Connectez-vous pour voir vos prix revendeur et commander.</p>' +
      '<form class="form" id="login-form"><div class="field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="username" placeholder="pharmacie@exemple.fr"></div>' +
        '<div class="notice warn">Maquette : aucun mot de passe n\'est demandé. Le bouton ouvre une session de démonstration « pharmacie ».</div>' +
        '<button class="btn btn-primary" type="submit">Se connecter (démo) ' + ARROW + '</button></form>' +
      '<p>Pas encore de compte ? <a href="#/devenir-revendeur">Devenir revendeur</a></p></div></div></section>';
  }
  function pageAccount() {
    setTitle('Mon compte');
    if (!logged()) return gate('Mon compte', 'Connectez-vous pour voir vos commandes et vos rappels de réassort.');
    var sample = [['couverture de survie', 20], ['pochette de froid instantané', 10], ['tampons chlorhexidine', 6], ['coussin hémostatique he.co stop', 5]].map(function (x) { var p = find(x[0]); return p ? { p: p, q: x[1] } : null; }).filter(Boolean);
    var sum = sample.reduce(function (a, l) { return a + (l.p.prixHT || 0) * l.q; }, 0);
    return '<section class="section" style="padding-top:48px"><div class="container stack" style="gap:24px">' +
      '<div class="section-head" style="margin:0"><div class="stack"><span class="eyebrow">Espace pro</span><h1 style="font-size:clamp(36px,5vw,58px)">Mon compte</h1><p class="muted">Session de démonstration : ' + esc(state.session.email || 'pharmacie de démonstration') + ' · groupe Pharmacie</p></div><button class="btn btn-ghost" id="logout">Se déconnecter</button></div>' +
      '<div class="tiles">' +
        '<div class="tile"><span class="muted">Mes conditions</span><b>Groupe Pharmacie</b><span>Franco dès ' + FRANCO_HT + ' € HT · paiement par carte ou virement</span></div>' +
        '<div class="tile"><span class="muted">Dernière commande <span class="badge">exemple</span></span><b class="tnum">' + eur(sum) + ' HT</b><span>4 références · livrée</span></div>' +
        '<div class="tile"><span class="muted">Prochain rappel de réassort</span><b>Dans 60 jours</b><span>Après votre dernière commande</span></div>' +
        '<a class="tile tile-link" href="#/commande-rapide"><span class="muted">Commander</span><b>Commande rapide →</b><span>Par référence ou code-barres</span></a>' +
      '</div>' +
      '<h2 style="font-size:26px">Ma dernière commande <span class="badge">exemple</span></h2>' +
      '<div class="tbl"><table><thead><tr><th></th><th>Produit</th><th class="n">Qté</th><th class="n">Prix HT</th><th class="n">Total HT</th></tr></thead><tbody>' +
        sample.map(function (l) { return '<tr><td><img class="mini" src="' + photo(l.p) + '" alt=""></td><td><a href="' + prodUrl(l.p) + '">' + esc(l.p.nom) + '</a></td><td class="n">' + l.q + '</td><td class="n">' + eur(l.p.prixHT || 0) + '</td><td class="n">' + eur((l.p.prixHT || 0) * l.q) + '</td></tr>'; }).join('') +
        '<tr><td></td><td><b>Total</b></td><td></td><td></td><td class="n"><b>' + eur(sum) + '</b></td></tr></tbody></table></div>' +
      '<div><button class="btn btn-primary" id="reorder" data-items=\'' + JSON.stringify(sample.map(function (l) { return [l.p.id, l.q]; })) + '\'>Recommander cette commande ' + ARROW + '</button></div>' +
      '<div class="notice">Rappel de réassort : nous vous écrirons 60 jours après votre dernière commande.</div>' +
      '</div></section>';
  }
  function pageAbout() {
    setTitle('Qui sommes-nous');
    return '<section class="section" style="padding-top:48px"><div class="container stack" style="max-width:820px;gap:20px">' +
      '<span class="eyebrow">OUATE HEALTH</span><h1 style="font-size:clamp(36px,5vw,58px)">Qui sommes-nous</h1>' +
      '<p class="lead">HE.CO STOP est la marque professionnelle d\'OUATE HEALTH, spécialiste du matériel de premiers secours. Nous assemblons nos trousses en France et distribuons consommables et matériel d\'urgence aux pharmacies et aux revendeurs.</p>' +
      '<p>Pour les entreprises, les collectivités et les particuliers, OUATE HEALTH propose aussi <a href="https://www.mypharmaciebox.com/" rel="noopener">MyPharmacieBox</a> : trousses par métier et gestion automatisée des trousses.</p>' +
      '<h2 style="font-size:30px">Mentions légales</h2><p>OUATE HEALTH, SAS au capital de 85 026 €. Siège : 6 rue du Plessis Beuscher, 35220 Châteaubourg. SIREN 793 648 767, RCS Rennes. TVA intracommunautaire FR27793648767. Directeur de la publication : Stéphane Lepinay.</p>' +
      '<div class="notice warn">À valider par OUATE HEALTH : coordonnées de l\'hébergeur, conditions générales de vente professionnelles.</div></div></section>';
  }
  function gate(title, msg) {
    return '<section class="section"><div class="container"><div class="empty"><h1 style="font-size:36px">' + esc(title) + '</h1><p class="muted">' + esc(msg) + '</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary" href="#/connexion">Se connecter ' + ARROW + '</a><a class="btn btn-ghost" href="#/devenir-revendeur">Devenir revendeur</a></div></div></div></section>';
  }
  function pageNotFound() {
    setTitle('Page introuvable');
    return '<section class="section"><div class="container"><div class="empty"><h1 style="font-size:36px">Cette page n\'existe pas</h1><p class="muted">Le produit a peut-être changé d\'adresse.</p><a class="btn btn-navy" href="#/catalogue">Voir le catalogue</a></div></div></section>';
  }

  // ---------- animations ----------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; el.classList.add('in'); io.unobserve(el);
      if (el.dataset.count) countUp(el);
      if (el.classList.contains('demo-screen')) startDemo();
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }) : null;
  function countUp(el) {
    var end = +el.dataset.count;
    if (REDUCED) { el.textContent = end; return; }
    var t0 = performance.now();
    (function step(t) { var k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  function arm() {
    var els = app.querySelectorAll('[data-reveal],[data-count],.kit-list,.demo-screen');
    if (!io) { els.forEach(function (el) { el.classList.add('in'); if (el.dataset.count) el.textContent = el.dataset.count; }); startDemo(); return; }
    els.forEach(function (el) { io.observe(el); });
    // Ce qui est déjà à l'écran au chargement s'affiche sans attendre l'observateur
    // (onglet en arrière-plan, navigateurs qui retardent l'observation).
    setTimeout(function () {
      els.forEach(function (el) {
        if (el.classList.contains('in')) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('in'); io.unobserve(el);
          if (el.dataset.count) countUp(el);
          if (el.classList.contains('demo-screen')) startDemo();
        }
      });
    }, 60);
  }

  // ---------- routeur ----------
  function route() {
    clearTimers();
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var parts = h.split('?')[0].split('/').filter(Boolean);
    var query = (h.split('?q=')[1] || '').replace(/\+/g, ' ');
    var html, active = null;
    switch (parts[0] || '') {
      case '': html = pageHome(); break;
      case 'catalogue': html = pageCatalogue(parts[1], parts[2], query); active = parts[1] || (query ? null : 'tout'); break;
      case 'produit': var pid = parseInt(parts[1], 10); html = pageProduct(pid); active = byId[pid] ? slug(byId[pid].cat[0]) : null; break;
      case 'commande-rapide': html = pageQuickOrder(); break;
      case 'panier': html = pageCart(); break;
      case 'devenir-revendeur': html = pageRegister(); break;
      case 'connexion': html = pageLogin(); break;
      case 'compte': html = pageAccount(); break;
      case 'qui-sommes-nous': html = pageAbout(); break;
      case 'aides-a-la-vente': html = pageAides(parts[1]); active = 'aides'; break;
      default: html = pageNotFound();
    }
    app.innerHTML = html;
    app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter');
    renderCatnav(active); renderAccountLink(); renderCartCount(false);
    var s = document.getElementById('sort'); if (s) s.value = load('hs_sort', 'pertinence');
    document.getElementById('catnav').classList.remove('open');
    closeDrawer(); closeSuggest();
    window.scrollTo(0, 0);
    arm();
  }

  // ---------- événements ----------
  document.addEventListener('click', function (e) {
    var si = e.target.closest('[data-siren]');
    if (si) { sirenPick(+si.dataset.siren); return; }
    var sb = e.target.closest('[data-scrollbuy]');
    if (sb) { var add = document.getElementById('pdp-add'); if (add) add.click(); return; }
    var t = e.target.closest('[data-add],[data-remove],[data-img],[data-rail],#pdp-add,#reorder,#logout,#checkout,#menu-toggle,#cart-btn,#drawer-close,#drawer-veil,#print-fiche');
    if (!t) return;
    if (t.dataset.add) { var id = +t.dataset.add, q = document.getElementById('q' + id); cartAdd(id, q ? q.value : 1, null, t); later(openDrawer, 700); }
    else if (t.dataset.remove != null) { state.cart.splice(+t.dataset.remove, 1); save('hs_cart', state.cart); renderCartCount(false); if (document.getElementById('drawer').classList.contains('open')) renderDrawer(); else route(); }
    else if (t.dataset.img) { var m = document.getElementById('main-img'); m.src = t.dataset.img; document.querySelectorAll('.thumbs button').forEach(function (b) { b.classList.toggle('on', b === t); }); }
    else if (t.dataset.rail) { var r = document.getElementById('rail'); r.scrollBy({ left: +t.dataset.rail * r.clientWidth * 0.8, behavior: REDUCED ? 'auto' : 'smooth' }); }
    else if (t.id === 'pdp-add') { var pid = parseInt(location.hash.split('/')[2], 10), v = document.getElementById('variant'); cartAdd(pid, document.getElementById('pq').value, v ? v.value : null, t); later(openDrawer, 700); }
    else if (t.id === 'reorder') { JSON.parse(t.dataset.items).forEach(function (x) { cartAdd(x[0], x[1]); }); toast('Commande rechargée dans le panier'); later(openDrawer, 300); }
    else if (t.id === 'logout') { state.session = null; save('hs_session', null); location.hash = '#/'; }
    else if (t.id === 'checkout') { document.getElementById('checkout-msg').textContent = 'Maquette : la commande n\'est pas transmise. Dans le site final, elle partira directement en préparation et en facturation.'; }
    else if (t.id === 'menu-toggle') { var n = document.getElementById('catnav'), open = n.classList.toggle('open'); t.setAttribute('aria-expanded', open); }
    else if (t.id === 'cart-btn') { openDrawer(); }
    else if (t.id === 'print-fiche') { window.print(); }
    else if (t.id === 'drawer-close' || t.id === 'drawer-veil') { closeDrawer(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'search-input' && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      var items = document.querySelectorAll('#suggest .sug-item');
      if (e.key === 'Enter' && sugIdx > -1 && items[sugIdx]) { e.preventDefault(); location.hash = items[sugIdx].getAttribute('href'); closeSuggest(); e.target.blur(); return; }
      if (e.key !== 'Enter' && items.length) {
        e.preventDefault(); sugIdx = (sugIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (it, i) { it.classList.toggle('on', i === sugIdx); });
        e.target.setAttribute('aria-activedescendant', 'sug-' + sugIdx);
      }
    }
  });
  document.addEventListener('focusout', function (e) { if (e.target.id === 'search-input') setTimeout(function () { if (!document.activeElement || !document.activeElement.closest('#suggest')) closeSuggest(); }, 150); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); closeSuggest(); var rb = document.getElementById('r-results'); if (rb) rb.hidden = true; } });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'search-input') { clearTimeout(sugTimer); var sv = e.target.value; sugTimer = setTimeout(function () { renderSuggest(sv); }, 110); }
    if (e.target.id === 'r-search') { clearTimeout(sirenTimer); var v = e.target.value; sirenTimer = setTimeout(function () { sirenSearch(v); }, 320); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'sort') { save('hs_sort', e.target.value); route(); }
    if (e.target.id === 'variant') { var o = e.target.selectedOptions[0], p = byId[parseInt(location.hash.split('/')[2], 10)]; document.getElementById('price-zone').innerHTML = priceBlock(p, parseFloat(o.dataset.price)); document.getElementById('ref-val').textContent = o.value; var bp = document.getElementById('buybar-price'); if (bp) bp.textContent = eur(parseFloat(o.dataset.price)) + ' HT'; }
    if (e.target.dataset.line != null) { var i = +e.target.dataset.line, q = parseInt(e.target.value, 10) || 0; if (q <= 0) state.cart.splice(i, 1); else state.cart[i].q = q; save('hs_cart', state.cart); route(); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target; e.preventDefault();
    if (f.id === 'search-form') { closeSuggest(); location.hash = '#/catalogue?q=' + encodeURIComponent(document.getElementById('search-input').value.trim()); }
    if (f.id === 'qo-form') {
      var ref = document.getElementById('qo-ref'), found = findByCode(ref.value), msg = document.getElementById('qo-msg');
      if (!found) { msg.textContent = 'Référence introuvable : vérifiez la saisie ou cherchez dans le catalogue.'; return; }
      cartAdd(found.p.id, document.getElementById('qo-q').value, found.v, f); msg.textContent = 'Ajouté : ' + found.p.nom + '.'; ref.value = ''; ref.focus();
    }
    if (f.id === 'cart-add-form') {
      var cf = findByCode(document.getElementById('cart-ref').value);
      if (!cf) { document.getElementById('cart-add-msg').textContent = 'Référence introuvable.'; return; }
      cartAdd(cf.p.id, document.getElementById('cart-q').value, cf.v); route(); toast('Ajouté : ' + cf.p.nom);
    }
    if (f.id === 'qo-paste') {
      var ok = 0, ko = [];
      document.getElementById('qo-list').value.split(/\n+/).forEach(function (l) { var m = l.split(/[;,\t]/); if (!m[0].trim()) return; var fd = findByCode(m[0]); if (fd) { cartAdd(fd.p.id, m[1] || 1, fd.v); ok++; } else ko.push(m[0].trim()); });
      document.getElementById('qo-paste-msg').textContent = ok + ' ligne(s) ajoutée(s)' + (ko.length ? ' · introuvable(s) : ' + ko.join(', ') : '') + '.';
      if (ok && !document.getElementById('qo-summary')) later(openDrawer, 400);
    }
    if (f.id === 'login-form') { state.session = { email: document.getElementById('l-email').value || null, groupe: 'pharmacie' }; save('hs_session', state.session); location.hash = '#/compte'; toast('Session de démonstration ouverte'); }
    if (f.id === 'register-form') {
      var sir = document.getElementById('r-siret');
      sir.setCustomValidity(sir.value && !luhn(sir.value) ? 'SIRET invalide' : '');
      var bad = Array.prototype.filter.call(f.querySelectorAll('[required]'), function (x) { return !x.checkValidity(); }), box = document.getElementById('register-msg');
      if (bad.length) { box.innerHTML = '<div class="notice warn">Complétez les champs : ' + bad.map(function (x) { return esc(f.querySelector('label[for="' + x.id + '"]').textContent); }).join(', ') + '.</div>'; bad[0].focus(); return; }
      box.innerHTML = '<div class="notice">Demande enregistrée (maquette, rien n\'est envoyé). Dans le site final, vous recevrez une réponse sous 24 h ouvrées.</div>';
    }
  });
  var header = document.getElementById('header');
  window.addEventListener('scroll', function () { header.classList.toggle('scrolled', window.scrollY > 10); }, { passive: true });
  window.addEventListener('hashchange', route);

  (window.HS_CATALOGUE ? Promise.resolve(window.HS_CATALOGUE) : fetch('assets/data/catalogue.json?v=' + Date.now()).then(function (r) { return r.json(); })).then(function (d) {
    data = d; d.produits.forEach(function (p) { byId[p.id] = p; });
    TOP_2026.forEach(function (k) { var p = find(k); if (p) topIds[p.id] = 1; });
    state.cart = state.cart.filter(function (l) { return byId[l.id]; });
    route();
  }).catch(function () {
    app.innerHTML = '<section class="section"><div class="container"><div class="empty"><h1 style="font-size:30px">Le catalogue ne s\'est pas chargé</h1><p class="muted">Ouvrez le site depuis un serveur local.</p></div></div></section>';
  });
})();
