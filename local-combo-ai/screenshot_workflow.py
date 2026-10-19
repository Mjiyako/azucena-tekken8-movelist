"""Screenshot-first, local Ollama transcription with human approval and image removal."""
import argparse
import hashlib
import io
import json
import math
import re
import secrets
import shutil
import subprocess
import threading
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image
import engine

HOME = engine.HOME / 'screenshot-jobs'
EXAMPLES = engine.HOME / 'approved-text-examples.json'
PORT = 18766
TOKEN = secrets.token_urlsafe(32)
BUSY = False
LAST_ERROR = None
STATE_LOCK = threading.Lock()
RECORDINGS = {}


def folder_for(job_id):
    if not re.fullmatch(r'(ryzingsol|thefury)-[A-Za-z0-9_-]{11}-[a-z0-9-]+', job_id):
        raise ValueError('Invalid job ID.')
    return HOME / job_id


def examples_for(character, author):
    # Only explicitly approved text is retrieved. No screenshots or model-only
    # guesses enter this memory, and model weights are never modified.
    examples = engine.read_json(EXAMPLES, [])
    examples = sorted(examples, key=lambda e: (e['character'] == character, e['author'] == author,
                                              e.get('reviewedAt', '')), reverse=True)
    return [{k: e[k] for k in ('character', 'author', 'notation', 'category', 'notes')}
            for e in examples[:4]]


def transcribe(image_path, state):
    with Image.open(image_path) as original:
        original = original.convert('RGB')
        w, h = original.size
        strip = original.crop((0, int(h*.05), w, int(h*.17))) if state['author'] == 'TheFURY' else original.crop((0, int(h*.70), w, int(h*.96)))
        counter = original.crop((0, int(h*.18), int(w*.36), int(h*.65)))
        original.thumbnail((1280, 720))
        prompt = engine.PROMPT.format(character=state['character'], chapter='')
        prompt += '\nUse at most four short, distinct uncertainties. Do not repeat sentences.'
        examples = examples_for(state['character'], state['author'])
        if examples:
            prompt += '\nHuman-approved notation examples follow. Use them only for notation conventions; never copy their moves or infer damage from them. Read the current screenshot independently.\n' + json.dumps(examples)
        payload = {'model': engine.config()['model'], 'stream': False, 'think': False,
                   'prompt': prompt, 'images': [engine.image_b64(original), engine.image_b64(strip), engine.image_b64(counter)],
                   'format': engine.SCHEMA, 'keep_alive': '15m',
                   'options': {'temperature': 0, 'seed': 42, 'num_ctx': 8192, 'num_predict': 900}}
    value, answer = engine.generate_reading(payload)
    value['model'] = answer.get('model', engine.config()['model'])
    value['inferenceSeconds'] = round(answer.get('total_duration', 0)/1e9, 2)
    return value


def source_info(url, character, author, local_file):
    vid = engine.video_id(url)
    if author not in engine.AUTHORS or character not in {c['id'] for c in engine.roster()}:
        raise ValueError('Select a supported character and creator.')
    cached = engine.JOBS / f'{author.lower()}-{vid}-{character}'
    info = engine.read_json(cached/'source.json')
    if not info:
        try:
            info = engine.metadata(url)
        except Exception:
            if not local_file or (character, author) not in engine.registered_sources().get(vid, []):
                raise
            info = {'id': vid, 'title': f'{character} registered Season 3 guide', 'chapters': []}
    evidence = engine.validate_source(info, character, author)
    return vid, cached, info, evidence


