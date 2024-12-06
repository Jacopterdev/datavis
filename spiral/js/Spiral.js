"use strict";

function Spiral(gc, repaint) {
  this.gc = gc;
  this.repaint = repaint;

  this.offscreenImg = document.createElement("canvas");
  this.offscreenGC = this.offscreenImg.getContext("2d");
  this.offscreenValid = false;

  this.pickedSegment = undefined;

  this.info = $("#info")[0]; // The div element for textual output of the picked data value

  this.colorMapper = new ColorMapper(["black", "white"]); // Will be set once the colorMap parameter is initialized

  // Range slider for navigating through time
  this.rangeSlider = Xlider.RangeXlider($(".range-container")[0], {
    domain: Object.create(Xlider.Domain.Integer), // Custom domain to be overridden for custom labeling
    /* no_subslider: true */
  });

  this.rangeSlider.addChangeListener(
    function (evt) {
      if (evt.type == "mark") {
        if (evt.index == 0) {
          this.start = evt.value;
          this.numberOfCycles.value =
            (this.end - this.start) / this.segmentsPerCycle.value;
        } else if (evt.index == 1) {
          this.end = evt.value;
          this.numberOfCycles.value =
            (this.end - this.start) / this.segmentsPerCycle.value;
        }
      } else if (evt.type == "range") {
        this.start = evt.value[0];
        this.end = evt.value[1];
        this.offscreenValid = false;
        this.repaint();
      }
    }.bind(this)
  );

  // Parameters of the spiral visualization
  this.segmentsPerCycle = Parameter("slider", "Segments per Cycle", 4, 1, 999);
  this.numberOfCycles = Parameter("slider", "Number of Cycles", 11, 0, 100);

  this.colorMap = Parameter("colorselector", "Color Map", "OrRd");
  this.visualRepresentation = Parameter("switch", "Heatmap / Spiral", 1, 0, 1);

  this.parameters = function () {
    return [
      this.segmentsPerCycle,
      this.numberOfCycles,
      this.colorMap,
      this.visualRepresentation,
    ];
  };

  this.parameter = function (param, value) {
    if (value != undefined) {
      this[param].value = value;
    }
    return this[param].value;
  };

  this.onParameterChange = function (param) {
    let cmParam = undefined;
    switch (param) {
      case this.visualRepresentation:
        if (param.value) {
          this.generateSegment = this.generateSpiralSegment;
          this.pickSegment = this.pickSpiralSegment;
          this.generateOutline = this.generateSpiralOutline;
        } else {
          this.generateSegment = this.generateHeatmapSegment;
          this.pickSegment = this.pickHeatmapSegment;
          this.generateOutline = this.generateHeatmapOutline;
        }
        this.offscreenValid = false;
        break;
      case this.delimiterStrength:
      case this.bandScale:
        this.offscreenValid = false;
        break;
      case this.colorMap:
        this.colorMapper = this.brewColors(param.value, 5);
        this.recolor();
        break;
      case this.colorClasses:
        this.colorMapper = this.brewColors(this.colorMap.value, param.value);
        this.recolor();
        break;
      case this.smoothColors:
        cmParam = cmParam || "cmSmooth";
      case this.reverseColors:
        cmParam = cmParam || "cmReverse";
      case this.twoToneColors:
        cmParam = cmParam || "cmTwoTone";
      case this.twoToneFlip:
        cmParam = cmParam || "cmTwoToneFlip";
        this.colorMapper[cmParam] = param.value;
        this.recolor();
        break;
      case this.segmentsPerCycle:
      case this.numberOfCycles:
      case this.size:
      case this.offset:
        this.reshape();
    }
    repaint();
  };

  this.init(
    {
      Date: new Array(this.segmentsPerCycle.value).fill().map((_, i) => i + 1), // Default to 1-based indexing for clarity
      Incidents: new Array(this.segmentsPerCycle.value).fill().map((_, i) => {
        const x = i / this.segmentsPerCycle.value; // Normalize based on total segments
        return 200 * Math.sin(Math.PI * x) ** 2 + 10; // Example: oscillating values with baseline
      }),
    },
    "Incidents",
    "Default Fatalities Dataset",
    "people"
  );

  // Add parameter change listeners
  this.parameters().forEach(function (p) {
    p.addChangeListener(this.onParameterChange.bind(this));
  }, this);
  this.updateCaption();
}

Spiral.prototype.init = function (data, attr, caption = "", unit = "") {
  this.data = data;
  console.log("recived init with", data);
  this.caption = caption;
  this.unit = unit;

  // Override slider's label function to use Year labels
  this.rangeSlider.domain.toLabel = function labelFromDataArray(value) {
    return this.data["Date"][Math.floor(value)];
  }.bind(this);

  console.log("init with attr", attr);

  this.encode(attr);
};

