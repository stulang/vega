#!/usr/bin/env node

var util = require('util'),
    http = require('http'),
    fs = require('fs'),
    url = require('url'),
    events = require('events');

var DEFAULT_PORT = 8000;

function main(argv) {//console.log('main');
  new HttpServer({
    'GET': createServlet(StaticServlet),
    'HEAD': createServlet(StaticServlet)
  }).start(Number(argv[2]) || DEFAULT_PORT);
}

function escapeHtml(value) {
  return value.toString().
    replace('<', '&lt;').
    replace('>', '&gt;').
    replace('"', '&quot;');
}

function createServlet(Class) {//console.log('createServlet');
  var servlet = new Class();
  return servlet.handleRequest.bind(servlet);
}

/**
 * An Http server implementation that uses a map of methods to decide
 * action routing.
 *
 * @param {Object} Map of method => Handler function
 */
function HttpServer(handlers) {//console.log('HttpServer');
  this.handlers = handlers;
  this.server = http.createServer(this.handleRequest_.bind(this));
}

HttpServer.prototype.start = function(port) {//console.log('start');
  this.port = port;
  this.server.listen(port);
  util.puts('Http Server running at http://localhost:' + port + '/');
};

HttpServer.prototype.parseUrl_ = function(urlString) {//console.log('parseUrl_');
  var parsed = url.parse(urlString);
  parsed.pathname = url.resolve('/', parsed.pathname);
  return url.parse(url.format(parsed), true);
};

HttpServer.prototype.handleRequest_ = function(req, res) {//console.log('handleRequest_'); 
  var logEntry = req.method + ' ' + req.url;
  if (req.headers['user-agent']) {
    logEntry += ' ' + req.headers['user-agent'];
  }
  util.puts(logEntry);
  req.url = this.parseUrl_(req.url);
  var handler = this.handlers[req.method];
  if (!handler) {
    res.writeHead(501);
    res.end();
  } else {
    handler.call(this, req, res);
  }
};

/**
 * Handles static content.
 */
function StaticServlet() {}

StaticServlet.MimeMap = {
  'txt': 'text/plain',
  'html': 'text/html;charset=utf-8',
  'css': 'text/css',
  'xml': 'application/xml',
  'json': 'application/json',
  'js': 'application/javascript',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'png': 'image/png',
 'svg': 'image/svg+xml'
};

