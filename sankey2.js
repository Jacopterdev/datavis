var attackTypes;

// Load the CSV data asynchronously
d3.csv("region_attack_counts.csv", d3.autoType).then(function(data) {
    console.log(data); // Check the loaded data

    // Assuming your data is in the 'data' variable after loading
    attackTypes = Array.from(new Set(data.map(d => d.AttackType))); // Get unique attack types

    // Generate graph structure (nodes and links) from the data
    const graphResult = graph(data);
    console.log(graphResult);

    // Generate the chart SVG using the graph structure
    const chartSVG = chart(graphResult);

    // Append the SVG to the document body or a specific container
    document.body.appendChild(chartSVG);
}).catch(error => {
    console.error("Error loading CSV data:", error);
});

const graph = function foo(data) {
    const keys = data.columns.slice(0, -1);
    let index = -1;
    const nodes = [];
    const nodeByKey = new d3.InternMap([], JSON.stringify);
    const indexByKey = new d3.InternMap([], JSON.stringify);
    const links = [];

    for (const k of keys) {
        for (const d of data) {
            const key = [k, d[k]];
            if (nodeByKey.has(key)) continue;
            const node = {name: d[k]};
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
            const value = +d.value || 1;
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
    return {nodes, links};
}

const chart = function bar(graph) {
    const width = 928;
    const height = 720;

    const sankey = d3.sankey()
        .nodeSort((a, b) => d3.descending(a.value, b.value))
        .linkSort((a, b) => d3.descending(a.value, b.value))
        .nodeWidth(4)
        .nodePadding(20)
        .extent([[0, 5], [width, height - 5]]);

    //const color = d3.scaleOrdinal(["AttackType"], ["#da4f81"]).unknown("#ccc");
    
    // Define a color scale with those unique attack types
    const color = d3.scaleOrdinal()
        .domain(attackTypes) // Set the unique attack types as the domain
        .range(d3.schemeCategory10) // Use a D3 color scheme or define your own colors
        .unknown("#ccc"); // Set a fallback color for unknown types


    const svg = d3.create("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", width)
        .attr("height", height)
        .attr("style", "max-width: 100%; height: auto;");

    const {nodes, links} = sankey({
        nodes: graph.nodes.map(d => Object.create(d)),
        links: graph.links.map(d => Object.create(d))
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

    return svg.node();
}
