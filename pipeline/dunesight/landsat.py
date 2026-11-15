"""Landsat Collection 2 Level-1 helpers for Earth Engine (needs earthengine-api).

QA_PIXEL bits (USGS Landsat Collection 2 Level-1 Data Format Control Book; same layout for
ETM+ and OLI):
    bit 0  Fill
    bit 1  Dilated cloud
    bit 2  Cirrus (high confidence)   -- OLI only; always 0 on Landsat 7 ETM+ (no cirrus band)
    bit 3  Cloud
    bit 4  Cloud shadow
    bit 5  Snow
    bit 6  Clear (no cloud and no dilated cloud)
    bit 7  Water
QA_RADSAT bit (b - 1) flags radiometric saturation of band b, so bit 7 is band 8 (panchromatic).
"""

import os

QA_BITS = {"fill": 0, "dilated_cloud": 1, "cirrus": 2, "cloud": 3, "cloud_shadow": 4, "snow": 5, "clear": 6, "water": 7}
RADSAT_B8_BIT = 7

COLLECTIONS = {
    "LANDSAT/LE07/C02/T1": "Landsat 7 ETM+",
    "LANDSAT/LC08/C02/T1": "Landsat 8 OLI",
    "LANDSAT/LC09/C02/T1": "Landsat 9 OLI-2",
}
L7_SLC_FAILURE = "2003-05-31"  # scan-line corrector failed on 31 May 2003; L7 scenes on/after this date are excluded


def ee_init(root):
    """Load .env from the repo root and initialise Earth Engine. Never prints the project id."""
    import ee
    from dotenv import load_dotenv

    load_dotenv(root / ".env")
    ee.Initialize(project=os.environ["EE_PROJECT"])
    return ee


def qa_bit(qa, name):
    return qa.rightShift(QA_BITS[name]).bitwiseAnd(1)


