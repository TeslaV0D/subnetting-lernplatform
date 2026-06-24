# Subnetting Lernplattform v2 – Vollständige Anleitung

---

## 1. Projektübersicht

Eine selbst-gehostete Lernplattform für IPv4-Subnetting, gedacht für FI-Azubis. Schüler loggen sich ein, lernen anhand strukturierter Kapitel und absolvieren einen Test. Die Ergebnisse werden serverseitig gespeichert. Admins können über ein Dashboard Fragen verwalten und Ergebnisse auswerten.

---

## 2. Architektur

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

**Zwei Docker-Container:**
- `subnetting-web` – nginx, liefert das statische Frontend
- `subnetting-api` – Node.js (Express), REST-API + Datenhaltung

Beide laufen hinter nginx. Anfragen an `/api/*` werden intern an Port 3001 weitergeleitet. Die Daten (`questions.json`, `results.json`) liegen in einem Docker-Volume namens `results-data` und überleben Container-Neustarts.

---

## 3. Dateistruktur

```
subnetting-lernplattform/
├── Dockerfile              ← nginx-Image (Frontend)
├── Dockerfile.api          ← Node.js-Image (Backend)
├── docker-compose.yml      ← Beide Services + Volume-Definition
├── README.md
├── data/
│   ├── questions.json      ← 11 Standardfragen (Seed-Vorlage für Betrieb ohne Docker)
│   └── results.json        ← leeres Array (Vorlage)
├── html/
│   ├── index.html          ← gesamte Schüler-App + Admin-Shell
│   ├── admin-editor.css    ← Styles für das Admin-Fragen-Dashboard
│   └── admin-editor.js     ← Admin-Logik (Ergebnisse + Fragen)
├── nginx/
│   └── default.conf        ← nginx-Konfiguration mit /api-Proxy
└── server/
    ├── package.json
    └── server.js           ← REST-API (Auth, Fragen, Ergebnisse)
```

---

## 4. Deployment (Schnellstart)

### Voraussetzungen
- Docker
- Docker Compose

### Starten
```bash
cd subnetting-lernplattform
docker compose up -d --build
```

Plattform ist danach erreichbar unter:
- `http://localhost:8080` (lokal)
- `http://<server-ip>:8080` (Netzwerk/Server)

### Nützliche Befehle

| Befehl | Funktion |
|--------|----------|
| `docker compose ps` | Status beider Container |
| `docker compose logs -f` | Live-Logs |
| `docker compose down` | Container stoppen |
| `docker compose down -v` | Stoppen + **alle Daten löschen** (Vorsicht!) |
| `docker compose up -d --build` | Neubauen nach Änderungen |

### Port ändern
In `docker-compose.yml`:
```yaml
ports:
  - "9090:80"   # statt 8080
```

---

## 5. Admin-Zugang & Passwort

Login erfolgt **nur über Passwort** (kein Benutzername).

| Feld | Standardwert |
|------|--------------|
| Passwort | `admin123` |

**Passwort ändern** – nur in `docker-compose.yml`:
```yaml
environment:
  - ADMIN_PASS=mein-sicheres-passwort
  - SESSION_SECRET=langer-zufaelliger-string
```

Danach: `docker compose up -d --build`

Das Passwort steht **nicht** im HTML – ausschließlich im Backend als Umgebungsvariable.

---

## 6. Authentifizierung (technisch)

Das Backend (`server.js`) generiert nach erfolgreichem Login ein **HMAC-SHA256-signiertes Token** (Base64url-kodiert), gültig für **1 Stunde**.

Zwei Auth-Wege für API-Anfragen:
1. `Authorization: Bearer <token>` – Standard-Weg nach Login
2. `x-admin-pass: <passwort>` – Direktzugriff für Scripts/curl (Abwärtskompatibilität)

---

## 7. Schüler-Workflow

1. **Login** – Name eingeben (kein Passwort erforderlich)
2. **Lernseite** – 8 aufklappbare Kapitel mit Theorie zu IPv4-Subnetting
   - Jedes Kapitel kann als „gelesen" markiert werden
   - Fortschrittsbalken zeigt den Lernstand
3. **Test starten** – Alle Fragen werden nacheinander angezeigt
   - Fragetypen: Multiple Choice, Freitext, Reihenfolge (Drag & Drop)
   - Nach jeder Antwort sofortiges Feedback + Erklärung
4. **Ergebnis** – Score in Prozent, bestanden ab 60 %, falsche Antworten aufgelistet
5. **Ergebnis wird serverseitig gespeichert** (POST `/api/results`)

**Offline-Fallback:** Falls die API nicht erreichbar ist, lädt der Client die Standardfragen aus dem HTML-Fallback.

---

## 8. Fragetypen

| Typ | Key | Beschreibung |
|-----|-----|--------------|
| Multiple Choice | `mc` | Eine richtige + 1–4 falsche Antworten (werden zufällig gemischt) |
| Freitext | `freetext` | Textfeld, mehrere gültige Antworten mit `\|` trennen, optional case-sensitive |
| Reihenfolge | `order` | Drag & Drop – Elemente in korrekte Reihenfolge bringen |

---

## 9. Admin-Dashboard

Erreichbar nach Login über den Admin-Tab.

### Zwei Ansichten

**Ergebnisse-Ansicht:**
- Tabelle aller Testergebnisse (Name, Score, Datum, Dauer)
- Fehlerquoten pro Frage (welche Frage wird am häufigsten falsch beantwortet)
- Export als JSON
- Alle Ergebnisse löschen

