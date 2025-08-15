# Vollständige Anleitung: Lokale AI-gestützte Schule-App mit Llama 3.1 8B

## 🎯 Übersicht
Diese Anleitung erklärt, wie Sie Ihre Schule-App mit lokalem Llama 3.1 8B AI-Modell, TTS-Funktionalität und KI-gestützter Vertretungsplan-Logik einrichten.

## 📋 Voraussetzungen

### 1. Hardware-Anforderungen
- **RAM**: Mindestens 8 GB (16 GB empfohlen für Llama 3.1 8B)
- **Festplatte**: 10 GB freier Speicherplatz
- **CPU**: Moderne Mehrkern-CPU (AI-Berechnungen)

### 2. Software-Voraussetzungen
- Node.js (Version 18+)
- Git
- Moderner Webbrowser mit Web Speech API Support

---

## 🚀 Schritt 1: Ollama Installation und Setup

### Windows Installation
```powershell
# Download Ollama von https://ollama.ai/download
# Installiere die .exe Datei
# Oder via Chocolatey:
choco install ollama
```

### macOS Installation
```bash
# Download von https://ollama.ai/download
# Oder via Homebrew:
brew install ollama
```

### Linux Installation
```bash
# Ubuntu/Debian:
curl -fsSL https://ollama.ai/install.sh | sh

# Arch Linux:
yay -S ollama
```

### Llama 3.1 8B Modell herunterladen
```bash
# Ollama starten (falls nicht automatisch gestartet)
ollama serve

# In einem neuen Terminal:
ollama pull llama3.1:8b
```

**⚠️ Wichtig**: Das Modell ist ~4.7 GB groß und kann je nach Internetverbindung lange dauern.

### Ollama-Konfiguration überprüfen
```bash
# Testen ob Ollama läuft:
curl http://localhost:11434/api/tags

# Modell testen:
ollama run llama3.1:8b "Hallo, funktioniert das?"
```

---

## 🔧 Schritt 2: Projekt-Setup

### Repository klonen und starten
```bash
# Wenn noch nicht geschehen:
git clone [your-repo-url]
cd school-management-app

# Dependencies installieren:
npm install

# Entwicklungsserver starten:
npm run dev
```

### Supabase-Konfiguration
Die App nutzt bereits konfigurierte Supabase Edge Functions als Proxy für Ollama:
- `ollama-proxy`: Leitet Anfragen an lokales Ollama weiter
- `ai-actions`: Führt KI-gesteuerte Aktionen aus
- Alle CORS-Probleme sind bereits gelöst

---

## 🌐 Schritt 3: Netzwerk-Zugriff einrichten

### Lokales Netzwerk verfügbar machen
```bash
# Vite Server für Netzwerk-Zugriff konfigurieren:
npm run dev -- --host 0.0.0.0

# Oder in vite.config.ts hinzufügen:
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
```

### IP-Adresse finden
```bash
# Windows:
ipconfig

# macOS/Linux:
ip addr show
# oder
ifconfig
```

Die App ist dann erreichbar unter: `http://[IHRE-IP]:5173`

### Firewall-Einstellungen
**Windows:**
```powershell
# Port für Vite freigeben:
netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=5173
```

**Linux (ufw):**
```bash
sudo ufw allow 5173
```

---

## 🗣️ Schritt 4: Text-to-Speech Konfiguration

### Browser-Kompatibilität prüfen
Die App nutzt die Web Speech API (bereits implementiert in `OfflineTTS.tsx`):

**Unterstützte Browser:**
- ✅ Chrome/Chromium (beste Qualität)
- ✅ Firefox (eingeschränkt)
- ✅ Safari (macOS/iOS)
- ❌ Ältere Browser

### Deutsche Stimmen installieren

**Windows:**
1. Einstellungen → Zeit und Sprache → Sprache
2. Deutsch hinzufügen
3. Sprachpaket → Sprachfunktionen → Text-zu-Sprache herunterladen