def scene_stats(ee, img, box, epsg, aer_point=None, aer_transform=None):
    """Server-side per-scene statistics over the box, returned as an ee.Feature (no geometry).

    Cloud fractions are over the valid (non-fill) 30 m QA pixels inside the box, in percent.
    B8 statistics are on the 15 m grid. Texture = std of (B8 TOA reflectance minus its 150 m-radius
    moving mean) divided by the mean TOA reflectance: a relative local-contrast index for tracking.
    If aer_point is given, MERRA-2 aerosol optical depth (total and dust, 550 nm) for the hour
    containing the acquisition is sampled there (the hourly mean, so a haze indicator, not a measure).
    """
    crs = f"EPSG:{epsg}"
    qa = img.select("QA_PIXEL")
    valid = qa_bit(qa, "fill").Not()
    flags = ee.Image.cat([
        qa_bit(qa, "cloud"), qa_bit(qa, "dilated_cloud"), qa_bit(qa, "cirrus"), qa_bit(qa, "cloud_shadow"),
        qa_bit(qa, "cloud").Or(qa_bit(qa, "dilated_cloud")).Or(qa_bit(qa, "cirrus")).Or(qa_bit(qa, "cloud_shadow")),
    ]).rename(["cloud", "dilated", "cirrus", "shadow", "any"]).updateMask(valid)
    pct = flags.reduceRegion(ee.Reducer.mean(), box, scale=30, crs=crs, maxPixels=1e8)
    n_qa = valid.selfMask().reduceRegion(ee.Reducer.count(), box, scale=30, crs=crs, maxPixels=1e8).values().get(0)
    n_box30 = ee.Image.constant(1).reduceRegion(ee.Reducer.count(), box, scale=30, crs=crs, maxPixels=1e8).values().get(0)

    b8 = img.select("B8")
    b8_valid = b8.gt(0)
    n_b8 = b8_valid.selfMask().reduceRegion(ee.Reducer.count(), box, scale=15, crs=crs, maxPixels=1e8).values().get(0)
    n_box15 = ee.Image.constant(1).reduceRegion(ee.Reducer.count(), box, scale=15, crs=crs, maxPixels=1e8).values().get(0)
    b8s = b8.updateMask(b8_valid).reduceRegion(
        ee.Reducer.minMax().combine(ee.Reducer.percentile([2, 98]), sharedInputs=True).combine(ee.Reducer.mean(), sharedInputs=True),
        box, scale=15, crs=crs, maxPixels=1e8)
    sat = img.select("QA_RADSAT").rightShift(RADSAT_B8_BIT).bitwiseAnd(1).reduceRegion(
        ee.Reducer.mean(), box, scale=30, crs=crs, maxPixels=1e8).values().get(0)

    toa = b8.updateMask(b8_valid).toFloat().multiply(ee.Number(img.get("REFLECTANCE_MULT_BAND_8"))).add(
        ee.Number(img.get("REFLECTANCE_ADD_BAND_8")))
    hp = toa.subtract(toa.focalMean(150, "circle", "meters"))
    hp_sd = hp.reduceRegion(ee.Reducer.stdDev(), box, scale=15, crs=crs, maxPixels=1e8).values().get(0)
    toa_mean = toa.reduceRegion(ee.Reducer.mean(), box, scale=15, crs=crs, maxPixels=1e8).values().get(0)

    # Raw values only (nulls survive as missing properties); percentages are derived client-side in derive().
    props = {
        "scene_id": img.get("LANDSAT_PRODUCT_ID"),
        "ee_id": img.get("system:index"),
        "date": img.get("DATE_ACQUIRED"),
        "time_start": img.get("system:time_start"),
        "spacecraft": img.get("SPACECRAFT_ID"),
        "sun_elevation": img.get("SUN_ELEVATION"),
        "sun_azimuth": img.get("SUN_AZIMUTH"),
        "cloud_cover_scene": img.get("CLOUD_COVER"),
        "cloud_cover_land": img.get("CLOUD_COVER_LAND"),
        "footprint_contains_box": img.geometry().contains(box, 10),
        "n_qa_valid": n_qa, "n_box30": n_box30, "n_b8_valid": n_b8, "n_box15": n_box15,
        "frac_cloud": pct.get("cloud"), "frac_dilated": pct.get("dilated"), "frac_cirrus": pct.get("cirrus"),
        "frac_shadow": pct.get("shadow"), "frac_any": pct.get("any"),
        "b8_min": b8s.get("B8_min"), "b8_max": b8s.get("B8_max"), "b8_mean": b8s.get("B8_mean"),
        "b8_p2": b8s.get("B8_p2"), "b8_p98": b8s.get("B8_p98"),
        "frac_b8_saturated": sat, "hp_sd": hp_sd, "b8_toa_mean": toa_mean,
    }
    if aer_point is not None:
        t = ee.Number(img.get("system:time_start"))
        hour = ee.Date(t.divide(3600000).floor().multiply(3600000))
        # a fully masked fallback keeps the band names when the hour is missing from the asset (-> null)
        empty = ee.Image.constant([0, 0]).rename(["TOTEXTTAU", "DUEXTTAU"]).toFloat().updateMask(0)
        aer = ee.ImageCollection([empty]).merge(
            ee.ImageCollection("NASA/GSFC/MERRA/aer/2").filterDate(hour, hour.advance(1, "hour"))
            .select(["TOTEXTTAU", "DUEXTTAU"])).mosaic()
        a = aer.select(["TOTEXTTAU", "DUEXTTAU"]).reduceRegion(
            ee.Reducer.first(), aer_point, crs="EPSG:4326", crsTransform=aer_transform)
        props["merra2_aod550_total"] = a.get("TOTEXTTAU")
        props["merra2_aod550_dust"] = a.get("DUEXTTAU")
    return ee.Feature(None, props)


def derive(df):
    """Client-side derived columns (pandas DataFrame of scene_stats properties): percentages, valid fractions
    and the texture index. Missing values (scene does not reach the box) stay NaN."""
    df = df.copy()
    for k in ["n_qa_valid", "n_box30", "n_b8_valid", "n_box15", "frac_cloud", "frac_dilated", "frac_cirrus", "frac_shadow",
              "frac_any", "frac_b8_saturated", "hp_sd", "b8_toa_mean", "b8_min", "b8_max", "b8_mean", "b8_p2", "b8_p98"]:
        if k not in df:
            df[k] = float("nan")
        df[k] = df[k].astype(float)
    df["qa_valid_frac"] = df.n_qa_valid / df.n_box30
    df["b8_valid_frac"] = df.n_b8_valid / df.n_box15
    for a, b in [("pct_cloud", "frac_cloud"), ("pct_dilated_cloud", "frac_dilated"), ("pct_cirrus", "frac_cirrus"),
                 ("pct_cloud_shadow", "frac_shadow"), ("pct_any_cloud_shadow", "frac_any"), ("b8_saturated_pct", "frac_b8_saturated")]:
        df[a] = df[b] * 100.0
    df["b8_texture"] = df.hp_sd / df.b8_toa_mean
    return df
