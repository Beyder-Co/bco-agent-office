"""Synthetic transport and source checks. Never invokes a real chat, job or provider."""
from pathlib import Path
from datetime import datetime,timezone
import tempfile,time,unittest,json,uuid,os
from unittest.mock import patch
import bridge as B

class Coordinator(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory();self.addCleanup(self.folder.cleanup)
        self.root=Path(self.folder.name);self.path=self.root/'commands.jsonl';self.h=B.Hub();self.t=time.time();self.sent=[];self.client=object()
        self.c=B.OfficeCommands(self.h,self.path,self.runner,lambda:self.t)
        self.h.set_feed('fub','ok',B.iso_z(datetime.now(timezone.utc)))
        self.h.set_feed('fleet','attention',B.iso_z(datetime.now(timezone.utc)))
        self.gate={'gateId':'fub-task-123','agentId':'crimson','requestedBy':'automations','need':'Review test draft','title':'Test task','draft':'Approved sample text','link':'https://example.followupboss.com/2/people/view/9'}
        self.h.snapshot['approvals']={'items':[self.gate]}
        self.owner={'workflow':'desktop:fub-sms-flush-local','threadId':'00000000-0000-0000-0000-000000000001','name':'FUB test owner','status':'ACTIVE','verified':True}
        self.bind=patch.object(B,'office_owner_bindings',return_value=[self.owner]);self.bind.start();self.addCleanup(self.bind.stop)
    def runner(self,msg):self.sent.append(msg);return str(uuid.uuid4())
    def request(self):return {'mode':'gate','sourceId':'fub-task-123','agentId':'crimson','decision':'approve','message':''}
    def submit(self):return self.c.confirm(self.c.prepare(self.request(),self.client)['token'],self.client)
    def doc(self,name,data):
        p=self.root/name;p.write_text(json.dumps(data));return str(p)
    def receipt(self,seconds=0):return B.iso_z(datetime.fromtimestamp(self.t+seconds,timezone.utc))
    def job(self,ok,seconds=0):return dict(label='com.beyderco.monitor',name='Monitor',agent='engineer',ok=ok,summary='TEST outcome',lastFrom='record',lastAt=self.receipt(seconds),running=False)
    def observe(self,job):self.h.snapshot['fleet']={'jobs':[job]};self.c.observe_failures([job])
    def test_review_is_bound_to_client_and_to_live_source(self):
        token=self.c.prepare(self.request(),self.client)['token']
        with self.assertRaises(ValueError): self.c.confirm(token,object())
        self.gate['draft']='Changed after review'
        with self.assertRaises(ValueError):self.c.confirm(token,self.client)
        self.assertEqual(self.sent,[])
    def test_expired_review_and_stale_source_hold(self):
        token=self.c.prepare(self.request(),self.client)['token'];self.t+=181
        with self.assertRaises(ValueError):self.c.confirm(token,self.client)
        self.h.set_feed('fub','error',None)
        with self.assertRaises(ValueError):self.c.prepare(self.request(),self.client)
        self.assertFalse(self.sent)
    def test_queue_receipt_is_not_a_source_action(self):
        row=self.submit();self.assertEqual(row['state'],'queued');self.assertEqual(len(self.sent),1)
        self.assertIn(B.COORDINATOR_ID,self.sent[0]);self.assertIn('Approved sample text',self.sent[0]);self.assertIn('do not repeat',self.sent[0]);self.assertEqual(self.h.snapshot['approvals']['items'],[self.gate]);self.assertNotIn('context',self.c.view()['items'][0])
        self.assertEqual(self.submit()['id'],row['id']);self.assertEqual(len(self.sent),1)
        self.c=B.OfficeCommands(self.h,self.path,self.runner,lambda:self.t)
        self.assertEqual(self.submit()['id'],row['id']);self.assertEqual(len(self.sent),1)
    def test_uncertain_or_interrupted_handoff_never_replays(self):
        def failed(prompt):self.sent.append(prompt);raise TimeoutError()
        self.c.runner=failed;row=self.submit();self.assertEqual(row['state'],'uncertain');self.assertEqual(self.submit()['id'],row['id']);self.assertEqual(len(self.sent),1)
        self.path.write_text(json.dumps(dict(row,state='submitting'))+'\n')
        self.assertEqual(self.submit()['state'],'submitting');self.assertEqual(len(self.sent),1)
    def test_invalid_id_missing_owner_or_draft_cannot_approve(self):
        for key,bad in [('sourceId','fub-task-None'),('sourceId','fub-task-444')]:
            with self.assertRaises(ValueError):self.c.prepare(dict(self.request(),**{key:bad}),self.client)
        self.gate['draft']=''
        with self.assertRaises(ValueError):self.c.prepare(self.request(),self.client)
        self.gate['draft']='Test';self.owner['verified']=False
        with self.assertRaises(ValueError):self.c.prepare(self.request(),self.client)
    def test_source_owner_changes_between_review_and_confirm(self):
        token=self.c.prepare(self.request(),self.client)['token'];self.bind.stop();self.bind=patch.object(B,'office_owner_bindings',return_value=[dict(self.owner,status='PAUSED')]);self.bind.start();self.addCleanup(self.bind.stop)
        with self.assertRaises(ValueError):self.c.confirm(token,self.client)
        self.assertFalse(self.sent)
    def test_automatic_repair_only_new_source_failure_once_per_episode(self):
        self.observe(self.job(False,-3600));self.assertFalse(self.sent)
        self.t+=10;self.observe(self.job(False));self.assertEqual(len(self.sent),1)
        self.c=B.OfficeCommands(self.h,self.path,self.runner,lambda:self.t);self.t+=60
        self.observe(self.job(False));self.assertEqual(len(self.sent),1)
        self.observe(self.job(True,-2000));self.assertEqual(self.c.rows()[0]['state'],'queued')
        self.observe(self.job(True));self.assertEqual(self.c.rows()[0]['state'],'resolved_by_source')
        self.t+=60;self.observe(self.job(False));self.assertEqual(len(self.sent),2)
    def test_two_different_repairs_and_later_recheck_required(self):
        row=self.submit();cid=row['id'];dep='Igor must select which account owns this source.'
        a=self.doc('a.json',{'result':'supported owner access denied'});b=self.doc('b.json',{'result':'alternate authorized binding is missing'})
        def escalate(path):return self.c.result(cid,'needs_igor','Rechecked owner and supported access',[path],dependency=dep)
        with self.assertRaises(ValueError):escalate(a)
        self.c.result(cid,'attempt_failed','First repair did not restore access',[a],'repair saved owner')
        with self.assertRaises(ValueError):self.c.result(cid,'attempt_failed','Again',[b],'REPAIR SAVED OWNER')
        with self.assertRaises(ValueError):self.c.result(cid,'attempt_failed','Again',[a],'alternative binding')
        self.t+=2;self.c.result(cid,'attempt_failed','Alternate binding unavailable',[b],'verify alternate binding')
        def check(delta):return self.doc('recheck.json',dict(schema='bco.office.recheck/v1',commandId=cid,checkedAt=self.receipt(delta),source='Synthetic owning service',observation='Both authorized routes still lack the selected owner',dependency=dep))
        with self.assertRaises(ValueError):escalate(check(-120))
        with self.assertRaises(ValueError):escalate(check(600))
        self.t+=2;done=escalate(check(-1));self.assertEqual(done['attemptCount'],2);self.assertEqual(done['dependency'],dep);self.assertEqual(self.c.view()['items'][0]['state'],'needs_igor')
    def test_success_needs_evidence_but_no_second_attempt(self):
        cid=self.submit()['id'];p=self.doc('ordinary.json',{'ok':True,'test':True})
        with self.assertRaises(ValueError):self.c.result(cid,'reported_complete','Unsupported',[])
        self.assertEqual(self.c.result(cid,'reported_complete','Source result verified',[p])['state'],'reported_complete')
        with self.assertRaises(ValueError):self.c.result(cid,'received','Late notification')
    def test_request_without_known_owner_uses_coordinator_not_an_invented_route(self):
        r=self.c.prepare({'mode':'instruction','agentId':'scout','message':'Review the RealScout report'},self.client)
        self.assertIsNone(r['context']['owner']);self.assertEqual(r['context']['coordinatorId'],B.COORDINATOR_ID)
    def test_routed_assignment_records_selection_without_inventing_execution(self):
        cid=self.submit()['id'];proof=self.doc('owner.json',{'received':True,'test':True})
        with self.assertRaises(ValueError):self.c.result(cid,'assigned','Assigned to test owner',[proof])
        row=self.c.result(cid,'assigned','Assigned to test owner',[proof],model='requested test model',routing_reason='Meets the tested requirements with lower cost')
        self.assertEqual(row['routing']['selected'],'requested test model');self.assertIsNone(row['routing']['observed'])
    def test_retained_extra_native_timers_are_visible_without_including_office(self):
        listing=B.parse_launchctl_list('PID\tStatus\tLabel\n-\t0\tcom.igorbeyder.content.plan\n-\t0\tcom.igorbeyder.matrix-keepalive\n-\t0\tcom.igorbeyder.agent-office\n')
        self.assertEqual(set(listing),B.ADDITIONAL_NATIVE)
        self.assertEqual(B.agent_for_job('com.igorbeyder.matrix-keepalive')[0],'scout')
    def test_approval_cannot_send_twice_even_after_completion_or_an_edited_comment(self):
        cid=self.submit()['id'];proof=self.doc('ordinary-result.json',{'test':True});self.c.result(cid,'reported_complete','Synthetic owner result recorded',[proof])
        token=self.c.prepare(dict(self.request(),message='Changed optional comment'),self.client)['token'];self.assertEqual(self.c.confirm(token,self.client)['id'],cid);self.assertEqual(len(self.sent),1)
        self.gate['draft']='A new source draft';self.submit();self.assertEqual(len(self.sent),2)
    def test_manual_and_automatic_repair_share_one_episode(self):
        self.observe(self.job(False,-5));self.t+=20;job=self.job(False);self.observe(job);self.assertEqual(len(self.sent),1)
        req={'mode':'repair','sourceId':job['label'],'agentId':'engineer','message':'Please investigate this existing problem.'};token=self.c.prepare(req,self.client)['token'];self.c.confirm(token,self.client);self.assertEqual(len(self.sent),1)
    def test_corrupt_ledger_holds_submission(self):
        self.path.write_text('{broken\n')
        with self.assertRaises(ValueError):self.submit()
        self.assertFalse(self.sent)
    def test_noninstalled_bridge_cannot_use_real_cli(self):
        self.assertFalse(B.OfficeCommands(self.h,self.path).enabled())

if __name__=='__main__':unittest.main()
