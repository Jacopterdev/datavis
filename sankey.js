function main() {
	// Example Exercise to understand d3. 
	d3.select('div') //Select the first div in the DOM.
		.selectAll('p') //Select all p's inside that div.
		.data([1,2,3]) //Bind the data to those missing p's.
		.enter() //Select those missing p's. 
		.append('p') //Now create the p's.
		.text(dta => dta); //Let them take form as text elements.
}
