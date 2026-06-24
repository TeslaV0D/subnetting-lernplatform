# Mobile-Testing-Anleitung

Die Lernplattform ist **mobile-first responsive**. Diese Anleitung beschreibt,
wie du das Verhalten auf Smartphone, Tablet und Desktop prüfst.

## Breakpoints

| Bereich            | Breite        | Verhalten                                          |
|--------------------|---------------|----------------------------------------------------|
| Smartphone (klein) | 320 – 480 px  | Hamburger-Menü, gestapelte Eingaben, 1-spaltig     |
| Smartphone / Tablet| 481 – 768 px  | Hamburger-Menü, kompakte Stats (2-spaltig)         |
| Tablet quer        | 769 – 1023 px | Horizontale Navigation, Editor neben Liste         |
| Desktop            | ≥ 1024 px     | Volle Zwei-Spalten-Ansicht, Sidebar + Content      |

Die magische Grenze ist **768 px**: darunter Hamburger-Menü, darüber
horizontale Navigation.

## Schnelltest im Browser (Chrome / Edge / Firefox)

1. Seite öffnen: `http://localhost:8080` (bzw. dein Server-Port).
2. DevTools öffnen: `F12` oder `Strg/Cmd + Shift + I`.
3. Geräte-Toolbar aktivieren: `Strg/Cmd + Shift + M` (Toggle device toolbar).
4. Oben die Gerätebreite wählen oder „Responsive“ und manuell ziehen.

### Testbreiten (Presets)

- **iPhone SE** – 375 px (kleines Smartphone)
- **iPhone 14 Pro** – 393 px
- **Pixel 7** – 412 px
- **iPad Mini** – 768 px (Grenzfall – hier wechselt die Navigation)
- **iPad Air** – 820 px (Tablet quer)
- **Desktop** – 1280 px+

## Checkliste pro Breite

- [ ] **Kein horizontaler Scroll** der ganzen Seite (nur Tabellen dürfen
      intern scrollen).
- [ ] **Navigation**
  - ≤ 768 px: Hamburger-Icon oben rechts, öffnet/schließt das Menü.
      Nach Tippen auf einen Tab schließt sich das Menü automatisch.
  - ≥ 769 px: Tabs horizontal in der Leiste.
- [ ] **Touch-Targets**: Buttons/Links sind mind. ~44 px hoch und leicht
      zu treffen (Nav-Tabs, „Prüfen“, „Test starten“, Admin-Buttons).
- [ ] **Lernen**: Kapitel klappen sauber auf, Code-Blöcke scrollen bei
      Bedarf horizontal statt das Layout zu sprengen.
- [ ] **Test**: Frage-Karten volle Breite; bei Freitext liegt das
      Eingabefeld über dem „Prüfen“-Button (gestapelt).
- [ ] **IP-Trainer**: Label und Eingabe untereinander; „Alle prüfen“-
      Aktionen auf kleinen Screens gestapelt.
- [ ] **Admin → Ergebnisse**: Tabelle horizontal scrollbar, Stat-Karten
      2-spaltig (klein: 1-spaltig).
- [ ] **Admin → Fragen verwalten**: Liste und Editor gestapelt (≤ 860 px);
      Filter-Selects untereinander auf sehr kleinen Screens.
- [ ] **Modals** (Import/Kategorien): volle Breite, Buttons gut erreichbar.

## Lighthouse Mobile (Score-Ziel > 80)

1. DevTools → Tab **Lighthouse**.
2. Mode: *Navigation*, Device: **Mobile**.
3. Kategorien: *Performance* + *Accessibility* + *Best Practices*.
4. **Analyze page load** klicken.

Hinweise:
- Die App ist statisch (nur HTML/CSS/JS + Icon-Webfont über CDN) → kaum
  Layout-Shifts (CLS) zu erwarten.
- Viewport-Meta ist gesetzt (`width=device-width, initial-scale=1.0`).

## Echtes Gerät im selben WLAN

1. Server-IP herausfinden (z. B. `ip addr` / `ipconfig`).
2. Am Smartphone im Browser `http://<server-ip>:8080` öffnen.
3. Checkliste oben durchgehen, besonders Touch-Bedienung und Tastatur-
   Verhalten bei den Eingabefeldern.

## Was wurde responsiv umgesetzt

- `html/responsive.css` – zentrale Mobile-first-Overrides (Breakpoints,
  Hamburger-Navigation, Touch-Targets, Tabellen-Scroll, Typografie/Spacing).
- `html/index.html` – Hamburger-Button + `nav-menu`-Wrapper, `toggleNav()`/
  `closeNav()`, Tabellen in `.table-scroll`-Container gewickelt.
