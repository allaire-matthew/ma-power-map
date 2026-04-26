#!/usr/bin/env bash
# Build the five MA GeoJSON layers + town population join.
# Idempotent: re-running skips downloads it already has.
#
# Sources:
#   Census TIGER 2024 (counties, county subdivisions, CD119, SLDL, SLDU)
#   Census 2020 Decennial DHC API (P1_001N total population by county subdivision)
#
# Outputs to public/geo/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$ROOT/scripts/.tmp"
OUT="$ROOT/public/geo"
mkdir -p "$TMP" "$OUT"

TIGER="https://www2.census.gov/geo/tiger/TIGER2024"
MS="npx --yes mapshaper"

# ---- download helpers --------------------------------------------------------
fetch() {
  local url="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    echo "  cached $(basename "$dest")"
  else
    echo "  download $(basename "$dest")"
    curl -fsSL "$url" -o "$dest"
  fi
}

unzip_to() {
  local zip="$1" dir="$2"
  if [[ -d "$dir" && -n "$(ls -A "$dir" 2>/dev/null)" ]]; then
    echo "  unzipped $(basename "$dir")"
  else
    mkdir -p "$dir"
    unzip -oq "$zip" -d "$dir"
  fi
}

# ---- 1. download all sources -------------------------------------------------
echo "==> downloading TIGER 2024 sources"
fetch "$TIGER/COUNTY/tl_2024_us_county.zip"     "$TMP/county.zip"
fetch "$TIGER/COUSUB/tl_2024_25_cousub.zip"     "$TMP/cousub.zip"
fetch "$TIGER/CD/tl_2024_25_cd119.zip"          "$TMP/cd119.zip"
fetch "$TIGER/SLDL/tl_2024_25_sldl.zip"         "$TMP/sldl.zip"
fetch "$TIGER/SLDU/tl_2024_25_sldu.zip"         "$TMP/sldu.zip"
fetch "$TIGER/UNSD/tl_2024_25_unsd.zip"         "$TMP/unsd.zip"
fetch "$TIGER/ELSD/tl_2024_25_elsd.zip"         "$TMP/elsd.zip"
fetch "$TIGER/SCSD/tl_2024_25_scsd.zip"         "$TMP/scsd.zip"

unzip_to "$TMP/county.zip" "$TMP/county"
unzip_to "$TMP/cousub.zip" "$TMP/cousub"
unzip_to "$TMP/cd119.zip"  "$TMP/cd119"
unzip_to "$TMP/sldl.zip"   "$TMP/sldl"
unzip_to "$TMP/sldu.zip"   "$TMP/sldu"
unzip_to "$TMP/unsd.zip"   "$TMP/unsd"
unzip_to "$TMP/elsd.zip"   "$TMP/elsd"
unzip_to "$TMP/scsd.zip"   "$TMP/scsd"

# ---- 2. fetch population (Census 2020 DHC, by county subdivision) -----------
POP_JSON="$TMP/pop.json"
POP_CSV="$TMP/pop.csv"
if [[ -f "$POP_CSV" ]]; then
  echo "==> population csv cached"
else
  echo "==> fetching 2020 population by MA county subdivision"
  curl -fsSL 'https://api.census.gov/data/2020/dec/dhc?get=NAME,P1_001N&for=county%20subdivision:*&in=state:25' -o "$POP_JSON"
  # Convert [[hdr],[row],...] JSON to CSV with GEOID,population columns.
  # GEOID = state + county + cousub (2+3+5 = 10 digits).
  node -e '
    const rows = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const [hdr, ...data] = rows;
    const I = (k) => hdr.indexOf(k);
    const out = ["GEOID,population"];
    for (const r of data) {
      const geoid = r[I("state")] + r[I("county")] + r[I("county subdivision")];
      out.push(geoid + "," + r[I("P1_001N")]);
    }
    require("fs").writeFileSync(process.argv[2], out.join("\n"));
  ' "$POP_JSON" "$POP_CSV"
fi

# ---- 3. counties (filter national to MA, simplify) --------------------------
echo "==> building ma-counties.geojson"
$MS \
  -i "$TMP/county/tl_2024_us_county.shp" \
  -filter 'STATEFP=="25"' \
  -simplify 8% keep-shapes \
  -filter-fields STATEFP,COUNTYFP,GEOID,NAME \
  -rename-fields name=NAME \
  -o format=geojson precision=0.0001 "$OUT/ma-counties.geojson"

