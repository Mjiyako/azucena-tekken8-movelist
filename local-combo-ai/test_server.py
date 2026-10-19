import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import engine
import server


class LocalServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.jobs = patch.object(engine, 'JOBS', Path(self.temp.name) / 'jobs')
        self.jobs.start()
        self.http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = patch.object(server, 'PORT', self.http.server_port)
        self.port.start()
        self.base = f'http://127.0.0.1:{self.http.server_port}'
        server.CAPTURES.clear()
        threading.Thread(target=self.http.serve_forever, daemon=True).start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.port.stop()
        self.jobs.stop()
        self.temp.cleanup()

    def post(self, path, body, token=server.TOKEN, origin=None, raw=False):
        headers = {'X-Local-Token':token,'Content-Type':'application/octet-stream' if raw else 'application/json'}
        if origin:
            headers['Origin'] = origin
        req = urllib.request.Request(self.base + path, data=body if raw else json.dumps(body).encode(), headers=headers)
        return urllib.request.urlopen(req)

    def test_cross_site_and_missing_token_cannot_start_jobs(self):
        for token, origin in [('', None), (server.TOKEN, 'https://untrusted.example')]:
            with self.assertRaises(urllib.error.HTTPError) as caught:
                self.post('/api/start', {}, token=token, origin=origin)
            self.assertEqual(caught.exception.code, 403)
            caught.exception.close()

    def test_recording_chunks_stay_in_the_selected_job(self):
        with self.post('/api/capture/start', {'url':'https://www.youtube.com/watch?v=IKaAPbrhZxo','character':'anna','author':'RyzingSol'}) as response:
            capture = json.load(response)
        with self.post('/api/capture/chunk/' + capture['session'], b'first-chunk', raw=True):
            pass
        with self.post('/api/capture/chunk/' + capture['session'], b'-second', raw=True):
            pass
        saved = engine.job_folder(capture['jobId']) / 'capture.webm'
        self.assertEqual(saved.read_bytes(), b'first-chunk-second')
        self.assertTrue(engine.read_json(saved.parent/'job.json')['captureTimingUnverified'])

    def test_media_ranges_support_local_video_seeking(self):
        folder = engine.job_folder('ryzingsol-IKaAPbrhZxo-anna')
        folder.mkdir(parents=True)
        (folder/'video.mp4').write_bytes(b'0123456789')
        request = urllib.request.Request(self.base+'/media/ryzingsol-IKaAPbrhZxo-anna/video.mp4',headers={'Range':'bytes=2-5'})
        with urllib.request.urlopen(request) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.read(), b'2345')


if __name__ == '__main__':
    unittest.main()
