# Pour Claude : dépôt PUBLIC, code seulement

Coulisses est l'app de maintenance du système d'assistants et de l'app carte de vie : une colonne « État » en lecture
seule, et « Piloter » (18/10) : des boutons sans IA vers le serveur (état, relancer, pause, reprendre, journal, alertes).
L'adresse du serveur et la clé de pilotage se saisissent sur l'appareil ; elles ne sont jamais écrites dans le code.
Aucune commande d'activation : un flux jamais lancé s'active dans l'éditeur du serveur.
Ce dépôt est public (GitHub Pages) : il ne contient que le code (`index.html`, `app.js`, `piloter.js`, `style.css`,
`sw.js`, manifeste, icônes unies).

Interdit ici, même temporairement : données, noms de workflows ou d'assistants, noms de personnes, comptes,
adresses, captures d'écran, clés ou jetons. L'état affiché vient de `etat.json` dans un dépôt privé, lu avec un
jeton en lecture seule que la personne colle elle-même ; il n'est jamais écrit dans le code.
Tout texte reçu est affiché avec textContent (jamais innerHTML). La source de travail est gardée dans un
dépôt privé ; elle est recopiée ici telle quelle.
