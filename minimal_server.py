#!/usr/bin/env python3
import json, sqlite3, sys, re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DB_PATH = '/mnt/f/sw/ricetteTest/data/recipes.db'
BASE_DIR = '/mnt/f/sw/ricetteTest/static'

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f'{self.address_string()} {format % args}')
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        if path.startswith('/static/'):
            try:
                fname = path[len('/static/'):]
                with open(f'{BASE_DIR}/{fname}', 'rb') as f:
                    content = f.read()
                ext = fname.rsplit('.', 1)[-1] if '.' in fname else ''
                mime = {'html': 'text/html', 'js': 'application/javascript'}.get(ext, 'application/octet-stream')
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404)
            return
        
        if path.startswith('/images/'):
            try:
                fname = path[len('/images/'):]
                with open(f'/mnt/f/sw/ricetteTest/data/images/{fname}', 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/*')
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404)
            return
        
        if path == '/api/recipes':
            self.handle_recipes(query)
        elif path == '/api/stats':
            self.handle_stats()
        elif path in ('/', '/index.html'):
            try:
                with open(f'{BASE_DIR}/index.html', 'r') as f:
                    html = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                self.wfile.write(html.encode())
            except FileNotFoundError:
                self.send_error(404)
        else:
            self.send_error(404)
    
    def handle_recipes(self, query):
        q, ingredient, exclude_ingredient, favorite, status = '', '', '', False, ''
        for k, vals in query.items():
            v = vals[0] if vals else ''
            if k == 'q': q = v.strip()
            elif k == 'ingredient': ingredient = v.strip()
            elif k == 'exclude_ingredient': exclude_ingredient = v.strip()
            elif k == 'favorite': favorite = v.lower() == 'true'
            elif k == 'status': status = v
        
        # ALWAYS use non-FTS query - FTS causes hangs
        sql, params = 'SELECT r.* FROM recipes r WHERE 1=1', []
        if ingredient:
            sql += ' AND (r.title LIKE ? OR r.ingredients LIKE ? OR r.manual_text LIKE ?)'
            params.extend([f'%{ingredient}%'] * 3)
        if exclude_ingredient:
            sql += ' AND NOT (r.title LIKE ? OR r.ingredients LIKE ? OR r.manual_text LIKE ?)'
            params.extend([f'%{exclude_ingredient}%'] * 3)
        if favorite:
            sql += ' AND favorite = 1'
        if status:
            sql += f' AND r.status = ?'
            params.append(status)
        sql += ' ORDER BY updated_at DESC'
        
        conn = sqlite3.connect(DB_PATH, timeout=60.0)
        try:
            cursor = conn.execute(sql, params) if params else conn.execute(sql)
            rows = cursor.fetchall()
            cols = [col[0] for col in cursor.description]
            results = []
            for row in rows:
                item = {col: val for col, val in zip(cols, row)}
                # Parse JSON fields
                for field in ('ingredients', 'instructions', 'categories'):
                    try:
                        val_str = str(item.get(field, ''))
                        if val_str.strip():
                            parsed_val = json.loads(val_str.strip())
                            item[field] = parsed_val if isinstance(parsed_val, list) else []
                        else:
                            item[field] = []
                    except (json.JSONDecodeError, ValueError):
                        item[field] = []
                # Handle favorite
                fav_val = item.get('favorite', 0)
                if isinstance(fav_val, bytes):
                    fav_val = str(fav_val).decode()
                item['favorite'] = bool(int(fav_val)) if isinstance(fav_val, (int, str)) else False
                results.append(item)
            conn.close()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        except Exception as e:
            print(f'Error: {type(e).__name__}: {e}')
            self.send_error(500, str(e))
    
    def handle_stats(self):
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute('SELECT COUNT(*) total, COALESCE(SUM(favorite), 0) favorites FROM recipes').fetchone()
        stats = {'total': row[0] or 0, 'favorites': int(row[1])}
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(stats).encode())

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = HTTPServer(('localhost', port), Handler)
    print(f'Starting server at http://localhost:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('Shutting down...')
        server.shutdown()
