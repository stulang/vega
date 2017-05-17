FROM node:latest
FROM python:2.7

COPY . /app  
WORKDIR /app

RUN npm install
RUN npm run build

CMD ["python -m SimpleHTTPServer 8000"]  
