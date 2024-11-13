
//
// originalData --> The entire dataset for preliminary filters
// |
// | (is defined as const when the dataset is loaded)
// |
// groupedData --> The filtered dataset with all elements for selections
// |
// | (Should be able to add and remove between these two when interacting with the graph)
// |
// dataset & graph --> The current, visible and selected data
//


let groupedData;

let dataset;

let graph = null;  // Store the current graph data

let col1;
let col2;

let selectedTopN = 5;

//Node Color maps
const colorMap = new Map();

const categoricalColumns = [
    "Month", "Country", "Region", "city", "AttackType", 
    "Target", "Group", "Target_type", "Weapon_type", 
    "Deadly", "AnyCasualties"
];

const categoricalColumnsModerated = [
  "Country", "Region", "AttackType", "Target_type", "Weapon_type", 
  "Deadly", "AnyCasualties"
];


// List of quantifiable columns
const quantifiableColumns = ['Incidents', 'Killed', 'Wounded', 'Casualties'];

const width = 928;
const height = 720;

let svg;
let sankey;



// Function to group and either count rows or sum specific columns
function groupAndAggregate(data, operation, sumCol) {
  const groupedData = {};

  data.forEach(row => {
    const key = `${row[col1]}|${row[col2]}`;
    if (!groupedData[key]) {
      groupedData[key] = { [col1]: row[col1], [col2]: row[col2], Count: 0 };
    }
    if (operation === 'count') {
      groupedData[key].Count++;
    } else if (operation === 'sum') {
      groupedData[key].Count += row[sumCol] || 0; // Ensure the value exists and is a number
    }
  });

  return Object.values(groupedData);
}

// Function to prepare data for the Sankey diagram
function prepareSankeyData(data) {
    const keys = [col1, col2];
    const nodes = [];
    const nodeByKey = new d3.InternMap([], JSON.stringify);
    const indexByKey = new d3.InternMap([], JSON.stringify);
    const links = [];
    let index = -1;

    for (const k of keys) {
      for (const d of data) {
        const key = [k, d[k]];
        if (nodeByKey.has(key)) continue;
        const node = { name: d[k] };
        nodes.push(node);
        nodeByKey.set(key, node);
        indexByKey.set(key, ++index);
      }
    }

    for (let i = 1; i < keys.length; ++i) {
      const a = keys[i - 1];
      const b = keys[i];
      const prefix = keys.slice(0, i + 1);
      const linkByKey = new d3.InternMap([], JSON.stringify);
      for (const d of data) {
        const names = prefix.map(k => d[k]);
        const value = +d.Count || 0; //Not sure if 1 or 0...
        let link = linkByKey.get(names);
        if (link) { link.value += value; continue; }
        link = {
          source: indexByKey.get([a, d[a]]),
          target: indexByKey.get([b, d[b]]),
          names,
          value
        };
        links.push(link);
        linkByKey.set(names, link);
      }
    }
    return { nodes, links };
}

function updateChart(data, newCol1, newCol2, linkAttr, bypassFilter=false) {
  
  //Update Cols
  col1 = newCol1;
  col2 = newCol2;

  var filteredData = data;

  if(!bypassFilter){
    filteredData = filterData(data, getSelectedValues());
  }
  
  console.log("filtereddata:", filteredData);
  // Group and count depending on the link/quantifiable data type
  if (linkAttr === 'Incidents') {
    groupedData = groupAndAggregate(filteredData, 'count');
  } else {
    groupedData = groupAndAggregate(filteredData, 'sum', linkAttr);
  }

  // Remove any existing SVG
  d3.select("#chart").selectAll("*").remove();

  // Create SVG
  svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

  sankey = d3.sankey()
    .nodeSort((a, b) => d3.descending(a.value, b.value))
    .linkSort((a, b) => d3.descending(a.value, b.value))
    .nodeWidth(40)
    .nodePadding(20)
    .extent([[0, 5], [width, height - 5]]);


  dataset = reduceToTopN(groupedData);
  renderSankey(dataset);
  
}

