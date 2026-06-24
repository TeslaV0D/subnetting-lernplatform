# MAINTAINER.md – Subnetting Lernplattform

Ausführliche technische Dokumentation für Maintainer und Entwickler der
**Subnetting Lernplattform** – einer self-hosted Lernumgebung für IPv4-Subnetting
(Zielgruppe: FI-Azubis).

> Diese Datei richtet sich an Personen, die das Projekt betreiben, weiterentwickeln
> oder debuggen. Eine kurze Anleitung für **Endnutzer** findet sich in
> [`USER_GUIDE.md`](./USER_GUIDE.md).

---

## Inhaltsverzeichnis

1. [Architektur-Überblick](#1-architektur-überblick)
2. [Setup & Entwicklungsumgebung](#2-setup--entwicklungsumgebung)
3. [Codebase-Struktur](#3-codebase-struktur)
4. [Kernfunktionen & Module](#4-kernfunktionen--module)
5. [Deployment & DevOps](#5-deployment--devops)
6. [Testing](#6-testing)
7. [Häufige Entwicklungsaufgaben](#7-häufige-entwicklungsaufgaben)
8. [API-Referenz](#8-api-referenz)
9. [Troubleshooting](#9-troubleshooting)
10. [Contributing-Guidelines](#10-contributing-guidelines)

---

## 1. Architektur-Überblick

### 1.1 Systemdesign

Die Plattform besteht aus **zwei Containern**: einem nginx-Frontend, das statische
Dateien ausliefert und `/api/*` an ein Node.js/Express-Backend weiterleitet. Persistente
Daten liegen als JSON-Dateien in einem Docker-Volume.

```
                          ┌────────────────────────────────────────────┐
                          │                Docker Host                  │
                          │                                             │
   Browser  ─── :8080 ───▶│  ┌───────────────────────┐                  │
 (Schüler /              │  │  subnetting-web (nginx) │  :80            │
  Admin)                 │  │  /usr/share/nginx/html  │                  │
                          │  │   ├── index.html        │                  │
                          │  │   ├── admin-editor.js   │                  │
                          │  │   ├── admin-editor.css  │                  │
                          │  │   └── responsive.css    │                  │
                          │  └───────────┬───────────┘                  │
                          │              │ proxy /api/ → api:3001        │
                          │              ▼                               │
                          │  ┌───────────────────────┐                  │
                          │  │  api (Node.js/Express) │  :3001          │
                          │  │  server.js             │                  │
                          │  └───────────┬───────────┘                  │
                          │              │ liest/schreibt               │
                          │              ▼                               │
                          │  ┌───────────────────────┐                  │
                          │  │  Volume: results-data  │  /app/data       │
                          │  │   ├── questions.json   │                  │
                          │  │   └── results.json     │                  │
                          │  └───────────────────────┘                  │
                          └────────────────────────────────────────────┘
```

### 1.2 Komponenten & Beziehungen

| Komponente | Technologie | Aufgabe |
|------------|-------------|---------|
| **Frontend** | nginx (statisch) | Liefert HTML/CSS/JS aus, proxyt `/api/*` ans Backend, setzt Security-Header & Gzip |
| **Backend** | Node.js 20 + Express 4 | REST-API für Fragen & Ergebnisse, Auth, Validierung, Seeding, Statistik |
| **Persistenz** | JSON-Dateien im Volume | `questions.json` (Fragen), `results.json` (Testergebnisse) |

Es gibt **keine** klassische Datenbank – der gesamte Zustand wird in zwei JSON-Dateien
gehalten. Das hält das Deployment minimal (zwei Container, kein DB-Service).

### 1.3 Datenmodelle

**Frage (`questions.json`)** – normalisiertes Schema (siehe `normalizeQuestion()`):

```jsonc
{
  "id": "q-<uuid>",          // serverseitig vergeben
  "type": "mc",              // "mc" | "freetext" | "order"
  "text": "Was ist ...",     // min. 10 Zeichen
  "category": "CIDR",        // Default "Allgemein"
  "difficulty": 3,           // 1–5 (Sterne), Default 2
  "ip": "192.168.5.64/26",   // optional, Kontext-IP
  "correct": "/24",          // mc + freetext
  "wrong": ["/25", "/16"],   // nur mc
  "orderItems": ["...","..."],// nur order (≥ 2 Elemente)
  "caseSensitive": false,    // nur freetext
  "explain": "Begründung",   // optional
  "author": "admin",
  "createdAt": 1690000000000,
  "updatedAt": 1690000000000
}
```

**Ergebnis (`results.json`)** – siehe `POST /api/results`:

```jsonc
{
  "id": 1690000000000,       // Date.now()
  "name": "Max Mustermann",  // max. 80 Zeichen
  "time": "24.06.2026, 12:00:00",  // lokalisiert (Europe/Berlin)
  "score": 80,               // Prozent
  "correct": 8,
  "total": 10,
  "duration": 240,           // Sekunden, optional
  "passed": true,            // score >= 60
  "wrong": [{ "q": "...", "...": "..." }],  // falsch beantwortete Fragen
  "answers": [ ... ]         // alle Antworten
}
```

### 1.4 API-Endpunkte (Kurzübersicht)

Vollständige Referenz in [Abschnitt 8](#8-api-referenz). Alle Endpunkte hängen unter
`/api`. Geschützte Endpunkte verlangen einen Admin-Token (Bearer) oder den
`x-admin-pass`-Header.

---

## 2. Setup & Entwicklungsumgebung

### 2.1 Voraussetzungen

| Für | Benötigt |
|-----|----------|
| **Betrieb (empfohlen)** | Docker + Docker Compose |
| **Backend lokal ohne Docker** | Node.js ≥ 18 (getestet mit 20) + npm |
| **Frontend lokal ohne Docker** | beliebiger statischer Webserver + laufendes Backend |

### 2.2 Installation & Start (Docker, empfohlen)

```bash
# 1. Repository klonen
git clone https://github.com/TeslaV0D/subnetting-lernplatform.git
cd subnetting-lernplatform

# 2. Container bauen und starten
docker compose up -d --build

# 3. Im Browser öffnen
#    http://localhost:8080
```

Beim **ersten Start** seedet die API automatisch 11 Standardfragen in
`questions.json`, falls die Datei noch nicht existiert (siehe `seedQuestionsIfEmpty()`).

### 2.3 Umgebungsvariablen

Konfiguration erfolgt über Environment-Variablen des `api`-Service in
`docker-compose.yml`:

| Variable | Default | Zweck |
|----------|---------|-------|
| `PORT` | `3001` | Port, auf dem die API lauscht |
| `ADMIN_PASS` | `admin123` | Admin-Passwort (Login & `x-admin-pass`) |
| `SESSION_SECRET` | `<ADMIN_PASS>:sn-secret` | HMAC-Schlüssel zum Signieren der Login-Tokens |

> **Sicherheit:** In Produktion **immer** `ADMIN_PASS` und `SESSION_SECRET` auf eigene,
> lange Zufallswerte setzen. Das Passwort steht bewusst nicht mehr im HTML.

### 2.4 Lokale Entwicklung ohne Docker

**Backend:**

```bash
cd server
npm install
# Datenverzeichnis liegt relativ zu server.js unter server/data
ADMIN_PASS=admin123 PORT=3001 npm start
```

Hinweis: `server.js` erwartet das Datenverzeichnis unter `path.join(__dirname, 'data')`,
also `server/data/`. Im Docker-Build wird stattdessen `/app/data` (Volume) genutzt. Für
lokalen Betrieb kann die Vorlage aus `data/questions.json` nach `server/data/` kopiert
werden – andernfalls seedet der Server beim Start automatisch.

**Frontend:** `html/` mit einem beliebigen statischen Server ausliefern (z. B.
`python3 -m http.server`) und sicherstellen, dass `/api/*` auf das Backend zeigt
(in Docker übernimmt das nginx; lokal ggf. einen Proxy einrichten oder `API_BASE` in
`index.html` anpassen).

### 2.5 Daten initialisieren / seeden

- **Automatisch:** Ist `questions.json` leer oder fehlt, schreibt der Server die 11
  `SEED_QUESTIONS` (in `server.js`).
- **Manuell (Vorlage):** Das Repo enthält unter `data/questions.json` die 11 Standardfragen
  als Vorlage und `data/results.json` als leeres Array.

---

## 3. Codebase-Struktur

```
subnetting-lernplatform/
├── Dockerfile              # nginx-Image (Frontend)
├── Dockerfile.api          # Node.js-Image (Backend/API)
├── docker-compose.yml      # beide Services + benanntes Volume
├── README.md               # Deployment-Doku (DE)
├── MAINTAINER.md           # diese Datei
├── USER_GUIDE.md           # Endnutzer-Kurzanleitung
├── anleitung-kurz.md       # ältere Kurzanleitung (DE)
├── anleitung-vollstaendig.md  # ältere Langanleitung (DE)
├── mobile-testing.md       # Notizen zu mobilem/Responsive-Testing
├── data/                   # Vorlage / Betrieb ohne Docker
│   ├── questions.json      # 11 Standardfragen (Seed-Vorlage)
│   └── results.json        # leeres Array
├── html/                   # Frontend-Assets (von nginx ausgeliefert)
│   ├── index.html          # Schüler-App + Admin-Shell + Großteil des JS
│   ├── admin-editor.js     # gesamte Admin-Logik (Ergebnisse + Fragen)
│   ├── admin-editor.css    # Styles für das Frage-Dashboard
│   └── responsive.css      # responsive/mobile Styles
├── nginx/
│   └── default.conf        # nginx-Konfiguration inkl. /api-Proxy
└── server/
    ├── package.json        # Express + cors
    ├── package-lock.json
    └── server.js           # gesamte REST-API
```

### 3.1 Modul-Verantwortlichkeiten

| Datei | Verantwortung |
|-------|---------------|
| `server/server.js` | Komplettes Backend: Auth, Routen, Validierung, Normalisierung, Seeding, Statistik, Datei-I/O. Eine einzige Datei, ~390 Zeilen, ohne Sub-Module. |
| `html/index.html` | Schüler-App (Login, Lernkapitel, Test, IP-Trainer) **und** Admin-Login-Shell. Enthält den Großteil des Client-JS inline (Test-Logik, IP-Rechner, Default-Fragen als Offline-Fallback). |
| `html/admin-editor.js` | Admin-Dashboard-Logik: Login/Token, Ergebnis-Ansicht, Frage-CRUD, Filter/Suche/Sortierung/Pagination, Bulk-Aktionen, Import/Export, Kategorien. |
| `html/admin-editor.css` | Styles speziell für das Zwei-Spalten-Frage-Dashboard. |
| `html/responsive.css` | Mobile-/Breakpoint-Anpassungen. |
| `nginx/default.conf` | Statische Auslieferung, `/api/`-Proxy, Security-Header, Gzip, Caching. |

### 3.2 Namens- & Organisationskonventionen

- **Sprache:** UI-Texte, Kommentare und Variablennamen sind überwiegend **deutsch**.
- **State im Frontend:** globale `let`-Variablen (z. B. `questions`, `adminToken`,
  `filterState`, `sortState`, `pageState`). Kein Framework, reines Vanilla-JS.
- **Storage-Keys:** `sn_`-Präfix (`sn_questions`, `sn_errors`, `sn_admin_token`).
  Schüler-Cache in `localStorage`, Admin-Token in `sessionStorage`.
- **Backend-Helfer:** kleine, klar benannte Funktionen (`readJson`/`writeJson`,
  `readQuestions`/`writeQuestions`, `validateQuestion`, `normalizeQuestion`,
  `computeStats`, `makeToken`/`verifyToken`).

---

## 4. Kernfunktionen & Module

### 4.1 Schüler-Workflow (Frontend)

**Zweck:** Lernen + Selbsttest. **Dateien:** `html/index.html`.

- **Login:** nur Name (≥ 2 Zeichen), keine Server-Auth – `doLogin()`. Der Name wird
  später dem Testergebnis beigelegt.
- **Lernseite (`#page-learn`):** 5 aufklappbare Kapitel (IP-Grundlagen, Subnetzmaske/CIDR,
  Netzadresse/Broadcast/Hosts, Subnetting Schritt-für-Schritt, private Bereiche/Referenz).
  Fortschrittsbalken via `updateProgress()` / `chaptersRead`.
- **Test (`#page-test`):** lädt Fragen über `loadQuestionsForTest()`
  (Server → localStorage-Cache → eingebaute `DEFAULT_QUESTIONS`). Rendert je nach Typ
  (`renderQuestion()`): Multiple Choice (`answerMC`), Freitext (`answerFT`), Reihenfolge
  per Drag & Drop (`dragStart`/`drop`/`answerOrder`). Ergebnis via `showResult()`,
  das `POST /api/results` sendet. Bestanden ab Score ≥ 60.
- **IP-Trainer (`#page-ip-trainer`):** interaktiver Rechner/Challenge-Modus mit
  Funktionen wie `cidrToSubnet`, `calcNetAddress`, `calcBroadcast`, `calcUsableHosts`,
  `calcIPLive`, plus Session-Statistik (`recordIPStat`, `renderIPStats`) in `localStorage`.

**Offline-Fallback:** Ist die API nicht erreichbar, nutzt der Test gecachte Fragen
(`sn_questions`) oder die eingebauten `DEFAULT_QUESTIONS`. Ergebnisse können dann nicht
gespeichert werden.

### 4.2 Admin-Dashboard (Frontend)

**Zweck:** Ergebnisse auswerten + Fragen verwalten. **Dateien:** `html/admin-editor.js`,
`html/admin-editor.css`, Admin-Shell in `index.html` (`#page-admin`).

- **Auth:** `adminLogin()` ruft `POST /api/admin/login`, speichert den Bearer-Token in
  `sessionStorage` (`sn_admin_token`). `authHeaders()` hängt ihn an jeden Request.
- **Ansichten:** `adminView` schaltet zwischen `results` und `questions`.
- **Ergebnisse:** Liste aller Tests, abgeleitete Fehlerquoten pro Frage, JSON-Export,
  Löschen.
- **Fragen:** Zwei-Spalten-Layout (Liste links, Inline-Editor rechts). Filter (`filterState`),
  Sortierung (`sortState`), Pagination (`pageState`), Volltextsuche. Bulk-Operationen
  (`selectedIds`): löschen, Kategorie/Schwierigkeit setzen. Undo beim Löschen
  (`lastDeleted`). Import (JSON/CSV) & Export (JSON). Kategorienverwaltung.

### 4.3 Backend-Kernlogik (`server.js`)

- **Auth (`makeToken`/`verifyToken`/`requireAdmin`):** Token = `base64url(admin.<exp>.<hmac>)`,
  signiert per HMAC-SHA256 mit `SESSION_SECRET`, 1 h gültig. Vergleich via
  `crypto.timingSafeEqual` (Schutz vor Timing-Angriffen). Abwärtskompatibel: alternativ
  `x-admin-pass`-Header.
- **Validierung (`validateQuestion`):** prüft Typ, Mindestlänge des Texts (10 Zeichen),
  typ-spezifische Pflichtfelder (mc: `correct` + ≥1 `wrong`; freetext: `correct`;
  order: ≥2 `orderItems`), Difficulty 1–5.
- **Normalisierung (`normalizeQuestion`):** bringt jede Frage in das Speicherschema,
  vergibt `id`/`createdAt`/`updatedAt`, setzt Defaults (Kategorie „Allgemein", Difficulty 2).
- **Statistik (`computeStats`):** leitet aus `results.json` Fehlerquoten je Frage ab.
  Annahme: Im Test wird jede Frage genau einmal beantwortet → Versuche ≈ Anzahl Ergebnisse.
  Matching erfolgt über `text (+ ip)`.
- **Seeding (`seedQuestionsIfEmpty`):** schreibt `SEED_QUESTIONS`, falls leer.
- **Datei-I/O:** synchrones `fs` (`readJson`/`writeJson`). Bei Lesefehlern wird ein
  Fallback (leeres Array) zurückgegeben.

### 4.4 Fehlerbehandlung

- **Backend:** Jede Route validiert Eingaben und gibt aussagekräftige Statuscodes zurück
  (400 Validierung, 401 Auth, 404 nicht gefunden, 500 intern). Ein globaler Error-Handler
  loggt Server-Fehler. Ein `/api`-Catch-all liefert 404 für unbekannte Endpunkte.
- **Frontend:** API-Aufrufe sind in `try/catch` gekapselt; der Schülerteil hat einen
  Offline-Fallback, das Admin-Dashboard zeigt Toast-Benachrichtigungen.

---

## 5. Deployment & DevOps

### 5.1 Build-Prozess

Zwei Images, gebaut über Docker Compose:

- **`Dockerfile` (Frontend):** `nginx:alpine`, kopiert `html/` nach
  `/usr/share/nginx/html/` und `nginx/default.conf` nach `/etc/nginx/conf.d/`.
- **`Dockerfile.api` (Backend):** `node:20-alpine`, installiert nur Production-Deps
  (`npm install --production`), kopiert `server.js`, legt `/app/data` an.

```bash
docker compose up -d --build      # bauen & starten
docker compose ps                 # Status
docker compose logs -f            # Logs folgen
docker compose down               # stoppen
docker compose down -v            # stoppen + ALLE Daten löschen (Vorsicht!)
```

### 5.2 Port ändern

In `docker-compose.yml` beim `subnetting-web`-Service:

```yaml
ports:
  - "9090:80"   # extern 9090 statt 8080
```

### 5.3 Umgebungen (dev / staging / prod)

Das Projekt definiert keine separaten Umgebungsdateien. Unterschiede werden über
Environment-Variablen in `docker-compose.yml` gesetzt. Für mehrere Umgebungen empfiehlt
sich eine Override-Datei (`docker-compose.override.yml`) oder ein `.env`-File mit
`ADMIN_PASS`/`SESSION_SECRET`/Port.

### 5.4 Healthchecks

Beide Services definieren Healthchecks (Frontend: `wget http://localhost/`; API:
`wget http://localhost:3001/api/results` mit `x-admin-pass`). Status via `docker compose ps`.

### 5.5 Migrationen

Kein Schema-Migrations-Framework (keine DB). „Migration" beschränkt sich auf das
automatische Seeding und die Normalisierung beim Schreiben. Strukturänderungen am
Frageschema müssen in `normalizeQuestion()` und bei Bedarf mit einem einmaligen
Konvertierungsskript über `questions.json` erfolgen.

### 5.6 Backup & Recovery

Beide JSON-Dateien liegen im benannten Volume `results-data`:

```bash
# Lesen
docker exec subnetting-api cat /app/data/questions.json
docker exec subnetting-api cat /app/data/results.json

# Backup (auf den Host kopieren)
docker cp subnetting-api:/app/data/questions.json ./backup-questions.json
docker cp subnetting-api:/app/data/results.json ./backup-results.json
```

Alternativ regelmäßig den Admin-Export nutzen (`/api/questions/export`,
`/api/results/export`).

### 5.7 Monitoring & Logging

- **Request-Logging:** Jede Anfrage wird mit Zeitstempel, Methode und URL geloggt
  (Middleware in `server.js`). Sichtbar via `docker compose logs -f`.
- Keine externe Monitoring-Anbindung – bei Bedarf Container-Logs an ein zentrales
  Log-System weiterleiten.

---

## 6. Testing

> **Status:** Das Projekt enthält aktuell **keine automatisierte Test-Suite** und keine
> Test-Frameworks/Coverage-Vorgaben. Verifizierung erfolgt manuell.

### 6.1 Empfohlene manuelle Smoke-Tests

```bash
# Login → Token
curl -X POST http://localhost:8080/api/admin/login \
  -H "Content-Type: application/json" -d '{"password":"admin123"}'

# Öffentliche Fragen (kein Auth)
curl http://localhost:8080/api/questions/public

# Admin-Fragen inkl. Statistik
curl -H "x-admin-pass: admin123" http://localhost:8080/api/questions

# Ergebnis speichern (Schüler-Pfad)
curl -X POST http://localhost:8080/api/results \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","score":80,"correct":8,"total":10}'
```

### 6.2 Manuelle UI-Checks

- Schüler: Login → Kapitel lesen → Test → Ergebnis erscheint im Admin.
- Admin: Frage anlegen/bearbeiten/löschen, Filter/Sortierung, Bulk-Aktion, Import/Export.
- Responsive: `mobile-testing.md` enthält Notizen zum mobilen Verhalten.

### 6.3 Fixtures / Mock-Daten

- `data/questions.json` (11 Standardfragen) dient als Fixture/Seed-Vorlage.
- `SEED_QUESTIONS` in `server.js` ist die maßgebliche In-Code-Quelle der Defaults.

---

## 7. Häufige Entwicklungsaufgaben

### 7.1 Neue Fragen/Übungen hinzufügen

**Empfohlen (zur Laufzeit):** Admin-Dashboard → „Fragen verwalten" → neue Frage oder
Import (JSON/CSV).

**Als Default/Seed (im Code):** neue Objekte zu `SEED_QUESTIONS` in `server.js` hinzufügen
**und** ggf. zu `DEFAULT_QUESTIONS` in `index.html` (Offline-Fallback) sowie zur Vorlage
`data/questions.json`. Achtung: Seeding greift nur, wenn `questions.json` leer ist –
bestehende Installationen müssen die Frage über die API/den Import erhalten.

### 7.2 UI / Styling ändern

- Schüler-UI & Inline-JS: `html/index.html`.
- Admin-Dashboard-Styles: `html/admin-editor.css`.
- Responsive/Breakpoints: `html/responsive.css`.
- Nach Änderungen Container neu bauen: `docker compose up -d --build`.

### 7.3 Abhängigkeiten aktualisieren

```bash
cd server
npm outdated
npm update            # respektiert package.json-Ranges
# danach Image neu bauen
docker compose build api
```

Nur das Backend hat npm-Abhängigkeiten (`express`, `cors`). Das Frontend nutzt keine
Build-Tools/Bundler.

### 7.4 Neue API-Funktion hinzufügen

In `server.js`: Route definieren, `requireAdmin` voranstellen falls geschützt, Eingaben
mit `validateQuestion`/eigener Prüfung validieren, über `read*/write*`-Helfer persistieren.
**Reihenfolge beachten:** spezifischere Routen (z. B. `/api/questions/export`) **vor**
Parameter-Routen (`/api/questions/:id`) registrieren – sonst greift `:id`.

### 7.5 Häufige Debug-Schritte

```bash
docker compose logs -f api        # Backend-Logs (inkl. Request-Logger)
docker exec subnetting-api cat /app/data/questions.json   # Datenstand prüfen
```

---

## 8. API-Referenz

**Basis-URL:** `/api` (über nginx auf demselben Origin).
**Auth:** `Authorization: Bearer <token>` (aus `POST /api/admin/login`) **oder**
`x-admin-pass: <passwort>`. Token sind 1 h gültig.

### 8.1 Auth

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| POST | `/api/admin/login` | – | Body `{ "password": "..." }` → `{ "ok": true, "token": "...", "expiresIn": 3600 }` |

### 8.2 Ergebnisse

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| POST | `/api/results` | – | Testergebnis speichern (Schüler-Client) |
| GET | `/api/results` | ✓ | alle Ergebnisse |
| DELETE | `/api/results` | ✓ | alle Ergebnisse löschen |
| GET | `/api/results/export` | ✓ | Ergebnisse als JSON-Download |

### 8.3 Fragen

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/api/questions/public` | – | Fragen für den Test (ohne `stats`/`author`) |
| GET | `/api/questions` | ✓ | alle Fragen inkl. berechneter Fehlerquote |
| GET | `/api/questions/stats/:id` | ✓ | Statistik einer Frage |
| POST | `/api/questions` | ✓ | neue Frage anlegen |
| PUT | `/api/questions/:id` | ✓ | Frage bearbeiten |
| DELETE | `/api/questions/:id` | ✓ | Frage löschen |
| POST | `/api/questions/bulk-delete` | ✓ | `{ "ids": [...] }` mehrere löschen |
| POST | `/api/questions/bulk-update` | ✓ | `{ "ids": [...], "patch": { "category"?, "difficulty"? } }` |
| GET | `/api/questions/export` | ✓ | Fragen als JSON-Download |
| POST | `/api/questions/import` | ✓ | `{ "mode": "skip\|overwrite\|merge", "questions": [...] }` |

### 8.4 Request-/Response-Beispiele

**Login:**

```bash
curl -X POST http://localhost:8080/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'
# → { "ok": true, "token": "eyJ...", "expiresIn": 3600 }
```

**Frage anlegen:**

```bash
curl -X POST http://localhost:8080/api/questions \
  -H "x-admin-pass: admin123" -H "Content-Type: application/json" \
  -d '{
        "type":"mc",
        "text":"Was ist die Broadcast-Adresse von:",
        "ip":"192.168.5.64/26",
        "category":"Broadcast","difficulty":3,
        "correct":"192.168.5.127",
        "wrong":["192.168.5.128","192.168.5.63"],
        "explain":"Blockgröße=64 → Broadcast .127"
      }'
# → 201 Created, normalisierte Frage
```

**Import (Modi):**

| Modus | Verhalten bei gleichem Fragetext |
|-------|----------------------------------|
| `skip` | vorhandene Frage bleibt, Import wird ignoriert |
| `overwrite` | vorhandene Frage wird ersetzt |
| `merge` | vorhandene aktualisiert, neue hinzugefügt |

### 8.5 Fehlercodes

| Code | Bedeutung |
|------|-----------|
| 400 | Validierungsfehler (z. B. Fragetext < 10 Zeichen, ungültiger Typ) |
| 401 | nicht autorisiert (fehlender/abgelaufener Token, falsches Passwort) |
| 404 | Ressource/Endpoint nicht gefunden |
| 500 | interner Serverfehler (siehe Logs) |

---

## 9. Troubleshooting

| Symptom | Ursache / Lösung |
|---------|------------------|
| **Login schlägt fehl (Admin)** | Passwort prüfen (`ADMIN_PASS` in `docker-compose.yml`). Nach Änderung `docker compose up -d --build`. |
| **„Nicht autorisiert" trotz Login** | Token abgelaufen (1 h). Neu einloggen. Bei `x-admin-pass` exakte Übereinstimmung mit `ADMIN_PASS` nötig. |
| **Fragen erscheinen nicht im Test** | API erreichbar? `curl /api/questions/public`. Browser nutzt sonst Offline-Cache/Defaults. |
| **Ergebnisse werden nicht gespeichert** | API offline → `POST /api/results` schlägt fehl. Logs prüfen, Container-Status checken. |
| **Daten weg nach Neustart** | Wurde `docker compose down -v` ausgeführt? `-v` löscht das Volume. Ohne `-v` bleiben Daten erhalten. |
| **Import bringt Duplikate/keine Änderung** | Falscher Modus. `overwrite`/`merge` ersetzt/aktualisiert, `skip` ignoriert vorhandene Texte. |
| **Neue Default-Frage erscheint nicht** | Seeding greift nur bei leerer `questions.json`. Bestehende Installation: über API/Import einspielen. |
| **404 bei `/api/questions/export`** | Route-Reihenfolge: spezifische Routen müssen vor `:id` stehen (bereits korrekt in `server.js`). |

**Debug-Logging:** Der Request-Logger ist standardmäßig aktiv (`docker compose logs -f api`).
Server-Fehler werden über den globalen Error-Handler geloggt.

**Performance/Limits (bekannte Grenzen):**

- JSON-Dateien werden vollständig im Speicher gelesen/geschrieben – für sehr große
  Ergebnis-/Fragenmengen ungeeignet (Designziel: Klassenraum-Skala).
- Datei-I/O ist synchron; unter hoher Last kann das blockieren.
- Kein Mehrbenutzer-Locking – paralleles Schreiben kann theoretisch zu Lost-Updates führen.
- Body-Limit für JSON: 4 MB (`express.json({ limit: '4mb' })`).

---

## 10. Contributing-Guidelines

### 10.1 Code-Stil

- **Vanilla-JS** im Frontend (kein Build-Step, kein Bundler) – Einfachheit bewahren.
- Backend: kleine, klar benannte Funktionen; Eingaben immer validieren, sinnvolle
  HTTP-Statuscodes zurückgeben.
- Deutsche UI-Texte/Kommentare beibehalten (Konsistenz mit dem Bestand).
- Keine zusätzlichen Runtime-Abhängigkeiten ohne guten Grund (Footprint klein halten).

### 10.2 Git-Workflow & Branching

- Feature-Branches von `main` abzweigen, beschreibende Namen verwenden.
- **Nicht** direkt auf fremde Branches pushen.
- Pull Requests nur auf ausdrücklichen Wunsch erstellen.

### 10.3 Commit-Konventionen

- Klare, beschreibende Commit-Messages (Imperativ, kurze Zusammenfassung + ggf. Details).
- Eine logische Änderung pro Commit.

### 10.4 PR-Review-Checkliste

- [ ] Läuft `docker compose up -d --build` ohne Fehler?
- [ ] Manuelle Smoke-Tests (Abschnitt 6) grün?
- [ ] Eingaben serverseitig validiert, Auth korrekt gesetzt?
- [ ] Frageschema unverändert oder `normalizeQuestion`/Doku angepasst?
- [ ] Keine Secrets im Code/HTML (Passwort nur via Env)?
- [ ] Doku (`README.md`/`MAINTAINER.md`/`USER_GUIDE.md`) bei Bedarf aktualisiert?

### 10.5 Release-Prozess

Kein formaler Release-Prozess/Versionierungs-Tooling. `server/package.json` trägt eine
Versionsnummer; bei nennenswerten Änderungen Version anheben und README-Changelog
(„Was ist neu") pflegen.

---

_Letzte Aktualisierung: 2026-06-24_