@engine.single_worker
def capture(url, character, author, local_file='', interval=3, recording_start=None):
    interval = float(interval)
    if not math.isfinite(interval) or not 0.5 <= interval <= 15:
        raise ValueError('Screenshot interval must be between 0.5 and 15 seconds.')
    if recording_start is not None:
        vid = engine.video_id(url)
        if (character,author) not in engine.registered_sources().get(vid,[]):
            raise ValueError('Recording requires a checked creator guide URL for the selected character.')
        cached = engine.JOBS/f'{author.lower()}-{vid}-{character}'
        info = {'id':vid,'title':f'{character} Season 3 guide — browser recording'}
        evidence = engine.validate_source(info,character,author)
    else:
        vid, cached, info, evidence = source_info(url, character, author, local_file)
    job_id = f'{author.lower()}-{vid}-{character}'
    folder = folder_for(job_id)
    folder.mkdir(parents=True, exist_ok=True)
    if (folder/'rows.json').exists():
        return engine.read_json(folder/'job.json')
    if (folder/'images').exists():
        # Preserve unapproved images from an interrupted capture when retrying.
        (folder/'images').rename(folder/('interrupted-capture-'+secrets.token_hex(4)))
    state = {'id': job_id, 'character': character, 'author': author,
             'url': f'https://www.youtube.com/watch?v={vid}', 'title': info.get('title', ''),
             'sourceEvidence': evidence, 'channelId': info.get('channel_id'),
             'status': 'capturing', 'createdAt': engine.utc(), 'updatedAt': engine.utc(),
             'interval': interval, 'model': engine.config()['model'],
             'duration': float(info.get('duration') or engine.config()['maxVideoMinutes']*60)}
    engine.write_json(folder/'job.json', state)
    shots = folder/'images'
    shots.mkdir(exist_ok=True)
    try:
        if local_file:
            source = Path(local_file).expanduser().resolve()
            if not source.exists():
                raise ValueError('Local video or screenshot folder does not exist.')
        elif (cached/'video.mp4').exists():
            source = cached/'video.mp4'
        else:
            from yt_dlp import YoutubeDL
            source = folder/'source.mp4'
            with YoutubeDL({'outtmpl': str(source), 'quiet': True, 'noplaylist': True,
                            'js_runtimes': {'node': {}}, 'retries': 1,
                            'format': 'bestvideo[height<=1080][ext=mp4][vcodec^=avc1]/best[height<=1080][ext=mp4]'}) as ydl:
                ydl.download([state['url']])
        rows = []
        if source.is_dir():
            images = sorted(p for p in source.iterdir() if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') and p.is_file())
            if not images or len(images) > 5000:
                raise ValueError('Provide a folder containing 1–5000 screenshots.')
            for index, image in enumerate(images):
                name = f'shot-{index+1:06d}.jpg'
                with Image.open(image) as picture:
                    picture.convert('RGB').save(shots/name, quality=95)
                match = re.match(r'^(\d+(?:\.\d+)?)$', image.stem)
                rows.append(new_row(name, float(match[1]) if match else 0,
                                    not bool(match)))
            state['sourceKind'] = 'screenshots'
        else:
            details = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(source)], text=True))
            duration = float(details['format']['duration'])
            if duration > engine.config()['maxVideoMinutes']*60:
                raise ValueError('Video exceeds configured duration limit.')
            if shutil.disk_usage(folder).free < duration/interval*700000 + 2000000000:
                raise ValueError('Not enough disk space for screenshots plus a 2 GB reserve.')
            state['duration'] = duration
            # showinfo records actual selected frame times, instead of assigning
            # guessed timestamps from output filename numbers.
            command = ['ffmpeg','-hide_banner','-y','-i',str(source),'-an','-vf',
                       f"select=isnan(prev_selected_t)+gte(t-prev_selected_t\\,{interval}),showinfo",
                       '-fps_mode','vfr','-q:v','2',str(shots/'shot-%06d.jpg')]
            times, tail = [], []
            with subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, encoding='utf-8', errors='replace') as process:
                for line in process.stderr:
                    tail = (tail+[line])[-15:]
                    match = re.search(r'\bpts_time:([0-9.eE+-]+)', line)
                    if match:
                        times.append(float(match[1]))
                if process.wait():
                    raise ValueError('Screenshot capture failed: '+''.join(tail))
            images = sorted(shots.glob('shot-*.jpg'))
            if not images or len(images) != len(times):
                raise ValueError('Screenshot timestamps did not match captured images.')
            rows = [new_row(p.name, t) for p,t in zip(images,times)]
            state['sourceKind'] = 'video'
        state.update(status='screenshots-ready', imageCount=len(rows), updatedAt=engine.utc())
        if recording_start is not None:
            state.update(recordingTimingUnverified=True, recordingStartSeconds=recording_start,
                         duration=state['duration']+recording_start)
            for row in rows:
                row['second'] += recording_start
                row['timestampUnknown'] = True
                row['uncertainties'].append('Recording time is approximate. Correct source timestamps for lead-in, ads, pauses or buffering.')
        engine.write_json(folder/'rows.json', rows)
        engine.write_json(folder/'job.json', state)
        return state
    except Exception as error:
        state.update(status='failed', error=str(error), updatedAt=engine.utc())
        engine.write_json(folder/'job.json', state)
        raise


