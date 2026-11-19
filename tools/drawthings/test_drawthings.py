"""Test bằng server giả lập: python3 -m unittest tools/drawthings/test_drawthings.py"""
import base64, json, os, sys, tempfile, threading, unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
sys.path.insert(0, os.path.dirname(__file__))
import drawthings

PNG = base64.b64encode(b"\x89PNG fake").decode()
seen = []

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        seen.append((self.path, body))
        out = json.dumps({"images": [PNG] * body.get("batch_size", 1)}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(out)
    do_GET = lambda s: (s.send_response(200), s.end_headers())
    def log_message(self, *a): pass

class T(unittest.TestCase):
    @classmethod
    def setUpClass(c):
        c.srv = HTTPServer(("127.0.0.1", 0), H); c.url = f"http://127.0.0.1:{c.srv.server_port}"
        threading.Thread(target=c.srv.serve_forever, daemon=True).start()
    @classmethod
    def tearDownClass(c): c.srv.shutdown()

    def test_txt2img(self):
        d = tempfile.mkdtemp(); seen.clear()
        drawthings.main(["--url", self.url, "txt2img", "-p", "hi", "--count", "2", "-o", d])
        self.assertEqual(seen[0][0], "/sdapi/v1/txt2img"); self.assertEqual(len(os.listdir(d)), 2)

    def test_img2img_and_batch(self):
        d = tempfile.mkdtemp(); src = os.path.join(d, "s.png"); open(src, "wb").write(b"x")
        jobs = os.path.join(d, "j.json")
        json.dump([{"prompt": "a"}, {"prompt": "b", "image": src, "strength": 0.4}], open(jobs, "w"))
        seen.clear(); drawthings.main(["--url", self.url, "batch", jobs, "-o", d])
        self.assertEqual([p for p, _ in seen], ["/sdapi/v1/txt2img", "/sdapi/v1/img2img"])
        self.assertEqual(seen[1][1]["strength"], 0.4); self.assertIn("init_images", seen[1][1])

    def test_ping(self): drawthings.main(["--url", self.url, "ping"])

if __name__ == "__main__": unittest.main()