function renderSankey(data) {
  // Convert to Sankey data
  graph = prepareSankeyData(data);

  console.log("Sankey data:", graph);

   // Extract rows for color coding
  const col2Rows = Array.from(new Set(data.map(d => d[col2])));
  const color = d3.scaleOrdinal()
    .domain(col2Rows)
    .range(d3.schemeCategory10)
    .unknown("#ccc");
  
  const { nodes, links } = sankey({
    nodes: graph.nodes.map(d => Object.create(d)),
    links: graph.links.map(d => Object.create(d))
  });

  console.log("Rendered nodes:", nodes);
  console.log("Rendered links:", links);

  // Bind data to nodes
  const node = svg.selectAll(".node")
    .data(nodes, d => d.name);

  // Enter new nodes
  const nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .on("click", function(event, d) {
      handleNodeClick(d);
    });

  nodeEnter.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.name));

  nodeEnter.append("title")
    .text(d => `${d.name}\n${d.value.toLocaleString()}`);

  // Update existing nodes
  node.select("rect").transition().duration(750)
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("height", d => d.y1 - d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("fill", d => color(d.name));

  node.select("title")
    .text(d => `${d.name}\n${d.value.toLocaleString()}`);

  // Remove old nodes
  node.exit().transition().duration(750)
  .attr("opacity", 0)
  .remove();

  // When rendering nodes in the Sankey plot
  //nodes.attr("fill", d => nodeColor(d));
  

  // Bind data to links
  const link = svg.selectAll(".link")
    .data(links, d => `${d.source.name}-${d.target.name}`);

  // Enter new links
  const linkEnter = link.enter().append("path")
    .attr("class", "link")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", d => color(d.names[1]))
    .attr("stroke-width", d => Math.max(1, d.width))
    .attr("stroke-opacity", 0.7)
    .attr("fill", "none")
    .style("mix-blend-mode", "multiply");

  linkEnter.append("title")
    .text(d => `${d.names.join(" → ")}\n${d.value.toLocaleString()}`);

  // Update existing links
  link.transition().duration(750)
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", d => color(d.names[1]))
    .attr("stroke-width", d => Math.max(1, d.width));

  link.select("title")
    .text(d => `${d.names.join(" → ")}\n${d.value.toLocaleString()}`);

  // Remove old links
  link.exit().transition().duration(750)
    .attr("opacity", 0)
    .remove();

  // Bind data to node labels
  const label = svg.selectAll(".label")
    .data(nodes, d => d.name);

  // Enter new labels
  const labelEnter = label.enter().append("text")
    .attr("class", "label")
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => d.name);

  labelEnter.append("tspan")
    .attr("fill-opacity", 0.7)
    .text(d => ` ${d.value.toLocaleString()}`);

  // Update existing labels
  label.transition().duration(750)
    .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr("y", d => (d.y1 + d.y0) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
    .text(d => d.name)
    .select("tspan")
    .attr("fill-opacity", 0.7)
    .text(d => ` ${d.value.toLocaleString()}`);

  // Remove old labels
  label.exit().transition().duration(750)
    .attr("opacity", 0)
    .remove();
}

// Function to get top N categories by count along with counts
function getTopCategories(data, col, topN) {
  const counts = {};

  data.forEach(row => {
    if (!counts[row[col]]) {
      counts[row[col]] = 0;
    }
    counts[row[col]]++;
  });

  const sortedCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const topCategories = sortedCounts.slice(0, topN).map(d => d[0]);

  return { topCategories, counts };
}

function handleNodeClick(clickedNode) {
  // Remove clicked node from data
  const newDataset = dataset.filter(row => row[col1] !== clickedNode.name && row[col2] !== clickedNode.name);

  dataset = newDataset;
  // Re-render the Sankey diagram with updated data
  renderSankey(dataset, col1, col2);
}

// Function to categorize data and group non-top categories as 'Other' based on the includeOther flag
function reduceToTopN(data, topN = selectedTopN, includeOther = false) {
  const { topCategories: topCol1, counts: countsCol1 } = getTopCategories(data, col1, topN);
  const { topCategories: topCol2, counts: countsCol2 } = getTopCategories(data, col2, topN);

  return data.filter(row => {
    const newRow = { ...row };

    // If 'includeOther' is true, categorize non-top values as "Other"
    if (includeOther) {
      if (!topCol1.includes(row[col1])) {
        newRow[col1] = 'Other';
      }

      if (!topCol2.includes(row[col2])) {
        newRow[col2] = 'Other';
      }

      return true; // Keep the row with 'Other' values
    }

    // If 'includeOther' is false, only keep rows that belong to the top categories
    return topCol1.includes(row[col1]) && topCol2.includes(row[col2]);
  });
}

