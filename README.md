# iVoc · Ripasso per la difesa del dottorato

App di quiz + materiali di studio per preparare la **difesa** del dottorato in linguistica italiana
(analisi quantitativa della poesia italiana 1960-65 tramite la concordanza digitale **iVoc**).

Tutto **statico e offline**: nessuna build, nessuna dipendenza. Pronto per **GitHub Pages**.

## Cosa contiene
- **Quiz** con centinaia di domande verificate, ancorate alle fonti (tesi, statistiche, concordanza iVoc, contesto).
  Ogni domanda mostra spiegazione + fonte. La difesa testa la *giustificazione*: gli angoli (metodologia, limiti,
  obiezione, collegamento-dati, contributo, definizione, contesto) hanno peso maggiore del semplice ricordo.
- **Modalità**: filtri per argomento/tipo/angolo, ricerca testuale, «solo da ripassare», «solo non viste»,
  ordine casuale, ripetizione spaziata (Leitner), **modalità orale** (TTS) e **simulazione difesa** a tempo.
- **Materiali**: brief di difesa, domande-giuria con risposte modello, punti deboli (red-team), cheat-sheet
  dei numeri, glossario, timeline del contesto.
- **Dashboard** di padronanza per argomento/angolo, vista «ripasso completo» stampabile, export/import del progresso.

## Uso locale
Apri una shell nella cartella `app/` e servi i file (serve un server perché il browser carica `data.js`):
```
cd app
python -m http.server 5510
```
Poi apri http://localhost:5510 . (Aprire `index.html` con doppio clic funziona anch'esso, dato che i dati
sono in `data.js` e non via fetch.)

## Deploy su GitHub Pages
1. Crea un repo su GitHub e fai push di questa cartella.
2. **Rinomina `app/` in `docs/`** (oppure copia il contenuto di `app/` in `docs/`).
3. Su GitHub: *Settings → Pages → Build and deployment → Source: Deploy from a branch*,
   branch `main`, cartella **`/docs`**. Salva.
4. Dopo qualche minuto il sito è online all'URL indicato da GitHub.

> In alternativa, copia il contenuto di `app/` nella radice del repo e imposta Pages su `/ (root)`.

## Struttura
```
app/                 # l'applicazione (index.html, style.css, app.js, data.js)
data/
  all.json           # tutte le domande verificate (sorgente di data.js)
  schema.json        # schema di una domanda
  questions/         # 1 file per agente generatore (FASE 1)
  verified/          # 1 file per agente verificatore (FASE 2)
  source/            # estrazioni: tesi in markdown, immagini, profili excel, sintesi
materiali/           # brief, domande-giuria, punti deboli, cheat-sheet, glossario, timeline
```

## Rigenerare i dati dell'app
Dopo aver aggiornato `data/all.json` o i `materiali/`, ricostruisci `app/data.js`:
```
python data/source/_package.py
```

## Note di accuratezza
Le domande sono passate da una **doppia verifica avversariale** contro le fonti. Alcune **discrepanze interne
alla tesi** sono segnalate e da conoscere per la difesa (vedi `materiali/punti_deboli.md` e
`data/source/_analisi.md`), in particolare la data dell'articolo di Montale «Poesia inclusiva» e il conteggio
delle occorrenze di «vita» (927 vs 972).
