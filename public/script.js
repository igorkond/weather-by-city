'use strict';

document.addEventListener('DOMContentLoaded',async function(){
	document.getElementById('render-graph').addEventListener('click', async function(){
		await renderGraph();
	});
	document.getElementById('text-box').addEventListener('keydown', async function(e){
		if(e.key === 'Enter'){
			await renderGraph();
		}
	});
});

async function renderGraph(){
	const chart = Chart.getChart('temperature-chart');
	if(chart){
		chart.destroy(); //deleting the old chart (if it already exists) before creating a new one
	}
	
	const cityName = document.getElementById('text-box').value;
	if(!cityName || !cityName.trim()){
		confirm('Было введено пустое название города, это не разрешено');
		return;
	}
	const results = await (await fetch(`http://127.0.0.1:8080/weather?city=${cityName}`)).json();
	const {hours, hourlyTemperatures} = results;

	const canvas = document.getElementById('temperature-chart');

	new Chart(canvas, {
		type: 'line',
		data: {
			labels: hours,
			datasets: [{
				label: 'Температура, °C',
				data: hourlyTemperatures,
				borderWidth: 1
			}]
		},
		options: {
			interaction: {
				mode: 'index',
				axis: 'x',
				intersect: false
			},
			scales: {
				y: {
					beginAtZero: true
				}
			}
		}
	});
}