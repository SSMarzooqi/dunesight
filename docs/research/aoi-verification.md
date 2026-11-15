# DuneSight — Phase 1: target-area verification

Prepared 2026-11-14 (Phase 1 of `docs/PLAN.md`, handoff §6.1). I used only open sources and no logins. Every fact below has the URL it came from, and each section marks what is **confirmed** (from a source or a query I ran), what is **inferred** (my reasoning), and what I **could not verify**.

---

## Summary

| Item | Value | Status |
|---|---|---|
| **Recommended AOI (AOI-1)** | **S 24.015, W 55.475, N 24.105, E 55.575** (WGS84), about 10.2 km × 9.95 km | Proposed (inference, explained in §3) |
| AOI-1 centroid | **24.060 N, 55.525 E**, about 29 km SW of the Al Ain city node | Arithmetic from the box |
| Alternative (AOI-2) | S 23.960, W 55.355, N 24.050, E 55.455 (about 10.2 × 9.95 km), centred on GeoNames "Sayḩ al Ḩammah" | Proposed |
| UTM / EPSG | **UTM zone 40N, EPSG:32640** | Confirmed: USGS STAC `proj:epsg` = 32640 on all 406 scenes, and the HLS tile is `T40QCM` (CMR) |
| Landsat WRS-2 | **Path 160, Row 043**. It fully covers both AOIs. | Confirmed by a USGS STAC footprint test (393 of 395 path-160 scenes contain all four AOI-1 corners) |
| Best month (scene cloud) | **May**: a Tier-1 scene with ≤ 1 % scene cloud in **all 16 target years** (2000–2002, 2013–2025). July also has 16/16. | Confirmed from STAC `eo:cloud_cover` (scene-level, not in-AOI) |
| Alternative month | **November**: 15/16 years (no 2002 L7 scene). The low sun (≈ 39–46°) makes dune relief much more visible in the snapshots. | Confirmed (coverage). Visual judgement from the snapshots. |
| Thesis "3.32 m" | Abstract: *"the rate of migration peaking in 2019 (average 3.32 m)"*. **No time unit, no area and no statistic definition are given in any text I could reach.** | **Units and time base not verified.** Full PDF blocked (see §2). |
| Thesis sensor / dates / method | Sentinel-2 monthly imagery, 2018–2020, COSI-Corr; 4 field-sampled dunes | Confirmed from the abstract |
| "Sieh Al Hama" location | Not in OSM, Nominatim or GeoNames under that spelling. Best evidence: "Sieh Al Hama Camel Race Track" at **24.0578614, 55.5217188** (third-party listing), which matches an unnamed OSM "Camel Race Track" node 29 m away and an oval track visible in HLS. GeoNames has a separate **"Sayḩ al Ḩammah"** interdune trough at **24.00430, 55.40645**, 13 km WSW. | Partly verified (§1) |