Spiral.prototype.updateData = function (data, attr, caption = "", unit = "") {
  this.data = data;
  console.log("recived update with", data);
  this.caption = caption;
  this.unit = unit;

  // Override slider's label function to use Date labels
  this.rangeSlider.domain.toLabel = function labelFromDataArray(value) {
    return this.data["Date"][Math.floor(value)];
  }.bind(this);

  console.log("update with attr", attr);
  this.encode(attr);

  this.offscreenValid = false;
  this.repaint();
  this.updateCaption();
};

// Rest of the methods remain unchanged

Spiral.prototype.brewColors = function (map, classes) {
  let colors = Constants.COLORBREWER[map];
  while (classes > 3 && colors[classes] == undefined) {
    classes--;
  }
  colors = colors[classes];

  var cm = new ColorMapper(colors);
  cm.cmReverse = 0;
  cm.cmSmooth = 1;
  cm.cmTwoTone = 0;

  return cm;
};

Spiral.prototype.encode = function (attr) {
  attr = attr || this.attr; // If no attr is provided, simply encode the previous attr again

  this.attr = attr;
  console.log("metric", this.data[attr]);
  this.values = this.data[attr].map(function (v) {
    return +v; // Implicit conversion to Number
  });

  this.start = 0;
  this.end = this.values.length - 1;

  this.rangeSlider.model.setModel({
    min: Math.min(...this.data[attr]),
    max: Math.max(...this.data[attr]),
    marks: [this.start, this.end],
  });

  this.recolor();
  this.reshape();
};

Spiral.prototype.recolor = function () {
  let min = this.values[0];
  let max = this.values[0];
  this.values.forEach(function (v) {
    if (v < min) {
      min = v;
    } else if (v > max) {
      max = v;
    }
  });

  [min, max] = this.colorMapper.autoExpand(min, max);

  // Override actual min/max to get better color labels

  this.colorMapper.cmRange = [min, max];

  const normalized = this.values.map(function (value) {
    return (value - min) / (max - min);
  }, this);

  this.colors = normalized.map(this.colorMapper.encodeColor, this);
  this.twoTone = normalized.map(this.colorMapper.encodeTwoTone, this);

  this.offscreenValid = false;
};

Spiral.prototype.reshape = function () {
  const segments = this.numberOfCycles.value * this.segmentsPerCycle.value;
  const range = this.end - this.start + 1;

  if (range > segments) {
    // If there are more values in the range than segments
    // Shrink the range of values
    this.end = this.start + segments - 1;
  } else {
    // Else there are more segments than values in the range
    let delta = segments - range;
    // Expand the range to include more values
    if (this.end < this.values.length - 1) {
      // Expand until we reach the end
      const expandBack = Math.min(delta, this.values.length - 1 - this.end); // Number of segments needed and actually available at the back
      this.end += expandBack;
      delta -= expandBack;
    }

    if (delta > 0) {
      // Still more segments needed, expand until we reach the front
      this.start = Math.max(0, this.start - delta);
    }
  }

  this.rangeSlider.model.setModel({
    marks: [this.start, this.end],
  });

  this.cycles = (this.end - this.start + 1) / this.segmentsPerCycle.value;
  this.phi = Constants.MATH_PI_DOUBLE * this.cycles;
  this.anglePerSegment = Constants.MATH_PI_DOUBLE / this.segmentsPerCycle.value;

  this.center = [this.gc.canvas.width / 2, this.gc.canvas.height / 2];
  this.radius = (100 / 100) * Math.min(this.center[0], this.center[1]);
  this.radiusStart = (this.radius * 15) / 100;
  this.radiusEnd = this.radius;
  this.radiusPerCycle = (this.radiusEnd - this.radiusStart) / (this.cycles + 1);

  this.offscreenValid = false;
};

Spiral.prototype.shiftDataWindow = function (amount) {
  if (amount < 0) {
    // Decrement window position
    const dec = Math.min(Math.abs(amount), this.start);
    this.start -= dec;
    this.end -= dec;
    if (this.pickedSegment != undefined) this.pickedSegment -= dec;
  } else {
    // Increment window position
    const inc = Math.min(amount, this.values.length - 1 - this.end);
    this.start += inc;
    this.end += inc;
    if (this.pickedSegment != undefined) this.pickedSegment += inc;
  }
  this.reshape();
};

