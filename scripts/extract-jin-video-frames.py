#!/usr/bin/env python3
"""Extract year-end map frames from the user's local ShiTuGuan videos.

Uses FFmpeg to retain the 1920x1080 source pixels. Coarse year OCR runs through
macOS Vision locally; the final transition is found by matching the fixed year
label at native frame rate, not by treating video timestamps as calendar years.
No network upload occurs. Original recordings are never changed.
"""
from __future__ import annotations
import argparse, hashlib, io, json, math, re, subprocess
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = Path('/Users/yujiangnan/Downloads/Bilibili/中国历代疆域变化第十五版_6-5至7-9_无声')
DEFAULT_FFMPEG = '/private/tmp/codex-bilibili-media-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
DEFAULT_OCR = '/private/tmp/jin-video-year-ocr'
CROP = (1520, 0, 1860, 54)
PARTS = ['6-5', '6-6', '7-1', '7-2', '7-3']


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def year_mask(image):
    # All videos use the same font and fixed upper-right calendar strip.
    # Threshold excludes the water/background and keeps the black calendar text.
    return np.asarray(image.convert('L')) < 100


def parse_ocr(path):
    records = []
    for line in Path(path).read_text().splitlines():
        row = json.loads(line)
        text = ' '.join(x['text'] for x in row.get('ocr', []))
        # Vision often reads 年 as a trailing 7. Do not require a word boundary.
        match = re.search(r'(2[3-9]\d|3[0-9]\d)', text)
        sample_path = Path(row['path'])
        part = sample_path.name[:3]
        index = int(sample_path.stem.rsplit('-', 1)[-1])
        records.append(dict(part=part, sample=str(sample_path),
                            nominal_seconds=(index - 1) * 2,
                            year=int(match.group()) if match else None,
                            ocr_text=text, ocr_confidence=[x['confidence'] for x in row.get('ocr', [])]))
    return records


def video_info(ffmpeg, video):
    result = subprocess.run([ffmpeg, '-hide_banner', '-i', str(video)], capture_output=True, text=True)
    text = result.stderr
    m = re.search(r'Duration: (\d+):(\d+):(\d+(?:\.\d+)?)', text)
    duration = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
    f = re.search(r'(\d+(?:\.\d+)?) fps', text)
    fps = float(f[1])
    tb = re.search(r'([0-9.]+)([kM]?) tbn', text)
    denominator = int(float(tb[1]) * {'':1, 'k':1000, 'M':1000000}[tb[2]])
    return dict(duration_seconds=duration, fps=fps, source_time_base=f'1/{denominator}', width=1920, height=1080,
                sha256=hashlib.file_digest(open(video, 'rb'), 'sha256').hexdigest())


def png_at(ffmpeg, video, seconds, crop=False, return_metadata=False):
    args = [ffmpeg, '-hide_banner', '-loglevel', 'info' if return_metadata else 'error',
            '-ss', f'{max(0, seconds-0.0006):.8f}']
    if return_metadata: args += ['-copyts']
    args += ['-i', str(video)]
    if crop:
        args += ['-vf', 'crop=340:55:1520:0']
    elif return_metadata:
        args += ['-vf', 'showinfo']
    args += ['-frames:v', '1', '-fps_mode', 'passthrough', '-f', 'image2pipe', '-c:v', 'png', '-']
    result = run(args, capture_output=True)
    if return_metadata:
        match = re.search(rb'n:\s*0\s+pts:\s*(-?\d+)\s+pts_time:([0-9.]+)', result.stderr)
        if not match: raise RuntimeError('Could not read original video PTS')
        return result.stdout, int(match[1]), float(match[2])
    return result.stdout


