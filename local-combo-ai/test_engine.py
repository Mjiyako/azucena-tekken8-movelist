import tempfile
import json
import unittest
from pathlib import Path
from unittest.mock import patch
import engine


def observation(second, damage, hits, notation='df+2 ► 4'):
    return dict(second=second, damage=damage, hits=hits, notation=notation, category='normal',
        kind='combo', frame=f'frames/frame-{second}.jpg', conditions=[], legible=True,
        uncertainties=[], route_complete=True, section='Normal Hit')


class ExtractionTests(unittest.TestCase):
    def test_truncated_model_json_is_retried_before_returning_a_reading(self):
        value = dict(kind='combo',title='',character='Anna',section='Normal Hit',
                     notation='df+2',damage=20,hits=1,category='normal',conditions=[],
                     route_complete=False,legible=True,uncertainties=[])
        with tempfile.TemporaryDirectory() as temp, patch.object(engine, 'HOME', Path(temp)), \
             patch.object(engine, 'api', side_effect=[{'response':'{"uncertainties":['},
                                                     {'response':json.dumps(value)}]) as generate:
            actual, _ = engine.generate_reading({'prompt':'Read frame'})
            self.assertEqual(actual, value)
            self.assertEqual(generate.call_count, 2)

    def test_repeated_invalid_model_output_becomes_manual_inspection_not_a_crash(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(engine, 'HOME', Path(temp)), \
             patch.object(engine, 'api', return_value={'response':'{"uncertainties":['}):
            actual, _ = engine.generate_reading({'prompt':'Read frame'})
            self.assertTrue(actual['modelReadFailed'])
            self.assertIsNone(actual['notation'])
            self.assertIsNone(actual['damage'])
            self.assertFalse(actual['legible'])
            self.assertEqual(len(list((Path(temp)/'inference-errors').glob('*.json'))),1)

    def test_counter_episodes_keep_completed_totals_and_pre_hit_lead_in(self):
        readings = [dict(index=i,damage=d,hits=h) for i,(d,h) in enumerate([
            (None,None),(20,1),(44,2),(44,2),(None,None),(None,None),(20,1),(60,3)])]
        episodes = engine.counter_episodes(readings, 2)
        self.assertEqual(len(episodes), 2)
        self.assertEqual((episodes[0]['start'],episodes[0]['best'],episodes[0]['maxDamage']), (0,3,44))
        self.assertEqual(episodes[1]['maxDamage'],60)

    def test_final_counter_and_repeated_route_reset(self):
        routes = engine.group_routes([observation(0, 20, 1), observation(2, 63, 9),
            observation(3, 63, 9), observation(5, 20, 1), observation(7, 63, 9)], 'test')
        self.assertEqual(len(routes), 2)
        self.assertEqual(routes[0]['damage'], 63)
        self.assertTrue(routes[0]['agreement'])
        self.assertFalse(routes[0]['approved'])
        self.assertEqual(routes[1]['videoTimestampSeconds'], 5)

    def test_unreadable_damage_is_not_guessed_or_silently_dropped(self):
        routes = engine.group_routes([observation(5, None, None)], 'test')
        self.assertIsNone(routes[0]['damage'])
        self.assertFalse(routes[0]['agreement'])

    def test_approval_requires_damage_and_reviewed_source_timestamp(self):
        job = dict(character='anna',author='RyzingSol',url='https://www.youtube.com/watch?v=IKaAPbrhZxo',
            duration=555,sourceEvidence='Checked source registry',title='Anna Season 3')
        route = engine.group_routes([observation(265, 44, 2)], 'test')[0]
        self.assertEqual(engine.checked_candidates(job, [route]), [])
        route['approved'] = True
        with self.assertRaises(ValueError):
            engine.checked_candidates(job, [route])
        route['timestampReviewed'] = True
        result = engine.checked_candidates(job, [route])
        self.assertEqual(result[0]['damage'], 44)
        self.assertTrue(result[0]['sourceUrl'].endswith('&t=265s'))
        route['damage'] = None
        with self.assertRaises(ValueError):
            engine.checked_candidates(job, [route])

    def test_registered_guides_keep_both_characters_for_shared_video(self):
        sources = engine.registered_sources()
        self.assertIn(('kuma', 'RyzingSol'), sources['H4_27uQFHWg'])
        self.assertIn(('panda', 'RyzingSol'), sources['H4_27uQFHWg'])
        self.assertNotEqual(engine.job_folder('ryzingsol-H4_27uQFHWg-kuma'),
                            engine.job_folder('ryzingsol-H4_27uQFHWg-panda'))

    def test_unknown_sources_and_traversal_are_rejected(self):
        with self.assertRaises(ValueError):
            engine.video_id('https://evil.example/watch?v=IKaAPbrhZxo')
        with self.assertRaises(ValueError):
            engine.job_folder('../secrets')
        with self.assertRaises(ValueError):
            engine.validate_source({'id':'IKaAPbrhZxo'}, 'anna', 'TheFURY')

    def test_frame_sampling_keeps_final_frame_and_reuses_completed_extraction(self):
        if not engine.shutil.which('ffmpeg'):
            self.skipTest('FFmpeg unavailable')
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            video = root / 'fixture.mp4'
            engine.subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi',
                '-i','color=blue:s=640x360:r=30:d=2','-c:v','libx264',str(video)],check=True)
            frames = engine.extract_frames(video, root / 'frames', 2)
            self.assertEqual(len(frames), 4)
            keys = engine.keyframes(frames, 2, 3)
            self.assertEqual(keys[-1][0], 3)
            with patch.object(engine.subprocess, 'run', side_effect=AssertionError('Must reuse completed frames')):
                self.assertEqual(engine.extract_frames(video, root / 'frames', 2), frames)


if __name__ == '__main__':
    unittest.main()
