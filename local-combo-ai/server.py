"""Loopback-only review UI and background job runner."""
import json
import mimetypes
import secrets
import threading
import traceback
import subprocess
import shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import engine

TOKEN = secrets.token_urlsafe(32)
PORT = 18765
ACTIVE = {'busy': False, 'message': 'Ready', 'error': None}
STOP = threading.Event()
LOCK = threading.Lock()
CAPTURES = {}


def run_task(function):
    with LOCK:
        if ACTIVE['busy']:
            raise ValueError('A job is already running. Pause it before starting another.')
        ACTIVE.update(busy=True, error=None)
        STOP.clear()
    def worker():
        try:
            result = function()
            ACTIVE['message'] = json.dumps(result) if isinstance(result, dict) else 'Finished'
        except InterruptedError as error:
            ACTIVE['message'] = str(error)
        except Exception as error:
            ACTIVE.update(error=str(error), message='Job failed; cached progress retained')
            traceback.print_exc()
        finally:
            ACTIVE['busy'] = False
    threading.Thread(target=worker, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def allowed(self):
        host = self.headers.get('Host', '')
        return host in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def send(self, data, content_type='application/json', status=200):
        if isinstance(data, (dict, list)):
            data = json.dumps(data).encode()
        elif isinstance(data, str):
            data = data.encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', len(data))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        try:
            if not self.allowed():
                return self.send({'error': 'Invalid host'}, status=403)
            route = unquote(urlparse(self.path).path)
            if route == '/':
                html = Path(__file__).with_name('index.html').read_text(encoding='utf-8').replace('__TOKEN__', TOKEN)
                return self.send(html, 'text/html; charset=utf-8')
            if route in ('/ui.js', '/ui.css'):
                return self.send(Path(__file__).with_name(route[1:]).read_bytes(),
                                 'text/javascript; charset=utf-8' if route.endswith('.js') else 'text/css; charset=utf-8')
            if route == '/api/status':
                jobs = [engine.read_json(file) for file in engine.JOBS.glob('*/job.json')]
                return self.send({'active': ACTIVE, 'jobs': sorted(jobs, key=lambda j: j['updatedAt'], reverse=True),
                                  'characters': engine.roster(), 'config': engine.config()})
            if route == '/api/doctor':
                return self.send(engine.doctor())
            if route.startswith('/api/job/'):
                folder = engine.job_folder(route.removeprefix('/api/job/'))
                return self.send({'job': engine.read_json(folder / 'job.json'),
                                  'candidates': engine.read_json(folder / 'candidates.json', []),
                                  'observations': engine.read_json(folder / 'observations.json', [])})
            if route.startswith('/media/'):
                _, _, job_id, relative = route.split('/', 3)
                folder = engine.job_folder(job_id).resolve()
                file = (folder / relative).resolve()
                if not file.is_relative_to(folder) or file.suffix.lower() not in ('.jpg', '.mp4') or not file.is_file():
                    return self.send({'error': 'Not found'}, status=404)
                return self.stream_file(file)
            return self.send({'error': 'Not found'}, status=404)
        except (ValueError, FileNotFoundError) as error:
            self.send({'error': str(error)}, status=400)

    def stream_file(self, file):
        size = file.stat().st_size
        start, end, status = 0, size - 1, 200
        byte_range = self.headers.get('Range')
        if byte_range:
            import re
            match = re.fullmatch(r'bytes=(\d+)-(\d*)', byte_range)
            if not match:
                return self.send({'error': 'Unsupported range'}, status=416)
            start = int(match[1])
            end = min(int(match[2]) if match[2] else size - 1, size - 1)
            if start > end:
                return self.send({'error': 'Range outside file'}, status=416)
            status = 206
        self.send_response(status)
        self.send_header('Content-Type', mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
        self.send_header('Content-Length', end - start + 1)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        try:
            with file.open('rb') as stream:
                stream.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = stream.read(min(256 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        try:
            origin = self.headers.get('Origin')
            if (not self.allowed() or self.headers.get('X-Local-Token') != TOKEN
                or origin not in (None, f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}')):
                return self.send({'error': 'Local request token required'}, status=403)
            length = int(self.headers.get('Content-Length', 0))
            if not 0 < length <= 20_000_000:
                raise ValueError('Request too large or empty.')
            route = urlparse(self.path).path
            if route.startswith('/api/capture/chunk/'):
                capture = CAPTURES.get(route.rsplit('/', 1)[1])
                if not capture:
                    raise ValueError('Unknown recording session.')
                if shutil.disk_usage(capture['folder']).free < length + 2_000_000_000:
                    raise ValueError('Recording stopped: less than 2 GB free disk space.')
                with (capture['folder'] / 'capture.webm').open('ab') as stream:
                    stream.write(self.rfile.read(length))
                return self.send({'saved': length})
            body = json.loads(self.rfile.read(length))
            def notify(message):
                ACTIVE['message'] = message
            if route == '/api/start':
                if CAPTURES:
                    raise ValueError('Finish the current recording before starting another job.')
                run_task(lambda: engine.process(body['url'], body['character'], body['author'],
                    local_file=body.get('file') or None, every_frame=body.get('everyFrame', False),
                    dense=body.get('dense', False), notify=notify, stop=STOP))
                return self.send({'started': True})
            if route == '/api/weekly':
                if CAPTURES:
                    raise ValueError('Finish the current recording before starting another job.')
                run_task(lambda: engine.weekly(notify=notify, stop=STOP))
                return self.send({'started': True})
            if route == '/api/capture/start':
                if ACTIVE['busy'] or CAPTURES:
                    raise ValueError('Pause the active extraction before recording.')
                vid = engine.video_id(body['url'])
                if (body['character'], body['author']) not in engine.registered_sources().get(vid, []):
                    raise ValueError('Browser recording currently requires a checked guide URL from data/combo-guides.json. New sources need channel verification through direct import.')
                job_id = f"{body['author'].lower()}-{vid}-{body['character']}"
                folder = engine.job_folder(job_id)
                folder.mkdir(parents=True, exist_ok=True)
                if (folder / 'video.mp4').exists() or (folder / 'capture.webm').exists():
                    raise ValueError('This job already has a video or recording. Resume it or use the existing local file.')
                session = secrets.token_urlsafe(24)
                CAPTURES[session] = {'folder': folder, 'body': body, 'jobId': job_id}
                engine.write_json(folder / 'source.json', {'id': vid,
                    'title': f"{body['character']} Season 3 creator guide (browser recording)",
                    'chapters': [], 'metadataOffline': True})
                engine.write_json(folder / 'job.json', {'id': job_id, 'character': body['character'],
                    'author': body['author'], 'url': f'https://www.youtube.com/watch?v={vid}',
                    'createdAt': engine.utc(), 'updatedAt': engine.utc(), 'status': 'recording',
                    'captureTimingUnverified': True})
                return self.send({'session': session, 'jobId': job_id})
            if route == '/api/capture/finish':
                capture = CAPTURES.pop(body['session'], None)
                if not capture:
                    raise ValueError('Unknown recording session.')
                def finish():
                    source = capture['folder'] / 'capture.webm'
                    output = capture['folder'] / 'video.mp4'
                    try:
                        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                            '-an', '-vf', 'fps=30,scale=1280:-2', '-c:v', 'libx264', '-preset', 'fast',
                            '-crf', '20', '-movflags', '+faststart', str(output)], check=True)
                    except Exception as error:
                        job = engine.read_json(capture['folder'] / 'job.json')
                        job.update(status='failed', error=str(error), updatedAt=engine.utc())
                        engine.write_json(capture['folder'] / 'job.json', job)
                        raise
                    b = capture['body']
                    return engine.process(b['url'], b['character'], b['author'],
                        every_frame=b.get('everyFrame', False), dense=b.get('dense', False), notify=notify, stop=STOP)
                run_task(finish)
                return self.send({'processing': True})
            if route == '/api/capture/cancel':
                capture = CAPTURES.pop(body['session'], None)
                if capture:
                    job = engine.read_json(capture['folder'] / 'job.json')
                    job.update(status='failed', error='Recording upload stopped; partial capture retained.', updatedAt=engine.utc())
                    engine.write_json(capture['folder'] / 'job.json', job)
                return self.send({'cancelled': True})
            if route == '/api/stop':
                STOP.set()
                return self.send({'paused': 'Will pause after the current model request or frame extraction.'})
            if route == '/api/review':
                if ACTIVE['busy']:
                    raise ValueError('Pause processing before editing/publishing a review.')
                if body.get('publish'):
                    run_task(lambda: engine.save_review(body['jobId'], body['candidates'], True, body.get('push', False)))
                    return self.send({'publishing': True})
                return self.send(engine.save_review(body['jobId'], body['candidates']))
            if route == '/api/add-candidate':
                if ACTIVE['busy']:
                    raise ValueError('Pause processing before adding a route.')
                folder = engine.job_folder(body['jobId'])
                observations = engine.read_json(folder / 'observations.json', [])
                if not observations:
                    raise ValueError('Analyze at least one frame first.')
                second = float(body['second'])
                observation = min(observations, key=lambda o: abs(o['second'] - second))
                candidates = engine.read_json(folder / 'candidates.json', [])
                candidates.append({'id': 'manual-' + secrets.token_hex(8), 'notation': '', 'damage': None,
                    'hits': None, 'category': 'normal', 'conditions': [], 'videoTimestampSeconds': max(0, second),
                    'endSeconds': second, 'section': 'Manually added missed route', 'approved': False,
                    'timestampReviewed': False, 'agreement': False, 'reviewEdited': True,
                    'notes': 'Added during human review of local extraction.', 'routeCompleteObserved': False,
                    'evidence': [{'frame': observation['frame'], 'second': observation['second'],
                        'damage': observation.get('damage'), 'hits': observation.get('hits'), 'uncertainties': []}]})
                engine.write_json(folder / 'candidates.json', candidates)
                return self.send({'added': True})
            return self.send({'error': 'Not found'}, status=404)
        except (ValueError, KeyError, TypeError) as error:
            self.send({'error': str(error)}, status=400)
        except Exception as error:
            self.send({'error': str(error)}, status=500)


if __name__ == '__main__':
    engine.HOME.mkdir(parents=True, exist_ok=True)
    print(f'Local Combo AI: http://127.0.0.1:{PORT}', flush=True)
    print('Video analysis stays on this computer. Close this console to stop the review app.', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
