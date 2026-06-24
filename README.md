# Subnetting Lernplattform – Deployment

Eine self-hosted Lernplattform für IPv4-Subnetting (FI-Azubi). Schüler lernen, machen
einen Test und ihre Ergebnisse landen serverseitig. Über das **Admin-Dashboard** lassen
sich jetzt nicht nur Ergebnisse auswerten, sondern auch die **Fragen vollständig verwalten**.

---

## Was ist neu (v2)?

| Feature | Beschreibung |
|---------|--------------|
| **Frage-Verwaltung** | Vollständiges Zwei-Spalten-Dashboard: Liste links, Inline-Editor rechts |
| **Server-Fragen** | Fragen liegen serverseitig in `questions.json` (persistent), nicht mehr nur im Browser |
| **Kategorien & Schwierigkeit** | Jede Frage hat Kategorie + 1–5 Sterne; danach filter- und sortierbar |
| **Filter / Suche / Sortierung** | Nach Typ, Kategorie, Schwierigkeit filtern, Volltextsuche, Spalten-Sortierung, Pagination |
| **Bulk-Operationen** | Mehrere Fragen auswählen → gemeinsam löschen, Kategorie oder Schwierigkeit setzen |
| **Import / Export** | Fragen als JSON **oder CSV** importieren (Modi: überspringen / überschreiben / zusammenführen), Export als JSON |
| **Fehlerquote pro Frage** | Server rechnet aus den Testergebnissen aus, welche Fragen am häufigsten falsch sind |
| **Sichere Auth** | Admin-Passwort steht **nur noch** als Environment-Variable im Backend – nicht mehr im HTML. Login liefert ein signiertes Token (1 h gültig) |
| **caseSensitive Freitext** | Freitextfragen können optional Groß-/Kleinschreibung erzwingen |
| **UX** | Inline-Validierung, Toast-Benachrichtigungen, Undo beim Löschen, Lade-Indikatoren, responsiv |

Der Schüler-Teil (Login, Lernseite, Test) ist unverändert nutzbar – inkl. Offline-Fallback,
falls die API mal nicht erreichbar ist.

---

## Architektur

```
Browser
  │
  ├── / (HTML/CSS/JS) ──────→ nginx:80 ──→ /usr/share/nginx/html/
  │                                         ├── index.html
  │                                         ├── admin-editor.css
  │                                         └── admin-editor.js
  │
  └── /api/* ───────────────→ nginx:80 ──→ Node.js API:3001 ──→ /app/data/
                                                                  ├── results.json
                                                                  └── questions.json
```

Beim ersten Start seedet die API automatisch **11 Standardfragen** in `questions.json`,
falls die Datei noch nicht existiert.

---

## Voraussetzungen

- Docker
- Docker Compose

## Schnellstart

```bash
# 1. In das Verzeichnis wechseln
cd subnetting-lernplattform

# 2. Container bauen und starten
docker compose up -d --build

# 3. Im Browser öffnen
# http://localhost:8080       (lokal)
# http://dein-server-ip:8080  (Server)
```

---

## Admin-Zugang

Login läuft nur noch über **Passwort** (kein Benutzername mehr).

| Feld     | Standardwert |
|----------|--------------|
| Passwort | `admin123`   |

**Passwort ändern** – ausschließlich in `docker-compose.yml`:

```yaml
environment:
  - ADMIN_PASS=dein-neues-passwort
  - SESSION_SECRET=langer-zufaelliger-wert   # signiert die Login-Tokens
```

Danach: `docker compose up -d --build`

> Das Passwort steht **nicht mehr im HTML**. Du musst also nichts mehr in `index.html` ändern.
> `SESSION_SECRET` ist optional, aber empfohlen – ohne eigenen Wert wird ein Default aus dem
> Passwort abgeleitet.

---

## Fragen verwalten

Im Admin-Bereich oben auf **„Fragen verwalten"** umschalten.

- **Neue Frage:** Button oben rechts oder eine Zeile in der Liste anklicken → rechts im Editor bearbeiten.
- **Fragetypen:** Multiple Choice, Freitext (mehrere Antworten mit `|` trennen), Reihenfolge (Drag & Drop).
- **Auswählen:** Checkboxen links → Bulk-Leiste erscheint (löschen, Kategorie/Schwierigkeit setzen).
- **Kategorien:** Button „Kategorien" – anlegen, umbenennen (verschiebt alle betroffenen Fragen), leere löschen.

### Import-Formate

**JSON** – entweder ein Array oder `{ "questions": [...] }`:

```json
[
  {
    "type": "mc",
    "text": "Was ist die Broadcast-Adresse von:",
    "ip": "192.168.5.64/26",
    "category": "Broadcast",
    "difficulty": 3,
    "correct": "192.168.5.127",
    "wrong": ["192.168.5.128", "192.168.5.63"],
    "explain": "Blockgröße=64 → Broadcast .127"
  }
]
```