Spiral.prototype.pick = function (evt) {
  const oldPick = this.pickedSegment;
  this.pickedSegment = undefined;

  let x = evt.screenCoords[0];
  let y = evt.screenCoords[1];

  const rx = x - this.center[0];
  const ry = y - this.center[1];

  const cos = Math.cos(-270 * Constants.MATH_TO_RAD);
  const sin = Math.sin(-270 * Constants.MATH_TO_RAD);

  x = rx * cos - ry * sin;
  y = ry * cos + rx * sin;

  this.pickSegment(x, y);

  if (oldPick != this.pickedSegment) {
    let str = this.caption;
    if (this.pickedSegment != undefined) {
      str += "\n";
      str += this.data["Date"][this.pickedSegment];
      str += "\n";
      str += this.values[this.pickedSegment] + this.unit;
    }
    this.info.textContent = str;
  }

  return this.pickedSegment != undefined;
};

Spiral.prototype.pickSpiralSegment = function (x, y) {
  let a = Math.atan2(y, x); // Angle in range [-PI .. PI]
  if (a < 0) a += Constants.MATH_PI_DOUBLE; // Map negative angles from [-PI .. 0] to [PI .. 2*PI]
  a /= Constants.MATH_PI_DOUBLE; // Normailze angle from [0 .. 2*PI] to [0 .. 1]

  let d = Math.sqrt(x * x + y * y); // Distance from center
  d -= this.radiusStart + a * this.radiusPerCycle; // Subtract the offset from the center (radiusStart) and the amount that the radius has already advanced at angle a (a is normalized per cycle)
  d /= this.radiusEnd - this.radiusStart; // Normalize distance from [radiusStart .. radiusEnd] to [0 .. 1]

  const ring = Math.floor(d * (this.cycles + 1)); // The ring at relative distance d (+1 to account for spiral band width)
  const index = Math.floor(
    this.start + (a + ring) * this.segmentsPerCycle.value
  );

  if (index >= this.start && index <= this.end) {
    this.pickedSegment = index;
  }
};

Spiral.prototype.pickHeatmapSegment = function (x, y) {
  const w = (this.gc.canvas.width * 100) / 100;
  const h = (this.gc.canvas.height * 100) / 100;
  const sw = w / this.segmentsPerCycle.value;
  const sh = h / this.numberOfCycles.value;

  x += w / 2;
  y += h / 2;

  if (x >= 0 && x <= w && y >= 0 && y <= h) {
    const row = Math.floor(y / sh);
    const col = Math.floor(x / sw);
    this.pickedSegment = this.start + col + row * this.segmentsPerCycle.value;
  }
};

Spiral.prototype.onmousedown = function (evt) {
  if (evt.button == 0) {
    this.doclick = {
      down: evt.screenCoords, // Coordinates where drag started
    };

    this.dodrag = {
      down: evt.screenCoords, // Coordinates where drag started
      dragged: false, // Actually dragged after threshold has been reached ?
    };

    return true; // Event consumed
  }
  // Event not consumed
};

Spiral.prototype.onmousemove = function (evt) {
  if (this.dodrag) {
    const dx = this.dodrag.down[0] - evt.screenCoords[0];
    const dy = this.dodrag.down[1] - evt.screenCoords[1];
    this.dodrag.dragged =
      this.dodrag.dragged ||
      dx >= Constants.DRAG_THRESHOLD ||
      dx < -Constants.DRAG_THRESHOLD ||
      dy >= Constants.DRAG_THRESHOLD ||
      dy < -Constants.DRAG_THRESHOLD;

    if (this.dodrag.dragged) {
      // Do something
    }
    return true; // Event consumed
  }
  // Event not consumed
};

Spiral.prototype.onmouseup = function (evt) {
  if (evt.button == 0) {
    if (this.dodrag) {
      if (this.dodrag.dragged) {
        // Actual drag was performed, so this up event should NOT become a click
        delete this.doclick;
      }
      delete this.dodrag;
    }

    if (this.doclick) {
      if (evt.ctrlKey) {
        // Do something
      } else {
        // Do something
      }
      delete this.doclick;
    }

    return true; // Event consumed
  }
  // Event not consumed
};

Spiral.prototype.ondblclick = function (evt) {
  // Event not consumed
};

Spiral.prototype.update = function (time) {
  const needUpdate = false;

  this.delta = time - (this.time || time);
  this.time = time;

  return needUpdate;
};

