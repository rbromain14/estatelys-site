# Estatelys Budapest — site web

Site statique en 4 langues (FR à la racine, `/en/`, `/de/`, `/hu/`), hébergé sur **GitHub Pages**, domaine acheté chez **Hostinger**.

- Aucune dépendance : `node build.mjs` génère le site dans `dist/` (Node 18+).
- Tout le contenu (textes, prix, loyers, photos, contact, domaine) est dans **`src/data.mjs`**.
- Les photos sont dans `src/img/` (`nom.jpg` 1600 px + `nom-s.jpg` 800 px).
- Chaque `git push` sur `main` reconstruit et publie le site (`.github/workflows/pages.yml`).

## Pages générées (×4 langues)
Accueil · Biens en vente (+ carte) · une page par bien (Stollár Béla 22, Paulay Ede 18, Rákóczi 40, Klauzál 23) · À propos · Contact.
Plus : `sitemap.xml`, `robots.txt`, `404.html`, `CNAME`, balises hreflang, Open Graph et données structurées schema.org.

## Mise en ligne — 1. GitHub
1. Créer un dépôt vide sur github.com, par ex. `estatelys-site` (public, car GitHub Pages gratuit exige un dépôt public ; en privé il faut GitHub Pro).
2. Dans ce dossier :
   ```sh
   git init -b main
   git add .
   git commit -m "Estatelys Budapest website"
   git remote add origin https://github.com/<votre-compte>/estatelys-site.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Onglet **Actions** : attendre la coche verte « Deploy to GitHub Pages » (≈ 1 min).

## Mise en ligne — 2. Domaine Hostinger
Le domaine est défini dans `src/data.mjs` → `SITE.domain` (actuellement `www.estatelys.com`). Changez-le si votre domaine est différent, puis poussez.

Dans **hPanel Hostinger → Domaines → votre domaine → DNS / Nameservers → Gérer les enregistrements DNS** :

| Type  | Nom   | Valeur                   |
|-------|-------|--------------------------|
| A     | @     | 185.199.108.153          |
| A     | @     | 185.199.109.153          |
| A     | @     | 185.199.110.153          |
| A     | @     | 185.199.111.153          |
| CNAME | www   | `<votre-compte>.github.io` |

- Supprimer d'abord les anciens enregistrements **A @** et **CNAME www** créés par Hostinger (parking). Ne pas toucher aux enregistrements **MX / TXT** si vous avez des e-mails sur le domaine.
- Puis sur GitHub : **Settings → Pages → Custom domain** = `www.estatelys.com` → Save → attendre la vérification DNS → cocher **Enforce HTTPS**.
- La propagation DNS prend de quelques minutes à 24 h.

## Modifier le site
- Prix / loyer / textes : `src/data.mjs`, objet `projects`.
- Ajouter un bien : copier un bloc dans `projects`, déposer ses photos dans `src/img/` (`slug-01.jpg`, `slug-01-s.jpg`…).
- Aperçu local : `node build.mjs && npx serve dist` (ou `python3 -m http.server -d dist`).

## Points à valider
- **E-mail / téléphone** : `info@estatelys.com` et `+36 30 957 6834` repris de l'ancienne brochure Paulay Ede. À confirmer.
- **« 60+ appartements rénovés »** : chiffre repris du projet Lovable. À confirmer.
- **Paulay Ede 18** : pas de photos disponibles → carte « Photos et brochure sur demande ». Déposer les photos (`paulay-01.jpg`…) et remplir `cover` / `images`.
- **Stollár Béla 22** : les photos intérieures sont des rendus 3D (mention affichée sous la galerie).
- **Formulaire de contact** : ouvre la messagerie du visiteur (mailto). Pour recevoir les messages sans mailto, brancher Formspree ou Web3Forms (gratuit) sur le `<form id="cform">`.
- **Mentions légales** : non incluses (raison sociale, numéro d'immatriculation, adresse du siège à fournir).
- Photos de la ville : Unsplash (licence libre, crédit affiché).
