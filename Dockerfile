FROM node:latest
FROM python:2.7
ENV HTTP_PORT 8000
COPY . /app  
WORKDIR /app

RUN npm install
RUN npm run build
EXPOSE 8000
CMD ["python -m SimpleHTTPServer 8000"]  
