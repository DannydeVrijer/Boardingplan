# Boardingplan Thialf

Webapp om de boarding van Thialf in te tekenen: KNSB-seizoensposities vast, een automatisch voorstel op basis van partnerafspraken, en daarna zelf schuiven met drag & drop. Export als PDF (A3) of PNG.

## Werkwijze per event

1. **+ Event** en geef het event een naam (bijv. "Staatsloterij OKT 26 & 31 december").
2. **KNSB-plan 2026-2027 laden**: zet de seizoenspartners (HSNL, Staatsloterij, Daikin, OK, De'Longhi) op hun vaste posities en zet die vast.
3. **Excel/CSV importeren** met de partnerafspraken van het event (zie *sjabloon* in de app of `public/voorbeeld-partnerafspraken.csv`).
4. **Maak voorstel**: vult de vrije posities.
5. Schuif zelf bij: sleep een partner (⠿) naar een bord, of sleep een bord naar een ander bord om te ruilen. Klik op een bord voor details, `Del` maakt leeg, `L` zet vast, `Ctrl/Cmd+Z` maakt ongedaan.
6. **PDF** of **PNG** exporteren. **Positielijst kopiëren** geeft de lijst "1: …, 2: …" voor de opbouwploeg.

Alles wordt automatisch in de browser bewaard. Om te delen met een collega: *Project opslaan als bestand* en *Project openen*.

## Kolommen in het Excel/CSV-bestand

| Kolom | Betekenis |
|---|---|
| Partner | Naam (verplicht) |
| Meters | Afgesproken meters; wordt omgerekend met "meter per positie" (instelling) |
| Posities | Aantal posities; gaat voor op Meters |
| Niveau | 1 = hoofd/seizoen, 2 = eventpartner, 3 = partner. Niveau 1 kiest eerst |
| Kleur | `#rrggbb` |
| Categorie | Branche; partners met dezelfde categorie komen niet naast elkaar |
| Blok | 1 = losse borden, 2 = steeds in paren, … |
| Voorkeur | `recht`, `bocht` of `finish` |
| Vast | Contractuele posities, bijv. `33, 34, 76-78` |

## Hoe het voorstel werkt

- Vastgezette en contractueel vaste posities blijven altijd staan.
- De rest wordt in rondes verdeeld: per ronde kiest elke partner één bord (of blok). Niveau 1 kiest eerst; binnen een niveau kiest wie relatief het minst heeft.
- Een keuze weegt mediawaarde, voorkeur, spreiding over de vier zijden en houdt concurrenten uit elkaar.

## Mediawaarde

Standaard is een vuistregel (zie `src/model/value.ts`): rechte stukken 6, bochten 3, bonus rond de finish en de startlijnen, en +2 voor KNSB-plan-posities. Per positie is de waarde in de app aan te passen (weergave *Mediawaarde*, klik op een bord). Zodra er echte data is (bijv. een mediawaarde-rapport per positie), horen die getallen hier.

## Baannummering

Posities 1–86 lopen als één ring: 1–23 bocht links (onder → boven), 24–43 rechte stuk boven, 44–66 bocht rechts, 67–86 rechte stuk onder (rechts → links). 86 grenst aan 1.

## Ontwikkelen

```bash
npm install
npm run dev     # lokaal op http://localhost:5173
npm test        # tests voor het voorstel-algoritme
npm run build   # productiebuild in dist/
```

Elke push naar `main` publiceert de app via GitHub Pages (workflow in `.github/workflows/deploy.yml`). Eenmalig instellen: *Settings → Pages → Source: GitHub Actions*.

## Bekende beperkingen (v0.1)

- Eén positie = één bord; meter per positie is één instelling voor de hele baan.
- Het KNSB-doek dat niet precies in het midden zit (bij 68 een positie te kort, terug bij 80) is nog niet gemodelleerd.
- Opslag is per browser; er is nog geen gedeelde database.
