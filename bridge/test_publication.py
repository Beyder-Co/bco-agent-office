# Offline publication boundary regressions; all fixtures are synthetic.
import http.client,json,os,re,subprocess,sys,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import patch
import bridge as B

ROOT=Path(__file__).resolve().parents[1]

class PublicationBoundary(unittest.TestCase):
    def test_browser_origin_matrix_and_no_query_escape(self):
        source=(ROOT/'src/js/88_bridge.js').read_text()
        function=source[source.index('function resolveBridgeUrl('):source.index("/** The bridge's own report:")]
        script="const vm=require('node:vm'),assert=require('node:assert/strict');const source="+json.dumps(function)+";"+r"""
        for(const origin of ['https://office.beyderco.com','https://bco-agent-office.vercel.app','http://127.0.0.1:8000','http://localhost:4317','http://[::1]:4317','https://127.0.0.1:4317','null']) {
          for(const search of ['', '?bridge=ws://127.0.0.1:4317/ws','?demo=0&bridge=ws://localhost:4317/ws']) {
            const c={window:{},location:{origin,search},URLSearchParams};vm.createContext(c);vm.runInContext(source,c);
            assert.equal(vm.runInContext('resolveBridgeUrl()',c),null);
          }
        }
        for(const mode of ['local','public','artifact']) {
          const c={window:{BCO_PUBLIC_DEMO:mode==='public',BCO_ARTIFACT:mode==='artifact'},location:{origin:'http://127.0.0.1:4317',search:'?bridge=ws://evil.invalid/ws'},URLSearchParams};vm.createContext(c);vm.runInContext(source,c);
          assert.equal(vm.runInContext('resolveBridgeUrl()',c),mode==='local'?'ws://127.0.0.1:4317/ws':null);
        }
        """
        subprocess.run(['node','-e',script],check=True,capture_output=True)

    def test_http_host_and_origin_guard_all_paths(self):
        server=B.Server(('127.0.0.1',0),B.Handler);port=server.server_address[1]
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            with patch.dict(B.CFG,port=port):
                host=f'127.0.0.1:{port}';origin='http://'+host
                def request(path,hosts,origins):
                    c=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
                    c.putrequest('GET',path,skip_host=True)
                    for h in hosts:c.putheader('Host',h)
                    for o in origins:c.putheader('Origin',o)
                    c.endheaders();r=c.getresponse();r.read();status=r.status;c.close();return status
                for path in ('/','/health','/diagnostics','/vendor/three/build/three.min.js','/ws'):
                    for hosts,origins in [(['rebind.invalid'],[]),([host],['https://office.beyderco.com']),([host],['null']),([host],['http://localhost:'+str(port)]),([host,host],[]),([host],[origin,origin]),([],[])]:
                        with self.subTest(path=path,hosts=hosts,origins=origins):self.assertEqual(request(path,hosts,origins),403)
                self.assertEqual(request('/health',[host],[]),200)
                self.assertEqual(request('/health',[host],[origin]),200)
        finally:server.shutdown();server.server_close();t.join()

    def test_public_output_has_no_network_transport(self):
        subprocess.run([sys.executable,str(ROOT/'build.py'),'--public'],check=True,capture_output=True)
        page=(ROOT/'dist/public/index.html').read_text()
        self.assertIn('window.BCO_PUBLIC_DEMO=true;',page)
        self.assertIn('TEST sample',page)
        config=json.loads((ROOT/'vercel.json').read_text())
        headers={h['key']:h['value'] for h in config['headers'][0]['headers']}
        self.assertIn("connect-src 'none'",headers['Content-Security-Policy'])
        self.assertIn('noindex',headers['X-Robots-Tag'])
        files=[p.relative_to(ROOT/'dist/public').as_posix() for p in (ROOT/'dist/public').rglob('*') if p.is_file()]
        self.assertTrue(all(p in ('index.html','robots.txt') or p.startswith('vendor/') for p in files))

    def test_unconfigured_private_reader_is_closed(self):
        with patch.dict(B.CFG,access_hold_ids=None),patch.object(B,'read_env_values') as read:
            self.assertEqual(B.fub_credentials(),{});read.assert_not_called()

if __name__=='__main__':unittest.main()