def new_row(name, second, unknown=False):
    return {'id': Path(name).stem, 'image': name, 'second': second,
            'timestampUnknown': unknown, 'status': 'pending', 'notation': '',
            'damage': None, 'hits': None, 'category': 'situational', 'conditions': [],
            'notes': '', 'uncertainties': [], 'approved': False}


@engine.single_worker
def read_screenshots(job_id):
    folder = folder_for(job_id)
    state = engine.read_json(folder/'job.json')
    if not state or not (folder/'rows.json').exists():
        raise ValueError('Capture screenshots successfully first.')
    rows = engine.read_json(folder/'rows.json', [])
    state.update(status='reading-screenshots', error=None, model=engine.config()['model'])
    engine.write_json(folder/'job.json', state)
    try:
        for row in rows:
            if row['status'] in ('read', 'approved', 'discarded', 'edited'):
                continue
            print(f"Ollama {state['model']}: {job_id} / {row['id']}", flush=True)
            value = transcribe(folder/'images'/row['image'], state)
            for key in ('notation','damage','hits','category','conditions','uncertainties'):
                row[key] = value.get(key)
            if state.get('recordingTimingUnverified'):
                row['uncertainties'].append('Recorded elapsed time is not a verified YouTube timestamp. Check the exact source combo start.')
            row['notation'] = row['notation'] or ''
            row.update(status='needs-manual-reading' if value.get('modelReadFailed') else 'read',
                       detectedKind=value.get('kind'), section=value.get('section'),
                       model=value.get('model'), routeCompleteObserved=value.get('route_complete',False))
            engine.write_json(folder/'rows.json', rows)
            state.update(processedImages=sum(r['status'] != 'pending' for r in rows), updatedAt=engine.utc())
            engine.write_json(folder/'job.json', state)
        state.update(status='needs-review', updatedAt=engine.utc())
        engine.write_json(folder/'job.json', state)
    except Exception as error:
        state.update(status='failed', error=str(error), updatedAt=engine.utc())
        engine.write_json(folder/'job.json', state)
        raise
    return state


def save_draft(job_id, row_id, edits):
    folder = folder_for(job_id)
    rows = engine.read_json(folder/'rows.json', [])
    row = next((r for r in rows if r['id'] == row_id), None)
    if not row or row.get('approved'):
        raise ValueError('Select an unapproved screenshot to edit.')
    fields = ('notation','damage','hits','category','second','notes','conditions')
    if any(row.get(k) != edits.get(k) for k in fields):
        if (edits.get('category') not in engine.CATEGORIES
                or type(edits.get('second')) not in (float,int)
                or not math.isfinite(edits['second']) or edits['second'] < 0
                or not isinstance(edits.get('conditions'),list)
                or not all(isinstance(v,str) for v in edits['conditions'])
                or any(not isinstance(edits.get(k),str) for k in ('notation','notes'))):
            raise ValueError('Invalid draft fields.')
        row.update({k:edits[k] for k in fields})
        row['status'] = 'edited'
        engine.write_json(folder/'rows.json', rows)
    return {'saved':True,'imageDeleted':False}