**Still unverified (blocking or important):**
1. The thesis study-area extent, coordinates and map. The full text sits behind a Cloudflare challenge, so I only have the abstract.
2. What "3.32 m" means: per year, per month or per image pair; mean or median; which dunes or area.
3. The migration direction reported by the thesis.
4. That the "Sieh Al Hama dune field" in the thesis is the same place as the camel race track or the GeoNames trough. The thesis's own Arabic abstract spells it **سيح اللحمة** ("Seih Al-Lahma"), not سيح الحمة.
5. In-AOI cloud/haze per scene. STAC gives only scene-level cloud, so `QA_PIXEL` checks are deferred to Phase 2 (Earth Engine).
6. Whether dunes in AOI-1 are actually moving. The snapshots show dunes, but I made no measurement.
7. Farms: OSM has almost no farmland mapped inside either AOI (2 orchard polygons at AOI-1's northern edge). Farm targets for Step 6 will need another source (see §3).

---

## 1. Where is "Sieh Al Hama"?

### What I queried

| Source | Query | Result |
|---|---|---|
| Nominatim (https://nominatim.openstreetmap.org/search, `countrycodes=ae`) | "Sieh Al Hama", "Seih Al Hama", "Saih Al Hama", "Sih Al Hamah", "Seih Al Hamah", "سيح الحمة", "Al Hama Al Ain" | **No results** for any of them |
| Overpass (https://overpass-api.de/api/interpreter) | Every named feature in 23.9–24.5 N, 55.0–55.8 E (14,507 elements), filtered for hama / hamah / hamma / الحمة / الحمه / seih / sieh / lahma | **No feature named Sieh/Seih/Sayh Al Hama(h)**. The nearest hits are unrelated (Hamasa village, street names). |
| Overpass | `place=*` and admin boundaries in 23.6–24.6 N, 54.9–56.0 E | 416 elements, none named Hama/Hamah. There are many "Sayh …" localities (GNS imports), but none is "Sayh al Hama(h)". |
| GeoNames search (https://www.geonames.org/search.html?q=sayh&country=AE and q=hama, hamah, hamma, lahma, lahmah) | Parsed all result pages | One relevant hit: **Sayḩ al Ḩammah**, GeoNames ID 291983, feature T.TRGD "interdune trough(s)", **24.00430 N, 55.40645 E**, elevation ca. 160 m (SRTM3). The history shows an NGA (GNS) source, moved 1.723 km in 2011. https://www.geonames.org/291983/sayh-al-hammah.html |
| Web search | "Sieh/Seih/Seeh Al Hama" | "**Sieh Al Hama Camel Race Track**", listed at **24.0578614, 55.5217188** (https://heroesofadventure.com/listing/sieh-al-hama-camel-race-track-al-ain-abu-dhabi-united-arab-emirates/). Also a "Seih Al Hama Training Centre in Al Ain Region" (national service), with no coordinates given (https://www.mediaoffice.abudhabi/en/security/hazza-bin-zayed-attends-specialised-demonstrations-by-22nd-cohort-of-national-service-recruits-at-seih-al-hama-training-centre-in-al-ain-region/). |
| OSM | Node 6226677846 `name=Camel Race Track`, `sport=Race Track` at **24.0581, 55.52161** (https://www.openstreetmap.org/node/6226677846) | Unnamed as "Sieh Al Hama", but it lies **29 m** from the listing's coordinate |
| Thesis landing page | Arabic abstract (https://scholarworks.uaeu.ac.ae/all_theses/1432) | Names the field **"حقل كثبان سيح اللحمة"** (Seih **Al-Lahma**), while the English abstract says "Sieh Al Hama". Neither text gives coordinates. |

### Candidates

| # | Name | Lat, Lon | Source | Relation to the thesis |
|---|---|---|---|---|
| A | Sieh Al Hama Camel Race Track | 24.0578614, 55.5217188 | heroesofadventure.com listing. Matches OSM node 6226677846 (29 m away). An oval track is visible at that spot in HLS (see `img/aoi1_*`). | Same English name as the thesis. About 29 km SW (bearing ≈ 231°) of the Al Ain city node (OSM node 82799640, 24.2248697, 55.7452211, from Nominatim). This fits "west of Al Ain". |
| B | Sayḩ al Ḩammah (interdune trough) | 24.00430, 55.40645 | GeoNames 291983 (NGA GNS) | A similar transliteration. A *sayh* is a flat interdune plain. About 42 km WSW of the Al Ain node, 13.1 km WSW of A. |
| C | Niqa Sabrah Street (نقا صبرة = "Sabra dune") | 24.20564, 55.34255 | OSM way 816936903 | **Weak.** The thesis sampled a "Large Sabra Dune". A street named after a *niqa* (dune) called Sabrah exists about 41 km W of the city, but nothing ties it to the thesis. I list it only so it isn't overlooked. |

**Inference:** A and B are probably the same named district: a *sayh* (gravel/interdune plain) whose name was transliterated differently by NGA ("Ḩammah") and by local usage ("Hama"). The race track would be named after the district it sits in. I could not confirm that the thesis dune field is centred on either point. The thesis's Arabic "اللحمة" vs English "Hama" mismatch makes this more uncertain. **Sultan, or the thesis PDF (its study-area figure), should confirm it.**

---

## 2. The thesis (Fareaa 2025, UAEU)

**Record (confirmed):** Sanad Salem Mohammad Fareaa, *Monitoring Sand Migration in Al Ain City Utilizing Remote Sensing Techniques*, MSc Geosciences, United Arab Emirates University. Date of award 4-2025. First advisor Dr. Mabrouk Hassan, second advisor Dr. Mritunjay Singh. Theses 1432. https://scholarworks.uaeu.ac.ae/all_theses/1432. The defence listing (7 April 2025) is at https://scholarworks.uaeu.ac.ae/thesis_dissertation_defense/2025-2024/thesis_defenses/66, and a CORE mirror record is at https://core.ac.uk/outputs/649291325.

**Access:** **Abstract only.** The full-text link (`https://scholarworks.uaeu.ac.ae/cgi/viewcontent.cgi?article=2434&context=all_theses`) returns a Cloudflare "Just a moment… Enable JavaScript" challenge to scripted clients, and the CORE PDF did the same (HTTP 403). I did not try to get around the challenge. **Sultan can open the viewcontent link in a normal browser** and send the PDF, or pages with the study-area map and results tables.

**Exact quotes from the English abstract** (landing page above):
- Location: *"This study employs advanced remote sensing techniques to monitor and predict sand dune migration across the Sieh Al Hama dune field, a critical area west of Al Ain."*
- Sensors and dates: *"quantifying dune migration rates over three years (2018–2020) using monthly Sentinel-2 satellite imagery, identifying distinct dune fields, and analyzing the textural and mineralogical properties of dune sediments"*
- Field data: *"Field sampling from four dunes (Large Sabra Dune, Dune 1, Dune 2, and Dune 3) was coupled with laboratory analyses, including grain size distribution, X-Ray Diffraction (XRD), and Scanning Electron Microscopy (SEM)."*
- Method: *"The COSI-Corr software facilitated precise measurement of dune displacement"*
- The number: *"The results demonstrate significant interannual variability, with the rate of migration peaking in 2019 (average 3.32 m) and changing seasonally, influenced by wind patterns."*
- Arabic abstract, same claim: *"حيث بلغ معدل الهجرة ذروته في عام 2019 (بمتوسط 3.32 متر)"*. This is also metres, also with no time unit.

**What "3.32 m" is: could not verify.** Neither abstract says:
- whether it is per year, per month, per season or per image pair;
- whether "average" is a mean over pixels, over dunes, or over monthly pairs;
- over which area or dunes it applies;
- the direction of migration (not stated in either abstract).

**Inference only, not to be used as a fact:** "peaking in 2019" with monthly imagery suggests a per-year aggregate, so 2019's average displacement may be about 3.32 m over the year. But "average 3.32 m" could equally be a mean monthly displacement, which would be about 40 m/yr if it held all year. These two readings differ by about 12×, which is why the handoff's warning about units matters. **Until the PDF is read, DuneSight should cite it as "3.32 m (time base not stated in the abstract)" and must not use it as a m/yr validation target.**

---

## 3. Proposed AOI

### AOI-1 (recommended): camel-track dune field
- **Box (WGS84): S 24.015, W 55.475, N 24.105, E 55.575.** That is 10.16 km E–W × 9.95 km N–S (computed with 111.32 km/deg × cos 24.06° and 110.57 km/deg lat).
- **Centroid: 24.060 N, 55.525 E.** CRS for processing: **EPSG:32640** (UTM 40N).
- Optional 5 × 5 km core for fast iteration (inference): S 24.035, W 55.500, N 24.080, E 55.550. It holds the track and the dune belt between the track and the E40.

**Why (what I saw in HLS L30/S30 and what Overpass returned):**
- It contains candidate point A (the "Sieh Al Hama" camel race track). The oval is clearly visible in every HLS snapshot.
- **Dunes:** in HLS at 30 m, the SE quadrant (between the track and the E40), the W and the NE show crescent/dome-shaped dunes a few hundred metres across. They show best in the November low-sun images (`img/aoi1_HLSL30_2024-11-05.png`, `img/aoi1_HLSL30_2019-11-08.png`).
- **Roads (OSM, confirmed):** the **E40 Ni'mah Road** (`highway=primary`, 2–3 lanes) crosses the southern part of the box SW→NE. There is also a roundabout and links, plus a dense grid of `unclassified`/`residential`/`service` roads in the settlement in the SE corner ("Al Kiristal" streets, Ghafat Um Ad Da'ali Street).
- **Farms:** the imagery shows green plantations on the northern edge (top-left and top-right) and a large grid of rows that look **abandoned and part-buried by sand** in the west-centre. That last point is an inference from appearance only, but it is a strong storytelling and validation candidate. OSM maps only 2 orchard polygons (ways 853279347, 1539063145) at the northern edge and **no `landuse=farmland/farmyard`** inside the box.

Overpass results inside AOI-1 (query below, OSM base timestamp 2026-11-15T01:23:36Z). Road lengths are clipped to the box, summed over segments whose midpoint lies inside:

| Feature | Count (ways/elements) | Clipped length |
|---|---|---|
| highway=primary (E40 + roundabout) | 9 | 18.3 km (both carriageways) |
| highway=primary_link | 4 | 0.2 km |
| highway=unclassified | 70 | 138.0 km |
| highway=residential | 161 | 82.2 km |
| highway=service | 193 | 70.1 km |
| highway=construction | 19 | 8.3 km |
| highway=track | 5 | 3.2 km |
| building=* | 2 | – |
| landuse=farmland / farmyard | **0** | – |
| landuse=orchard | 2 | – |
| landuse=residential / industrial / construction | 2 / 2 / 1 | – |
| sport=Race Track (node 6226677846) | 1 | – |

### AOI-2 (alternative): GeoNames "Sayḩ al Ḩammah"
- **Box: S 23.960, W 55.355, N 24.050, E 55.455.** 10.17 × 9.95 km, centroid **24.005 N, 55.405 E**, EPSG:32640, also Path 160/Row 043.
- Contains GeoNames point B. Its dune texture is visible in HLS, and the E40 crosses the box. There is an industrial compound near the GeoNames point and a settlement grid at the SE edge (`img/aoi2_HLSL30_2024-05-29.png`).
- Overpass: primary 10 ways / 13.9 km, service 158 / 42.9 km, unclassified 10 / 8.0 km, track 2 / 1.5 km, 0 buildings, 0 farmland. It has **fewer farm/road targets** than AOI-1.

**Recommendation (inference):** AOI-1. It is tied to the English place name, and it has the most visible dunes plus targets (E40, settlement, plantations, apparently buried farm rows). Use AOI-2 only if the thesis map shows the study area there.

**Farm targets for Step 6 (proposal):** OSM is not enough here. Options: (a) map vegetated plots from HLS NDVI (NASA data, which fits the brief) and keep OSM for roads; (b) hand-digitise plantations from the 2025 pan image; (c) use ESA WorldCover cropland as a cross-check. I recommend (a) with visual QA.

### Overpass query used (AOI-1; AOI-2 is identical with bbox `23.960,55.355,24.050,55.455`)
Sent as an HTTP POST to `https://overpass-api.de/api/interpreter`, with User-Agent `DuneSight-research/0.1 (open-source dune study)`:
```
[out:json][timeout:120];
(
  way["highway"](24.015,55.475,24.105,55.575);
  nwr["landuse"](24.015,55.475,24.105,55.575);
  nwr["building"](24.015,55.475,24.105,55.575);
  nwr["natural"](24.015,55.475,24.105,55.575);
  nwr["leisure"](24.015,55.475,24.105,55.575);
  nwr["sport"](24.015,55.475,24.105,55.575);
);
out tags geom;
```
Place-name search query (1):
```
[out:json][timeout:180];
nwr["name"](23.9,55.0,24.5,55.8);
out center tags;
```
Regional farmland check (131 farmland/farmyard/orchard features in 23.90–24.30 N, 55.25–55.80 E, mostly north of 24.10 N, in the Al Ain–Al Khazna corridor):
```
[out:json][timeout:120];
( nwr["landuse"~"^(farmland|farmyard|orchard)$"](23.90,55.25,24.30,55.80); );
out center tags;
```

---

## 4. Visual check (Step 0)

All images came from the **Worldview Snapshots API** (`https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=<date>&BBOX=<S>,<W>,<N>,<E>&CRS=EPSG:4326&LAYERS=<layer>&FORMAT=image/png&WIDTH=..&HEIGHT=..`). Dates are real HLS/Landsat acquisition dates, checked in CMR or STAC. AOI images were requested at 1020 × 918 px for a box about 10 × 10 km, i.e. **about 3× upsampled from the native 30 m** (≈ 340 native pixels across). They are display-only. No measurement may come from them.

| File (`docs/research/img/`) | Layer | Date | What I saw |
|---|---|---|---|
| `region_HLSL30_2024-05-29_annotated.png` (and unannotated) | HLS L30 | 2024-05-29 | 55 × 44 km overview: red box = AOI-1, blue box = AOI-2. Circles: red = race track (A), blue = GeoNames (B), purple = Niqa Sabrah St (C), black = OSM Al Ain city node. Al Ain city is at the upper right, with the oasis-farm corridor running W along the Al Ain–Abu Dhabi road and reddish dune belts between farm strips. |
| `aoi1_HLSL30_2016-05-23.png`, `_2020-05-18.png`, `_2024-05-29.png`, `_2025-05-16.png` | HLS L30 | May dates | **Distinguishable:** E40 (thin grey diagonal line, bottom), the oval race track, settlement grid (SE corner), green plantations (top edge), and the faint grid of buried-looking farm rows (W-centre). **Dunes:** visible as mottled reddish texture with some crescent shapes, but **low contrast at May's high sun (≈ 69°)**. A haze/dust veil sits over the W-centre on several dates. |
| `aoi1_HLSL30_2019-11-08.png`, `aoi1_HLSL30_2024-11-05.png` | HLS L30 | November | **Dunes much clearer:** distinct crescentic and dome dunes with shaded lee sides in the SE quadrant, NE and W. Individual dunes about 150–500 m across are separable at 30 m. Roads and plantations are as above. |
| `aoi1_HLSS30_2024-05-27.png` | HLS S30 (Sentinel-2) | 2024-05-27 | Same content as L30, slightly sharper. Confirms HLS S30 exists here (tile T40QCM). |
| `aoi2_HLSL30_2020-05-18.png`, `aoi2_HLSL30_2024-05-29.png` | HLS L30 | May | E40, an industrial compound and the dune texture are visible. There are fewer farms. A small saturated white/green blob south of the road is a rendering artefact or a bright surface (not interpreted). |
| `aoi1_MODISTerra_2024-05-29.png` | MODIS Terra true colour (250 m) | 2024-05-29 | **Too coarse.** About 40 MODIS pixels span the box. I could not distinguish dunes, roads or farms. |
| `aoi1_MODISTerra_2020-05-18.png` | MODIS Terra | 2020-05-18 | **Empty (fully transparent)**: no MODIS data was rendered for this box and date. Kept as a record. |
| `region_MODISTerra_2024-05-29.png` | MODIS Terra | 2024-05-29 | At 55 km scale MODIS shows only reddish sand belts vs grey urban/gravel areas. No individual dunes. |

HLS S30 snapshots requested for 2020-05-15/17/20/22 and 2024-05-24/26/29/31 came back empty (3.7 kB transparent PNGs) because no S30 granule exists on those dates. CMR lists S30 granules for this box on 2024-05-07/12/17/22/27 (https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSS30&bounding_box=55.475,24.015,55.575,24.105&temporal=2024-05-01T00:00:00Z,2024-06-01T00:00:00Z). The yellow specks on some HLS frames are unexplained rendering artefacts (possibly bright roofs or saturation). I did not interpret them.

**Honest read:** at HLS/Landsat 30 m, roads, the race track, settlements and plantations are clearly distinguishable, and dunes are visible as individual bedforms, best in November. MODIS shows none of this. Landsat 15 m pan was not viewable through GIBS (no Landsat-pan layer), so the 15 m check moves to Phase 2 thumbnails. **Comparing 2016 with 2024 by eye, I could not see dune displacement**, which is expected if rates are a few m/yr (≈ 0.1–0.3 of a 30 m pixel per year). Whether motion is measurable is a Phase 3 question.

### Worldview links (open in a browser; Worldview is a JavaScript app, so I could not confirm they render from here)
- AOI-1, HLS L30, 2024-11-05 (low sun): https://worldview.earthdata.nasa.gov/?v=55.475,24.015,55.575,24.105&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-05-T00%3A00%3A00Z
- AOI-1, HLS L30, 2024-05-29: https://worldview.earthdata.nasa.gov/?v=55.475,24.015,55.575,24.105&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-05-29-T00%3A00%3A00Z
- AOI-1, HLS S30, 2024-05-27: https://worldview.earthdata.nasa.gov/?v=55.475,24.015,55.575,24.105&l=HLS_S30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-05-27-T00%3A00%3A00Z
- AOI-1, MODIS Terra, 2024-05-29: https://worldview.earthdata.nasa.gov/?v=55.475,24.015,55.575,24.105&l=MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines_15m&t=2024-05-29-T00%3A00%3A00Z
- AOI-2, HLS L30, 2024-05-29: https://worldview.earthdata.nasa.gov/?v=55.355,23.960,55.455,24.050&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-05-29-T00%3A00%3A00Z
- Regional overview, HLS L30, 2024-05-29: https://worldview.earthdata.nasa.gov/?v=55.25,23.90,55.80,24.30&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-05-29-T00%3A00%3A00Z

---

## 5. Landsat path/row and preliminary scene list

**Catalogue:** USGS LandsatLook STAC, collection `landsat-c2l1` (https://landsatlook.usgs.gov/stac-server/search). I sent a POST with an intersects polygon of 55.30–55.62 E, 23.95–24.25 N (covering both AOIs), with platform LANDSAT_7 for 2000-01-01 → 2003-05-31 and LANDSAT_8/9 for 2013–2025, one request per year. **406 scenes** were returned. Every result set was complete (`numberMatched` = returned count).

**Path/row (confirmed):** **160/043** covers both AOIs fully. My point-in-polygon test of all four box corners against each scene footprint found 393 of 395 path-160 scenes covering AOI-1. The two exceptions are `LC08_L1TP_160043_20130324…` (early L8 commissioning) and `LC09_L1TP_160043_20211108…` (early L9), both partial. Path 159 (rows 043/044) reaches the area only occasionally (11 scenes), and none of them covers AOI-1 except an L1GT T2 scene. **Use 160/043 only.** Typical 160/043 scene bbox from STAC: about 54.0–56.3 E, 23.5–25.6 N (e.g. `LE07_L1TP_160043_20000519…`: 54.08–56.28 E, 23.62–25.50 N; `LC08_L1TP_160043_20200228…`: 54.11–56.32 E, 23.50–25.60 N).

**Cross-check of L7 sparsity:** A point query at the AOI-1 centroid for 2000–2002 with no platform filter returned 71 scenes: 15 Landsat 7 (all 160/043) and 56 Landsat 5 TM. **The USGS archive has only 4–6 L7 scenes per year here** (2000: May, Jul, Aug, Sep, Nov; 2001: Apr, May, Jul, Aug, Sep, Nov; 2002: May, Jul, Aug, Sep). That limits the month choice. Landsat 5 TM (30 m, no pan band) is a possible extra source for 2000–2002 if needed. That is a proposal, not a requirement.

**Month analysis** (Tier 1, L1TP, path 160/043, covers AOI-1, scene cloud ≤ 5 %; 16 target years):

| Month | Years with a good scene | Missing years |
|---|---|---|
| Jan | 6 | 2000–02, 2013, 2016–20, 2023 |
| Feb | 8 | 2000–02, 2013, 2016, 2017, 2020, 2021 |
| Mar | 11 | 2000–02, 2013, 2016 |
| Apr | 12 | 2000, 2002, 2014, 2020 |
| **May** | **16** | **none** |
| Jun | 13 | 2000–02 (no L7 acquisitions) |
| **Jul** | **16** | **none** |
| Aug | 15 | 2013 |
| Sep | 15 (16 at ≤ 10 %) | 2013 (5.01 %) |
| Oct | 12 | 2000–02, 2013 |
| Nov | 15 | 2002 |
| Dec | 11 | 2000–02, 2014, 2021 |

**Best month: May.** All 16 years have a scene with ≤ 1 % scene cloud, and the sun geometry is consistent (elevation 65.5–69.6°, azimuth 93–102° for the picks). July ties on coverage but falls in peak shamal/dust season (an inference; STAC cloud cover does not flag dust).

**Caveat (inference from the snapshots):** May's high sun gives weak dune shading. November (elevation 38.6–46.5°) shows dunes much more clearly and covers 15/16 years, missing only 2002. Feature tracking needs texture, so **I recommend Phase 2 pulls thumbnails for both the May and November picks and decides on in-AOI QA plus visible texture.** For November, the L7 baseline would be 2000-11-27 and 2001-11-30.

Also note: `LE07_L1TP_160043_20030528_20200915_02_T1` (2003-05-28, 0 % cloud) predates the SLC failure date given in the handoff (31 May 2003). It could be an extra early scene but is outside the requested 2000–2002 window.

### Preliminary picks (one per year; Tier-1 L1TP, 160/043; cloud % is scene-level from STAC, **not** in-AOI)

Selection rule: scene cloud ≤ 1 % preferred, then the date closest to 20 May (or 10 Nov). The full list of 406 scenes with flags is in `landsat_candidates.csv`. Sultan confirms the final list in Phase 2, after the `QA_PIXEL` in-AOI check.

| Year | May pick (scene ID) | Date | Cloud % (scene/land) | Sun el / az (deg) | Nov alternative | Date | Cloud % | Sun el / az |
|---|---|---|---|---|---|---|---|---|
| 2000 | `LE07_L1TP_160043_20000519_20200918_02_T1` | 2000-05-19 | 0 / 0 | 67.0 / 97.0 | `LE07_L1TP_160043_20001127_20200918_02_T1` | 2000-11-27 | 1 / 0 | 39.3 / 152.5 |
| 2001 | `LE07_L1TP_160043_20010522_20200917_02_T1` | 2001-05-22 | 0 / 0 | 66.6 / 95.2 | `LE07_L1TP_160043_20011130_20200917_02_T1` | 2001-11-30 | 1 / 1 | 38.6 / 152.1 |
| 2002 | `LE07_L1TP_160043_20020509_20200916_02_T1` | 2002-05-09 | 1 / 0 | 65.5 / 102.3 | none (no L7 scene in Nov 2002) | – | – | – |
| 2013 | `LC08_L1TP_160043_20130531_20200913_02_T1` | 2013-05-31 | 0 / 0 | 69.6 / 92.8 | `LC08_L1TP_160043_20131107_20200912_02_T1` | 2013-11-07 | 0.33 / 0.27 | 45.2 / 154.2 |
| 2014 | `LC08_L1TP_160043_20140518_20200911_02_T1` | 2014-05-18 | 0.03 / 0.02 | 68.7 / 99.2 | `LC08_L1TP_160043_20141110_20200910_02_T1` | 2014-11-10 | 0.45 / 0.29 | 44.4 / 154.1 |
| 2015 | `LC08_L1TP_160043_20150521_20200909_02_T1` | 2015-05-21 | 0 / 0 | 68.7 / 97.5 | `LC08_L1TP_160043_20151113_20200908_02_T1` | 2015-11-13 | 2.23 / 1.73 | 43.6 / 154.4 |
| 2016 | `LC08_L1TP_160043_20160523_20200906_02_T1` | 2016-05-23 | 0 / 0 | 69.0 / 96.1 | `LC08_L1TP_160043_20161115_20200905_02_T1` | 2016-11-15 | 1.55 / 0.26 | 43.0 / 154.8 |
| 2017 | `LC08_L1TP_160043_20170526_20200903_02_T1` | 2017-05-26 | 0 / 0 | 69.0 / 94.7 | `LC08_L1TP_160043_20171102_20200902_02_T1` | 2017-11-02 | 0.24 / 0.18 | 46.5 / 152.8 |
| 2018 | `LC08_L1TP_160043_20180529_20201015_02_T1` | 2018-05-29 | 0 / 0 | 68.8 / 93.3 | `LC08_L1TP_160043_20181105_20200830_02_T1` | 2018-11-05 | 0.32 / 0.26 | 45.7 / 153.2 |
| 2019 | `LC08_L1TP_160043_20190516_20200828_02_T1` | 2019-05-16 | 0.21 / 0 | 68.6 / 100.5 | `LC08_L1TP_160043_20191108_20200825_02_T1` | 2019-11-08 | 0.19 / 0.11 | 45.0 / 153.9 |
| 2020 | `LC08_L1TP_160043_20200518_20200820_02_T1` | 2020-05-18 | 0 / 0 | 68.7 / 98.8 | `LC08_L1TP_160043_20201110_20210316_02_T1` | 2020-11-10 | 0.02 / 0.02 | 44.2 / 154.2 |
| 2021 | `LC08_L1TP_160043_20210521_20210528_02_T1` | 2021-05-21 | 0 / 0 | 68.9 / 97.3 | `LC08_L1TP_160043_20211113_20211125_02_T1` | 2021-11-13 | 0.29 / 0.18 | 43.5 / 154.6 |
| 2022 | `LC08_L1TP_160043_20220524_20220602_02_T1` | 2022-05-24 | 0 / 0 | 69.0 / 95.9 | `LC09_L1TP_160043_20221108_20230322_02_T1` | 2022-11-08 | 0.94 / 0.97 | 44.9 / 153.9 |
| 2023 | `LC08_L1TP_160043_20230527_20230603_02_T1` | 2023-05-27 | 0 / 0 | 68.9 / 94.4 | `LC08_L1TP_160043_20231119_20231122_02_T1` | 2023-11-19 | 1.59 / 1.34 | 42.1 / 155.0 |
| 2024 | `LC09_L1TP_160043_20240521_20240521_02_T1` | 2024-05-21 | 0.01 / 0 | 68.8 / 97.1 | `LC09_L1TP_160043_20241113_20241113_02_T1` | 2024-11-13 | 0.25 / 0.03 | 43.4 / 154.5 |
| 2025 | `LC08_L1TP_160043_20250516_20250529_02_T1` | 2025-05-16 | 0 / 0 | 68.6 / 100.1 | `LC08_L1TP_160043_20251108_20251128_02_T1` | 2025-11-08 | 0.73 / 0.45 | 44.8 / 153.9 |

Each scene's STAC record is at `https://landsatlook.usgs.gov/stac-server/collections/landsat-c2l1/items/<scene_id>` (I checked one, which returned HTTP 200). The matching Earth Engine IDs follow `LANDSAT/LE07/C02/T1/LE07_160043_YYYYMMDD` etc.; that naming is the Earth Engine convention and is not verified here (Phase 2).

**CSV columns** (`landsat_candidates.csv`, 406 rows): scene_id, landsat_scene_id, platform, instrument, wrs_path, wrs_row, acquired_utc, date, year, month, collection_category, processing_level, cloud_cover_scene, cloud_cover_land, sun_elevation, sun_azimuth, geometric_rmse_m, covers_AOI1, covers_AOI2, tier1_l1tp_pre_slc_ok, preliminary_pick_may, preliminary_pick_nov, stac_item_url.

**HLS (for Step 2b), confirmed via public CMR search (no login):** HLSL30 and HLSS30 granules exist for AOI-1 on MGRS tile **T40QCM**. HLSS30 has 18 granules in 2016 (e.g. 2016-05-19, 0 % cloud), and HLSL30 has 14 in 2013. Query pattern: `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSS30&bounding_box=55.475,24.015,55.575,24.105&temporal=...`.

---

## 6. Other published rates (sanity range)

| Source | Place | Rate | Status |
|---|---|---|---|
| Lorenz & Radebaugh, *Giant Linear Dunes as the Formation Pathway to Megabarchan Chains: Titan and the Rub' Al Khali*, 4th Int. Planetary Dunes Workshop (2015), abstract 8003. https://www.hou.usra.edu/meetings/dunes2015/pdf/8003.pdf | **Liwa megabarchans**, UAE (~50 m slip faces) | Quote: *"To our knowledge, no estimate of the migration rate of the Liwa dunes has been published … field observation [1] suggests, from the overrunning of healthy date palms (fig. 1e), that a rate of ~0.1 meter per year is about right."* They also write that migration *"implies a sand transport rate of ~5 m3/m/yr"* and that the dunes make *"a slow advance to the south"* under the NW shamal. | **Verified** (PDF text read). This is a contrast case only: megadunes, not Al Ain barchans. |
| "Barchan Dunes Properties in the Middle East", ResearchGate listing https://www.researchgate.net/publication/368954458_Barchan_Dunes_Properties_in_the_Middle_East | Iraq, Kuwait, Saudi, Qatar, UAE | A search summary attributed "average migration rate of 24 m year-1" to it | **Could not verify.** The page returned 403, so I have not read the paper and do not know its authors or UAE values. Do not cite yet. |
| Saudi/Qatar barchan rates in an EPSL-style paper on barchan prediction (https://sciencedirect.com/science/article/pii/S0012821X24004813) | Qatar, Saudi Arabia | A search summary gave "3 to 27" (Qatar) and "2 to 30" (Saudi), with units shown as m/s (presumably a typo for m/yr) | **Could not verify.** Not read. |
| General COSI-Corr / image-matching studies (North Sinai, e.g. https://doi.org/10.3390/rs13183694) | Egypt | Search summaries: max ≈ 9.4 m/a (Landsat 8) and ≈ 15.9 m/a (Sentinel-2) | **Not read.** Method context only, not UAE. |

**Result:** I found **no peer-reviewed migration rate for the Al Ain / eastern Abu Dhabi dune fields** other than the thesis abstract. The only UAE number I verified is Liwa's ~0.1 m/yr (megadunes, field estimate). The handoff's generic "a few m/yr to a few tens of m/yr" for barchans remains the plausibility band, and I did not verify it for this region. The UAEU thesis on Abu Dhabi sand-area change (https://scholarworks.uaeu.ac.ae/all_theses/281) reports cover change (1992–2013), not migration rates (seen from a search snippet only).

---

## Verified / inferred / not verified

**Verified (with source):**
- No OSM or GeoNames feature carries the spelling "Sieh/Seih/Saih Al Hama(h)" (Nominatim, Overpass, GeoNames queries above).
- "Sieh Al Hama Camel Race Track" is listed at 24.0578614, 55.5217188 (heroesofadventure.com). It sits 29 m from OSM node 6226677846 "Camel Race Track", and an oval track is visible there in HLS.
- GeoNames 291983 "Sayḩ al Ḩammah" is an interdune trough at 24.00430, 55.40645.
- Thesis metadata, and the abstract statements on area, Sentinel-2 2018–2020, COSI-Corr, 4 dunes, and "peaking in 2019 (average 3.32 m)". The Arabic abstract names the field "سيح اللحمة".
- WRS-2 160/043 covers both AOIs fully. EPSG:32640. HLS tile T40QCM.
- Scene list, dates, scene cloud and sun angles (USGS STAC). May (and July) has a ≤ 1 % cloud scene in all 16 years.
- OSM inside AOI-1: E40 primary road, about 290 km of minor roads, 2 orchards, 2 buildings, 0 farmland.
- HLS 30 m shows roads, track, settlement and plantations clearly, and dunes visibly (best in November). MODIS 250 m shows none of it.
- Liwa megabarchans ~0.1 m/yr (Lorenz & Radebaugh 2015).

**Inferred:**
- The camel track (A) and the GeoNames trough (B) are the same named district ("Hama" ≈ "Ḩammah"), and the thesis field is near them.
- AOI-1 is the better AOI: more dunes plus targets, and tied to the English name.
- The grid of faint farm rows in AOI-1 looks abandoned and part-buried by sand.
- November's low sun will give better tracking texture than May.
- July/summer scenes may carry dust that scene cloud cover misses.

**Could not verify:**
- The thesis full text: study-area extent and map, the definition and time base of 3.32 m, the per-season numbers and the migration direction. **Action: Sultan opens https://scholarworks.uaeu.ac.ae/cgi/viewcontent.cgi?article=2434&context=all_theses in a browser and shares the PDF.**
- Which spelling or place the thesis means (Hama vs Lahma vs Ḩammah).
- In-AOI cloud/haze per scene (Phase 2, `QA_PIXEL`).
- Any peer-reviewed Al Ain dune migration rate.
- That the Worldview share links render as described (I could only check the snapshot API).
