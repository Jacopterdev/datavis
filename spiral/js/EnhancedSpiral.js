"use strict";

function EnhancedSpiral() {
  const canvas = document.getElementById("vis");
  canvas.tabIndex = 0;

  let requestID = undefined;

  const requestUpdate = function () {
    if (requestID == 0) {
      requestID = window.requestAnimationFrame(update);
    }
  };

  const gc = canvas.getContext("2d");
  gc.scale(window.devicePixelRatio, window.devicePixelRatio);

  const spiral = new Spiral(gc, requestUpdate);

  const update = function (time) {
    let needUpdate = false;
    needUpdate = spiral.update(time) || needUpdate;

    gc.clearRect(0, 0, canvas.width, canvas.height);
    gc.beginPath();
    spiral.draw();

    requestID = needUpdate ? window.requestAnimationFrame(update) : 0;
  };

  let lock;
  const handle = function (handler, evt) {
    const clientRect = canvas.getBoundingClientRect();
    evt.screenCoords = [
      (evt.clientX - clientRect.left) * window.devicePixelRatio,
      (evt.clientY - clientRect.top) * window.devicePixelRatio,
    ];

    if (lock && lock[handler] && lock[handler](evt)) {
      requestUpdate();
      return lock;
    }

    let handledBy;
    if (spiral[handler] && spiral.pick(evt) && spiral[handler](evt)) {
      handledBy = spiral;
    }

    requestUpdate();
    return handledBy;
  };

  const onmousedown = function (evt) {
    if (evt.target == canvas) {
      evt.preventDefault();
      canvas.focus();
      if (!lock) lock = handle("onmousedown", evt);
    }
  };

  const onmouseup = function (evt) {
    if (evt.target == canvas || lock) {
      evt.preventDefault();
      if (lock == handle("onmouseup", evt)) lock = undefined;
    }
  };

  const onmousemove = function (evt) {
    if (evt.target == canvas || lock) {
      evt.preventDefault();
      handle("onmousemove", evt);
    }
  };

  const onresize = function () {
    $(".main").css("height", window.innerHeight);
    const $placeholder = $(".canvas-container");
    canvas.width = $placeholder.innerWidth() * window.devicePixelRatio;
    canvas.height = $placeholder.innerHeight() * window.devicePixelRatio;
    canvas.style.width = $placeholder.innerWidth() + "px";
    canvas.style.height = $placeholder.innerHeight() + "px";
    canvas.style.top = $placeholder.position().top + "px";
    canvas.style.left = $placeholder.position().left + "px";

    spiral.reshape();
    spiral.colorMapper.legend();
    requestUpdate();
  };

  const resizeAnimated = function () {
    const id = window.setInterval(onresize, 10);
    window.setTimeout(function () {
      window.clearInterval(id);
    }, 500);
  };

  canvas.addEventListener("mousedown", onmousedown);
  canvas.addEventListener("mouseup", onmouseup);
  canvas.addEventListener("mousemove", onmousemove);
  window.addEventListener("resize", onresize);

  onresize();

  $(".bars").on("click", function () {
    $(".ui").toggleClass("hidden");
    $(".main").toggleClass("shrink");
    resizeAnimated();
  });

  const uicontainer = document.getElementById("ui-container");
  ParameterUI(uicontainer, spiral.parameters(), "Spiral");

  const reset = function () {
    spiral.reshape();
    requestUpdate();
  };
  // Data management
  let dataset = [];
  let selectedMetrics = ["Incidents"]; // Default selected metric (only one metric allowed)
  let selectedFilters = {};

  function aggregateDataLists(data, metrics) {
    const monthMap = new Map();
    const allMonths = new Set();

    // Define the range of years
    const startYear = 1970;
    const endYear = 2017;

    // Collect all months (1-12) for each year in the range
    for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
            const monthKey = `${year}-${String(month).padStart(2, "0")}`;
            allMonths.add(monthKey);
        }
    }

    // Initialize monthMap with 0 for all months and the selected metric
    allMonths.forEach(month => {
        monthMap.set(month, {}); // Initialize empty object for each month
        metrics.forEach(metric => {
            monthMap.get(month)[metric] = 0; // Set initial value for the metric to 0
        });
    });

    // Now aggregate the data for the selected metric
    data.forEach(entry => {
        const month = `${entry.Year}-${String(entry.Month).padStart(2, "0")}`;

        metrics.forEach(metric => {
            if (metric === "Incidents") {
                // Special case: Count each entry as one incident
                if (monthMap.has(month)) {
                    monthMap.get(month).Incidents += 1; // Increment the incident count for this month
                }
            } else {
                // For other metrics, sum the value as usual
                const value = entry[metric];
                if (value !== null && value !== undefined) {
                    monthMap.get(month)[metric] += value;
                }
            }
        });
    });

    // Sort the monthMap entries by date
    const sortedEntries = Array.from(monthMap.entries()).sort(
        ([a], [b]) => new Date(a) - new Date(b)
    );

    // Prepare results object for the selected metric
    const results = {};
    metrics.forEach(metric => {
        results[metric] = sortedEntries.map(([, values]) => values[metric]);
    });

    // Include the month (Date) for each entry in the results
    results.Date = sortedEntries.map(([month]) => month);
    console.log("Results: ", results);
    return results;
}



  fetch("toggleData.json")
    .then((response) => response.json())
    .then((data) => {
      dataset = data;

      // Initialize Spiral with the default selected metric
      const initialResults = aggregateDataLists(dataset, selectedMetrics);
      spiral.init(
        initialResults,
        selectedMetrics,
        `${selectedMetrics.join(", ")} every year`,
        ""
      );

      // Setup event listeners for toggles and filters
      setupEventListeners();
    })
    .catch((error) => {
      console.error("Error loading data:", error);
    });

  function setupEventListeners() {
    // Metric toggles (only one metric can be selected at a time)
    document.querySelectorAll(".toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const metric = button.getAttribute("data-metric");

        // Select the metric and replace the existing selection
        selectedMetrics = [metric]; // Ensure only one metric is selected

        console.log("selectedMetrics", selectedMetrics);

        // Update Spiral with the selected metric
        const results = aggregateDataLists(dataset, selectedMetrics);
        spiral.updateData(
          results,
          selectedMetrics,
          `${selectedMetrics.join(", ")} every year`,
          ""
        );

        // Update button UI to indicate active selection
        document
          .querySelectorAll(".toggle")
          .forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
      });
    });

    // Apply button for filters
    document
      .getElementById("applyFiltersButton")
      .addEventListener("click", () => {
        // Get selected filter values
        const attackType = document.getElementById("attackTypeDropdown").value;
        const targetType = document.getElementById("targetTypeDropdown").value;
        const weaponType = document.getElementById("weaponTypeDropdown").value;
        const country = document.getElementById("country").value;
        const region = document.getElementById("region").value;

        // Store selected filters
        selectedFilters = {
          attackType,
          targetType,
          weaponType,
          country,
          region,
        };

        // Filter dataset based on selected filters
        const filteredData = dataset.filter((item) => {
          return (
            (!attackType || item.AttackType === attackType) &&
            (!targetType || item.Target_type === targetType) &&
            (!weaponType || item.Weapon_type === weaponType) &&
            (!country || item.Country === country) &&
            (!region || item.Region === region)
          );
        });
        console.log("Filtered data, ", filteredData);

        // Update Spiral with filtered data
        const results = aggregateDataLists(filteredData, selectedMetrics);
        spiral.updateData(
          results,
          selectedMetrics,
          `${selectedMetrics.join(", ")} every year`,
          ""
        );
      });
  }

  // Helper function to reset dropdowns
  function resetDropdowns() {
    const dropdownIds = [
      "attackTypeDropdown",
      "targetTypeDropdown",
      "weaponTypeDropdown",
      "country",
      "region",
    ];
    dropdownIds.forEach((id) => {
      document.getElementById(id).value = "";
    });
  }

  document.getElementById("reset").addEventListener("click", () => {
    // Reset filters
    resetDropdowns();

    // Reset metrics to default ("Incidents")
    selectedMetrics = ["Incidents"];

    // Clear all active toggle button styles
    document
      .querySelectorAll(".toggle")
      .forEach((btn) => btn.classList.remove("active"));

    // Reinitialize the spiral chart with the default metric
    const initialResults = aggregateDataLists(dataset, selectedMetrics);
    spiral.updateData(
      initialResults,
      selectedMetrics,
      `${selectedMetrics.join(", ")} every year`,
      ""
    );
  });

  // Start rendering
  requestID = 0;
  reset();
}
