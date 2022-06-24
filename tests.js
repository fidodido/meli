const request = require('supertest');
const assert = require('assert');
const express = require('express');
var app = require('./app');


// tests de integracion.



// ruta /*
request(app)
	.post('/get-short-url')
	.send('url=https://armistic.cl')
	.expect('Content-Type', /json/)
	.expect(200)
	.end(function(err, res) {

		
		if (err) throw err;

		console.log('test is passed');

		var short_url = res._body.url;
		var url_code = short_url.substr(app.SHORT_DOMAIN.length);


		request(app)
			.get('/' + url_code)
			.expect(302)
			.end(function(err, res) {

				if (err) throw err;

				console.log('test is passed');
				return;

			});


		request(app)
			.post('/get-long-url')
			.send('url=http://localhost:3000/' + url_code)
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res) {

				if (err) throw err;

				console.log('test is passed');

			});

		request(app)
			.post('/delete-short-url')
			.send('url=http://localhost:3000/' + url_code)
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res) {

				if (err) throw err;

				console.log('test is passed');

			});	

		request(app)
			.post('/get-statistics')
			.expect('Content-Type', /json/)
			.expect(200)
			.end(function(err, res) {

				if (err) throw err;

				console.log('test is passed');

			});	


	});