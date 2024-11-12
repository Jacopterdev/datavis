<!-- Styles -->
<style>
  #chartdiv {
    width: 100%;
    height: 900px;
    margin: 20px auto; /* Center the chart */
  }
</style>

<!-- Resources -->
<script src="https://cdn.amcharts.com/lib/4/core.js"></script>
<script src="https://cdn.amcharts.com/lib/4/charts.js"></script>
<script src="https://cdn.amcharts.com/lib/4/plugins/timeline.js"></script>
<script src="https://cdn.amcharts.com/lib/4/themes/animated.js"></script>
<script src="https://d3js.org/d3.v6.min.js"></script>

<!-- Chart code -->
<script>

  const columns = ["Killed", "Wounded"]
  am4core.ready(function () {
    // Use the animated theme
    am4core.useTheme(am4themes_animated);

    // Load the CSV data
    d3.csv("terror_cleaned.csv")
      .then(function (data) {
        // Process data: Aggregate incidents and total wounded by year
        const aggregatedData = d3.rollup(
          data,
          (v) => ({
            incidents: v.length,
            wounded: d3.sum(v, (d) => +d.Wounded || 0), // Handle NaN cases
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
          });
        });

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
        series.tooltipText = "Wounded: {wounded}\nIncidents: {incidents}"; // Update tooltip to show actual wounded count
        series.tooltip.pointerOrientation = "vertical";
        series.tooltip.background.fillOpacity = 0.7;
        series.strokeWidth = 2;

        // Color based on wounded count using intervals
        series.columns.template.adapter.add("fill", function (fill, target) {
          const wounded = target.dataItem.dataContext.wounded; // Use actual wounded count for color coding

          if (wounded < 4000) {
            return am4core.color("#ffcccc"); // Light red for counts less than 4000
          } else if (wounded < 8000) {
            return am4core.color("#ff9999"); // Medium light red for counts between 4000 and 8000
          } else if (wounded < 12000) {
            return am4core.color("#ff6666"); // Medium red for counts between 8000 and 12000
          } else {
            return am4core.color("#ff3333"); // Dark red for counts 12000 and above
          }
        });

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
      }); // end of data loading
  }); // end am4core.ready()
</script>