def approve(job_id, row_id, edits):
    folder = folder_for(job_id)
    state = engine.read_json(folder/'job.json')
    rows = engine.read_json(folder/'rows.json', [])
    row = next((r for r in rows if r['id'] == row_id), None)
    if not row:
        raise ValueError('Unknown screenshot.')
    if not edits.get('timestampReviewed') or not edits.get('inputsReviewed'):
        raise ValueError('Check inputs/final damage and the source start timestamp first.')
    notation = str(edits.get('notation', '')).strip()
    damage, hits = edits.get('damage'), edits.get('hits')
    second, category = edits.get('second'), edits.get('category')
    if not notation or type(damage) is not int or not 0 < damage <= 500:
        raise ValueError('Provide inputs and an integer final damage total between 1 and 500.')
    if hits is not None and (type(hits) is not int or not 0 < hits <= 100):
        raise ValueError('Hits must be a positive integer or blank.')
    if (type(second) not in (float,int) or not math.isfinite(second) or second < 0
            or second >= state.get('duration', float('inf')) or category not in engine.CATEGORIES):
        raise ValueError('Provide a valid category and source start time in seconds.')
    notes = str(edits.get('notes', ''))[:2000]
    conditions = edits.get('conditions', [])
    if not isinstance(conditions, list) or not all(isinstance(v,str) for v in conditions):
        raise ValueError('Conditions must be text lines.')
    approved = engine.read_json(folder/'approved.json', [])
    record = {'id': f"screenshot-{job_id}-{row_id}", 'character': state['character'],
              'author': state['author'], 'notation': notation, 'damage': damage, 'hits': hits,
              'category': category, 'conditions': conditions, 'notes': notes,
              'videoTimestampSeconds': second, 'sourceUrl': state['url']+f'&t={math.floor(second)}s',
              'reviewedAt': engine.utc(), 'approved': True, 'timestampReviewed': True,
              'evidence': [], 'agreement': False, 'section': category}
    approved = [r for r in approved if r['id'] != record['id']] + [record]
    # Durable reviewed text first, then text-only examples, THEN remove image.
    engine.write_json(folder/'approved.json', approved)
    examples = engine.read_json(EXAMPLES, [])
    example = {k:record[k] for k in ('id','character','author','notation','category','notes','reviewedAt')}
    engine.write_json(EXAMPLES, ([e for e in examples if e['id'] != example['id']]+[example])[-500:])
    row.update({k:record[k] for k in ('notation','damage','hits','category','conditions','notes')})
    row.update(status='approved', approved=True, second=second, imageDeleted=False)
    engine.write_json(folder/'rows.json', rows)
    image = folder/'images'/row['image']
    image.unlink(missing_ok=True)
    row['imageDeleted'] = True
    engine.write_json(folder/'rows.json', rows)
    return {'approved': True, 'imageDeleted': True, 'saved': str(folder/'approved.json'),
            'learning': 'Approved text example saved locally; model weights were not changed.'}


def publish(job_id, push=False):
    folder = folder_for(job_id)
    state = engine.read_json(folder/'job.json')
    rows = engine.read_json(folder/'approved.json', [])
    if not rows:
        raise ValueError('Approve at least one screenshot transcription first.')
    # Reuse the existing reviewed-data publisher; its exported records contain no images.
    export_id = job_id+'-screenshots'
    target = engine.job_folder(export_id)
    target.mkdir(parents=True, exist_ok=True)
    engine.write_json(target/'job.json', {**state,'id':export_id,'status':'needs-review','workflow':'approved-screenshot-text'})
    engine.write_json(target/'candidates.json', rows)
    return engine.save_review(export_id, rows, publish=True, push=push)


def start_worker(function):
    global BUSY, LAST_ERROR
    with STATE_LOCK:
        if BUSY:
            raise ValueError('Wait for the current screenshot operation to finish.')
        BUSY = True
        LAST_ERROR = None
    def run():
        global BUSY, LAST_ERROR
        try:
            function()
        except Exception as error:
            LAST_ERROR = str(error)
            print(f'Operation failed: {error}', flush=True)
        finally:
            BUSY = False
    threading.Thread(target=run, daemon=True).start()


