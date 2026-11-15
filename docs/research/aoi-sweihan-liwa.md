# DuneSight — Phase 1b: target-area verification for Sweihan and Liwa

Prepared 2026-11-14. This is the same job as `aoi-verification.md` (Seih Al Hama), with the same method and standards. I used open sources only, with no logins. Earth Engine was used read-only, for thumbnails, NASADEM relief and land-cover fractions. Each section marks what is **confirmed** (from a source or a query I ran), what is **inferred** (my reasoning) and what I **could not verify**.

Box names used below: **S1/S2** for Sweihan and **L1/L2/L3** for Liwa. Each box was placed where dunes meet roads, farms and buildings, following the scope change in `docs/PLAN.md`.

---

## Summary

| Item | **Sweihan (recommended S1)** | **Liwa (recommended L1)** |
|---|---|---|
| Box (WGS84) | **S 24.42, W 55.29, N 24.51, E 55.39** | **S 23.00, W 54.08, N 23.09, E 54.18** |
| Centroid | **24.465 N, 55.340 E** (Sweihan town, OSM node 914493080, is ≈ 0.3 km away) | **23.045 N, 54.130 E** (eastern Liwa crescent; GeoNames "Wadhīl" and "Mawşil" lie inside) |
| Size | 10.26 × 10.09 km (101 km²) | 10.45 × 10.17 km (102 km²) |
| UTM / EPSG | **UTM 40N, EPSG:32640** | **UTM 40N, EPSG:32640** (box is east of 54° E) |
| Landsat WRS-2 | **160/043**. These are the **same scenes as Seih Al Hama**: 394 of 395 path-160 scenes cover the box. | **160/044**. 395 of 395 path-160 scenes cover the box. The acquisition dates match the other two sites (same orbit). 161/044 also covers it (369 of 398), but do not mix paths. |
| HLS tile | **T40RCN** (full cover, L30 and S30) | **T40QBL** (full cover, native UTM 40). T39QZF also covers it but is in UTM 39. |
| May coverage (≤ 5 % scene cloud, 16 target years) | **16/16** (≤ 1 %: 16/16) | **15/16**: there is no L7 scene of 160/044 in May 2000 (≤ 1 %: 14/16, because 2002-05-09 has 2 %) |
| November coverage | **15/16**, missing 2002 (no L7 acquisition) | **15/16**, missing 2002 (all at ≤ 1 %) |
| Same month at all 3 sites? | **Yes for November.** All three sites have 15/16 years on the same path-160 dates. May gives 16/16/15. See §3.3. | |
| What the imagery shows | Two belts of crescentic/barchanoid transverse dunes (crest spacing about 100–200 m, my estimate from 15 m pan) north and south of an interdune corridor holding Sweihan town, farms, the E20 and E16 roads and a military compound. Plenty of stable ground. | Northern half: a field of small crescentic/dome dunes (the Al Qâfa-type small-dune sea). South-west: the foot of the 50–80 m Liwa megadunes, with sabkha flats and superimposed small dunes. Middle: the E90 crescent road and farm blocks. Plenty of stable ground. |
| Expected migration | **No published rate found.** Plausibility band: the Seih Al Hama thesis gives "3.32 m" (time base not stated). Small transverse dunes plausibly move m/yr. **Likely detectable** over 2000–2025 (inference). | **Megadunes ≈ 0.1 m/yr** (Lorenz et al., EGU2016-9369; Lorenz & Radebaugh 2015). That is **below the detection limit**. Small northern/superimposed dunes are said to move "more rapidly than the draa" (Pugh et al. 1993), but **no number was found**. Expect "megadunes: below detection limit; small dunes: possibly detectable". |
| Main risks for the method | Non-dune surface change: a new housing grid (2013→2024), a levelled rectangle north of the E16, NW road realignment (2000→2013), and an abandoned farm grid being covered by sand. All need masks. | A ~3 × 1.5 km farm block was built on dunes **between 2000-11-27 and 2013-11-07**, so the 2000→2025 baseline must mask it. Megadune motion is below the noise. Superimposed dunes may not stay coherent for 25 years. |
| Still unverified | Any measured Sweihan dune rate; in-box QA_PIXEL cloud/haze; the actual detection limit; build dates of the housing grid and the levelling | Any measured rate for Liwa small/superimposed dunes; the "~0.1 m/yr" field method (abstract only); in-box QA; the build date of the farm block within 2000–2013 |

**Alternatives** (details in §2):
- **S2, Sweihan / Noor Abu Dhabi solar plant:** S 24.50, W 55.40, N 24.59, E 55.50. **Not recommended for tracking**, because the plant was built inside the box during the study period.
- **L2, Liwa / Mezairaa:** S 23.06, W 53.74, N 23.15, E 53.84. It is centred on the Liwa town node and the main oasis, but it is **path 161 only and UTM 39**, and it has no L7 May or November scene in 2000–2002.
- **L3, Liwa north / E45 farm strip in the small-dune field:** S 23.15, W 53.745, N 23.24, E 53.845. This is the best Liwa box if the goal is measurable motion, but it has the same path-161 / UTM 39 problem and an EAD nature reserve.

**Flags (poor fit for the method):**
1. **Liwa megadunes:** at ~0.1 m/yr (two sources, both by Lorenz et al., both from field observation rather than a measurement series), 25 years gives ~2.5 m, which is ~0.17 of a 15 m pan pixel. The STAC geometric RMSE of the selected scenes alone is 3.6–8.2 m. **The method will not measure megadune motion.** The honest outcome for L1's megadune part is "below detection limit". Only the small dunes in L1's northern half have a realistic chance.
2. **Liwa outside path 160 (L2, L3):** the Landsat 7 record is broken for May and November there. 161/044 has no L7 Nov scene in 2000–2002 and no L7 May scene in 2000 or 2002. Those boxes would need June or December, breaking the common-month design. This is why I moved the recommended Liwa box east of 54° E.
3. **Sweihan S2 (solar plant):** about 7.8 km² of new panels (NS Energy, 780 ha) commissioned in 2019. The surface change has nothing to do with dunes. It is good as a "threatened asset", bad as a tracking area.

---

## 1. Where are the sites? (citable sources)

