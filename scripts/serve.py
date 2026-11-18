"""Static dev server that disables caching, so edited ES modules always reload.

Usage: python3 scripts/serve.py [port]   (serves the project root)
"""

import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # The page loads ~30 ES modules in parallel; the default listen backlog (5)
    # makes the OS reset some of those connections.
    request_queue_size = 128


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with Server(("127.0.0.1", port), handler) as httpd:
        print(f"Serving {ROOT} at http://127.0.0.1:{port}")
        httpd.serve_forever()
