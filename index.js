"use strict";

const http = require("http");
const httpProxy = require("http-proxy")
const express = require("express")
const port = process.env.PORT || 8081
const app = require('express')();

function requestPath(req) {
    const segments = req.path.split(/\//);
    segments.shift();

    let protocol;
    let host = segments.shift();
    if (!host.match(/:$/)) {
        protocol = 'http:';
    } else {
        protocol = host;
        segments.shift(); // double slash
        host = segments.shift();
    };
    host = protocol + '//' + host;
    const path = '/' + segments.join('/');

    return host + path;
}

app.use('/proxy/', function(req, res, next) {
    const target = requestPath(req);
    console.log('proxy', target);

    httpProxy.createProxyServer({
        target,
        followRedirects: true,
        changeOrigin: true,
        ignorePath: true,
    }).web(req, res, {}, next);
});

app.use('/cors/', function(req, res, next) {
    const target = requestPath(req);
    console.log('cors', target);

    const allowOrigin = process.env.ALLOW_ORIGIN || '*';
    const allowMethods = process.env.ALLOW_METHODS || '*';
    const allowHeaders = process.env.ALLOW_HEADERS || 'X-Requested-With';

    const proxy = httpProxy.createProxyServer({
        target,
        followRedirects: true,
        changeOrigin: true,
        ignorePath: true,
    });
    proxy.on('proxyRes', function (proxyRes, req, res) {
	    proxyRes.headers['Access-Control-Allow-Origin'] = allowOrigin;
	    proxyRes.headers['Access-Control-Allow-Methods'] = allowMethods;
	    proxyRes.headers['Access-Control-Allow-Headers'] = allowHeaders;
    });
    proxy.web(req, res, {}, next);
});

const server = http.createServer(app);
server.listen(port, () => {
    console.log("Server listening on port %d", port);
});

