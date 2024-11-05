let dataset;
const categoricalColumns = [
    "Month", "Country", "Region", "city", "AttackType", 
    "Target", "Group", "Target_type", "Weapon_type", 
    "Deadly", "AnyCasualties"
  ];

// List of quantifiable columns
const quantifiableColumns = ['Incidents', 'Killed', 'Wounded', 'Casualties'];

// Function to group and count combinations
function groupAndCount(data, col1, col2) {
    const groupedData = {};

    data.forEach(row => {
      const key = `${row[col1]}|${row[col2]}`;
      if (!groupedData[key]) {
        groupedData[key] = { [col1]: row[col1], [col2]: row[col2], Count: 0 };
      }
      groupedData[key].Count++;
    });

    return Object.values(groupedData);
  }

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

function updateChart(data, col1, col2, link){
    const filteredData = filterByTopCategories(data, col1, col2);

    // Group and count depending on the link/quantifiable data type
    let groupedData;
    if(link === 'Incidents'){
      groupedData = groupAndAggregate(filteredData, col1, col2, 'count');
    } else {
      groupedData = groupAndAggregate(filteredData, col1, col2, 'sum', link);
    }
    
      const sankeyData = prepareSankeyData(groupedData, col1, col2);

      const width = 928;
      const height = 720;

      const sankey = d3.sankey()
        .nodeSort((a, b) => d3.descending(a.value, b.value))
        .linkSort((a, b) => d3.descending(a.value, b.value))
        .nodeWidth(4)
        .nodePadding(20)
        .extent([[0, 5], [width, height - 5]]);

      const attackTypes = Array.from(new Set(data.map(d => d[col2])));
      const color = d3.scaleOrdinal()
        .domain(attackTypes)
        .range(d3.schemeCategory10)
        .unknown("#ccc");

      // Remove any existing SVG
      d3.select("#chart").selectAll("*").remove();

      // Create SVG
      const svg = d3.select("#chart")
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto;");

      const { nodes, links } = sankey({
        nodes: sankeyData.nodes.map(d => Object.create(d)),
        links: sankeyData.links.map(d => Object.create(d))
      });

      svg.append("g")
        .selectAll("rect")
        .data(nodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .append("title")
        .text(d => `${d.name}\n${d.value.toLocaleString()}`);

      svg.append("g")
        .attr("fill", "none")
        .selectAll("g")
        .data(links)
        .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => color(d.names[1]))
        .attr("stroke-width", d => d.width)
        .style("mix-blend-mode", "multiply")
        .append("title")
        .text(d => `${d.names.join(" → ")}\n${d.value.toLocaleString()}`);

      svg.append("g")
        .style("font", "10px sans-serif")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .attr("x", d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < width / 2 ? "start" : "end")
        .text(d => d.name)
        .append("tspan")
        .attr("fill-opacity", 0.7)
        .text(d => ` ${d.value.toLocaleString()}`);
}

// Function to get top N categories by count
function getTopCategories(data, col, topN = 12) {
    const counts = {};

    data.forEach(row => {
      if (!counts[row[col]]) {
        counts[row[col]] = 0;
      }
      counts[row[col]]++;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(d => d[0]);
  }

  // Function to filter data by top N categories
  function filterByTopCategories(data, col1, col2, topN = 12) {
    const topCol1 = getTopCategories(data, col1, topN);
    const topCol2 = getTopCategories(data, col2, topN);

    return data.filter(row => topCol1.includes(row[col1]) && topCol2.includes(row[col2]));
  }



// Load the data
d3.csv("terror_cleaned.csv", d3.autoType).then(data => {
    dataset = data;
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
        const link = selectLink.property("value");
        updateChart(dataset, col1, col2, link);
      });

      // Initial chart
      updateChart(dataset, categoricalColumns[2], categoricalColumns[4] || categoricalColumns[2], quantifiableColumns[0]);
    } else {
      console.error("No categorical columns found in the dataset.");
    }
  }).catch(error => {
    console.error("Error loading the data:", error);
  });