Spiral.prototype.updateCornerText = function () {
  const ctx = this.canvas.getContext("2d");

  // Clear previous text area
  ctx.clearRect(this.width - 200, 0, 200, 50);
  this.offscreenValid = false;
  this.repaint();
  // Set text properties
  ctx.font = "14px Arial";
  ctx.fillStyle = "#000"; // Adjust color as needed

  // Draw the updated caption and unit
  ctx.textAlign = "right";
  ctx.fillText(this.caption, this.width - 10, 20); // Position the text
  ctx.fillText(this.unit, this.width - 10, 40);
};

Spiral.prototype.path = function (gc, pts) {
  gc.moveTo(pts[0][0], pts[0][1]);
  let j, n;
  for (j = 1, n = pts.length; j < n; j++) {
    gc.lineTo(pts[j][0], pts[j][1]);
  }
  gc.closePath();
};

Spiral.prototype.draw = function () {
  // var time = Date.now();

  let gc;
  let pts;
  let i;
  let str;

  if (!this.offscreenValid) {
    // Maintain identical size of canvas and offscreen image
    if (
      this.offscreenImg.width != this.gc.canvas.width ||
      this.offscreenImg.height != this.gc.canvas.height
    ) {
      this.offscreenImg.width = this.gc.canvas.width;
      this.offscreenImg.height = this.gc.canvas.height;
    }

    // var ctx = new C2S(1024, 1024);

    gc = this.offscreenGC;
    // gc = ctx;
    gc.clearRect(0, 0, this.offscreenImg.width, this.offscreenImg.height);
    // gc = this.gc;
    gc.save();

    gc.translate(
      Math.floor(gc.canvas.width / 2) + 0.5,
      Math.floor(gc.canvas.height / 2) + 0.5
    );
    gc.rotate(270 * Constants.MATH_TO_RAD);

    const delimiters = [];

    for (i = this.start; i <= this.end; i++) {
      if (!this.colorMapper.cmTwoTone) {
        pts = this.generateSegment(i);
        gc.beginPath();
        this.path(gc, pts);
        gc.fillStyle = this.colors[i];
        gc.fill();
        delimiters.push(pts[0]); // First and ...
        delimiters.push(pts[pts.length - 1]); // ... last point of segment serve as delimiting line
      } else {
        pts = this.generateSegment(i, 0, (this.twoTone[i].ratio * 85) / 100);
        gc.beginPath();
        this.path(gc, pts);
        gc.fillStyle = this.twoTone[i].colors[0];
        gc.fill();
        delimiters.push(pts[0]); // First and ...

        pts = this.generateSegment(
          i,
          (this.twoTone[i].ratio * 85) / 100,
          85 / 100
        );
        gc.beginPath();
        this.path(gc, pts);
        gc.fillStyle = this.twoTone[i].colors[1];
        gc.fill();
        delimiters.push(pts[pts.length - 1]); // ... last point of segment serve as delimiting line
      }
    }

    if (80 > 0) {
      gc.beginPath();
      if (this.visualRepresentation.value == 0) gc.translate(-0.5, -0.5);
      for (i = 0; i < delimiters.length; i += 2) {
        gc.moveTo(delimiters[i][0], delimiters[i][1]);
        gc.lineTo(delimiters[i + 1][0], delimiters[i + 1][1]);
      }
      gc.lineWidth = 80 / 100;
      gc.strokeStyle = "#FFF";
      gc.stroke();
    }

    gc.restore();
    // console.log(ctx.getSvg());
    this.offscreenValid = true;
  }

  gc = this.gc;
  gc.drawImage(this.offscreenImg, 0, 0);

  gc.save();
  gc.lineWidth = 1;
  gc.translate(
    Math.floor(gc.canvas.width / 2),
    Math.floor(gc.canvas.height / 2)
  );
  gc.rotate(270 * Constants.MATH_TO_RAD);
  if (
    this.pickedSegment != undefined &&
    this.pickedSegment >= this.start &&
    this.pickedSegment <= this.end
  ) {
    pts = this.generateSegment(this.pickedSegment);
    gc.beginPath();
    this.path(gc, pts);
    gc.strokeStyle = "#666";
    gc.stroke();
  }

  if (0) {
    const glowBlur = 50;
    pts = [];
    this.generateOutline(pts);

    gc.beginPath();
    gc.rect(
      -gc.canvas.width / 2 - glowBlur,
      -gc.canvas.height / 2 - glowBlur,
      gc.canvas.width + 2 * glowBlur,
      gc.canvas.height + 2 * glowBlur
    );
    this.path(gc, pts);
    gc.clip("evenodd");

    gc.beginPath();
    this.path(gc, pts);
    gc.fillStyle = "#FFF";
    gc.shadowColor = "#808080";
    gc.shadowBlur = glowBlur;
    gc.fill();
  }

  gc.restore();

  // time = Date.now() - time;
  // console.log("Repaint: "+time+"ms");
};