def start_recording(body):
    global LAST_ERROR
    vid = engine.video_id(body['url'])
    character, author = body['character'],body['author']
    if (character,author) not in engine.registered_sources().get(vid,[]):
        raise ValueError('Select the matching character/creator and a checked Season 3 guide URL.')
    interval, offset = float(body.get('interval',1)),float(body.get('sourceStart',0))
    if not math.isfinite(interval) or not .5 <= interval <= 15:
        raise ValueError('Screenshot interval must be 0.5–15 seconds.')
    if not math.isfinite(offset) or not 0 <= offset < engine.config()['maxVideoMinutes']*60:
        raise ValueError('Source start time must be valid seconds.')
    job_id=f'{author.lower()}-{vid}-{character}'
    folder=folder_for(job_id)
    with STATE_LOCK:
        if BUSY or RECORDINGS:
            raise ValueError('Finish the current operation first.')
        if (folder/'rows.json').exists():
            raise ValueError('This guide already has screenshots. Read/resume its saved job instead.')
        session=secrets.token_urlsafe(24)
        recording_folder=engine.HOME/'browser-recordings'/session
        recording_folder.mkdir(parents=True)
        record={'folder':recording_folder,'jobId':job_id,'url':body['url'],'character':character,
                'author':author,'interval':interval,'sourceStart':offset,'bytes':0}
        RECORDINGS[session]=record
        LAST_ERROR=None
    engine.write_json(recording_folder/'recording.json',{k:str(v) if isinstance(v,Path) else v for k,v in record.items()})
    engine.write_json(folder/'job.json',{'id':job_id,'character':character,'author':author,'url':body['url'],
        'title':f'{character} — browser recording','status':'recording','updatedAt':engine.utc(),
        'recordingTimingUnverified':True})
    return {'session':session,'jobId':job_id}


def append_recording(session, data):
    record=RECORDINGS.get(session)
    if not record:
        raise ValueError('Unknown or finished recording session.')
    if not data or len(data)>20000000:
        raise ValueError('Invalid recording chunk size.')
    if shutil.disk_usage(record['folder']).free < len(data)+2000000000:
        raise ValueError('Recording stopped: leave at least 2 GB free disk space.')
    if record['bytes']+len(data)>8000000000:
        raise ValueError('Recording exceeds the 8 GB safety limit.')
    with (record['folder']/'capture.webm').open('ab') as stream:
        stream.write(data)
    record['bytes']+=len(data)
    return {'saved':len(data)}


