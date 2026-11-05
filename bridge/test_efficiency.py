"""Synthetic cache, freshness and display watchdog regressions; no network calls."""
import copy
import json
import subprocess
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
import bridge as B

NOW=datetime(2026,11,5,17,tzinfo=timezone.utc)
ROOT=Path(__file__).resolve().parents[1]

class SourceCaching(unittest.TestCase):
    def setUp(self):
        self.fub=Mock()
        self.p=B.FubPoller(self.fub,B.Hub())

    def task(self, revision='first', task_id=990001, note_id=990002):
        return dict(id=task_id,updated=revision,personId=990003,name=f'SEND TEXT: Message Prep #{note_id}')

    def test_notes_only_new_changed_and_removed_approvals(self):
        self.fub.get.return_value=dict(personId=990003,body='TEST draft one')
        self.p._notes_for([self.task()])
        self.p._notes_for([self.task()])
        self.assertEqual(self.fub.get.call_count,1)
        self.fub.get.return_value=dict(personId=990003,body='TEST draft two')
        self.p._notes_for([self.task('second')])
        self.assertEqual(self.fub.get.call_count,2)
        self.assertEqual(self.p.notes[990002]['body'],'TEST draft two')
        self.p._notes_for([self.task('second'),self.task(task_id=990004,note_id=990005)])
        self.assertEqual(self.fub.get.call_count,3)
        self.p._notes_for([])
        self.assertEqual(self.p.notes,{})
        self.assertEqual(self.p.approval_cache,{})

    def test_notes_mismatch_fails_without_committing_partial_refresh(self):
        self.fub.get.return_value=dict(personId=990003,body='TEST verified')
        self.p._notes_for([self.task()]);before=copy.deepcopy(self.p.notes)
        self.fub.get.return_value=dict(personId=990099,body='TEST wrong contact')
        with self.assertRaises(B.FubError):self.p._notes_for([self.task('second')])
        self.assertEqual(self.p.notes,before)

    def test_people_delta_and_full_sweep_remove_missing_records(self):
        self.fub.pages.side_effect=[
            [dict(id=990011,firstName='TEST One'),dict(id=990012,firstName='TEST Two')],
            [dict(id=990011,firstName='TEST Changed')],
            [dict(id=990011,firstName='TEST Changed')]]
        with patch.object(B.time,'monotonic',return_value=100):
            self.assertEqual(len(self.p._people(NOW)),2)
        self.p.people_since=NOW
        with patch.object(B.time,'monotonic',return_value=160):
            rows=self.p._people(NOW+timedelta(minutes=1))
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['firstName'],'TEST Changed')
        query=self.fub.pages.call_args.args[1]
        self.assertEqual(query['updatedAfter'],B.iso_z(NOW-timedelta(seconds=5)))
        with patch.object(B.time,'monotonic',return_value=1900):
            self.assertEqual([r['id'] for r in self.p._people(NOW)],[990011])
        self.assertNotIn('updatedAfter',self.fub.pages.call_args.args[1])

    def test_failed_census_preserves_cache_and_watermark(self):
        self.p.people_cache={990011:dict(id=990011)};self.p.people_since=NOW
        self.fub.pages.side_effect=B.FubError('TEST paging failed')
        with self.assertRaises(B.FubError):self.p._people(NOW)
        self.assertEqual(self.p.people_cache,{990011:dict(id=990011)})
        self.assertEqual(self.p.people_since,NOW)

    def test_delta_removal_and_pipeline_cadence(self):
        self.p.people_cache={990011:dict(id=990011)};self.p.people_since=NOW
        self.p.people_sweep_at=100
        self.fub.pages.return_value=[dict(id=990011,deleted=True)]
        self.fub.get.return_value={'pipelines':[]}
        with patch.object(B.time,'monotonic',return_value=160):
            self.assertEqual(self.p._people(NOW),[])
            self.p._pipelines();self.p._pipelines()
        self.assertEqual(self.fub.get.call_count,1)
        with patch.object(B.time,'monotonic',return_value=1960):self.p._pipelines()
        self.assertEqual(self.fub.get.call_count,2)

    def test_unchanged_hour_fetches_seven_drafts_once(self):
        self.fub.get.return_value=dict(personId=990003,body='TEST draft')
        tasks=[self.task(task_id=991000+i,note_id=992000+i) for i in range(7)]
        for _ in range(60):self.p._notes_for(tasks)
        self.assertEqual(self.fub.get.call_count,7) # old behavior: 7*60=420