# ---- 4. towns (already MA-only; filter water/non-MCD; join population) -----
echo "==> building ma-towns.geojson with population"
$MS \
  -i "$TMP/cousub/tl_2024_25_cousub.shp" \
  -filter 'ALAND > 0' \
  -simplify 3% keep-shapes \
  -filter-fields STATEFP,COUNTYFP,COUSUBFP,GEOID,NAME,NAMELSAD \
  -join "$POP_CSV" keys=GEOID,GEOID field-types=GEOID:str,population:num \
  -rename-fields name=NAME,fullName=NAMELSAD \
  -o format=geojson precision=0.0001 "$OUT/ma-towns.geojson"

# Patch the 4 "Town city" places where TIGER COUSUB code != DHC COUSUB code
# (Methuen, Watertown, Easthampton, Amesbury) by name-based fallback.
node -e '
  const fs = require("fs");
  const pop = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const [hdr, ...rows] = pop;
  const I = (k) => hdr.indexOf(k);
  // Build name -> population, stripping " Town city" / " city" / " town" suffixes.
  const norm = (s) => s.replace(/,.*/, "").replace(/\s+(Town\s+)?(city|town|CDP)$/i, "").trim();
  const byName = new Map();
  for (const r of rows) byName.set(norm(r[I("NAME")]), Number(r[I("P1_001N")]));
  const towns = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  let patched = 0;
  for (const f of towns.features) {
    if (f.properties.population == null) {
      const p = byName.get(f.properties.name);
      if (p != null) { f.properties.population = p; patched++; }
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(towns));
  console.log("[patch] filled population for", patched, "towns by name fallback");
' "$POP_JSON" "$OUT/ma-towns.geojson"

# ---- 5. congressional districts ---------------------------------------------
echo "==> building ma-congressional.geojson"
$MS \
  -i "$TMP/cd119/tl_2024_25_cd119.shp" \
  -simplify 8% keep-shapes \
  -filter-fields STATEFP,CD119FP,GEOID,NAMELSAD \
  -rename-fields name=NAMELSAD \
  -o format=geojson precision=0.0001 "$OUT/ma-congressional.geojson"

# ---- 6. state house ---------------------------------------------------------
echo "==> building ma-state-house.geojson"
$MS \
  -i "$TMP/sldl/tl_2024_25_sldl.shp" \
  -simplify 6% keep-shapes \
  -filter-fields STATEFP,SLDLST,GEOID,NAMELSAD \
  -rename-fields name=NAMELSAD \
  -o format=geojson precision=0.0001 "$OUT/ma-state-house.geojson"

# ---- 7. state senate --------------------------------------------------------
echo "==> building ma-state-senate.geojson"
$MS \
  -i "$TMP/sldu/tl_2024_25_sldu.shp" \
  -simplify 6% keep-shapes \
  -filter-fields STATEFP,SLDUST,GEOID,NAMELSAD \
  -rename-fields name=NAMELSAD \
  -o format=geojson precision=0.0001 "$OUT/ma-state-senate.geojson"

# ---- 8. school districts (UNSD + ELSD + SCSD merged) ------------------------
# MA uses unified regional districts (UNSD) for most regions plus stand-alone
# elementary (ELSD) and secondary (SCSD) districts elsewhere. Combine all three
# into one layer with a `kind` label (Unified / Elementary / Secondary).
echo "==> building ma-school-districts.geojson"
$MS \
  -i "$TMP/unsd/tl_2024_25_unsd.shp" name=u \
  -filter-fields target=u GEOID,NAME -each 'this.properties.kind="Unified"' target=u \
  -i "$TMP/elsd/tl_2024_25_elsd.shp" name=e \
  -filter-fields target=e GEOID,NAME -each 'this.properties.kind="Elementary"' target=e \
  -i "$TMP/scsd/tl_2024_25_scsd.shp" name=s \
  -filter-fields target=s GEOID,NAME -each 'this.properties.kind="Secondary"' target=s \
  -merge-layers target=u,e,s force \
  -rename-fields name=NAME \
  -simplify 5% keep-shapes \
  -o format=geojson precision=0.0001 "$OUT/ma-school-districts.geojson"

echo
echo "==> done. file sizes:"
ls -lh "$OUT" | awk 'NR>1 {print "   "$9" "$5}'