**CSV** – Kopfzeile mit diesen Spalten (Reihenfolge egal, leere Felder erlaubt):

```
text,type,category,difficulty,ip,correct,wrong1,wrong2,wrong3,wrong4,explain,items
```

- `wrong1`–`wrong4` nur bei `type=mc`
- `items` nur bei `type=order`, Schritte mit `|` getrennt
- `correct` bei `mc` und `freetext`

**Import-Modi:**

| Modus | Verhalten bei gleichem Fragetext |
|-------|----------------------------------|
| `skip` (überspringen) | vorhandene Frage bleibt, Import wird ignoriert |
| `overwrite` (überschreiben) | vorhandene Frage wird ersetzt |
| `merge` (zusammenführen) | vorhandene aktualisiert, neue hinzugefügt |

---

## API-Endpunkte

Auth: entweder `Authorization: Bearer <token>` (aus `POST /api/admin/login`)
**oder** der Header `x-admin-pass: <passwort>` (für Skripte/curl).

### Auth
| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| POST | `/api/admin/login` | – | `{ "password": "..." }` → `{ "token": "..." }` |

### Ergebnisse
| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| POST | `/api/results` | – | Testergebnis speichern (vom Schüler-Client) |
| GET  | `/api/results` | ✓ | Alle Ergebnisse |
| DELETE | `/api/results` | ✓ | Alle Ergebnisse löschen |
| GET  | `/api/results/export` | ✓ | Ergebnisse als JSON-Download |

### Fragen
| Methode | Pfad | Auth | Zweck |
|---------|------|------|-------|
| GET  | `/api/questions/public` | – | Fragen für den Test (ohne Statistik/Autor) |
| GET  | `/api/questions` | ✓ | Alle Fragen inkl. berechneter Fehlerquote |
| GET  | `/api/questions/stats/:id` | ✓ | Statistik einer einzelnen Frage |
| POST | `/api/questions` | ✓ | Neue Frage anlegen |
| PUT  | `/api/questions/:id` | ✓ | Frage bearbeiten |
| DELETE | `/api/questions/:id` | ✓ | Frage löschen |
| POST | `/api/questions/bulk-delete` | ✓ | `{ "ids": [...] }` mehrere löschen |
| POST | `/api/questions/bulk-update` | ✓ | `{ "ids": [...], "patch": {...} }` mehrere ändern |
| GET  | `/api/questions/export` | ✓ | Fragen als JSON-Download |
| POST | `/api/questions/import` | ✓ | `{ "mode": "...", "questions": [...] }` importieren |

**Beispiele:**

```bash
# Login → Token holen
curl -X POST http://localhost:8080/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'

# Fragen abrufen (mit x-admin-pass)
curl -H "x-admin-pass: admin123" http://localhost:8080/api/questions

# Fragen exportieren
curl -H "x-admin-pass: admin123" \
  http://localhost:8080/api/questions/export -o fragen.json
```

---

## Wo liegen die Daten?

Beide JSON-Dateien liegen im Docker-Volume `results-data` und überleben Container-Neustarts.

```bash
# Direkt lesen
docker exec subnetting-api cat /app/data/questions.json
docker exec subnetting-api cat /app/data/results.json
```

Im Repo liegt unter `data/` eine **Vorlage** (`questions.json` mit den 11 Standardfragen) –
nützlich, wenn du die API ohne Docker startest. In Docker wird sie nicht benötigt, da beim
ersten Start automatisch geseedet wird.

---

## Nützliche Befehle

```bash
docker compose ps              # Status
docker compose logs -f         # Logs
docker compose down            # Stoppen
docker compose down -v         # Stoppen + ALLE Daten löschen (Vorsicht!)
docker compose up -d --build   # Neubauen nach Änderungen
```

## Port ändern

In `docker-compose.yml`:

```yaml
ports:
  - "9090:80"   # z. B. Port 9090 statt 8080
```

---

## Dateien

```
subnetting-lernplattform/
├── Dockerfile              ← nginx (Frontend)
├── Dockerfile.api          ← Node.js (Backend/API)
├── docker-compose.yml      ← beide Services + Volume
├── README.md
├── data/                   ← Vorlage / für Betrieb ohne Docker
│   ├── questions.json      ← 11 Standardfragen (Seed-Vorlage)
│   └── results.json        ← leeres Array
├── html/
│   ├── index.html          ← Schüler-App (Login, Lernseite, Test) + Admin-Shell
│   ├── admin-editor.css    ← Styles für das Frage-Dashboard
│   └── admin-editor.js     ← gesamte Admin-Logik (Ergebnisse + Fragen)
├── nginx/
│   └── default.conf        ← nginx mit /api Proxy
└── server/
    ├── package.json
    └── server.js           ← REST-API (Ergebnisse + Fragen, Auth, Seeding)
```