function addNodeToColumn(column, key, otherKey) {
  const inputId = `node${column.charAt(0).toUpperCase() + column.slice(1)}`;  // Dynamically get input ID
  const buttonId = `add${column.charAt(0).toUpperCase() + column.slice(1)}Button`; // Dynamically get button ID

  // Get the value from the input field and trim spaces
  const value = document.getElementById(inputId).value.trim();
  console.log(`Input value for ${column}: '${value}'`);  // Debugging input value

  if (value) {
      // Loop through groupedData and find the matching entries by column (key)
      const nodesToReAdd = groupedData.filter(d => {
          // Trim spaces and handle case insensitivity
          const dataValue = d[key]?.toLowerCase().trim();
          const inputValue = value.toLowerCase();

          // Check if the otherKey exists in the dataset
          const otherKeyExists = dataset.some(existingNode => existingNode[otherKey] === d[otherKey]);

          return dataValue === inputValue && d.Count > 0 && dataset.some(existingNode => existingNode[otherKey] === d[otherKey]);
      });  // Find nodes by column value
      console.log(`Searching for '${value}' in ${key} within groupedData...`);
      console.log(groupedData);
      
      if (nodesToReAdd.length > 0) {
          console.log(`Found nodes to re-add:`, nodesToReAdd);  // Debugging: print found nodes

          // Check if the nodes already exist in the dataset
          const nodeExists = nodesToReAdd.some(d => dataset.some(existingNode => existingNode[key] === d[key]));
          console.log(`Do any of the nodes already exist in dataset?: ${nodeExists}`);  // Debugging: check if nodes exist in dataset

          if (!nodeExists) {
              // Add all the found nodes back to dataset
              dataset.push(...nodesToReAdd);
              console.log(`Nodes added to dataset. Re-rendering Sankey diagram...`);
              renderSankey(dataset, col1, col2);  // Re-render the Sankey diagram with updated data
          } else {
              alert("Node(s) already exist in the dataset.");
          }
      } else {
          alert(`No node found in the grouped data for ${column}: ${value}`);
      }
  } else {
      alert(`Please enter a value for ${column}.`);
  }
}

function setupFilterMenu(data){
  var uniqueValues = {};
  console.log("scanning dataset");
            // Extract unique values for each column
            categoricalColumnsModerated.forEach(function(column) {
                uniqueValues[column] = Array.from(new Set(data.map(function(d) { return d[column]; })));
                console.log(uniqueValues);
            });

            // Populate each select element with the unique values
            categoricalColumnsModerated.forEach(function(column) {
                populateSelect(column, uniqueValues[column]);
            });
}

function populateSelect(elementId, data) {
  console.log("populating", elementId);
  var select = document.getElementById(elementId);
  if(select == null) {
    console.log("couldnt find", elementId);
    return;
  }
  data.forEach(function(item) {
      var option = document.createElement("option");
      option.value = item;
      option.text = item;
      option.selected = true; // Select all options by default
      select.add(option);
  });
  // Re-initialize the multiselect plugin to reflect new options
  $(select).multiselect('rebuild');
}

// Function to filter the data based on selected values
// Function to filter the data based on selected values
function filterData(data, selectedValues) {
  return data.filter(function(d) {
      return Object.keys(selectedValues).every(function(key) {
          // Convert selected values and data value to strings
          const selectedValuesForKey = selectedValues[key].map(v => v.trim().toString()); // Convert selected values to strings
          const dataValueForKey = d[key].toString(); // Convert data value to string //TODO Change so that if the value is null, we just skip it. 

          // Check if the value is included
          const isIncluded = selectedValuesForKey.includes(dataValueForKey);

          // Perform the filtering check
          return selectedValuesForKey.length === 0 || isIncluded;
      });
  });
}

