# Server Online Deployment Tutorial

## Übersicht
Diese Anleitung erklärt, wie Sie Ihre Schule-App online verfügbar machen, sodass sie über das Internet erreichbar ist.

## 1. Vorbereitung

### Voraussetzungen
- Supabase Account (bereits vorhanden)
- Domain (optional aber empfohlen)
- Lovable Account mit Deploy-Zugang

## 2. Deployment-Optionen

### Option A: Lovable Deploy (Einfachste Lösung)
1. **In Lovable:**
   - Klicken Sie auf "Publish" in der oberen rechten Ecke
   - Wählen Sie einen Subdomain-Namen (z.B. `ihre-schule.lovable.app`)
   - Bestätigen Sie das Deployment

2. **Zugriff:**
   - Die App ist sofort unter `ihre-schule.lovable.app` erreichbar
   - Teilen Sie diese URL mit Lehrern und Schülern

### Option B: Eigene Domain (Professioneller)
1. **Domain kaufen:**
   - Bei einem Provider wie Namecheap, GoDaddy oder Strato
   - Empfehlung: `ihre-schule.de` oder `schule-verwaltung.de`

2. **Domain in Lovable verbinden:**
   - Gehen Sie zu Project Settings → Domains
   - Fügen Sie Ihre Domain hinzu
   - Folgen Sie den DNS-Anweisungen

## 3. Sicherheitseinstellungen

### Supabase Konfiguration
```bash
# Erlaubte URLs in Supabase Dashboard eintragen:
https://ihre-schule.lovable.app
https://ihre-domain.de
```

### Environment Variables
- Alle Secrets sind bereits in Supabase gespeichert
- Keine weiteren Konfigurationen nötig

## 4. Benutzer-Onboarding

### Schulleitung Setup
1. **Erste Anmeldung:**
   - Mit dem Admin-Account einloggen
   - Weitere Benutzer erstellen über "Benutzerverwaltung"

2. **Lehrer hinzufügen:**
   - Username vergeben (z.B. m.mueller)
   - Permission Level 5 für Lehrkräfte
   - Permission Level 10 für Schulleitung

### Schüler-Accounts
- Permission Level 1-3 für Schüler
- Können nur Stundenplan und Announcements einsehen

## 5. Wartung und Updates

### Automatische Updates
- Alle Änderungen in Lovable werden automatisch deployed
- Kein manueller Server-Wartung nötig

### Backup
- Datenbank wird automatisch von Supabase gesichert
- Zusätzliche Backups über Supabase Dashboard möglich

## 6. Kosten

### Lovable Pro (empfohlen)
- ~$20/Monat für professionelle Features
- Eigene Domain
- Erweiterte Analytics

### Supabase
- Kostenlos bis 50,000 Nutzer/Monat
- Bei größerer Nutzung: ~$25/Monat

## 7. Support und Hilfe

### Bei Problemen:
1. Überprüfen Sie die Supabase Logs
2. Kontaktieren Sie den Lovable Support
3. Nutzen Sie die AI-Chat Funktion für technische Fragen

### Monitoring
- Zugriffe und Fehler über Lovable Analytics einsehbar
- Supabase Dashboard für Datenbankstatistiken

## 8. Erweiterte Konfiguration (Optional)

### Custom Domain SSL
- Automatisch von Lovable bereitgestellt
- Keine manuellen SSL-Zertifikate nötig

### CDN und Performance
- Automatisch optimiert durch Lovable
- Globale Verfügbarkeit

---

**Wichtiger Hinweis:** 
Die Architektur wurde so konzipiert, dass alle AI-Anfragen über die Website laufen, nicht direkt vom Nutzer. Dies gewährleistet Sicherheit und einheitliche Nutzererfahrung.

**Kontakt bei Fragen:**
- AI-Chat in der App nutzen
- Schulleitung kann technischen Support kontaktieren