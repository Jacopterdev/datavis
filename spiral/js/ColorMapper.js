"use strict";

function ColorMapper(colors) {

    // Special purpose color scale with blue, [shades of gray], red to highlight extremal values
    //colors = [Constants.COLORBREWER.Paired[11][1], '#909090', '#979797', '#A0A0A0', '#A7A7A7', '#B0B0B0', '#B7B7B7', '#C0C0C0', '#C7C7C7', '#E0E0E0', '#F0F0F0', Constants.COLORBREWER.Paired[11][5]];

    let cmReverse = 1;
    Object.defineProperty(this, "cmReverse", {
        get: function () {
            return cmReverse;
        },
        set: function (value) {
            cmReverse = value;
            legend();
        }
    });

    let cmSmooth = 1;
    Object.defineProperty(this, "cmSmooth", {
        get: function () {
            return cmSmooth;
        },
        set: function (value) {
            cmSmooth = value;
            legend();
        }
    });

    let cmTwoTone = 0;
    Object.defineProperty(this, "cmTwoTone", {
        get: function () {
            return cmTwoTone;
        },
        set: function (value) {
            cmTwoTone = value;
            legend();
        }
    });

    let cmTwoToneFlip = 0;
    Object.defineProperty(this, "cmTwoToneFlip", {
        get: function () {
            return cmTwoToneFlip;
        },
        set: function (value) {
            cmTwoToneFlip = value;
            legend();
        }
    });

    let cmRange = [0, 1];
    Object.defineProperty(this, "cmRange", {
        get: function () {
            return cmRange;
        },
        set: function (value) {
            cmRange = value;
            legend();
        }
    });

    const cmSmoothScale = chroma.scale(colors).mode('lab');
    const cmClasses = colors.length;
    const cmColors = cmSmoothScale.colors(cmClasses);
    const cmIndexedScale = chroma.scale(cmColors).classes(cmClasses);

    const encodeColor = function (val) {
        if (cmReverse) val = 1 - val;
        return ((cmSmooth) ? cmSmoothScale(val) : cmIndexedScale(val)).hex();
    };
    this.encodeColor = encodeColor;

    const encodeTwoTone = function (val) {
        const t = val * (cmClasses - 1);
        let index = Math.floor(t);
        const ratio = t - index;
        let next = 1;
        if (cmReverse) {
            index = (cmClasses - 1) - index;
            next = -1;
        }
        return {
            colors: (cmTwoToneFlip) ? [cmColors[index], cmColors[index + next]] : [cmColors[index + next], cmColors[index]],
            ratio: (cmTwoToneFlip) ? (1 - ratio) : ratio
        };
    };
    this.encodeTwoTone = encodeTwoTone;

    const gradient = function (width, height) {
        width = width || 30;
        height = height || 1;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const gc = canvas.getContext("2d");

        if (!cmTwoTone) {
            for (let x = 0; x < canvas.width; x++) {
                gc.fillStyle = encodeColor(x / canvas.width);
                gc.fillRect(x, 0, 2, height);
            }
        }
        else {
            let tt;
            for (let x = 0; x < canvas.width; x++) {
                tt = encodeTwoTone(x / canvas.width);
                gc.fillStyle = tt.colors[0];
                gc.fillRect(x, (1 - tt.ratio) * height, 2, tt.ratio * height);

                gc.fillStyle = tt.colors[1];
                gc.fillRect(x, 0, 2, (1 - tt.ratio) * height);
            }
        }

        return canvas.toDataURL();
    };
    this.gradient = gradient;

    const legend = function (containerClass = ".legend-container") {

        const colorContainer = $(containerClass + " .colors");
        colorContainer.css("background-image", 'url("' + gradient(colorContainer.innerWidth(), colorContainer.innerHeight()) + '")');

        const ticksContainer = $(containerClass + " .ticks");
        ticksContainer.empty();

        const labelsContainer = $(containerClass + " .labels");
        labelsContainer.empty();

        const format = new Intl.NumberFormat('en-US');
        const n = (cmTwoTone) ? cmClasses - 1 : cmClasses;

        for (let i = 0; i <= n; i++) {
            const t = i / n;

            const tick = $("<div>");
            tick.addClass("tick");
            tick.css({
                left: ((i / n) * 100) + "%",
                transform: "translate(" + ((i == 0) ? 0 : (i == n) ? -100 : -50) + "%, 0)"
            });

            const label = $("<div>");
            label.addClass("label");
            label.text(format.format(cmRange[0] + t * (cmRange[1] - cmRange[0])));
            label.css({
                left: ((i / n) * 100) + "%",
                transform: "translate(" + ((i == 0) ? 0 : (i == n) ? -100 : -50) + "%, 0)"
            });

            ticksContainer.append(tick);
            labelsContainer.append(label);
        }
    };
    this.legend = legend;

    const autoExpand = function (min, max, classes = cmClasses) {

        // Expand min max to reasonable range (see https://dx.doi.org/10.1117/12.766440)

        function orderOfMagnitude(value) {
            let n = 0;

            while (value <= 10) {
                value *= 10;
                n++;
            }

            while (value > 100) {
                value /= 10;
                n--;
            }

            return n;
        }

        function nextMultiple10(value) {
            if (value == 0) return 0;
            if (value < 10) return 10;

            let next = value;
            if (value % 10 != 0) {
                next /= 10;
                next = Math.round(next) * 10;
                if (next < value) next += 10;
            }
            return next;
        }

        function nextMultiple2(value) {
            let next = Math.round(value);
            if (next % 2 != 0) next++;
            if (next < value) next += 2;
            return next;
        }

        // Calc range from min to max
        let range = max - min;
        // Get n so that range*pow(10,n)>=10 (order of magnitude of range)
        let n = (range > 0) ? orderOfMagnitude(range) : 0;
        // Shift min and max to order of magnitude of range
        max = max * Math.pow(10, n);
        min = min * Math.pow(10, n);
        // Get multiple of 10 for max
        max = nextMultiple10(max);

        // Calc range with new max
        range = Math.abs(max - min);

        // ORIGINAL step 4. from TTTL paper
        // // Calc range for one interval
        // var classRange = range / classes;
        // // Get multiple of 2 for class range
        // classRange = nextMultiple2(classRange);
        // // Set range min to new min so that the range of one interval is multiple of 2

        // OVERRIDE behavior of step 4. described in TTTL paper, use simple ceiling instead of looking for multiple of 2
        const classRange = Math.ceil(range / classes);
        min = max - classRange * classes;

        // Shift back
        max *= Math.pow(10, -n);
        min *= Math.pow(10, -n);

        return [min, max];
    };
    this.autoExpand = autoExpand;

    legend();
}