// function getSelectedValues() {
//   var selectedValues = {};
//   categoricalColumnsModerated.forEach(function (column) {
//     selectedValues[column] = $('#' + column).val();
//   });
//   return selectedValues;
// }

function getSelectedValues() {
  var selectedValues = {};

  // Get values from the multi-select elements
  categoricalColumnsModerated.forEach(function (column) {
    selectedValues[column] = $('#' + column).val();
  });

  // Get values from the tag input containers
  const tagContainers = ['city', 'Target', 'Group'];
  tagContainers.forEach(function (containerId) {
    selectedValues[containerId] = getTags(containerId);
  });
  console.log("Selected Values: ", selectedValues);
  return selectedValues;
}

function getTags(containerId) {
  const tags = [];
  const tagInputContainer = document.getElementById(containerId);
  tagInputContainer.querySelectorAll('.tag').forEach(tagElement => {
    tags.push(tagElement.firstChild.textContent);
  });
  return tags;
}

function setupTagInput(containerId, inputId) {
  const tagInputContainer = document.getElementById(containerId);
  const tagInput = document.getElementById(inputId);

  tagInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const tagText = tagInput.value.trim();
      if (tagText) {
        addTag(tagText, tagInputContainer, tagInput);
        tagInput.value = '';
      }
    }
  });
}

function addTag(text, container, input) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = text;

  const removeTag = document.createElement('span');
  removeTag.className = 'remove-tag';
  removeTag.textContent = 'x';
  removeTag.addEventListener('click', function() {
    container.removeChild(tag);
  });

  tag.appendChild(removeTag);
  container.insertBefore(tag, input);
}

// Load the data
d3.csv("terror_cleaned.csv", d3.autoType).then(data => {
    dataset = data;
    const originalDataset = dataset;

    console.log("Data loaded:", data);

    setupFilterMenu(data); //Some of them are not rendered: Limited to only moderate sized columns...

    // Setup the tag input fields
    setupTagInput('city', 'cityTagInput');
    setupTagInput('Target', 'targetTagInput');
    setupTagInput('Group', 'groupTagInput');

    // Populate dropdowns
    const select1 = d3.select("#column1");
    const select2 = d3.select("#column2");
    const selectLink = d3.select("#link");

    categoricalColumns.forEach(column => {
      select1.append("option").text(column).attr("value", column);
      select2.append("option").text(column).attr("value", column);
    });

    quantifiableColumns.forEach(column => {
      selectLink.append("option").text(column).attr("value", column);
    });

    // Set default selections
    if (categoricalColumns.length > 0) {
      select1.property("value", categoricalColumns[2]);
      select2.property("value", categoricalColumns[4] || categoricalColumns[2]);

      selectLink.property("value", quantifiableColumns[0]);

      // Add event listener to update button
      d3.select("#update").on("click", () => {
        const col1 = select1.property("value");
        const col2 = select2.property("value");
        const linkAttr = selectLink.property("value");
        dataset = originalDataset;
        updateChart(dataset, col1, col2, linkAttr);
      });

      // Get the slider element
      const topNSlider = document.getElementById('topNSlider');
      const sliderValue = document.getElementById('sliderValue');

      // Set the default value of the slider
      topNSlider.value = selectedTopN;
      sliderValue.textContent = selectedTopN;

      // Update the selectedTopN variable and displayed value when the slider value changes
      topNSlider.addEventListener('input', function () {
        selectedTopN = parseInt(topNSlider.value);
        sliderValue.textContent = selectedTopN;
      });

      
      // Handle click event for adding a node to col1
      document.getElementById('addCol1Button').addEventListener('click', function () {
        const col1 = select1.property("value");
        addNodeToColumn('col1', col1, col2);  // Call function to add to col1
      });

      // Handle click event for adding a node to col2
      document.getElementById('addCol2Button').addEventListener('click', function () {
        const col2 = select2.property("value");
        addNodeToColumn('col2', col2, col1);  // Call function to add to col2
      });

      // Initial chart
      updateChart(dataset, categoricalColumns[2], categoricalColumns[4] || categoricalColumns[2], quantifiableColumns[0], true);
    } else {
      console.error("No categorical columns found in the dataset.");
    }
  }).catch(error => {
    console.error("Error loading the data:", error);
  });
