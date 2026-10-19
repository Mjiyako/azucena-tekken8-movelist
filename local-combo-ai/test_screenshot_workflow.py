import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from PIL import Image
import engine
import screenshot_workflow as shots


class ScreenshotWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.patches = [patch.object(shots,'HOME',self.root/'jobs'),
                        patch.object(shots,'EXAMPLES',self.root/'examples.json')]
        for p in self.patches:p.start()
        self.job_id = 'ryzingsol-IKaAPbrhZxo-anna'
        self.folder = shots.folder_for(self.job_id)
        (self.folder/'images').mkdir(parents=True)
        self.image = self.folder/'images/shot-000001.jpg'
        Image.new('RGB',(100,100),'blue').save(self.image)
        self.sibling = self.folder/'images/shot-000002.jpg'
        Image.new('RGB',(100,100),'green').save(self.sibling)
        engine.write_json(self.folder/'job.json',dict(id=self.job_id,character='anna',author='RyzingSol',
            url='https://www.youtube.com/watch?v=IKaAPbrhZxo',duration=555,
            sourceEvidence='Checked registry',title='Anna Season 3',updatedAt=engine.utc()))
        engine.write_json(self.folder/'rows.json',[shots.new_row(self.image.name,12)])
        self.edits=dict(notation='df+2',damage=20,hits=1,category='normal',second=12,
                        notes='Checked',conditions=[],timestampReviewed=True,inputsReviewed=True)

    def tearDown(self):
        for p in reversed(self.patches):p.stop()
        self.temp.cleanup()

    def test_approval_saves_text_and_examples_before_deleting_only_selected_image(self):
        original=self.root/'user-original.jpg'
        original.write_bytes(self.image.read_bytes())
        result=shots.approve(self.job_id,'shot-000001',self.edits)
        self.assertTrue(result['imageDeleted'])
        self.assertFalse(self.image.exists())
        self.assertTrue(self.sibling.exists())
        self.assertTrue(original.exists())
        record=engine.read_json(self.folder/'approved.json')[0]
        self.assertEqual(record['notation'],'df+2')
        self.assertNotIn('image',record)
        self.assertEqual(record['evidence'],[])
        self.assertNotIn('image',engine.read_json(shots.EXAMPLES)[0])

    def test_unchecked_approval_and_failed_text_write_keep_image(self):
        with self.assertRaises(ValueError):
            shots.approve(self.job_id,'shot-000001',{**self.edits,'inputsReviewed':False})
        self.assertTrue(self.image.exists())
        with patch.object(engine,'write_json',side_effect=OSError('Disk full')):
            with self.assertRaises(OSError):shots.approve(self.job_id,'shot-000001',self.edits)
        self.assertTrue(self.image.exists())

    def test_drafts_do_not_delete_images_or_enter_learning_examples(self):
        shots.save_draft(self.job_id,'shot-000001',self.edits)
        self.assertTrue(self.image.exists())
        self.assertFalse(shots.EXAMPLES.exists())
        self.assertFalse((self.folder/'approved.json').exists())
        self.assertEqual(engine.read_json(self.folder/'rows.json')[0]['status'],'edited')

    def test_invalid_damage_does_not_remove_screenshot(self):
        for value in [None,0,True,501,3.5]:
            with self.assertRaises(ValueError):
                shots.approve(self.job_id,'shot-000001',{**self.edits,'damage':value})
            self.assertTrue(self.image.exists())

    def test_bad_model_reading_stays_for_manual_review_and_can_be_resumed(self):
        value=dict(notation=None,damage=None,hits=None,category='situational',conditions=[],
                   uncertainties=['Invalid JSON'],modelReadFailed=True,kind='other',section='')
        with patch.object(shots,'transcribe',return_value=value),patch.object(engine,'HOME',self.root/'runtime'):
            shots.read_screenshots(self.job_id)
        row=engine.read_json(self.folder/'rows.json')[0]
        self.assertEqual(row['status'],'needs-manual-reading')
        self.assertTrue(self.image.exists())
        self.assertFalse(row['approved'])

    def test_actual_ffmpeg_capture_records_selected_frame_timestamps(self):
        if not engine.shutil.which('ffmpeg'):self.skipTest('FFmpeg unavailable')
        video=self.root/'fixture.mp4'
        engine.subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi',
            '-i','color=blue:s=640x360:r=30:d=2','-c:v','libx264',str(video)],check=True)
        with patch.object(shots,'HOME',self.root/'fresh-jobs'),patch.object(engine,'HOME',self.root/'runtime'), \
             patch.object(shots,'source_info',return_value=('IKaAPbrhZxo',self.root/'cache',{'title':'Test'},'Checked source')):
            state=shots.capture('https://www.youtube.com/watch?v=IKaAPbrhZxo','anna','RyzingSol',str(video),.5)
            rows=engine.read_json(shots.folder_for(state['id'])/'rows.json')
            self.assertEqual([r['second'] for r in rows],[0,.5,1,1.5])
            self.assertTrue(all((shots.folder_for(state['id'])/'images'/r['image']).exists() for r in rows))
        self.assertTrue(video.exists())

    def test_web_approval_requires_local_token(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),shots.Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with patch.object(shots,'PORT',server.server_port):
                request=urllib.request.Request(f'http://127.0.0.1:{server.server_port}/api/approve',
                    data=json.dumps({**self.edits,'jobId':self.job_id,'rowId':'shot-000001'}).encode(),
                    headers={'Content-Type':'application/json'})
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
                self.assertEqual(error.exception.code,403)
                error.exception.close()
                self.assertTrue(self.image.exists())
        finally:
            server.shutdown();server.server_close();thread.join()

    def test_publisher_receives_only_reviewed_text_and_no_images(self):
        shots.approve(self.job_id,'shot-000001',self.edits)
        with patch.object(engine,'JOBS',self.root/'exported'),patch.object(engine,'save_review') as save:
            save.return_value={'approved':1}
            self.assertEqual(shots.publish(self.job_id),{'approved':1})
            export_id,candidates=save.call_args.args
            state=engine.read_json(engine.job_folder(export_id)/'job.json')
            exported=engine.checked_candidates(state,candidates)
            self.assertEqual(exported[0]['damage'],20)
            self.assertTrue(exported[0]['sourceUrl'].endswith('&t=12s'))
            self.assertFalse(any(p.suffix.lower() in ('.jpg','.png','.mp4') for p in engine.job_folder(export_id).rglob('*')))


if __name__=='__main__':unittest.main()
