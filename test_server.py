from http.server import HTTPServer, SimpleHTTPRequestHandler

    def do_GET(self):
class RecipeHandler(SimpleHTTPRequestHandler):
        self.send_response(200)
        self.send_header(\"Content-type\", \"application/json\")
    def do_GET(self): return super().do_GET() if self.path != "/api/recipes" else None
        recipes = \"[{\\\"id\\\":\\\"af481d03b7c7\\\",\\\"title\\\":\\\"Crostata\\\",\\\"categories\\\":[\\\"Antipasti\\\",\\\"Dolci\\\"]}]\\\"
        self.end_headers()
        self.wfile.write(recipes.encode())
if __name__ == "__main__":

