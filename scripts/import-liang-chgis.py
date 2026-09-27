#!/usr/bin/env python3
"""Read the user's nested CHGIS download without GIS packages or extracting it.

Only WGS84 V6 geometry is read. V4 supplement uses its explicit geographic
DBF coordinate attributes, never its projected SHP coordinates.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PLOT = (650, 390, 4490, 3690)
EXTENT = (93.5, 18, 128.5, 44)


def dbf_records(raw):
    count, header, size = struct.unpack_from('<IHH', raw, 4)
    fields = []
    for offset in range(32, header - 1, 32):
        if raw[offset] == 13:
            break
        fields.append((raw[offset:offset+11].split(b'\0')[0].decode(), raw[offset+16]))
    for index in range(count):
        row = raw[header+index*size:header+(index+1)*size]
        if row[:1] == b'*':
            yield None
            continue
        cursor, result = 1, {}
        for name, length in fields:
            # Some source DBF fields end mid-codepoint at the byte-width limit.
            result[name] = row[cursor:cursor+length].decode('utf-8',errors='replace').strip()
            cursor += length
        yield result


def shp_records(raw):
    cursor = 100
    while cursor < len(raw):
        size = struct.unpack_from('>i', raw, cursor+4)[0] * 2
        yield raw[cursor+8:cursor+8+size]
        cursor += 8 + size


def xy(lon, lat):
    return (round(650+(lon-93.5)/35*3840, 1), round(390+(44-lat)/26*3300, 1))


def polygon(raw):
    if struct.unpack_from('<i', raw)[0] != 5:
        raise ValueError('Expected Polygon shape')
    parts, count = struct.unpack_from('<ii', raw, 36)
    starts = list(struct.unpack_from(f'<{parts}i', raw, 44)) + [count]
    coords = [struct.unpack_from('<dd', raw, 44+parts*4+i*16) for i in range(count)]
    rings = [coords[starts[i]:starts[i+1]] for i in range(parts)]
    path = ''.join('M'+'L'.join(f'{x:g},{y:g}' for x,y in map(lambda p: xy(*p), ring))+'Z' for ring in rings if len(ring)>2)
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=Path.home()/'Downloads'/'CHGIS数据.zip')
    args = parser.parse_args()
    data = dict(version=1, dynasty='southern-liang', years=[502,557], width=4800,
                height=4128, plot=PLOT, extent=EXTENT,
                base='assets/maps/chen-terrain-base-web.webp?v=20260811',
                stateSeats=[], prefSeats=[], countySeats=[], prefAreas=[], sources=[])
    packages = [
        ('dataverse_files-v6.zip','v6_time_cnty_pts_utf_wgs84.zip','countySeats','county','CHGIS V6'),
        ('dataverse_files (2)-v6.zip','v6_time_pref_pts_utf_wgs84.zip','prefSeats',None,'CHGIS V6'),
        ('dataverse_files (1)-v6.zip','v6_time_pref_pgn_utf_wgs84.zip','prefAreas','prefecture','CHGIS V6'),
        ('v4_time_prov_pts_utf.zip',None,'stateSeats','state','CHGIS V4'),
    ]
    with zipfile.ZipFile(args.archive) as outer:
        for name, nested, array, level, version in packages:
            package = outer.read('CHGIS数据/'+name)
            archive = zipfile.ZipFile(io.BytesIO(package))
            if nested:
                package = archive.read(nested)
                archive = zipfile.ZipFile(io.BytesIO(package))
            names = [n for n in archive.namelist() if not n.startswith('__MACOSX')]
            dbf = next(n for n in names if n.endswith('.dbf'))
            prj = archive.read(next(n for n in names if n.endswith('.prj'))).decode().strip()
            if version == 'CHGIS V6' and 'WGS_1984' not in prj:
                raise ValueError('V6 import requires WGS84 geometry')
            raw = archive.read(dbf)
            shapes = list(shp_records(archive.read(next(n for n in names if n.endswith('.shp'))))) if array=='prefAreas' else []
            source_id = f'chgis-{len(data["sources"])+1}'
            source = dict(id=source_id, archive=name, member=nested, dbf=dbf,
                          sha256=hashlib.sha256(package).hexdigest(), dbf_sha256=hashlib.sha256(raw).hexdigest(),
                          version=version, projection=prj, coordinate_basis='WGS84 SHP/DBF' if nested else 'DBF X_COORD/Y_COORD geographic attributes; projected SHP not used',
                          imported=0)
            for index, row in enumerate(dbf_records(raw)):
                if not row:
                    continue
                begin,end = int(float(row['BEG_YR'])),int(float(row['END_YR']))
                if begin>557 or end<502:
                    continue
                if array=='prefAreas' and row['TYPE_CH'] not in ('郡','侨郡','尹','国'):
                    continue
                lon,lat = float(row.get('X_COOR',row.get('X_COORD'))),float(row.get('Y_COOR',row.get('Y_COORD')))
                if shapes:
                    west,south,east,north = struct.unpack_from('<4d',shapes[index],4)
                    lon,lat = (west+east)/2,(south+north)/2
                if not (93.5<=lon<=128.5 and 18<=lat<=44):
                    continue
                record_level = level or ('state' if row['TYPE_CH']=='州' else 'prefecture')
                if not level and row['TYPE_CH'] not in ('州','郡','侨郡','尹','国'):
                    continue
                x,y = xy(lon,lat)
                record = dict(i=row['SYS_ID'], n=row['NAME_FT'] or row['NAME_CH'], aliases=[row['NAME_CH']],
                              t=row['TYPE_CH'], b=begin,e=end,l=record_level,x=x,y=y,lon=lon,lat=lat,s=version,
                              source_id=source_id, dbf_row=index+1, begin_rule=row['BEG_RULE'],end_rule=row['END_RULE'],
                              note_id=row['NOTE_ID'],geo_source=row['GEO_SRC'],present_location=row.get('PRES_LOC',row.get('PERS_LOC','')),
                              truncated_utf8_fields=[k for k,v in row.items() if '\ufffd' in v])
                if shapes:
                    record['d'] = polygon(shapes[index])
                target = 'stateSeats' if array=='prefSeats' and record_level=='state' else array
                data[target].append(record)
                source['imported'] += 1
            data['sources'].append(source)
    data['limitations'] = [
        'CHGIS start/end years and BEG_RULE/END_RULE are preserved; a match is a geographic reference, not new evidence for Liang administration.',
        'Region rectangles constrain name matching only; they are not historical boundaries. Multiple surviving candidates remain unlocated.',
        'No Liang political territory reconstructed. V4 geographic attributes may have datum offsets; no claim of survey accuracy.',
        'Source reference maps at 534/555 are separate from annual layers.'
    ]
    text = json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (ROOT/'data/liang-map-dynamic.js').write_text('/* Generated by scripts/import-liang-chgis.py */\nwindow.LIANG_DYNAMIC_MAP = '+text+';\n')
    (ROOT/'reports/liang-chgis-inventory.json').write_text(json.dumps({
        'archive':str(args.archive),'archive_bytes':args.archive.stat().st_size,
        'sources':data['sources'],'counts':{k:len(data[k]) for k in ('stateSeats','prefSeats','countySeats','prefAreas')},
        'limitations':data['limitations']},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:len(data[k]) for k in ('stateSeats','prefSeats','countySeats','prefAreas')}))


if __name__ == '__main__':
    main()