def finish_recording(record):
    folder=folder_for(record['jobId'])
    state=engine.read_json(folder/'job.json')
    try:
        state.update(status='converting-recording',updatedAt=engine.utc())
        engine.write_json(folder/'job.json',state)
        source,video=record['folder']/'capture.webm',record['folder']/'video.mp4'
        if not source.exists() or not source.stat().st_size:
            raise ValueError('No recording was received. Record the YouTube tab before stopping.')
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-an',
            '-vf','fps=30','-c:v','libx264','-preset','fast','-crf','18','-movflags','+faststart',str(video)],check=True)
        capture(record['url'],record['character'],record['author'],str(video),record['interval'],
                recording_start=record['sourceStart'])
        return read_screenshots(record['jobId'])
    except Exception as error:
        state=engine.read_json(folder/'job.json',state)
        state.update(status='failed',error=str(error),updatedAt=engine.utc())
        engine.write_json(folder/'job.json',state)
        raise


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, value, status=200, mime='application/json'):
        if isinstance(value,(list,dict)):
            value = json.dumps(value).encode()
        elif isinstance(value,str):
            value = value.encode()
        self.send_response(status)
        self.send_header('Content-Type',mime)
        self.send_header('Content-Length',len(value))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(value)

    def allowed(self):
        return self.headers.get('Host') in (f'127.0.0.1:{PORT}',f'localhost:{PORT}')

    def do_GET(self):
        try:
            if not self.allowed():
                return self.send({'error':'Invalid host'},403)
            path = urlparse(self.path).path
            if path == '/':
                page = Path(__file__).with_name('screenshot-ui.html').read_text(encoding='utf-8').replace('__TOKEN__',TOKEN)
                return self.send(page,mime='text/html; charset=utf-8')
            if path in ('/screenshot-ui.js','/ui.css'):
                return self.send(Path(__file__).with_name(path[1:]).read_bytes(),mime='text/javascript' if path.endswith('.js') else 'text/css')
            if path == '/combo-inputs.js':
                return self.send((engine.ROOT/'combo-inputs.js').read_bytes(),mime='text/javascript')
            if path == '/api/status':
                jobs = [engine.read_json(p) for p in HOME.glob('*/job.json')]
                return self.send({'busy':BUSY,'recording':bool(RECORDINGS),'error':LAST_ERROR,'jobs':sorted(jobs,key=lambda j:j['updatedAt'],reverse=True),
                                  'characters':engine.roster(),'model':engine.config()['model']})
            if path.startswith('/api/job/'):
                folder = folder_for(path.rsplit('/',1)[1])
                return self.send({'job':engine.read_json(folder/'job.json'),'rows':engine.read_json(folder/'rows.json',[])})
            if path.startswith('/image/'):
                _,_,job_id,name = path.split('/')
                if not re.fullmatch(r'shot-\d{6}\.jpg',name):
                    raise ValueError('Invalid screenshot name.')
                image = folder_for(job_id)/'images'/name
                return self.send(image.read_bytes(),mime='image/jpeg')
            return self.send({'error':'Not found'},404)
        except FileNotFoundError:
            self.send({'error':'Image removed after approval, or file not found.'},404)
        except (ValueError,KeyError) as error:
            self.send({'error':str(error)},400)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):
            pass

    def do_POST(self):
        try:
            if (not self.allowed() or self.headers.get('X-Local-Token') != TOKEN
                or self.headers.get('Origin') not in (None,f'http://127.0.0.1:{PORT}',f'http://localhost:{PORT}')):
                return self.send({'error':'Local request token required'},403)
            length = int(self.headers.get('Content-Length',0))
            path = urlparse(self.path).path
            maximum=20000000 if path.startswith('/api/record/chunk/') else 100000
            if not 0 < length <= maximum:
                raise ValueError('Invalid request size.')
            if path.startswith('/api/record/chunk/'):
                return self.send(append_recording(path.rsplit('/',1)[1],self.rfile.read(length)))
            body = json.loads(self.rfile.read(length))
            if path == '/api/record/start':
                return self.send(start_recording(body))
            if path in ('/api/record/finish','/api/record/cancel'):
                record=RECORDINGS.pop(body['session'],None)
                if not record:
                    raise ValueError('Unknown recording session.')
                if path.endswith('/finish'):
                    start_worker(lambda:finish_recording(record))
                    return self.send({'processing':True})
                state=engine.read_json(folder_for(record['jobId'])/'job.json')
                state.update(status='recording-cancelled',updatedAt=engine.utc())
                engine.write_json(folder_for(record['jobId'])/'job.json',state)
                return self.send({'cancelled':True,'partialRecordingKept':True})
            if RECORDINGS:
                raise ValueError('Stop recording before starting another operation.')
            if BUSY:
                raise ValueError('Let the current operation finish before editing or starting another.')
            if path == '/api/capture':
                start_worker(lambda:capture(body['url'],body['character'],body['author'],body.get('file',''),body.get('interval',3)))
                return self.send({'started':True})
            if path == '/api/read':
                start_worker(lambda:read_screenshots(body['jobId']))
                return self.send({'started':True})
            if path == '/api/approve':
                return self.send(approve(body['jobId'],body['rowId'],body))
            if path == '/api/draft':
                return self.send(save_draft(body['jobId'],body['rowId'],body))
            if path == '/api/publish':
                # Publication is requested separately from approval/image removal.
                return self.send(publish(body['jobId'],body.get('push',False)))
            return self.send({'error':'Not found'},404)
        except (ValueError,KeyError,TypeError) as error:
            self.send({'error':str(error)},400)
        except Exception as error:
            self.send({'error':str(error)},500)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['serve','capture','read','publish'])
    parser.add_argument('--url');parser.add_argument('--character')
    parser.add_argument('--author',choices=sorted(engine.AUTHORS))
    parser.add_argument('--file',default='');parser.add_argument('--interval',type=float,default=3)
    parser.add_argument('--job');parser.add_argument('--push',action='store_true')
    args = parser.parse_args()
    HOME.mkdir(parents=True,exist_ok=True)
    if args.command == 'serve':
        server = ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
        print(f'Screenshot Combo AI: http://127.0.0.1:{PORT}\nClose this window to stop. No analysis starts until you request it.',flush=True)
        webbrowser.open(f'http://127.0.0.1:{PORT}')
        server.serve_forever()
    elif args.command == 'capture':
        if not all((args.url,args.character,args.author)):
            parser.error('capture requires --url, --character and --author')
        print(json.dumps(capture(args.url,args.character,args.author,args.file,args.interval),indent=2))
    elif args.command == 'read':
        if not args.job:parser.error('read requires --job')
        print(json.dumps(read_screenshots(args.job),indent=2))
    else:
        if not args.job:parser.error('publish requires --job')
        print(json.dumps(publish(args.job,args.push),indent=2))


if __name__ == '__main__':
    main()