class DisplaySafety(unittest.TestCase):
    def setUp(self):self.hub=B.Hub();self.client=Mock()
    def report(self,at=1000,**values):
        with patch.object(B.time,'time',return_value=at):
            self.hub.record_runtime(self.client,dict(visible=True,renderFps=30,errors=0,**values))
    def test_frozen_display_detected_in_two_minutes(self):
        self.report()
        self.assertEqual(self.hub.display_needs(1119),[])
        self.assertEqual(self.hub.display_needs(1120)[0]['failureCode'],'DISPLAY_SILENT')
    def test_low_fps_detected_in_three_minutes_and_recovers(self):
        for at in (1000,1060,1120,1180):
            with patch.object(B.time,'time',return_value=at):self.hub.record_runtime(self.client,dict(visible=True,renderFps=10,errors=0))
        self.assertEqual(self.hub.display_needs(1180)[0]['failureCode'],'DISPLAY_LOW_FPS')
        self.report(at=1200)
        self.assertEqual(self.hub.display_needs(1200),[])
    def test_error_and_hidden_tab_are_distinguished(self):
        with patch.object(B.time,'time',return_value=1000):self.hub.record_runtime(self.client,dict(visible=True,renderFps=30,errors=1))
        self.assertEqual(self.hub.display_needs(1000)[0]['failureCode'],'DISPLAY_ERROR')
        with patch.object(B.time,'time',return_value=1000):self.hub.record_runtime(self.client,dict(visible=False,renderFps=0,errors=0))
        self.assertEqual(self.hub.display_needs(1400),[])
    def test_disconnect_is_detected_and_reconnect_recovers(self):
        self.report();self.hub.clients.add(self.client)
        with patch.object(B.time,'time',return_value=1001):self.hub.remove(self.client)
        self.assertEqual(self.hub.display_needs(1121)[0]['failureCode'],'DISPLAY_DISCONNECTED')
        self.report(at=1122)
        self.assertEqual(self.hub.display_needs(1122),[])
    def test_watchdog_needs_retains_source_freshness_and_drops_on_recovery(self):
        self.hub.snapshot['panel:needs']={'type':'panel','panel':'needs','status':'stale','asOf':B.iso_z(NOW),'data':{'items':[]}}
        self.report()
        with patch.object(B.time,'time',return_value=1120):self.hub.refresh_display_needs()
        msg=self.hub.snapshot['panel:needs'];self.assertEqual(msg['status'],'stale');self.assertEqual(msg['asOf'],B.iso_z(NOW))
        self.assertEqual(msg['data']['items'][0]['id'],'sys-display-watchdog')
        self.report(at=1200)
        with patch.object(B.time,'time',return_value=1200):self.hub.refresh_display_needs()
        self.assertEqual(self.hub.snapshot['panel:needs']['data']['items'],[])

class Presentation(unittest.TestCase):
    def test_merge_tokens_are_filled_or_removed_without_damaging_percentages(self):
        self.assertEqual(B.merge_text('Hi %contact.first_name% %lastName%: %missing% at 5% or 6%',dict(firstName='TEST',lastName='Person')),'Hi TEST Person:  at 5% or 6%')
        self.assertNotIn('%firstName%',B.public_payload({'title':'Hi %firstName%'})['title'])
    def test_every_failed_job_has_code_and_recovery(self):
        label='com.beyderco.vercel-fleet-audit'
        fleet=B.build_fleet({label:{'exit':1}}, {}, {label:{'ok':False,'generated_at':B.iso_z(NOW),'summary':'access-held summary withheld'}}, {},{},NOW)
        job=fleet['jobs'][0]
        self.assertEqual(job['failureCode'],'PRIVATE_RECEIPT_REVIEW')
        self.assertIn('private receipt',job['recoveryStep'])
    def test_next_producer_run_is_future_even_when_previous_pull_is_stale(self):
        with patch.object(Path,'read_text',return_value='rrule="FREQ=DAILY;BYHOUR=7;BYMINUTE=5;BYSECOND=0"'):
            self.assertEqual(B.hotsheet_next_run(NOW).isoformat(),'2026-11-06T07:05:00-05:00')
            before=datetime.fromisoformat('2026-11-05T07:03:00-05:00')
            self.assertEqual(B.hotsheet_next_run(before).isoformat(),'2026-11-05T07:05:00-05:00')
            self.assertTrue(B.hotsheet_overdue(NOW-timedelta(days=2),NOW))

    def test_night_boundaries_in_eastern_time(self):
        source=(ROOT/'src/js/92_experience.js').read_text()
        start=source.index('function night(');end=source.index('\n',start)
        script=source[start:end]+"\nconst assert=require('node:assert/strict');"+"\n".join(f"assert.equal(night(Date.parse('{at}')),{str(expected).lower()});" for at,expected in [('2026-11-06T03:59:00Z',False),('2026-11-06T04:00:00Z',True),('2026-11-06T10:59:00Z',True),('2026-11-06T11:00:00Z',False)])
        subprocess.run(['node','-e',script],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