StaticServlet.prototype.handleRequest = function(req, res) {//console.log('handleRequest');
  var self = this;
  var path = ('./' + decodeURIComponent(req.url.pathname)).replace('//','/').replace(/%(..)/g, function(match, hex){
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  var parts = path.split('/');  
  if (parts[parts.length-1].charAt(0) === '.')
    return self.sendForbidden_(req, res, path);
  fs.stat(path, function(err, stat) {
    if (err)
      return self.sendMissing_(req, res, path);
    if (stat.isDirectory())
      return self.sendDirectory_(req, res, path);
    return self.sendFile_(req, res, path);
  });
}

StaticServlet.prototype.sendError_ = function(req, res, error) {//console.log('sendError_');
  res.writeHead(500, {
      'Content-Type': 'text/html;charset=utf-8'
  });
  res.write('<!doctype html>\n  <head><meta charset="utf-8"> \n <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">  </head>');
  res.write('<title>Internal Server Error</title>\n');
  res.write('<h1>Internal Server Error</h1>');
  res.write('<pre>' + escapeHtml(util.inspect(error)) + '</pre>');
  util.puts('500 Internal Server Error');
  util.puts(util.inspect(error));
};

StaticServlet.prototype.sendMissing_ = function(req, res, path) {//console.log('sendMissing_');
  path = path.substring(1);
  res.writeHead(404, {
      'Content-Type': 'text/html;charset=utf-8'
  });
  res.write('<!doctype html>\n  <head><meta charset="utf-8"> \n <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">  </head>');
  res.write('<title>404 Not Found</title>\n');
  res.write('<h1>Not Found</h1>');
  res.write(
    '<p>The requested URL ' +
    escapeHtml(path) +
    ' was not found on this server.</p>'
  );
  res.end();
  util.puts('404 Not Found: ' + path);
};

StaticServlet.prototype.sendForbidden_ = function(req, res, path) {//console.log('sendForbidden_');
  path = path.substring(1);
  res.writeHead(403, {
      'Content-Type': 'text/html;charset=utf-8'
  });
  res.write('<!doctype html>\n  <head><meta charset="utf-8"> \n <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">  </head>');
  res.write('<title>403 Forbidden</title>\n');
  res.write('<h1>Forbidden</h1>');
  res.write(
    '<p>You do not have permission to access ' +
    escapeHtml(path) + ' on this server.</p>'
  );
  res.end();
  util.puts('403 Forbidden: ' + path);
};

StaticServlet.prototype.sendRedirect_ = function(req, res, redirectUrl) {//console.log('sendRedirect_');
  res.writeHead(301, {
      'Content-Type': 'text/html;charset=utf-8',
      'Location': redirectUrl
  });
  res.write('<!doctype html>\n  <head><meta charset="utf-8"> \n <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">  </head>');
  res.write('<title>301 Moved Permanently</title>\n');
  res.write('<h1>Moved Permanently</h1>');
  res.write(
    '<p>The document has moved <a href="' +
    redirectUrl +
    '">here</a>.</p>'
  );
  res.end();
  util.puts('301 Moved Permanently: ' + redirectUrl);
};

StaticServlet.prototype.sendFile_ = function(req, res, path) {//console.log('sendFile_');
  var self = this;
  var file = fs.createReadStream(path);
  res.writeHead(200, {
    'Content-Type': StaticServlet.
      MimeMap[path.split('.').pop()] || 'text/plain'
  });
  if (req.method === 'HEAD') {
    res.end();
  } else {
    file.on('data', res.write.bind(res));
    file.on('close', function() {
      res.end();
    });
    file.on('error', function(error) {
      self.sendError_(req, res, error);
    });
  }
};

StaticServlet.prototype.sendDirectory_ = function(req, res, path) {//console.log('sendDirectory_');
  var self = this;
  if (path.match(/[^\/]$/)) {
    req.url.pathname += '/';
    var redirectUrl = url.format(url.parse(url.format(req.url)));
    return self.sendRedirect_(req, res, redirectUrl);
  }
  fs.readdir(path, function(err, files) {
    if (err)
      return self.sendError_(req, res, error);

    if (!files.length)
      return self.writeDirectoryIndex_(req, res, path, []);

    var remaining = files.length;
    files.forEach(function(fileName, index) {
      fs.stat(path + '/' + fileName, function(err, stat) {
        if (err)
          return self.sendError_(req, res, err);
        if (stat.isDirectory()) {
          files[index] = fileName + '/';
        }
        if (!(--remaining))
          return self.writeDirectoryIndex_(req, res, path, files);
      });
    });
  });
};

StaticServlet.prototype.writeDirectoryIndex_ = function(req, res, path, files) {//console.log('writeDirectoryIndex_');
  path = path.substring(1);
  res.writeHead(200, {
    'Content-Type': 'text/html;charset=utf-8'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.write('<!doctype html>\n  <head><meta charset="utf-8"> \n <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width">  </head>');
  res.write('<title>' + escapeHtml(path) + '</title>\n');
  res.write(' <button onclick="history.go(-1)">Back</button>\n');
  res.write('<style>\n');
  res.write('  ol { list-style-type: none; font-size: 1.2em; }\n');
  res.write('</style>\n');
  res.write('<h1>Directory: ' + escapeHtml(path) + '</h1>');
  res.write('<ol>');
	var reg = new RegExp(/\.swf$|\.avi$|\.flv$|\.mpg$|\.mp4$|\.rm$|\.mov$|\.wav$|\.asf$|\.3gp$|\.mkv$|\.rmvb$/i);
  files.forEach(function(fileName) {
    if (fileName.charAt(0) !== '.') {
		console.log(reg.test(fileName));
		if(reg.test(fileName)){// 视屏格式跳转到视频播放界面
			res.write('<li><a href="/video.html?file=' +
			escapeHtml(path)+escapeHtml(fileName) + '">' +
			escapeHtml(fileName) + '</a></li>');
		}else{
			res.write('<li><a href="' +
			escapeHtml(fileName) + '">' +
			escapeHtml(fileName) + '</a></li>');
		}
    }
  });
  res.write('</ol>');
  res.end();
};

// Must be last,
main(process.argv);
