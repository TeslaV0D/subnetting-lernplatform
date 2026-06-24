# Benutzerhandbuch – Subnetting Lernplattform

Eine kurze, verständliche Anleitung für Schülerinnen und Schüler (FI-Azubis), die mit
der Plattform IPv4-Subnetting lernen und üben.

> Technische Doku für Betreiber/Entwickler: siehe [`MAINTAINER.md`](./MAINTAINER.md).

---

## Inhaltsverzeichnis

1. [Was ist diese Plattform?](#1-was-ist-diese-plattform)
2. [Erste Schritte](#2-erste-schritte-5-10-minuten)
3. [So benutzt du die Plattform](#3-so-benutzt-du-die-plattform)
4. [Funktionsüberblick](#4-funktionsüberblick)
5. [Häufige Fragen](#5-häufige-fragen)
6. [Probleme & Lösungen](#6-probleme--lösungen)
7. [Schnellreferenz](#7-schnellreferenz)

---

## 1. Was ist diese Plattform?

**In einem Satz:** Eine kostenlose Lernumgebung, in der du IPv4-Subnetting von Grund auf
verstehst, interaktiv übst und dein Wissen in einem Test überprüfst.

**Für wen?** Für Einsteiger – besonders Auszubildende im IT-Bereich (Fachinformatiker).
Du brauchst **kein** Vorwissen.

**Was du lernst:**

- Aufbau einer IP-Adresse (32 Bit, Oktette, Netz- und Hostanteil)
- Subnetzmaske und CIDR-Notation (z. B. `/24`)
- Netzadresse, Broadcast-Adresse und nutzbare Hosts berechnen
- Subnetting Schritt für Schritt durchführen
- private Adressbereiche (RFC 1918) kennen

---

## 2. Erste Schritte (5–10 Minuten)

### Zugang

Die Plattform läuft im **Browser**. Öffne die Adresse, die dir dein Lehrer / Admin gegeben
hat, z. B.:

```
http://localhost:8080          (auf dem eigenen Rechner)
http://<server-adresse>:8080   (im Schulnetz)
```

### Anmelden

1. Auf dem Willkommensbildschirm deinen **Namen** eingeben (mindestens 2 Zeichen).
2. Auf **Einloggen** klicken (oder Enter drücken).

> Es gibt kein Passwort für Schüler. Dein Name wird nur deinem Testergebnis zugeordnet,
> damit dein Lehrer es zuordnen kann.

### Überblick über die Oberfläche

Nach dem Login siehst du oben eine Navigation mit drei Bereichen:

| Bereich | Inhalt |
|---------|--------|
| **Lernen** | 5 Kapitel Theorie mit Beispielen und Merksätzen |
| **Test** | Quiz mit verschiedenen Fragetypen, am Ende ein Ergebnis |
| **IP-Trainer** | Interaktiver Rechner & Übungs-Challenges |

---

## 3. So benutzt du die Plattform

### Schritt 1 – Theorie lesen

1. Gehe auf **Lernen**.
2. Klicke nacheinander die **5 Kapitel** auf, um sie aufzuklappen.
3. Lies sie sorgfältig – der **Fortschrittsbalken** oben zeigt, wie viel du schon gelesen hast.
4. Achte auf die **Merksätze** (Glühbirnen-Tipps) und **Code-Beispiele**.

### Schritt 2 – Test starten

1. Am Ende der Lernseite (oder über die Navigation) auf **Test starten** klicken.
2. Du beantwortest die Fragen nacheinander. Oben siehst du **Frage X/Y**, **Richtig** und
   **Falsch**.

So beantwortest du die drei Fragetypen:

| Typ | So antwortest du |
|-----|------------------|
| **Multiple Choice** | Die richtige Antwort anklicken |
| **Freitext** | Antwort eintippen (z. B. eine Zahl oder IP) und bestätigen |
| **Reihenfolge** | Die Bausteine per **Drag & Drop** in die richtige Reihenfolge ziehen |

3. Nach jeder Antwort siehst du, ob sie **richtig** war, plus eine kurze **Erklärung**.
4. Mit **Weiter** zur nächsten Frage.

### Schritt 3 – Ergebnis ansehen

Am Ende des Tests bekommst du:

- deine **Punktzahl in Prozent**,
- Anzahl **richtiger/falscher** Antworten,
- die **benötigte Zeit**,
- ob du **bestanden** hast (**ab 60 %**).

Dein Ergebnis wird automatisch gespeichert, sodass dein Lehrer es einsehen kann.

### Schritt 4 – Mit dem IP-Trainer üben

Im **IP-Trainer** kannst du gezielt rechnen üben: Gib eine IP/CIDR ein oder löse die
gestellten Aufgaben (Netzadresse, Broadcast, nutzbare Hosts usw.). Du bekommst sofort
Feedback, und eine kleine Statistik zeigt deine Trefferquote in dieser Sitzung.

---

## 4. Funktionsüberblick

- **5 Lernkapitel** mit Beispielen, Tabellen und Eselsbrücken.
- **Test mit 3 Fragetypen:** Multiple Choice, Freitext, Reihenfolge (Drag & Drop).
- **Sofort-Feedback** mit Erklärung nach jeder Frage.
- **IP-Trainer:** interaktiver Rechner + Übungs-Challenges mit Sitzungs-Statistik.
- **Fortschrittsanzeige** beim Lernen.
- **Funktioniert auch mobil** (responsive Darstellung).
- **Offline-Notbetrieb:** Ist der Server kurz nicht erreichbar, kannst du trotzdem mit
  zwischengespeicherten Fragen üben (Ergebnisse werden dann allerdings nicht gespeichert).

> **Schwierigkeitsgrade:** Jede Frage hat intern einen Schwierigkeitsgrad (1–5 Sterne).
> Diese pflegt der Admin – als Schüler beantwortest du einfach die zusammengestellten Fragen.

---

## 5. Häufige Fragen

**Wie setze ich meinen Fortschritt zurück?**
Der Lernfortschritt wird lokal in deinem Browser gespeichert. Du kannst die Seite einfach
neu durchgehen; über das Löschen der Browserdaten (für diese Seite) wird auch der lokale
Fortschritt zurückgesetzt.

**Kann ich meine Ergebnisse exportieren?**
Der Export der Ergebnisse ist dem **Admin/Lehrer** vorbehalten. Frag deinen Lehrer, wenn du
deine Auswertung brauchst.

**Was, wenn ich bei einer Aufgabe nicht weiterkomme?**
Nutze die **Erklärung**, die nach jeder Antwort erscheint, geh zurück zu **Lernen** und
übe im **IP-Trainer**, bis du sicher bist.

**Wie übe ich ein bestimmtes Thema?**
Lies das passende Kapitel unter **Lernen** und nutze gezielt den **IP-Trainer** für
Berechnungen (Netzadresse, Broadcast, Hosts usw.).

**Brauche ich ein Konto/Passwort?**
Nein. Als Schüler reicht dein Name beim Login.

---

## 6. Probleme & Lösungen

| Problem | Lösung |
|---------|--------|
| **„Ich kann mich nicht einloggen"** | Gib mindestens **2 Zeichen** als Namen ein. Erscheint ein roter Rahmen, ist der Name zu kurz. |
| **„Die App lädt nicht"** | Prüfe die Adresse (richtige IP/Port), die Internet-/Netzwerkverbindung und lade die Seite neu (F5). |
| **„Mein Ergebnis wurde nicht gespeichert"** | Vermutlich war der Server kurz nicht erreichbar. Melde es deinem Lehrer und mache den Test ggf. erneut. |
| **„Drag & Drop funktioniert nicht"** | Nutze einen aktuellen Browser. Auf dem Handy ggf. langsamer ziehen oder einen Desktop-Browser verwenden. |
| **Darstellung kaputt** | Browser-Cache leeren und Seite neu laden. |

**Browser-Voraussetzungen:** Ein aktueller Browser (Chrome, Firefox, Edge oder Safari).
JavaScript muss aktiviert sein.

**Support:** Wende dich bei Problemen an deinen Lehrer bzw. die Person, die die Plattform
betreibt.

---

## 7. Schnellreferenz

**Wichtige Formeln (zum Mitlernen):**

| Was | Formel |
|-----|--------|
| Nutzbare Hosts | `2^(32 − Präfix) − 2` |
| Blockgröße | `2^(Host-Bits)` |
| Letztes Masken-Oktett | `256 − Blockgröße` |
| Subnetze beim Aufteilen | `2^(neue Bits)` |

**Schnelltabelle:**

| Präfix | Maske | Hosts | Blockgröße |
|--------|-------|-------|------------|
| /24 | 255.255.255.0 | 254 | 256 |
| /25 | 255.255.255.128 | 126 | 128 |
| /26 | 255.255.255.192 | 62 | 64 |
| /27 | 255.255.255.224 | 30 | 32 |
| /28 | 255.255.255.240 | 14 | 16 |
| /29 | 255.255.255.248 | 6 | 8 |
| /30 | 255.255.255.252 | 2 | 4 |

**Tipps fürs schnellere Lernen:**

- Lerne die **Blockgrößen** auswendig: 256, 128, 64, 32, 16, 8, 4 (immer die Hälfte).
- Erst **alle Kapitel lesen**, dann den Test machen.
- Bei Fehlern die **Erklärung** lesen und das Thema im **IP-Trainer** nachüben.
- Eingaben: Bei Freitext genau auf das geforderte Format achten (z. B. nur eine Zahl
  oder eine vollständige IP-Adresse).

---

_Viel Erfolg beim Lernen!_
