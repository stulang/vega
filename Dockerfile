FROM node:latest
ENV HTTP_PORT 8000
COPY . /app  
WORKDIR /app
RUN yum -help
RUN npm install
RUN npm run build
EXPOSE 8000
CMD ["python -m SimpleHTTPServer 8000"]  
