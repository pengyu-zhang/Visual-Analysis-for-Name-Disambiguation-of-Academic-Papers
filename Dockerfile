# Static hosting of the visualization app.
#   docker build -t vand .
#   docker run --rm -p 8080:80 vand
# then open http://localhost:8080/
FROM nginx:1.27-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY vendor/ /usr/share/nginx/html/vendor/
COPY data/demo_papers.csv /usr/share/nginx/html/data/demo_papers.csv
