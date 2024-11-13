am4core.ready(function () {
  // Use the animated theme
  am4core.useTheme(am4themes_animated);

  // Load the CSV data
  d3.csv("terror_cleaned.csv")
    .then(function (data) {
      // Process data: Aggregate incidents, wounded, and killed by year
      const aggregatedData = d3.rollup(
        data,
        (v) => ({
          incidents: v.length,
          wounded: d3.sum(v, (d) => +d.Wounded || 0), // Handle NaN cases
          killed: d3.sum(v, (d) => +d.Killed || 0), // Handle NaN cases
        }),
        (d) => d.Year
      );

      // Set a constant value for bar lengths
      const constantValue = 100; // Fixed length for all bars

      // Transform the data for the spiral chart
      const chartData = [];
      aggregatedData.forEach((values, year) => {
        chartData.push({
          date: new Date(year, 0, 1), // January 1st of the year
          value: constantValue, // Fixed length for all bars
          incidents: values.incidents, // Keep incidents for tooltip
          wounded: values.wounded, // Actual wounded count for tooltip
          killed: values.killed, // Actual killed count for tooltip
        });
      });

      // Create the spiral chart
      var chart = am4core.create("chartdiv", am4plugins_timeline.SpiralChart);
      chart.levelCount = 3;
      chart.curveContainer.padding(60, 60, 60, 60); // Padding
      chart.data = chartData;

      var dateAxis = chart.xAxes.push(new am4charts.DateAxis());
      dateAxis.renderer.grid.template.location = 0;
      dateAxis.renderer.line.disabled = true;
      dateAxis.cursorTooltipEnabled = false;
      dateAxis.renderer.minGridDistance = 50; // Adjusted spacing
      dateAxis.renderer.labels.template.fontSize = 10;
      dateAxis.minZoomCount = 5;

      // Set a maximum number of labels
      dateAxis.renderer.labels.template.maxWidth = 60;
      dateAxis.renderer.labels.template.truncate = true;
      dateAxis.renderer.labels.template.fillOpacity = 0.8;

      var valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
      valueAxis.tooltip.disabled = true;
      valueAxis.renderer.innerRadius = -30; // Adjust inner radius
      valueAxis.renderer.radius = 30; // Adjust radius
      valueAxis.renderer.minGridDistance = 30; // Increase distance between grid lines
      valueAxis.renderer.axisLocation = 1;

      // Format y-axis labels
      valueAxis.renderer.labels.template.fontSize = 12; // Increase font size
      valueAxis.renderer.labels.template.adapter.add("text", function (text) {
        return parseInt(text, 10).toLocaleString(); // Add commas for thousands
      });

      var series = chart.series.push(
        new am4plugins_timeline.CurveColumnSeries()
      );
      series.dataFields.dateX = "date";
      series.dataFields.valueY = "value"; // Use constant value for length
      series.tooltipText =
        "Wounded: {wounded}\nIncidents: {incidents}\nKilled: {killed}"; // Update tooltip to show actual wounded, killed, and incidents count
      series.tooltip.pointerOrientation = "vertical";
      series.tooltip.background.fillOpacity = 0.7;
      series.strokeWidth = 2;

      // Color based on the selected metric (from white to red)
      function updateChartData(metric) {
        series.tooltipText = `${
          metric.charAt(0).toUpperCase() + metric.slice(1)
        }: {${metric}}\nIncidents: {incidents}`;

        // Create a color scale from 0 (white) to the maximum value (red)
        const maxValue = d3.max(chartData, (d) => d[metric]); // Get the maximum value for the selected metric
        const minValue = d3.min(chartData, (d) => d[metric]);
        const colorScale = d3
          .scaleLinear()
          .domain([minValue, maxValue]) // Define the domain: from 0 to the max value of the metric
          .range(["#ffffff", "#000000"]); // Interpolate from white to red

        series.columns.template.adapter.add("fill", function (fill, target) {
          const value = target.dataItem.dataContext[metric]; // Get the value for the selected metric
          return am4core.color(colorScale(value)); // Return the interpolated color
        });

        // Update chart data with selected metric
        chart.data = chartData.map(function (d) {
          return { ...d, value: constantValue, [metric]: d[metric] };
        });
      }

      // Add event listener for dropdown change
      document
        .getElementById("data-select")
        .addEventListener("change", function (event) {
          const selectedMetric = event.target.value;
          updateChartData(selectedMetric); // Update chart data based on selection
        });

      // Initial chart data
      updateChartData("wounded"); // Set initial chart to show wounded data

      chart.cursor = new am4plugins_timeline.CurveCursor();
      chart.cursor.xAxis = dateAxis;
      chart.cursor.yAxis = valueAxis;
      chart.cursor.lineY.disabled = true;

      chart.scrollbarX = new am4core.Scrollbar();
      chart.scrollbarX.width = am4core.percent(80);
      chart.scrollbarX.align = "center";
    })
    .catch(function (error) {
      console.error("Error loading the CSV data:", error);
    });
});