**Fragen-Ansicht:**
- Zwei-Spalten-Layout: Liste links, Inline-Editor rechts
- Filter nach Typ, Kategorie, Schwierigkeit
- Volltextsuche
- Spalten-Sortierung + Pagination
- Neue Fragen anlegen, bestehende bearbeiten
- Bulk-Operationen: mehrere auswählen → löschen, Kategorie/Schwierigkeit setzen
- Kategorie-Management: anlegen, umbenennen (verschiebt alle zugehörigen Fragen), leere löschen

---

## 10. Import / Export

### Export
- Fragen als JSON: `GET /api/questions/export`
- Ergebnisse als JSON: `GET /api/results/export`

### Import (Fragen)
Über den Admin-Bereich oder direkt per API.

**JSON-Format:**
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

**CSV-Format** (Kopfzeile obligatorisch, Reihenfolge egal):
```
text,type,category,difficulty,ip,correct,wrong1,wrong2,wrong3,wrong4,explain,items
```

- `wrong1`–`wrong4`: nur bei `type=mc`
- `items`: nur bei `type=order`, Schritte mit `|` trennen
- `correct`: bei `mc` und `freetext`

**Import-Modi:**

| Modus | Verhalten bei Duplikaten (gleicher Fragetext) |
|-------|----------------------------------------------|
| `skip` | Bestehende Frage bleibt unverändert |
| `overwrite` | Bestehende Frage wird ersetzt |
| `merge` | Bestehende wird aktualisiert, neue hinzugefügt |

---

## 11. REST-API – Vollständige Referenz

Basis-URL: `http://<server>:8080/api`

Auth: `Authorization: Bearer <token>` oder `x-admin-pass: <passwort>`

### Auth
| Methode | Pfad | Auth | Body / Beschreibung |
|---------|------|------|---------------------|
| POST | `/api/admin/login` | – | `{ "password": "..." }` → `{ "token": "...", "expiresIn": 3600 }` |

### Ergebnisse
| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| POST | `/api/results` | – | Testergebnis speichern (vom Schüler-Client) |
| GET | `/api/results` | ✓ | Alle Ergebnisse abrufen |
| DELETE | `/api/results` | ✓ | Alle Ergebnisse löschen |
| GET | `/api/results/export` | ✓ | Ergebnisse als JSON-Datei-Download |

### Fragen
| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/api/questions/public` | – | Fragen für den Test (ohne Statistik/Autor) |
| GET | `/api/questions` | ✓ | Alle Fragen inkl. Fehlerquote |
| GET | `/api/questions/stats/:id` | ✓ | Statistik einer einzelnen Frage |
| POST | `/api/questions` | ✓ | Neue Frage anlegen |
| PUT | `/api/questions/:id` | ✓ | Frage bearbeiten |
| DELETE | `/api/questions/:id` | ✓ | Einzelne Frage löschen |
| POST | `/api/questions/bulk-delete` | ✓ | `{ "ids": [...] }` – mehrere löschen |
| POST | `/api/questions/bulk-update` | ✓ | `{ "ids": [...], "patch": {...} }` – mehrere ändern |
| GET | `/api/questions/export` | ✓ | Fragen als JSON-Datei-Download |
| POST | `/api/questions/import` | ✓ | `{ "mode": "...", "questions": [...] }` importieren |

### curl-Beispiele
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

# Neue Frage anlegen
curl -X POST http://localhost:8080/api/questions \
  -H "Content-Type: application/json" \
  -H "x-admin-pass: admin123" \
  -d '{"type":"mc","text":"Was ist die Netzmaske von /24?","correct":"255.255.255.0","wrong":["255.255.0.0"],"category":"CIDR","difficulty":1}'
```

---

## 12. Datenhaltung

Beide JSON-Dateien liegen im Docker-Volume `results-data`:

```bash
# Direkt lesen (ohne Host-Zugriff)
docker exec subnetting-api cat /app/data/questions.json
docker exec subnetting-api cat /app/data/results.json
```

**Seeding:** Beim ersten Start prüft die API, ob `questions.json` leer oder nicht vorhanden ist. Falls ja, werden automatisch **11 Standardfragen** eingetragen.

---

## 13. nginx-Konfiguration (Kurzübersicht)

- Lauscht auf Port 80
- Liefert statische Dateien aus `/usr/share/nginx/html`
- Proxy für `/api/*` → `http://api:3001`
- Security-Header: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- Gzip-Komprimierung für HTML, CSS, JS, JSON
- Static-Asset-Caching: 7 Tage

---

## 14. Fragevalidierung (Backend)

Das Backend validiert jede Frage vor dem Speichern:

| Feld | Regel |
|------|-------|
| `text` | Mindestens 10 Zeichen |
| `type` | Muss `mc`, `freetext` oder `order` sein |
| `correct` | Pflicht bei `mc` und `freetext` |
| `wrong` | Mindestens 1 Eintrag bei `mc` |
| `orderItems` | Mindestens 2 Einträge bei `order` |
| `difficulty` | Integer zwischen 1 und 5 |

---

## 15. Fehlerquoten-Berechnung

Der Server berechnet aus den gespeicherten Testergebnissen automatisch die Fehlerquote pro Frage:

- Jedes Ergebnis enthält ein `wrong`-Array mit den falsch beantworteten Fragen (identifiziert über `q.text + ip`)
- `errorRate = Fehleranzahl / Anzahl Testergebnisse`
- Sichtbar im Admin-Dashboard unter „Fragen" und über `/api/questions`