### Queries
| Source | Query | Result |
|---|---|---|
| Nominatim (`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ae&q=…`) | "Sweihan", "سويحان", "Suwayhan" | **Town node 914493080 "سويحان" at 24.4676071, 55.3393223** (`place=town`). Admin relation 13251430 "سوِيحَان" (Al Ain region), centre 24.3825881, 55.4677429. "Suwayhan" gave no result. |
| Nominatim | "Liwa", "Mezairaa", "Moreeb Dune", "Madinat Zayed", "Liwa Oasis" | **Node 1253986403 "ليوا" (`place=town`) at 23.1358335, 53.7881048** (Mezairaa area). Way 310134938 "Mezairaa Fort" at 23.1389, 53.7805. Node 655288682 "Moreeb Dune" (`natural=peak`) at 22.9804967, 53.7865873. Relation 13251500 "بَطين ليوا" (admin). "Liwa Oasis" matched only Dubai apartment buildings, so it is not useful. |
| GeoNames search (`https://www.geonames.org/search.html?q=suwayhan&country=AE`) | suwayhan | 5 hits (DMS converted to decimal by me): **Suwayḩān** PPL, ID 413256, **24.46235, 55.33715**, pop. 5,403 (https://www.geonames.org/413256/suwayhan.html). **Ramlat Suwayḩān** DUNE, ID 290699, **24.46087, 55.26387** (https://www.geonames.org/290699/ramlat-suwayhan.html). Sayḩ Suwayḩān WAD, ID 290698, 24.44981, 55.28275. Ţawī Suwayḩān WLL, ID 290697, 24.43584, 55.25248. "Tawi Suwayhan" AIRF, ID 11843068, 24.48513, 55.36536. |
| GeoNames search (`…?q=liwa&country=AE`, `q=jiwa`, `q=muzayri`, `q=hamim`) | liwa etc. | **Līwā** OAS "Liwa Oasis(-es)", ID 291602, **23.13333, 53.75000** (https://www.geonames.org/291602/liwa.html). Līwā AREA, ID 291603, 22.97478, 54.19517. Liwa ADM3, ID 12747983, 23.10124, 53.81885. **Muzayri'** PPL, ID 291279, 23.14355, 53.78810 (pop. 10,000). **Wadhīl** PPL, ID 290521, **23.04740, 54.13332**. **Mawşil** PPL, ID 291471, **23.01353, 54.15447**. Ḩamīm PPL, ID 291987, 22.95805, 54.29721. "moreeb" gave no hits. |
| Overpass (regional, 24.20–24.65 N, 55.00–55.75 E; query in §5) | power, landuse, major roads, aerodromes, places, sport | **Noor Abu Dhabi**: way 614475328, `power=plant`, `plant:source=solar`, `plant:output:electricity=1177 MW`, centre 24.5448, 55.4446. ADCOP facilities (ways 360437276/360437234, ~24.59–24.60 N, 55.40–55.41 E). "Sweihan Pumping Station" (way 494883231, 24.443, 55.358). Military landuse at 24.494–24.508 N, 55.37–55.39 E. OSM place node "Ramlat Sweihan" at 24.3612, 55.2554 (≈11 km S of the GeoNames dune point). Camel/horse tracks at 24.4865, 55.2471 and 24.2898, 55.5161. 1,784 elements, OSM base 2026-11-15T01:39:51Z. |

### Sweihan: what the place is (confirmed plus inference)
- Confirmed: Sweihan is a town at the junction of **Sweihan Road (E20, `highway=trunk`)** and **At Taf Road (E16, `highway=primary`)** (OSM names inside S1, see §2). It lies in an ENE–WSW interdune corridor. GeoNames lists a named dune body, **Ramlat Suwayḩān**, 7.5 km west of the town.
- The NASADEM hillshade of the region (`img/sweihan_region_NASADEM_hillshade.png`) shows **large ENE–WSW linear dune ridges (draa) with smooth interdune corridors**. The settlements and farm strips follow the corridors (`img/sweihan_region_HLSL30_2024-11-05.png`).
- **Large infrastructure among the dunes (confirmed in OSM and imagery):** the Noor Abu Dhabi PV plant (1,177 MW per the OSM tag; 780 ha per https://www.nsenergybusiness.com/projects/noor-abu-dhabi-solar-power-project/; "located in Sweihan" per https://en.wikipedia.org/wiki/Noor_Abu_Dhabi). Sources disagree on the start of commercial operation (Wikipedia says 30 April 2019, The National says June, and Gulf News reports an EWEC announcement in mid-2019: https://gulfnews.com/uae/worlds-largest-solar-project-with-power-enough-for-90000-people-switched-on-in-abu-dhabi-1.1561799168033), so **"2019" is the safe statement**. Also present: ADCOP pipeline facilities, a pumping station, military compounds, high-voltage lines (157 OSM `power=tower` nodes inside S1 alone) and Al Ain International Airport at the region's SE edge.

### Liwa: what the place is (confirmed)
- Liwa is a **crescent of oasis villages and farms** along the **E90 "Sheikh Theyab Bin Eissa Al Falahi Road"** (OSM). The **E45 "Sheikha Salama Bint Butti Road"** runs north from Mezairaa as a straight farm strip (`img/liwa_region_HLSL30_2024-11-04.png`).
- Stokes & Bray (2005), GSA Bulletin 117(11–12):1466–1480, https://doi.org/10.1130/B25554.1 (abstract read via OpenAlex): Liwa has *"a sharp crescentic boundary coincident with a N-S elevation drop of ∼65 m with the transverse ridges in Al Qâfa to the north, Liwa is an area of some of the world's largest megabarchan dunes."* The NASADEM hillshade shows exactly this: a fine small-dune texture north of the crescent and 1–2 km megadunes south of it (`img/liwa_region_NASADEM_hillshade.png`).
- Pugh, Glennie & Williams (1993), AAPG abstract, https://www.searchanddiscovery.com/abstracts/html/1993/intl/abstracts/1656.htm: Liwa *"comprises compound crescentic draa and subcircular inland sabkhas"*, with draa *"up to 170 m high"* (this height is from the abstract; the EGU abstract gives 50–80 m for the dunes it measured).

---

## 2. Boxes, contents and imagery

Box sizes were computed by projecting the box corners to the stated EPSG with pyproj. Overpass counts use the query in §5. Road lengths are the parts of each way clipped to the box (both carriageways of dual roads count separately). Land-cover fractions come from ESA WorldCover v200 (2021, 10 m, `ESA/WorldCover/v200` in Earth Engine). WorldCover is not NASA data and is used only to describe the boxes. Its class 60 "bare/sparse" **cannot separate active dunes from stable gravel or interdune flats**, so the dune-vs-stable split below is my visual estimate from the 15 m pan images. NDVI > 0.2 fractions come from Landsat 9/8 C2 T1_TOA (B5, B4) on the November 2024 scene named in each row.

### 2.1 Sweihan

#### S1 (recommended): Sweihan town and its two dune belts
- **Box: S 24.42, W 55.29, N 24.51, E 55.39.** Centroid **24.465 N, 55.340 E**. 10.26 × 10.09 km. **EPSG:32640.**
- **Overpass (OSM base 2026-11-15T01:41:54Z, 958 elements):**

| Feature | Count | Clipped length / area |
|---|---|---|
| highway=trunk (**Sweihan Road E20**) + trunk_link | 8 + 11 | 22.0 + 2.6 km |
| highway=primary (**At Taf Road E16**) + primary_link | 14 + 5 | 25.5 + 2.0 km |
| tertiary / unclassified / residential / service / track | 38 / 61 / 165 / 220 / 42 | 7.4 / 29.0 / 64.4 / 31.6 / 28.0 km |
| all highway ways | 574 | 218.5 km |
| building=* | 96 | – |
| landuse farmland / orchard / farmyard / forest | 3 / 3 / 1 / 4 | 3.78 / 0.91 / 0.36 / 0.94 km² |
| landuse residential / industrial / military / greenfield | 5 / 7 / 3 / 1 | 16.0 / 1.9 / 7.3 / 2.7 km² |
| natural=sand | 1 | 11.6 km² |
| power=tower / line, substation | 157 / 6, 1 | – |
| Named: town node "Sweihan", "Sweihan Pumping Station", ADNOC fuel ×2, clinic "DPSC Sweihan", school, helipad | | |

- **WorldCover:** bare/sparse 90.6 %, built-up 4.9 %, cropland 1.6 %, shrub 1.6 %, tree 1.2 %. NDVI > 0.2: 5.8 % (LC09 160/043, 2024-11-13).
- **What I saw** (`img/sweihan_S1_LandsatB8_2000-11-27.png`, `_2013-11-07.png`, `_2024-11-13.png`, 15 m pan via Earth Engine. Also HLS `img/sweihan_S1_HLSL30_2016-05-23.png`, `_2019-11-08.png`, `_2024-05-21.png`, `_2024-11-05.png`):
  - **Dunes:** two belts of **crescentic/barchanoid transverse ridges**, one N/NE of the E16 and one S/SW of the town. Crest spacing is roughly 100–200 m (my estimate from the pan thumbnails; not measured). The ridges are sharp and well separated in the November pan images, so individual ridges are trackable at 15 m. In the May HLS images (sun ≈ 69°), the dunes almost vanish.
  - **Split (visual estimate):** active dune sand ≈ 45–55 % of the box. Town, farms, roads and compounds ≈ 10–15 %. Flat interdune or gravel surfaces ≈ 35–40 %.
  - **Stable ground for co-registration: plenty.** Two major dual roads crossing at the town, the street grid, farm plots, the military compound (NE) and the flat corridor floor.
  - NASADEM (Feb 2000): elevation 143–195 m (p5–p99). The local-relief index (elevation minus the minimum in a 1 km window) has median 14 m and p95 38 m. That index includes SRTM noise; treat it as an upper bound on dune heights, not a measurement. `img/sweihan_S1_NASADEM_hillshade.png` shows the two hummocky dune belts and the smooth corridor between them.
  - **Non-dune change 2000→2024 (seen in the pan images):**
    - the E20 was realigned and dualled in the NW (already done by 2013);
    - a new **housing grid** appeared W of the junction (absent in 2013, present in 2024);
    - a large **levelled rectangle** appeared N of the E16 (2024);
    - the **farm grid in the SE corner** was active in 2000 and is faded/sand-covered in 2013 and 2024;
    - plots in the NW settlement were added.
  - **Threat geometry:** under the NW shamal assumed in the handoff (§3), the N belt sits upwind of the E16, the town and the eastern farm strip, and the S belt sits on the town's southern flank. That is the "where does the windbreak go" question exactly. This is an inference from geometry; wind is checked in Phase 2.

#### S2 (alternative, not recommended): Noor Abu Dhabi solar plant
- **Box: S 24.50, W 55.40, N 24.59, E 55.50.** Centroid 24.545 N, 55.450 E. 10.24 × 10.08 km. EPSG:32640.
- Overpass (OSM base 2026-11-15T01:47:05Z): Sweihan Road E20 4 ways / 12.5 km, unclassified 53.9 km, service 55.5 km, 287 highway ways / 173.9 km in total. 14 buildings. 12 `power=generator` (7.42 km², the PV arrays), 276 power towers, 3 substations. Orchard 10 / 3.48 km², farmland 2 / 4.23 km², farmyard 9 / 2.2 km².
- WorldCover: bare 94.0 %, built 3.1 %. NDVI > 0.2: 3.7 %.
- Imagery: `img/sweihan_S2_HLSL30_2016-05-23.png` shows **no solar field**, only a flat interdune basin. `img/sweihan_S2_HLSL30_2024-11-05.png` shows the dark panel field (~5 × 1.5 km), small transverse dunes to its N and NE, and settlement/farm strips in the NW and SE corners.
- **Why not:** the plant replaced ~7–8 km² of the surface between 2016 and 2019, so any 2000→2025 or 2016→2025 tracking there is dominated by construction. It is a very good **threat target** (sand on PV panels), but the box should only be used if the plant is masked out entirely, and then S1 has more dunes and more targets.

### 2.2 Liwa

#### Why the recommended box moved east of 54° E
The obvious Liwa box (the Mezairaa/Liwa town node at 53.79 E, L2) lies **only on WRS-2 path 161**. That path's Landsat 7 archive has **no scene in May 2000, May 2002 or any November of 2000–2002** (list in §3.2), and it is in **UTM zone 39** while the other two sites are in zone 40. Path 160's western edge reaches ≈ 53.91–53.98 E at Liwa's latitude (STAC footprints). East of that, the eastern crescent is on **path 160/044**: the same orbit and the same dates as Seih Al Hama and Sweihan, the same UTM zone, and November L7 scenes for 2000 and 2001. The eastern crescent has the same oasis-at-the-megadune-foot setting. `img/liwa_region_HLSL30_2024-11-05_annotated.png` shows path 160's swath edge (black = no path-160 data) with L1 (red), L2 (blue) and L3 (purple).

#### L1 (recommended): eastern Liwa crescent, Wadhīl / Mawşil
- **Box: S 23.00, W 54.08, N 23.09, E 54.18.** Centroid **23.045 N, 54.130 E**. 10.45 × 10.17 km. **EPSG:32640.** It contains GeoNames Wadhīl (23.04740, 54.13332) and Mawşil (23.01353, 54.15447). (An earlier test box one step west, 23.02–23.11 N × 54.02–54.12 E, contained the OSM places "Eastern Mahadir" (node 9976911328) and "Maḩḑah Al Yabbānah" (way 121650346). I moved the box east so that HLS tile T40QBL contains it fully; that test box was only 48 % inside T40QBL.)
- **Overpass (OSM base 2026-11-15T01:54:06Z, 569 elements):**

| Feature | Count | Clipped length / area |
|---|---|---|
| highway=primary (**E90 Sheikh Theyab Bin Eissa Al Falahi Road**) + links | 6 + 20 | 25.7 + 1.8 km |
| unclassified / residential / service / track | 171 / 53 / 58 / 4 | 130.7 / 13.7 / 7.3 / 2.3 km |
| all highway ways | 328 | 183.4 km |
| building=* | 135 | – |
| landuse=farmland | 18 | 14.1 km² (coarse outlines: one polygon, way 121649097, is 5.7 km² and includes sand between plots) |
| landuse=residential | 3 | 0.33 km² |
| power tower / substation | 73 / 2 | – |
| leisure=nature_reserve "Al Delfaowyah Protected Area" (way 1334678300) | 1 | 0.32 km² inside the box |

- **WorldCover:** bare 93.5 %, tree 3.1 %, shrub 1.9 %, built 0.9 %, cropland 0.5 %. NDVI > 0.2: 6.2 % (LC09 160/044, 2024-11-13). WorldCover's low cropland share suggests the date-palm plots are classed as tree or shrub (inference).
- **What I saw** (`img/liwa_L1_LandsatB8_2000-11-27.png`, `_2013-11-07.png`, `_2024-11-13.png`, HLS `img/liwa_L1_HLSL30_*.png`, `img/liwa_L1_NASADEM_hillshade.png`):
  - **NE half:** a dense field of **small crescentic/dome dunes** (spacing roughly 100–300 m by eye). Farm blocks are set into it. This is the northern small-dune sea described by Stokes & Bray (Al Qâfa type).
  - **SW third:** **megadune slopes and slip faces with flat sabkha interdunes**, carrying a fine texture of superimposed small dunes.
  - **Middle:** the E90 winds through, lined by farm plots.
  - **Split (visual estimate):** small-dune field ≈ 45 %, megadune/sabkha ≈ 30–35 %, farms/road/settlement ≈ 20 %.
  - **Stable ground: plenty.** E90, farm walls and plots (very high contrast in pan), sabkha flats (stable but low-texture).
  - NASADEM: elevation 94–170 m (p5–p99). The local-relief index has median 23 m, p95 60 m and p99 82 m, consistent with the 50–80 m megadune heights in the EGU abstract.
  - **Major non-dune change:** a **~3 × 1.5 km farm block (centre-right) and several smaller blocks were built on former dune ground between 2000-11-27 (absent) and 2013-11-07 (present)**. They are unchanged in outline to 2024. More plots were added in the north after 2013.
  - May HLS (`_2016-05-23`, `_2024-05-21`) shows almost no dune relief. November (`_2019-11-08`, `_2024-11-05`) shows the small dunes clearly.
- **HLS:** the T40QBL footprint fully contains L1 (CMR polygons, §4). It is the native UTM 40 tile, so no reprojection is needed.

#### L2 (alternative): Mezairaa / Liwa town at the megadune foot
- **Box: S 23.06, W 53.74, N 23.15, E 53.84.** Centroid 23.105 N, 53.790 E. 10.44 × 10.17 km. **EPSG:32639. Path 161/044 only. HLS T39QYF.**
- Overpass (OSM base 2026-11-15T01:50:00Z): E90 primary 24.9 km, Tal Mur'ib (Moreeb) Road 21.9 km, E45 trunk 4.1 km, 1,058 highway ways / 333 km, **541 buildings**, 3 hospitals (incl. Liwa Hospital), orchard 2.03 km², farmland 0.67 km², forest 0.49 km². Place nodes "Liwa" (1253986403), "Mezaira", "Mzeerʻah".
- WorldCover: bare 89.9 %, tree 3.9 %, shrub 3.2 %, built 2.5 %. NDVI > 0.2: 8.9 % (LC08 161/044, 2024-11-12).
- Imagery (`img/liwa_L2_HLSL30_2024-11-04.png`): the north half is the oasis town and farms, with sand in the gaps. The south half is the megadune front with superimposed dunes, crossed by Tal Moreeb Road. It is the most "Liwa" place, but its active dunes are mostly megadunes.

#### L3 (alternative): E45 farm strip through the northern small-dune field
- **Box: S 23.15, W 53.745, N 23.24, E 53.845.** Centroid 23.195 N, 53.795 E. 10.43 × 10.17 km. **EPSG:32639. Path 161/044. HLS T39QYF.**
- Overpass (OSM base 2026-11-15T01:50:57Z): **E45 trunk 20.1 km**, unclassified 142.2 km, 216 buildings. **leisure=nature_reserve "محمية الرملة الطبيعية", operator Environment Agency Abu Dhabi** (way 1334678296, 16.4 km² inside the box; the reserve extends to 23.42 N, 54.12 E).
- WorldCover: bare 86.9 %, tree 8.2 %. NDVI > 0.2: 13.6 %.
- Imagery (`img/liwa_L3_HLSL30_2024-11-04.png`): a 1 km-wide straight farm strip along the E45, surrounded on both sides by small transverse/crescentic dunes (≈ 80 % of the box). **This is the Liwa box most likely to show measurable motion**, but it has L2's path/zone problem, and the reserve may involve fencing or vegetation management (not verified).

**Liwa recommendation (inference):** **L1.** It has the crescent-at-the-megadune-foot setting the user asked for, includes the small-dune field where motion is plausible, and is the only Liwa option on path 160 / UTM 40 with the same dates as the other two sites. Choose L2 only if the app must show Liwa town itself. Choose L3 only if measurable motion matters more than the common month (and accept June or December).

---

## 3. Landsat path/row and scene candidates

**Catalogue:** USGS LandsatLook STAC `landsat-c2l1` (https://landsatlook.usgs.gov/stac-server/search). I sent POST requests with an `intersects` polygon over the whole region (Sweihan 55.05–55.65 E × 24.25–24.65 N; Liwa 53.35–54.10 E × 22.85–23.30 N), with platform LANDSAT_7 for 2000-01-01 → 2003-05-31 and LANDSAT_8/9 for 2013–2025, one request per year. Every response was complete (`numberMatched` = returned).
- Sweihan: **396** items (395 on 160/043, plus 1 L1GT T2 scene on 159/043).
- Liwa: **793** items (398 on 161/044, EPSG 32639; 395 on 160/044, EPSG 32640).

Coverage = all four box corners inside the STAC footprint polygon (shapely).

### 3.1 Sweihan, path/row 160/043 (confirmed)
- 394 of 395 path-160 scenes contain S1. The exception is `LC09_L1TP_160043_20211108_20230506_02_T1` (early L9), the same exception as at Seih Al Hama. All are `proj:epsg` 32640. S2 has the same coverage.
- **These are exactly the same scenes as the Seih Al Hama list.** The preliminary November picks are identical, and the May picks are identical after aligning the tie-breaks.

| Month | Years with scene cloud ≤ 5 % (of 16) | Missing | ≤ 1 % |
|---|---|---|---|
| Jan | 6 | 2000–02, 2013, 2016–20, 2023 | 0 |
| Feb | 8 | 2000–02, 2013, 2016, 2017, 2020, 2021 | 2 |
| Mar | 11 | 2000–02, 2013, 2016 | 8 |
| Apr | 12 | 2000, 2002, 2014, 2020 | 10 |
| **May** | **16** | none | **16** |
| Jun | 13 | 2000–02 | 12 |
| Jul | 16 | none | 14 |
| Aug | 15 | 2013 | 12 |
| Sep | 15 | 2013 | 15 |
| Oct | 12 | 2000–02, 2013 | 12 |
| **Nov** | **15** | 2002 | 12 (2015, 2016, 2023 are 1.5–2.2 %) |
| Dec | 11 | 2000–02, 2014, 2021 | 3 |

Preliminary picks for S1 are the same IDs as `aoi-verification.md` §5:
- May: `LE07_L1TP_160043_20000519_20200918_02_T1` … `LC08_L1TP_160043_20250516_20250529_02_T1`.
- Nov: `LE07_L1TP_160043_20001127_20200918_02_T1`, `…20011130…`, then L8/9 from 2013-11-07 to 2025-11-08.

They are flagged in `landsat_candidates_sweihan.csv`. Earth Engine resolves `LANDSAT/LE07/C02/T1/LE07_160043_20001127` and `LANDSAT/LC09/C02/T1/LC09_160043_20241113`, with B8 in EPSG:32640 at 15 m and metadata matching STAC (2000-11-27: cloud 1, sun el 39.30°; 2024-11-13: cloud 0.25, sun el 43.41°). This **confirms the EE ID convention** for these two scenes.

### 3.2 Liwa, path/row 160/044 for L1 (confirmed)
- 395 of 395 path-160 scenes contain L1. 369 of 398 path-161 scenes also contain it (the box is in the overlap), but **use path 160 only** so that geometry and dates are consistent. Path 160 scenes contain **neither** L2 nor L3 (2 exceptions). That is why L2/L3 are path-161-only boxes.
- **L7 on 160/044 (2000–2003-05):** 2000: Jun 04, Aug 23, Sep 08, **Nov 27**. 2001: Apr 20, **May 22**, Jul 09, Aug 26, Sep 11, **Nov 30**. 2002: **May 09**, Jul 12, Aug 13, Sep 30, Oct 16. 2003: May 28. A point query at 54.07 E, 23.065 N for Apr–Jul 2000 with no platform filter returned 16 scenes: 3 L7 (none in May) and 13 L5 TM. **There is no L7 May 2000 scene of 160/044 in the USGS archive**, even though 160/043 has 2000-05-19.

| Month (L1, path 160) | Years with scene cloud ≤ 5 % (of 16) | Missing | ≤ 1 % |
|---|---|---|---|
| Jan | 11 | 2000–02, 2013, 2017 | 9 |
| Feb | 11 | 2000–02, 2013, 2017 | 7 |
| Mar | 11 | 2000–02, 2013, 2016 | 10 |
| Apr | 14 | 2000, 2002 | 13 |
| **May** | **15** | **2000** | 14 (2002-05-09 is 2 %) |
| Jun | 14 | 2001, 2002 | 14 |
| Jul | 15 | 2000 | 15 |
| Aug | 16 | none | 16 |
| Sep | 16 | none | 16 |
| Oct | 13 | 2000, 2001, 2013 | 13 |
| **Nov** | **15** | **2002** | **15** |
| Dec | 12 | 2000–02, 2021 | 12 |

**Preliminary picks for L1** (Tier-1 L1TP, 160/044. Where possible I used the **same date as the Seih Al Hama pick**; otherwise ≤ 1 % cloud and closest to 20 May / 10 Nov. Cloud is scene-level from STAC, not in-box.)

| Year | May pick | Cloud % | Sun el / az | Nov pick | Cloud % | Sun el / az |
|---|---|---|---|---|---|---|
| 2000 | none (fallback `LE07_L1TP_160044_20000604_20200918_02_T1`, June) | – | – | `LE07_L1TP_160044_20001127_20200918_02_T1` | 0 | 40.5 / 151.7 |
| 2001 | `LE07_L1TP_160044_20010522_20200917_02_T1` | 0 | 66.5 / 91.8 | `LE07_L1TP_160044_20011130_20200917_02_T1` | 0 | 39.7 / 151.2 |
| 2002 | `LE07_L1TP_160044_20020509_20200916_02_T1` | 2 | 65.5 / 99.0 | none (no L7 Nov 2002) | – | – |
| 2013 | `LC08_L1TP_160044_20130531_20200912_02_T1` | 0.2 | 69.4 / 88.9 | `LC08_L1TP_160044_20131107_20200912_02_T1` | 0 | 46.4 / 153.2 |
| 2014–2025 | same dates as Seih Al Hama, except 2023 (2023-05-19, L9) | 0 | 68.5–69.0 | same dates as Seih Al Hama | 0–0.78 | 43.3–47.7 |

The full flags are in `landsat_candidates_liwa.csv` (`preliminary_pick_may` / `_nov`). Each row has its STAC URL, so exact IDs, cloud and sun angles are there. Earth Engine resolved `LANDSAT/LE07/C02/T1/LE07_160044_20001127` (cloud 0, sun el 40.46°), `LANDSAT/LC08/C02/T1/LC08_160044_20131107` and `LANDSAT/LC09/C02/T1/LC09_160044_20241113`, all B8 in EPSG:32640.

**L2/L3 on path 161/044 (for the record):** at ≤ 5 % scene cloud, May has 13/16 years (missing 2000–02) and November 13/16 (missing 2000–02). June has 16/16 and December 16/16 at ≤ 10 %. The L7 161/044 scenes are: 2000-02-04, 06-27, 07-13, 08-30, 10-01, 12-04; 2001-01-21, 05-13 (7 %), 06-30, 08-01, 10-04, 12-07; 2002-01-24, 06-17, 07-03, 08-20, 09-05, 12-26. **A Liwa box on path 161 cannot use May or November for the L7 baseline.**

### 3.3 Can all three sites use the same month?
- **November: yes.** Seih Al Hama 15/16, Sweihan 15/16, Liwa L1 15/16, all missing only 2002 (no L7 November 2002 acquisition on path 160). All three use **the same acquisition dates**: path 160, rows 043 and 044 are imaged in the same pass. The L7 baseline is 2000-11-27 for all three. The low sun (≈ 39–47°) gives the strong dune texture seen in the pan images.
- **May: almost.** 16/16 at Seih Al Hama and Sweihan, but 15/16 at Liwa L1 (no May 2000; the baseline would start 2001-05-22 or use the June 2000 fallback). The high sun (≈ 65–70°) flattens dune relief at all sites.
- **Recommendation (inference):** **November for all three.** It is the only month that is equally complete at all three sites, it has identical dates across sites, and it has better tracking texture. Its cost is that 2002 is missing (two L7 years, 2000 and 2001, remain) and Sweihan/Seih Al Hama have three L8 years at 1.5–2.2 % scene cloud, which need the in-box `QA_PIXEL` check.

### 3.4 Detection limit (inference; to be measured in Phase 3)
- STAC `accuracy:geometric_rmse` of the picks: L7 4.7–6.5 m; L8/9 3.6–6.2 m (May picks) and 5.2–8.2 m (Nov picks). Before stable-ground correction, a 2000→2025 pair can therefore be offset by several metres, i.e. ≈ 0.2–0.4 m/yr over 25 years.
- After stable-ground correction (with many roads and farm walls in both boxes), the residual should be smaller. The Phase 3 NMAD on stable ground is the real number.
- Rough consequences:
  - motion ≲ 0.3 m/yr is not credibly detectable over 25 years;
  - single L8/9 year pairs (Δt = 1 yr) detect only motion ≳ several m/yr.
- **Liwa megadunes (~0.1 m/yr) fall below the long-baseline limit.**

---

## 4. HLS tiles (confirmed via public CMR, no login)
Granule polygons came from `https://cmr.earthdata.nasa.gov/search/granules.umm_json?short_name=HLSL30|HLSS30&bounding_box=W,S,E,N&temporal=2024-11-01T00:00:00Z,2024-11-30T23:59:59Z` and were tested for containment of each box.

| Box | Tile(s) that fully contain it | Example granules |
|---|---|---|
| S1, S2 | **T40RCN** (L30 4, S30 6 granules in Nov 2024) | `HLS.L30.T40RCN.2024310T064610.v2.0` (2024-11-05, 0 % cloud), `HLS.S30.T40RCN.2024308T065031.v2.0` |
| L1 | **T40QBL** (L30 7, S30 12) and T39QZF. T39QYF covers only 3 %. | `HLS.L30.T40QBL.2024309T065314.v2.0`, `HLS.S30.T40QBL.2024306T065939.v2.0` |
| L2, L3 | **T39QYF** | `HLS.L30.T39QYF.2024309T065314.v2.0`, `HLS.S30.T39QYF.2024306T065939.v2.0` |

Note: CMR bounding-box search also returns T40QCM for parts of the Sweihan area, but T40QCM does **not** intersect S1. A slightly larger box (24.40 N, the earlier test) touched it.

HLS existence over time: the Worldview HLS L30 layer rendered for S1 and L1 on 2016-05-23, 2019-11-08, 2024-05-21 and 2024-11-05 (images saved), so L30 data exist from at least 2016 at both sites.

---

## 5. What is known about migration rates

| Source | Place | Statement | Status |
|---|---|---|---|
| Lorenz, Radebaugh, Barnes & Turtle, *The Slipface Awakens: Evolution of Linear dunes to Megabarchans? Examples from Liwa (UAE), Badain Jaran and Titan*, EGU General Assembly 2016, abstract EGU2016-9369. https://meetingorganizer.copernicus.org/EGU2016/EGU2016-9369.pdf | Liwa megabarchans | *"slow migration (slow, since the dunes are large – we report measurements of 50-80 m high dunes at Liwa of ~0.1 m/yr)"* | **Verified** (PDF text extracted). It is an abstract: the measurement method is not given there. |
| Lorenz & Radebaugh 2015, Planetary Dunes Workshop abstract 8003. https://www.hou.usra.edu/meetings/dunes2015/pdf/8003.pdf | Liwa | *"no estimate of the migration rate of the Liwa dunes has been published … field observation … suggests, from the overrunning of healthy date palms … that a rate of ~0.1 meter per year is about right"*; also *"a slow advance to the south"* | **Verified in `aoi-verification.md` §6** (not re-read here). So the 0.1 m/yr is a **field inference from buried palms, by the same group**, not an independent measurement series. |
| Pugh, Glennie & Williams 1993, AAPG Search and Discovery #90990. https://www.searchanddiscovery.com/abstracts/html/1993/intl/abstracts/1656.htm | Liwa draa and the northern small-dune sea | Draa *"migrating very slowly to the south-southeast"*; *"The northern fringe of smaller dunes migrates southward more rapidly than the draa."* | **Verified (abstract).** **No number given.** |
| Stokes & Bray 2005, GSA Bulletin 117:1466–1480, https://doi.org/10.1130/B25554.1 (abstract via https://api.openalex.org/works/doi:10.1130/b25554.1) | Liwa and Al Qâfa | *"Contemporary bypassing of eolian sands via superimposed dunes in both Al Qâfa and Liwa appears to be in equilibrium with the current wind regime."* The megabarchan erg was deposited *"since ca. 6 ka, over a period of just a few thousand years."* | **Verified (abstract).** It supports active **superimposed** dunes today, but gives no rate. |
| Fareaa 2025, UAEU MSc thesis (see `aoi-verification.md` §2) | Seih Al Hama, W of Al Ain | "average 3.32 m", time base not stated | Same caveat as before. The nearest local reference for Sweihan (S1's centroid is ≈ 49 km NNW of the Seih Al Hama AOI-1 centroid; arithmetic from the coordinates). |
| Saleous et al., ACRS 2013 abstract (Landsat, Al Ain and Western Region) https://a-a-r-s.org/proceeding/ACRS2013/Abstracts/SC02/Abstract_ACRS2013_Saleous.pdf | Al Ain / Western Region | A search snippet said it gives no rates | **Could not verify:** HTTP 403. |
| UAEU thesis on Abu Dhabi sand areas 1992–2013, https://scholarworks.uaeu.ac.ae/all_theses/281 | Abu Dhabi emirate | Snippet: anthropogenic acceleration, encroachment on farms and roads. Area change, not rates. | Snippet only, not read. |

**I found no published dune-migration rate for Sweihan** (searches: "Sweihan sand dunes encroachment/migration", "dune migration rate Abu Dhabi Al Ain … Sweihan", "Abu Dhabi … COSI-Corr migration"). **I also found no number for Liwa's superimposed or northern small dunes.**

### Expected result (inference, stated plainly)
- **Sweihan S1:** the dunes are small transverse/barchanoid ridges of the kind that typically move metres per year elsewhere in Arabia. That range is unverified for the UAE; the only local number is the 3.32 m of unknown time base. If they move ≥ ~0.5 m/yr, 25 years gives ≥ 12 m (≈ 0.8 pan pixel), which is detectable after stable-ground correction. **Likely a good site for the method.** By eye, I could not see displacement between the 2000, 2013 and 2024 pan thumbnails at ~10 m/px display scale. That fits rates of a few m/yr or less, but I made no measurement.
- **Liwa L1:**
  - **Megadune part:** expect **"below detection limit"**. 0.1 m/yr × 25 yr ≈ 2.5 m ≈ 0.17 pan pixel, smaller than the per-scene geometric RMSE. This is exactly what `docs/PLAN.md` anticipated, and the app should say so.
  - **Northern small-dune field and superimposed dunes:** published sources say they are active and faster, but give no rate. **Possibly detectable, unknown.**
  - Superimposed dunes on megadune flanks may form, merge and die within years, so 25-year matching may decorrelate there. Yearly L8/9 pairs (2013–2025) are the better test for them.
  - By eye, the megadune outlines in the 2000 and 2024 pan thumbnails look unchanged, as expected.

---

## 6. Things that could break the method or the comparison

| Site | Issue | Evidence | Mitigation (proposal) |
|---|---|---|---|
| Sweihan S1 | New housing grid W of the junction (2013→2024); levelled rectangle N of the E16; NW road realignment (by 2013); SE farm grid abandoned and sanding over (2000→2013) | Pan thumbnails 2000/2013/2024 | Mask built or levelled areas from a 2000-vs-2025 change mask before tracking. The SE grid is a **sand-encroachment storytelling target**, but not a tracking area. |
| Sweihan S2 | PV plant built ~2017–2019 (780 ha) | HLS 2016 vs 2024; NS Energy; OSM | Do not use for tracking, or mask the plant. |
| Sweihan | Military compounds (landuse=military 7.3 km² in S1) | OSM | No access issue for satellite data. Treat as stable ground only if visually stable. |
| Liwa L1 | Farm block on former dunes, built between 2000-11-27 and 2013-11-07; more plots after 2013 | Pan 2000/2013/2024 | Mask in the long baseline. Start the tracking mask from the 2013 farm outline. |
| Liwa L1 | Megadune motion below the noise | §3.4, §5 | Report "below detection limit" with the measured NMAD. Don't extrapolate. |
| Liwa | Path choice | §3.2 | Use 160/044 only. Don't mix in 161/044 (different view geometry and dates). |
| Liwa L2/L3 | Path 161 only, UTM 39, no L7 May/Nov; EAD nature reserve over most of L3 | §3.2; OSM way 1334678296 | Prefer L1. |
| Liwa L1 | "Al Delfaowyah Protected Area" (0.32 km² at the box edge) | OSM way 1334678300 | Minor. Check for fencing or planting. |
| Both | OSM farmland is coarse (Liwa) or sparse (Sweihan) | Overpass | Same as the first site: map plots from HLS NDVI or the pan image, and use OSM for roads. |
| Both | May images show little dune relief | HLS May snapshots | Use November (§3.3). |

---

## 7. Saved images (all in `docs/research/img/`)
- Worldview Snapshot API (`https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&TIME=<date>&BBOX=<S>,<W>,<N>,<E>&CRS=EPSG:4326&LAYERS=HLS_L30_Nadir_BRDF_Adjusted_Reflectance&FORMAT=image/png&WIDTH=1000&HEIGHT=900`). The 10 km boxes are about 3× upsampled from 30 m, so these images are **display only**.
- Earth Engine thumbnails: Landsat C2 T1 B8 (15 m), stretched to the in-box 1st–99th percentile, and the NASADEM hillshade (az 315°, el 30°, 3 × 3 median-filtered). Also display only.

| File | What I saw |
|---|---|
| `sweihan_region_HLSL30_2024-11-05.png`, `_annotated.png` | 55.05–55.65 E, 24.25–24.65 N. Red = S1, blue = S2. Circles: red = GeoNames Suwayḩān PPL, purple = Ramlat Suwayḩān dune, blue = Noor Abu Dhabi (OSM), black = GeoNames airfield. ENE-trending settlement/farm corridors between sand belts. Dark PV field. Al Ain airport at bottom-right. |
| `sweihan_region_NASADEM_hillshade.png` | Large ENE–WSW linear ridges with smooth corridors |
| `sweihan_S1_LandsatB8_2000-11-27.png`, `_2013-11-07.png`, `_2024-11-13.png` | Two belts of sharp transverse/barchanoid ridges. Town, roads and farms. Non-dune changes as listed in §2.1. |
| `sweihan_S1_HLSL30_2016-05-23.png`, `_2024-05-21.png` | May: dunes barely visible. Roads, town and farms are clear. |
| `sweihan_S1_HLSL30_2019-11-08.png`, `_2024-11-05.png` | November: ripple-like dune ridges are visible N, SE and SW |
| `sweihan_S1_NASADEM_hillshade.png` | Two hummocky dune belts and a smooth corridor (Feb 2000) |
| `sweihan_S2_HLSL30_2016-05-23.png`, `_2024-11-05.png` | No PV in 2016; PV field in 2024 |
| `liwa_region_HLSL30_2024-11-04.png`, `_annotated.png` | Path-161 view, 53.35–54.10 E. Blue = L2, purple = L3. Circles: blue = GeoNames Muzayri', black = GeoNames Līwā oasis point. Farm crescent, small dunes to the N, megabarchans to the S. |
| `liwa_region_HLSL30_2024-11-05.png`, `_annotated.png` | Path-160 view, 53.60–54.30 E. The black wedge on the left is outside the path-160 swath. Red = L1. |
| `liwa_region_NASADEM_hillshade.png` | Fine small-dune texture N of the crescent, megadunes S, the E45 embankment |
| `liwa_L1_LandsatB8_2000-11-27.png`, `_2013-11-07.png`, `_2024-11-13.png` | Small-dune field (NE), megadune slip faces and sabkha (SW), E90. The large farm block is absent in 2000 and present in 2013 and 2024. |
| `liwa_L1_HLSL30_2016-05-23.png`, `_2024-05-21.png`, `_2019-11-08.png`, `_2024-11-05.png` | May flat, November textured. The farm block is present in 2016. |
| `liwa_L1_NASADEM_hillshade.png` | Megadune scarps in the SW and S; small-dune texture elsewhere |
| `liwa_L2_HLSL30_2024-11-04.png`, `liwa_L3_HLSL30_2024-11-04.png` | L2: town and farms over the megadune front. L3: E45 farm strip in the small-dune field. |

The yellow or white specks on HLS frames are the same unexplained rendering artefacts noted for the first site. I did not interpret them. One first request (L3, 2024-11-04) returned a blank 3.5 kB PNG, and the retry returned the image.

### Worldview links (not checked for rendering; Worldview is a JavaScript app)
- S1 Nov: https://worldview.earthdata.nasa.gov/?v=55.29,24.42,55.39,24.51&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-05-T00%3A00%3A00Z
- S2 Nov: https://worldview.earthdata.nasa.gov/?v=55.40,24.50,55.50,24.59&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-05-T00%3A00%3A00Z
- L1 Nov: https://worldview.earthdata.nasa.gov/?v=54.08,23.00,54.18,23.09&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-05-T00%3A00%3A00Z
- L2 Nov: https://worldview.earthdata.nasa.gov/?v=53.74,23.06,53.84,23.15&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-04-T00%3A00%3A00Z
- L3 Nov: https://worldview.earthdata.nasa.gov/?v=53.745,23.15,53.845,23.24&l=HLS_L30_Nadir_BRDF_Adjusted_Reflectance,Coastlines_15m&t=2024-11-04-T00%3A00%3A00Z

---

## 8. Queries used

**Overpass, per box** (HTTP POST to https://overpass-api.de/api/interpreter, User-Agent `DuneSight-research/0.1 (open-source dune study)`; bbox = S,W,N,E):
```
[out:json][timeout:180];
(
  way["highway"](S,W,N,E);
  nwr["landuse"](S,W,N,E);   nwr["building"](S,W,N,E);
  nwr["natural"](S,W,N,E);   nwr["leisure"](S,W,N,E);
  nwr["sport"](S,W,N,E);     nwr["power"](S,W,N,E);
  nwr["amenity"](S,W,N,E);   nwr["place"](S,W,N,E);
  nwr["aeroway"](S,W,N,E);   nwr["man_made"](S,W,N,E);
  nwr["barrier"](S,W,N,E);
);
out tags geom;
```
**Overpass, Sweihan regional:**
```
[out:json][timeout:200];
(
  nwr["power"~"^(plant|generator)$"](24.20,55.00,24.65,55.75);
  nwr["landuse"~"^(farmland|farmyard|orchard|plant_nursery|construction|industrial|military)$"](24.20,55.00,24.65,55.75);
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](24.20,55.00,24.65,55.75);
  nwr["aeroway"="aerodrome"](24.20,55.00,24.65,55.75);
  nwr["place"](24.20,55.00,24.65,55.75);
  nwr["sport"](24.20,55.00,24.65,55.75);
  nwr["natural"~"^(sand|dune|desert)$"](24.20,55.00,24.65,55.75);
);
out tags center;
```
**STAC** (POST https://landsatlook.usgs.gov/stac-server/search):
```
{"collections":["landsat-c2l1"],"intersects":<region polygon>,"datetime":"<year range>","limit":500,
 "query":{"platform":{"in":["LANDSAT_7"]}}}   # 2000–2003-05-31; ["LANDSAT_8","LANDSAT_9"] for 2013–2025
```
**CMR:** see §4.

**Earth Engine (read-only):**
- `NASA/NASADEM_HGT/001` (hillshade; relief = elev − focalMin 500 m);
- `LANDSAT/LE07|LC08|LC09/C02/T1/<ID>` band B8 (thumbnails, metadata);
- `LANDSAT/LC0x/C02/T1_TOA/<ID>` (NDVI);
- `ESA/WorldCover/v200` (class fractions).

**Web searches:** listed in §5.

**CSV files** (same columns as `landsat_candidates.csv`, plus `proj_epsg` and per-box coverage columns):
- `landsat_candidates_sweihan.csv`: 396 rows; `covers_S1`, `covers_S2`; picks refer to S1.
- `landsat_candidates_liwa.csv`: 793 rows; `covers_L1`, `covers_L2`, `covers_L3`; picks refer to L1 on path 160.
- In both, `tier1_l1tp_pre_slc_ok` = T1 and L1TP and (not L7 or date ≤ 2003-05-31). Cloud is scene-level.

---

## Verified / inferred / not verified

**Verified (with source):**
- Sweihan town: OSM node 914493080 (24.4676071, 55.3393223) and GeoNames 413256 (24.46235, 55.33715). Ramlat Suwayḩān dune: GeoNames 290699 (24.46087, 55.26387).
- Liwa: OSM town node 1253986403 (23.1358335, 53.7881048); GeoNames Līwā oasis 291602 (23.13333, 53.75); Muzayri' 291279; Wadhīl 290521 and Mawşil 291471 (both inside L1).
- Noor Abu Dhabi solar plant in OSM (way 614475328, 1,177 MW) inside S2. It is absent in HLS 2016-05-23 and present 2024-11-05. 780 ha (NS Energy). Commercial operation in 2019 (exact month disputed between sources).
- OSM contents of every box (tables above, with OSM base timestamps).
- WRS-2: S1/S2 on 160/043 (394/395 scenes). L1 on 160/044 (395/395) and 161/044 (369/398). L2/L3 on 161/044 only. EPSG 32640 for path 160 and 32639 for path 161 (STAC `proj:epsg`, and EE B8 CRS for the scenes checked).
- Month coverage tables (STAC scene cloud). November is 15/16 at all three sites on identical dates. May is 16/16 at Sweihan and 15/16 at Liwa L1. There is no L7 160/044 scene in May 2000.
- HLS tiles: T40RCN (S1/S2), T40QBL (L1), T39QYF (L2/L3), from CMR polygons.
- From 15 m pan and HLS: dune belts and stable targets in both recommended boxes; the Liwa L1 farm block built between 2000-11-27 and 2013-11-07; the Sweihan non-dune changes listed.
- Liwa megadunes "~0.1 m/yr" (EGU2016-9369 abstract; Lorenz & Radebaugh 2015). Northern small dunes "migrate southward more rapidly than the draa" (Pugh et al. 1993, no number). Active superimposed dunes today (Stokes & Bray 2005 abstract).

**Inferred:**
- S1 and L1 are the best boxes for the stated question. November is the best common month.
- Dune crest spacing (~100–200 m at Sweihan, ~100–300 m in the Liwa small-dune field) and the area splits, from visual inspection.
- The detection limit is ≈ 0.2–0.4 m/yr before correction over 25 years (from STAC geometric RMSE). Liwa megadunes are below it. Sweihan's small dunes are likely above it.
- The NW shamal puts the dune belts upwind of the targets (to be checked against MERRA-2 in Phase 2).
- Superimposed dunes on megadunes may decorrelate over 25 years.

**Could not verify:**
- Any measured migration rate for Sweihan, or for Liwa's small or superimposed dunes.
- How the "~0.1 m/yr" was measured (only the abstracts are available).
- In-box cloud and haze per scene (`QA_PIXEL`, Phase 2).
- Exact build dates of the Sweihan housing grid and levelled area, and of the Liwa farm block within 2000–2013 (yearly L7 or L5 imagery would narrow this).
- Whether the EAD reserves (L1 edge, L3) involve fencing or planting that alters sand transport.
- The Saleous et al. ACRS 2013 abstract (HTTP 403).
- Whether the Worldview links render as described.
