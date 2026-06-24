# Subnetting Lernplattform v2 – Kurzanleitung

---

## Start

```bash
cd subnetting-lernplattform
docker compose up -d --build
# → http://localhost:8080
```

---

## Was ist das?

Self-hosted Lernplattform für IPv4-Subnetting (FI-Azubis).  
**Schüler:** einloggen → Theorie lesen → Test machen → Ergebnis wird gespeichert.  
**Admin:** Fragen verwalten, Ergebnisse auswerten.

---

## Architektur

| Schicht | Technologie | Port |
|---------|-------------|------|
| Frontend | nginx (statisches HTML/CSS/JS) | 8080 → 80 |
| Backend | Node.js / Express (REST-API) | intern 3001 |
| Daten | JSON-Dateien in Docker-Volume | – |

nginx leitet `/api/*` intern an Node.js weiter.

---

## Admin-Login

Passwort-only (kein Benutzername). Standard: `admin123`

Ändern in `docker-compose.yml`:
```yaml
environment:
  - ADMIN_PASS=neues-passwort
  - SESSION_SECRET=zufallswert
```
→ `docker compose up -d --build`

---

## Fragetypen

| Typ | Beschreibung |
|-----|-------------|
| `mc` | Multiple Choice (1 richtig, 1–4 falsch) |
| `freetext` | Freitexteingabe, mehrere Antworten mit `\|` |
| `order` | Drag & Drop – Reihenfolge bestimmen |

---

## Admin-Dashboard (Kurzübersicht)

**Ergebnisse:** Alle Tests einsehen, Fehlerquoten pro Frage, JSON-Export, löschen.

**Fragen:** Anlegen, bearbeiten, löschen. Filter, Suche, Bulk-Aktionen. Import (JSON/CSV), Export (JSON).

---

## Wichtigste API-Endpunkte

Auth: `x-admin-pass: admin123` oder `Authorization: Bearer <token>`

```bash
POST /api/admin/login          # Login → Token
GET  /api/questions/public     # Fragen für Schüler (kein Auth)
GET  /api/questions            # Alle Fragen + Fehlerquoten (Admin)
POST /api/questions            # Neue Frage
PUT  /api/questions/:id        # Frage bearbeiten
DELETE /api/questions/:id      # Frage löschen
GET  /api/results              # Alle Ergebnisse (Admin)
POST /api/results              # Ergebnis speichern (Schüler, kein Auth)
GET  /api/questions/export     # JSON-Download Fragen
GET  /api/results/export       # JSON-Download Ergebnisse
```

---

## Daten

```bash
docker exec subnetting-api cat /app/data/questions.json
docker exec subnetting-api cat /app/data/results.json
```

Beim ersten Start: **11 Standardfragen** werden automatisch eingetragen.

---

## Nützliche Befehle

```bash
docker compose ps              # Status
docker compose logs -f         # Logs
docker compose down            # Stoppen
docker compose down -v         # Stoppen + ALLE Daten löschen
docker compose up -d --build   # Neubauen
```