**macOS:**
1. Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte
2. Systemstimme → Anpassen → Deutsch auswählen

**Linux:**
```bash
# Ubuntu/Debian:
sudo apt install espeak-ng-data-de festival-de

# Arch:
sudo pacman -S espeak-ng festival-de
```

### TTS testen
1. Öffnen Sie die App
2. Gehen Sie zu "Audio-Durchsagen"
3. Erstellen Sie eine TTS-Durchsage
4. Klicken Sie "Abspielen"

---

## 🤖 Schritt 5: KI-Vertretungsplan verwenden

### Verfügbare KI-Funktionen
Die App unterstützt natürlichsprachliche Eingaben für:

**Vertretungsplan-Änderungen:**
- "Herr Müller fällt morgen aus"
- "Die 10b hat Raumwechsel von 201 nach 305"
- "Frau Schmidt übernimmt die Mathestunde in der 9a"
- "Erste Stunde entfällt heute"

**Ankündigungen erstellen:**
- "Erstelle eine Ankündigung über den Ausflug"
- "Informiere alle Lehrer über die Konferenz"

### Schritt-für-Schritt Verwendung
1. **KI-Chat öffnen**: Navigation → "KI-Assistent"
2. **Eingabe**: Z.B. "Herr König ist krank, kann jemand die 3. Stunde Mathe in der 10b übernehmen?"
3. **KI-Antwort**: Die KI analysiert und schlägt eine Vertretung vor
4. **Bestätigung**: Sie müssen die Änderung bestätigen, bevor sie übernommen wird
5. **Automatische Erstellung**: Vertretungsplan wird automatisch aktualisiert

---

## 🔒 Schritt 6: Sicherheit und Berechtigungen

### Rollenbasierte Zugriffe
Die App implementiert strenge Berechtigungskontrollen:

**Schüler (Level 1-3):**
- ✅ Stundenplan einsehen
- ✅ Vertretungsplan einsehen
- ✅ Ankündigungen lesen
- ❌ Keine KI-Chat Funktionen
- ❌ Keine Verwaltungsfunktionen

**Lehrkräfte (Level 4-8):**
- ✅ Alle Schüler-Rechte
- ✅ Ankündigungen erstellen
- ✅ KI-Chat für Ankündigungen
- ❌ Vertretungsplan bearbeiten
- ❌ Benutzerverwaltung

**Koordination (Level 9):**
- ✅ Alle Lehrer-Rechte
- ✅ Vertretungsplan bearbeiten
- ✅ KI-Chat für Vertretungsplan
- ✅ Klassenverwaltung
- ❌ Benutzerverwaltung

**Schulleitung (Level 10):**
- ✅ Vollzugriff auf alle Funktionen
- ✅ Benutzerverwaltung
- ✅ TTS-Durchsagen
- ✅ Alle KI-Funktionen

### Sichere Datenbank-Konfiguration
Die Datenbank ist bereits mit Row-Level Security (RLS) gesichert:
- Benutzer sehen nur ihre eigenen Chat-Verläufe
- Passwörter sind verschlüsselt
- Berechtigungen werden streng kontrolliert

---

## 🔧 Schritt 7: Troubleshooting

### Häufige Probleme

**1. Ollama-Verbindung fehlgeschlagen**
```bash
# Prüfen ob Ollama läuft:
curl http://localhost:11434/api/tags

# Neu starten:
killall ollama
ollama serve
```

**2. Modell nicht gefunden**
```bash
# Verfügbare Modelle anzeigen:
ollama list

# Llama 3.1 neu herunterladen:
ollama pull llama3.1:8b
```

**3. TTS funktioniert nicht**
- Browser-Konsole prüfen (F12)
- Mikrofonberechtigung erteilen
- Deutsche Sprachpakete installieren
- Anderen Browser testen

**4. KI antwortet nicht**
- Ollama-Logs prüfen: `ollama logs`
- Supabase Edge Function Logs checken
- Internetverbindung prüfen