def mask_at(ffmpeg, video, index, fps):
    return year_mask(Image.open(io.BytesIO(png_at(ffmpeg, video, index / fps, crop=True))))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--ffmpeg', default=DEFAULT_FFMPEG)
    ap.add_argument('--video-dir', type=Path, default=VIDEO_DIR)
    ap.add_argument('--work-dir', type=Path, default=ROOT / 'work/jin-video')
    ap.add_argument('--ocr', default=DEFAULT_OCR)
    ap.add_argument('--reuse-ocr', action='store_true')
    ap.add_argument('--years', nargs='*', type=int, default=list(range(266, 317)))
    args = ap.parse_args()
    args.work_dir = args.work_dir.resolve()
    args.work_dir.mkdir(parents=True, exist_ok=True)
    samples = args.work_dir / 'samples'; samples.mkdir(exist_ok=True)
    frames = args.work_dir / 'frames'; frames.mkdir(exist_ok=True)
    videos = {p: next(args.video_dir.glob(p + ' *.mp4')) for p in PARTS}
    infos = {p: video_info(args.ffmpeg, v) for p, v in videos.items()}
    ocr_path = args.work_dir / 'year-ocr.jsonl'
    if not args.reuse_ocr:
        for part, video in videos.items():
            run([args.ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', str(video),
                 '-vf', 'fps=1/2,crop=340:55:1520:0', str(samples / (part + '-year-%04d.png')), '-y'])
        paths = sorted(samples.glob('*-year-*.png'))
        with ocr_path.open('w') as output:
            run([args.ocr, *map(str, paths)], stdout=output)
    records = parse_ocr(ocr_path)
    # Original OCR paths may be relative; resolve them from the repository.
    for row in records:
        row['sample'] = str((ROOT / row['sample']).resolve()) if not Path(row['sample']).is_absolute() else row['sample']
    templates = {}
    for row in records:
        if row['year'] is not None:
            templates[row['year']] = year_mask(Image.open(row['sample']))
    # The fps filter samples near the end of each two-second bin. A lone
    # short-year sample can already be in the calendar crossfade. Use a native
    # frame at the latest bin's *start* as the clean year template instead.
    for year in args.years:
        candidates = [r for r in records if r['year'] == year]
        if candidates:
            latest = max(candidates, key=lambda r: (PARTS.index(r['part']), r['nominal_seconds']))
            templates[year] = year_mask(Image.open(io.BytesIO(png_at(args.ffmpeg, videos[latest['part']], latest['nominal_seconds'], crop=True))))
    template_years = list(templates)
    stack = np.stack([templates[y] for y in template_years])
    def label(mask):
        distances = np.mean(stack != mask, axis=(1, 2))
        index = int(np.argmin(distances))
        return (template_years[index] if distances[index] < .035 else None, float(distances[index]))
    extraction = []
    missing = []
    for year in args.years:
        candidates = [r for r in records if r['year'] == year]
        if not candidates:
            missing.append(year); continue
        # If the same year occurs in two episodes, use the later episode.
        latest_part = max(candidates, key=lambda r: PARTS.index(r['part']))['part']
        latest = max((r for r in candidates if r['part'] == latest_part), key=lambda r: r['nominal_seconds'])
        part = latest_part; video = videos[part]; fps = infos[part]['fps']
        following = next((r for r in records if r['part'] == part and r['nominal_seconds'] > latest['nominal_seconds'] and r['year'] != year), None)
        lo = max(0, int(latest['nominal_seconds'] * fps))
        hi = min(int(infos[part]['duration_seconds'] * fps) - 1,
                 int(((following['nominal_seconds'] if following else latest['nominal_seconds'] + 4) + 2) * fps))
        lo_label, lo_distance = label(mask_at(args.ffmpeg, video, lo, fps))
        hi_label, hi_distance = label(mask_at(args.ffmpeg, video, hi, fps))
        if lo_label != year:
            for offset in range(1, int(fps * 2) + 1):
                candidate_year, _ = label(mask_at(args.ffmpeg, video, lo + offset, fps))
                if candidate_year == year:
                    lo += offset
                    break
            else:
                raise RuntimeError(f'{year}: lower bracket did not show target year ({lo_label})')
        if hi_label == year:
            raise RuntimeError(f'{year}: upper bracket still shows target year')
        known_good = lo
        while hi - lo > 1:
            mid = (hi + lo) // 2
            y, distance = label(mask_at(args.ffmpeg, video, mid, fps))
            if y == year: lo = mid
            else: hi = mid
        recognizable_end = lo
        # The episodes crossfade their calendar labels. Nearest-year matching
        # remains readable halfway through that fade, but is not a complete map
        # frame. Find the last unchanged calendar strip before the fade starts.
        calendar_ref_index = max(known_good, lo - int(fps * .6))
        calendar_ref = np.asarray(Image.open(io.BytesIO(png_at(args.ffmpeg, video, calendar_ref_index / fps, crop=True))).convert('RGB')).astype(np.int16)
        calendar_core = np.mean(calendar_ref, axis=2) < 50
        calendar_core[:, :110] = False
        calendar_core[:, 220:] = False
        def calendar_diff(index):
            current = np.asarray(Image.open(io.BytesIO(png_at(args.ffmpeg, video, index / fps, crop=True))).convert('RGB')).astype(np.int16)
            delta = np.abs(current - calendar_ref)
            core_change = float(np.mean(delta[calendar_core]))
            # Newly fading-in digits can change pixels outside the old ink.
            foreground_change = float(np.mean(delta[:, 110:220])) * 4
            return max(core_change, foreground_change)
        if calendar_diff(lo) > .10:
            a, b = calendar_ref_index, lo
            while b - a > 1:
                mid = (a + b) // 2
                if calendar_diff(mid) <= .10: a = mid
                else: b = mid
            lo = a
        # Match against an earlier completed event frame. If an outro fades the
        # whole map, keep the final unchanged frame before the fade begins.
        before = Image.open(io.BytesIO(png_at(args.ffmpeg, video, max(0, lo / fps - 1.0)))).convert('RGB')
        candidate_png = png_at(args.ffmpeg, video, lo / fps)
        candidate = Image.open(io.BytesIO(candidate_png)).convert('RGB')
        left_before = np.asarray(before)[:, :1500].astype(np.int16)
        left_candidate = np.asarray(candidate)[:, :1500].astype(np.int16)
        difference = float(np.mean(np.abs(left_before - left_candidate)))
        stable_index = lo
        if difference > 3:
            # This path applies to closing title fades. Search backwards for the
            # last fully visible frame by matching the stable map one second ago.
            stable_lo = max(0, lo - int(fps * 2))
            reference = np.asarray(Image.open(io.BytesIO(png_at(args.ffmpeg, video, stable_lo / fps))).convert('RGB'))[:, :1500].astype(np.int16)
            a, b = stable_lo, lo
            while b - a > 1:
                mid = (a + b) // 2
                im = np.asarray(Image.open(io.BytesIO(png_at(args.ffmpeg, video, mid / fps))).convert('RGB'))[:, :1500].astype(np.int16)
                if float(np.mean(np.abs(im - reference))) <= 2: a = mid
                else: b = mid
            stable_index = a
            candidate_png = png_at(args.ffmpeg, video, stable_index / fps)
        candidate_png, source_pts, source_pts_time = png_at(args.ffmpeg, video, stable_index / fps, return_metadata=True)
        path = frames / f'{year}.png'
        path.write_bytes(candidate_png)
        jpeg_path = frames / f'{year}.jpg'
        Image.open(io.BytesIO(candidate_png)).convert('RGB').save(jpeg_path, quality=92, optimize=True, subsampling=0)
        chosen_year, chosen_distance = label(year_mask(Image.open(path).crop(CROP)))
        if chosen_year != year: raise RuntimeError(f'{year}: final image label mismatch {chosen_year}')
        row = dict(year=year, source_part=part, source_filename=video.name,
                   source_sha256=infos[part]['sha256'], timestamp_seconds=source_pts_time,
                   source_pts=source_pts, source_time_base=infos[part]['source_time_base'],
                   nominal_frame_seconds=stable_index / fps,
                   frame_index=stable_index, fps=fps, year_label_last_frame_index=recognizable_end,
                   year_label_last_clear_frame_index=lo,
                   year_transition_first_fade_frame_index=lo+1,
                   year_transition_readable_boundary_frame_index=hi,
                   upper_bracket_year_recognized=hi_label,
                   next_year=year+1 if following and following['year'] is not None else None,
                   width=1920, height=1080, path=str(path.relative_to(ROOT)),
                   web_image_path=str(jpeg_path.relative_to(ROOT)),
                   web_image_bytes=jpeg_path.stat().st_size,
                   frame_sha256=hashlib.sha256(candidate_png).hexdigest(),
                   year_label_matching_error=chosen_distance,
                   calendar_ref_frame_index=calendar_ref_index,
                   last_frame_calendar_core_difference=calendar_diff(stable_index),
                   map_difference_vs_one_second_before=difference,
                   rule='最后一个本年年号与地图尚未开始交叉淡化的完整画面；若片尾淡出，退回淡出前最后完整帧',
                   year_end_interpretation='视频所示本年度最后事件后的地图，不等同于独立史料确认的12月31日疆界',
                   ambiguity='none' if stable_index == lo else '片尾淡出，选取最后完整地图而非最后可辨认年号帧')
        extraction.append(row)
        (args.work_dir / 'manifest.json').write_text(json.dumps(dict(version=1, source='史图馆《中国历代疆域变化》第十五版，用户本机无声视频',
          crop=CROP, sources=infos, frames=extraction, missing_years=missing), ensure_ascii=False, indent=2) + '\n')
        print(f'{year}: {part} @ {source_pts_time:.6f}s (frame {stable_index}), core diff {calendar_diff(stable_index):.3f}', flush=True)
    if missing: print('Missing years: ' + ', '.join(map(str, missing)), flush=True)

if __name__ == '__main__': main()
