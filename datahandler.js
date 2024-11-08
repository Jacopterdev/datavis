let dataset;

let graph = null;  // Store the current graph data

const categoricalColumns = [
    "Month", "Country", "Region", "city", "AttackType", 
    "Target", "Group", "Target_type", "Weapon_type", 
    "Deadly", "AnyCasualties"
];

// List of quantifiable columns
const quantifiableColumns = ['Incidents', 'Killed', 'Wounded', 'Casualties'];

const width = 928;
const height = 720;

let svg;
let sankey;



// Function to group and either count rows or sum specific columns
function groupAndAggregate(data, col1, col2, operation, sumCol) {
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
function prepareSankeyData(data, col1, col2) {
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
        const value = +d.Count || 1;
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

function updateChart(data, col1, col2, linkAttr) {
  const filteredData = categorizeData(data, col1, col2);

  // Group and count depending on the link/quantifiable data type
  let groupedData;
  if (linkAttr === 'Incidents') {
    groupedData = groupAndAggregate(filteredData, col1, col2, 'count');
  } else {
    groupedData = groupAndAggregate(filteredData, col1, col2, 'sum', linkAttr);
  }

  const width = 928;
  const height = 720;

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
    .linkSort(null)
    .nodeWidth(40)
    .nodePadding(20)
    .extent([[0, 5], [width, height - 5]]);


  //graph = prepareSankeyData(groupedData, col1, col2);
  renderSankey(groupedData, col1, col2);
}

function renderSankey(data, col1, col2) {
  // Convert to Sankey data
  graph = prepareSankeyData(data, col1, col2);

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
      handleNodeClick(d, col1, col2);
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
function getTopCategories(data, col, topN = 12) {
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

function handleNodeClick(clickedNode, col1, col2) {
  // Remove clicked node from data
  const newDataset = dataset.filter(row => row[col1] !== clickedNode.name && row[col2] !== clickedNode.name);

  dataset = newDataset;
  // Re-render the Sankey diagram with updated data
  renderSankey(newDataset, col1, col2);
}

// Function to categorize data and group non-top categories as 'Other'
function categorizeData(data, col1, col2, topN = 12) {
  const { topCategories: topCol1, counts: countsCol1 } = getTopCategories(data, col1, topN);
  const { topCategories: topCol2, counts: countsCol2 } = getTopCategories(data, col2, topN);

  return data.map(row => {
    const newRow = { ...row };

    if (!topCol1.includes(row[col1])) {
      newRow[col1] = 'Other';
    }

    if (!topCol2.includes(row[col2])) {
      newRow[col2] = 'Other';
    }

    return newRow;
  });
}

// Load the data
d3.csv("terror_cleaned.csv", d3.autoType).then(data => {
    dataset = data;
    const originalDataset = dataset;

    console.log("Data loaded:", data);

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

      // Initial chart
      updateChart(dataset, categoricalColumns[2], categoricalColumns[4] || categoricalColumns[2], quantifiableColumns[0]);
    } else {
      console.error("No categorical columns found in the dataset.");
    }
  }).catch(error => {
    console.error("Error loading the data:", error);
  });