**5. Berechtigungsfehler**
- Als Admin anmelden
- Benutzerberechtigung in der Benutzerverwaltung prüfen
- Browser-Cache leeren

### Performance-Optimierung

**Ollama-Performance:**
```bash
# GPU-Nutzung aktivieren (falls verfügbar):
export OLLAMA_GPU=1
ollama serve

# Memory-Limit setzen:
export OLLAMA_MAX_MEMORY=8GB
```

**Browser-Performance:**
- Hardware-Beschleunigung aktivieren
- Genügend RAM freigeben
- Andere Tabs schließen

---

## 📱 Schritt 8: Mobile Nutzung

### Responsive Design
Die App ist vollständig responsive und funktioniert auf:
- 📱 Smartphones (iOS/Android)
- 📱 Tablets
- 💻 Laptops
- 🖥️ Desktop-PCs

### Mobile TTS
**iOS Safari**: Funktioniert nativ
**Android Chrome**: Funktioniert nativ
**Andere Browser**: Eingeschränkte Unterstützung

---

## 🚀 Schritt 9: Produktions-Deployment

### Lokaler Server (empfohlen)
```bash
# Produktions-Build erstellen:
npm run build

# Mit serve hosten:
npx serve dist -p 80

# Oder mit nginx:
sudo apt install nginx
# nginx konfigurieren für dist/ Ordner
```

### Online-Deployment (optional)
Das Tutorial `DEPLOYMENT_TUTORIAL.md` erklärt Lovable-Deployment für Internetzugriff.

---

## 🔄 Schritt 10: Wartung und Updates

### Regelmäßige Updates
```bash
# Ollama aktualisieren:
ollama pull llama3.1:8b

# App-Dependencies aktualisieren:
npm update

# Supabase-Migrations anwenden:
# (automatisch bei App-Start)
```

### Backup-Strategie
- **Datenbank**: Supabase erstellt automatische Backups
- **Lokale Daten**: Ollama-Modelle bei Bedarf neu herunterladen
- **Konfiguration**: Git-Repository als Backup

---

## 📞 Support und Hilfe

### Bei Problemen:
1. **Logs prüfen**: Browser-Konsole (F12)
2. **Ollama-Status**: `ollama ps`
3. **Supabase-Logs**: Im Supabase Dashboard
4. **Community**: GitHub Issues erstellen

### Nützliche Befehle
```bash
# System-Status prüfen:
ollama ps                          # Laufende Modelle
curl localhost:11434/api/tags      # Verfügbare Modelle
npm run dev -- --host 0.0.0.0     # Dev-Server für Netzwerk

# Logs anzeigen:
ollama logs                        # Ollama-Logs
tail -f ~/.ollama/logs/server.log  # Detaillierte Logs
```

---

## ✅ Erfolgskriterien

Nach erfolgreicher Einrichtung sollten Sie:

1. ✅ **Login als "Kunadt"** ohne UUID-Fehler
2. ✅ **KI-Chat funktioniert** mit Llama 3.1 8B
3. ✅ **TTS spielt Sprache ab** ohne Fehler
4. ✅ **Vertretungsplan-KI** versteht natürliche Eingaben
5. ✅ **Netzwerk-Zugriff** von anderen Geräten funktioniert
6. ✅ **Rollenbasierte UI** zeigt nur erlaubte Funktionen

### Test-Checkliste
- [ ] Als verschiedene Benutzertypen anmelden
- [ ] KI-Chat mit Vertretungsplan-Anfrage testen
- [ ] TTS-Durchsage erstellen und abspielen
- [ ] Von Smartphone/Tablet auf App zugreifen
- [ ] Ollama-Verbindung ohne CORS-Fehler

---

**🎉 Herzlichen Glückwunsch!** 
Ihre lokale AI-gestützte Schule-App ist jetzt vollständig eingerichtet und einsatzbereit.

Bei Fragen oder Problemen schauen Sie in die Troubleshooting-Sektion oder erstellen Sie ein GitHub Issue.