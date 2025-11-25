'use strict';

import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import fsp from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ipAddress = '127.0.0.1';
const port = 8080;
const baseUrl = `http://${ipAddress}:${port}`;

async function queryExternalApiFor24HourTemperatureForecastInGivenCity(cityName: string){
	const hours = [];
	const hourlyTemperatures = [];
	const cities = (await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${cityName}`)).json()).results;
	if(cities){ //I found out that this is undefined when using arbitrary gibberish as the cityName's value
		const city = cities[0]; //choosing the first result because I empirically found out that it is often the most relevant one, especially for names of large cities
		const forecast = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&hourly=temperature_2m`)).json();
		const numberOfNextHoursToGetForecastFor = 24;
		const oneHourBeforeCurrentTime = (+new Date())-60*60*1000; //subtracting an hour because we start from the current hour (so we start with HH:00 if the current time is HH:MM)
		for(let i = 0; i < forecast.hourly.time.length; i++){
			const hour = forecast.hourly.time[i];
			if(hours.length < numberOfNextHoursToGetForecastFor && (+new Date(hour)) > oneHourBeforeCurrentTime){
				hours.push(hour);
				hourlyTemperatures.push(forecast.hourly.temperature_2m[i]);
			}
		}
	}
	return {hours, hourlyTemperatures};
}
const cache = new Map();
async function tryToRetrieveCached24HourTemperatureForecastInGivenCity(cityName: string){
	let result = cache.get(cityName);
	if(!result){
		result = await queryExternalApiFor24HourTemperatureForecastInGivenCity(cityName);
		const numberOfMillisecondsIn15Minutes = 15*60*1000;
		setTimeout(tryToInvalidateCachedResult, numberOfMillisecondsIn15Minutes, cityName);
		cache.set(cityName,result);
	}
	return result;
}
function tryToInvalidateCachedResult(cityName: string){
	cache.delete(cityName);
}

const server = http.createServer(async function(request: InstanceType<typeof http.IncomingMessage>, response: InstanceType<typeof http.ServerResponse>){
	response.setHeader('Cache-Control', 'no-store');
	if(!request.url || !request.method){
		response.writeHead(400, { 'Content-Type': 'text/plain' });
		response.end('Ни url, ни method запроса не должны быть пустыми');
		return;
	}
	const {href, pathname, searchParams} = new URL(request.url, baseUrl);
	const method = request.method.toLowerCase();
	const cityName = searchParams.get('city');
	if(pathname === '/weather' && method === 'get'){
		if(cityName && cityName.trim()){
			const body = JSON.stringify(await tryToRetrieveCached24HourTemperatureForecastInGivenCity(cityName));
			response.writeHead(200, {'Content-Type': 'application/json'});
			response.end(body);
		}else{
			const body = JSON.stringify({error: 'Было введено пустое название города, это не разрешено'});
			response.writeHead(400, {'Content-Type': 'application/json'});
			response.end(body);
		}
	}else if(pathname === '/' && method === 'get'){
		const body = await fsp.readFile(join(dirname(__dirname),'public','index.html'));
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.end(body);
		
	}else if(pathname === '/script.js' && method === 'get'){
		const body = await fsp.readFile(join(dirname(__dirname),'public','script.js'));
		response.writeHead(200, {'Content-Type': 'text/javascript'});
		response.end(body);
		
	}else if(pathname === '/styles.css' && method === 'get'){
		const body = await fsp.readFile(join(dirname(__dirname),'public','styles.css'));
		response.writeHead(200, {'Content-Type': 'text/css'});
		response.end(body);
		
	}else if(pathname === '/favicon.ico' && method === 'get'){
		const body = await fsp.readFile(join(dirname(__dirname),'public','favicon.ico'));
		response.writeHead(200, {'Content-Type': 'image/x-icon'});
		response.end(body);
		
	}else{
		response.writeHead(404, {'Content-Type': 'application/json'});
		response.end(JSON.stringify({error: 'Not found'}));
	}
});

server.listen(port, ipAddress, () => {
	console.log('Server listening...');
});