Spiral.prototype.updateCaption = function () {
  let str = this.caption;
  if (this.pickedSegment != undefined) {
    str += "\n";
    str += this.data["Date"][this.pickedSegment];
    str += "\n";
    str += this.values[this.pickedSegment] + this.unit;
  }
  this.info.textContent = str;
};

Spiral.prototype.generateSpiralArc = function (arcStart, arcEnd, scale, pts) {
  // For computing a, the actual radius range is the radius of the drawing space (radius) minus
  // the fractional offset from the center of the spiral. This is divided by phi plus
  // one full spiral cycle (2*Math.PI). The 2*Math.PI is necessary to account for the fact that
  // we allow the scaling of the spiral between 0 and 1.

  const a =
    (this.radiusEnd - this.radiusStart) / (this.phi + Constants.MATH_PI_DOUBLE);

  // Let the spiral start at the top (not to the right)
  //arcStart -= Math.PI / 2;
  //arcEnd -= Math.PI / 2;

  const scaleOffset = scale * Constants.MATH_PI_DOUBLE * a;
  let angle = arcStart;
  let rad = angle * a + scaleOffset + this.radiusStart;
  if (rad < 0) rad = 0;

  const segmentLength = 10; // Tolerance error when using line segment length
  const segmentHeight = 0.1; // Tolerance error when using arc segment height

  let px = rad * Math.cos(angle);
  let py = rad * Math.sin(angle);

  pts.length = 0;
  pts.push([px, py]);

  while (angle < arcEnd) {
    // For formulas see http://en.wikipedia.org/wiki/Circular_segment
    // Choose one of the following solutions
    // angle +=  segmentLength / rad; // Compute angle step based on equidistant arc lengths
    angle += 2 * Math.acos(1 - segmentHeight / rad); // Compute angle step based on a maximum arc height, i.e., max. difference between actual spiral and our linear approximation
    if (angle > arcEnd) angle = arcEnd;

    rad = angle * a + scaleOffset + this.radiusStart;
    if (rad < 0) rad = 0;

    px = rad * Math.cos(angle);
    py = rad * Math.sin(angle);

    pts.push([px, py]);
  }
};

Spiral.prototype.generateSpiralSegment = function (
  i,
  inner = 0,
  outer = 85 / 100
) {
  const angle =
    (Constants.MATH_PI_DOUBLE * (i - this.start)) / this.segmentsPerCycle.value;

  const points = [];

  this.generateSpiralArc(angle, angle + this.anglePerSegment, inner, points);
  const segment = points.slice();

  this.generateSpiralArc(angle, angle + this.anglePerSegment, outer, points);

  points.reverse();
  points.forEach(function (p) {
    segment.push(p);
  });

  return segment;
};

Spiral.prototype.generateSpiralOutline = function (outline) {
  this.generateSpiralArc(
    this.phi,
    this.phi + Constants.MATH_PI_DOUBLE,
    0,
    outline
  );
  return outline;
};

Spiral.prototype.generateHeatmapSegment = function (
  i,
  inner = 0,
  outer = 85 / 100
) {
  const w = (this.gc.canvas.width * 100) / 100;
  const h = (this.gc.canvas.height * 100) / 100;
  const sw = w / this.segmentsPerCycle.value;
  const sh = h / Math.ceil(this.numberOfCycles.value);

  i -= this.start;

  const x = (i % this.segmentsPerCycle.value) * sw - w / 2;
  const y = Math.floor(i / this.segmentsPerCycle.value) * sh - h / 2;

  const left = Math.floor(x) + 0.5;
  const right = left + Math.ceil(sw);
  const top = Math.floor(y + (1 - inner) * sh) + 0.5;
  const bottom = Math.floor(y + (1 - outer) * sh) + 0.5;

  const segment = [];
  segment[0] = [left, top];
  segment[1] = [right, top];
  segment[2] = [right, bottom];
  segment[3] = [left, bottom];

  return segment;
};

Spiral.prototype.generateHeatmapOutline = function (outline) {
  const w = (this.gc.canvas.width * 100) / 100;
  const h = (this.gc.canvas.height * 100) / 100;

  const x = -w / 2;
  const y = -h / 2;

  const left = Math.floor(x) + 0.5;
  const right = left + Math.ceil(w);
  const top = Math.floor(y) + 0.5;
  const bottom = top + Math.ceil(h);

  outline[0] = [left, top];
  outline[1] = [right, top];
  outline[2] = [right, bottom];
  outline[3] = [left, bottom];

  return outline;
};
