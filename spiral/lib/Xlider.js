"use strict";

var Xlider = (function Xlider() {

    function CustomXlider(id, options) {

        var domain = options.domain || guessDomain(options);
        var align = (options.align) ? options.align.slice() : [];

        function guessDomain(options) {
            if (options.min instanceof Date) {
                return Domain.Date;
            }
            if (options.min == 0 && options.max == 1) {
                return Domain.Boolean;
            }
            if (Number.isInteger(options.min)) {
                return Domain.Integer;
            }
            return Domain.Float;
        }

        // *************************************************
        // *** MODEL ***************************************
        // *************************************************
        var model = (function Model() {

            var min = options.min;
            var max = options.max;
            var marks = options.marks.slice();
            var ranges = options.ranges.slice();

            function setModel(options) {

                if (options.min != undefined) {
                    min = options.min;
                }

                if (options.max != undefined) {
                    max = options.max;
                }

                if (options.marks != undefined && options.marks.length == this.marks.length) {
                    marks = options.marks.slice();
                }

                ui.update();
            }

            function normalize(v) {
                var mi = domain.toNumber(min);
                var ma = domain.toNumber(max);
                return (domain.toNumber(v) - mi) / (ma - mi);
            }

            function normalizeAt(index) {
                return (index < 0) ? 0 : (index >= marks.length) ? 1 : normalize(marks[index]);
            }

            function denormalize(v) {
                var mi = domain.toNumber(min);
                var ma = domain.toNumber(max);
                return domain.toDomainValue(mi + v * (ma - mi));
            }

            function valueAt(index) {
                return (index < 0) ? min : (index >= marks.length) ? max : marks[index];
            }

            function labelize(v) {
                return domain.toLabel(v);
            }

            function labelAt(index) {
                return labelize(valueAt(index));
            }

            function log() {
                return;
                var msg = "";

                msg += labelize(min) + " |----";

                msg = marks.reduce(function (s, m) {
                    return s + " " + labelize(m) + " ---";
                }, msg);

                msg += "-| " + labelize(max);

                console.log(msg);
            }

            function moveMark(index, value) {
                var old = marks[index];

                var lowerLimit = normalizeAt(index - 1);
                var upperLimit = normalizeAt(index + 1);

                value = (value < lowerLimit) ? lowerLimit : (value > upperLimit) ? upperLimit : value;
                marks[index] = denormalize(value);

                if (old != marks[index]) {
                    try {
                        firechange("mark", index, marks[index]);
                        ui.update(index);
                    }
                    catch (ex) {
                        if (!ex.veto) throw ex; // If exception is not a veto, re-throw it

                        // Mark change to has been vetoed. Rolling back.
                        marks[index] = old;

                        try {
                            firechange("mark", index, marks[index]);
                        }
                        catch (ex) {
                            if (!ex.veto) throw ex; // If exception is not a veto, re-throw it

                            // Ignore veto! Everybody should be happy with the old value!
                        }
                    }
                }
            }

            function moveRange(index, value) {
                var rlo = ranges[index][0];
                var rhi = ranges[index][1];

                var old = [marks[rlo], marks[rhi]];

                // Keep delta between adjacent marks constant!!!
                var delta = normalizeAt(rhi) - normalizeAt(rlo);

                var lowerLimit = normalizeAt(rlo - 1);
                var upperLimit = normalizeAt(rhi + 1);
                upperLimit -= delta;

                value = (value < lowerLimit) ? lowerLimit : (value > upperLimit) ? upperLimit : value;
                marks[rlo] = denormalize(value);
                marks[rhi] = denormalize(value + delta);

                if (old[0] != marks[rlo]) {
                    try {
                        firechange("range", index, [marks[rlo], marks[rhi]]);
                        ui.update(rlo);
                        ui.update(rhi);
                    }
                    catch (ex) {
                        if (!ex.veto) throw ex; // If exception is not a veto, re-throw it

                        // Range change has been vetoed. Rolling back.
                        marks[rlo] = old[0];
                        marks[rhi] = old[1];

                        try {
                            firechange("range", index, [marks[rlo], marks[rhi]]);
                        }
                        catch (ex) {
                            if (!ex.veto) throw ex; // If exception is not a veto, re-throw it

                            // Ignore veto! Everybody should be happy with the old value!
                        }
                    }
                }
            }

            log();

            ///////////////
            // Model API //
            ///////////////
            return {
                get min() {
                    return min;
                },
                get max() {
                    return max;
                },
                get marks() {
                    return marks;
                },
                get ranges() {
                    return ranges
                },

                normalize: normalize,
                denormalize: denormalize,
                labelize: labelize,

                valueAt: valueAt,
                normalizeAt: normalizeAt,
                labelAt: labelAt,

                moveMark: moveMark,
                moveRange: moveRange,
                setModel: setModel,

                log: log
            };
        })();

        // *************************************************
        // *** UI ******************************************
        // *************************************************
        var ui = (function UI() {

            var container = document.createElement('div');
            container.classList.add("xlider-container");

            var slider = document.createElement('div');
            slider.classList.add("xlider-slider");
            slider.addEventListener("mousedown", start);
            slider.addEventListener("touchstart", start);
            container.appendChild(slider);

            var marks = model.marks.map(function (mark, i) {
                var m = document.createElement('div');
                m.classList.add("xlider-mark");
                m.classList.add(align[i] ? "align-" + align[i] : "align-center");

                m.addEventListener("mousedown", start);
                m.addEventListener("touchstart", start);

                m.start = function () {
                    handle.classList.add("moving");
                };

                m.move = function (t) {
                    model.moveMark(i, t);
                };

                m.update = function () {
                    tooltip.textContent = m.label();
                    m.style.left = (model.normalize(model.marks[i]) * 100) + '%';
                    m.ranges.forEach(function (range) {
                        range.update();
                    });
                };

                m.end = function () {
                    handle.classList.remove("moving");
                };

                m.label = function () {
                    return model.labelize(model.marks[i]);
                };

                slider.appendChild(m);

                var handle = document.createElement('div');
                handle.classList.add("xlider-handle");

                handle.classList.add("movable");
                m.appendChild(handle);

                var pin = document.createElement('div');
                pin.classList.add("xlider-pin");
                handle.appendChild(pin);

                var tooltip = document.createElement('div');
                tooltip.classList.add("xlider-tooltip");
                handle.appendChild(tooltip);

                m.mark = i; // Store index of associated mark
                m.ranges = []; // Store ranges that are incident to this mark

                return m;
            });

            var ranges = model.ranges.map(function (range, i) {
                var r = document.createElement('div');
                r.classList.add("xlider-range");

                var rlo = range[0];
                var rhi = range[1];

                if (marks[rlo]) marks[rlo].ranges.push(r); // Store this range in its incident marks
                if (marks[rhi]) marks[rhi].ranges.push(r);

                if ((rlo >= 0) && (rhi <= marks.length)) {
                    r.mark = rlo; // Store index of associated mark
                    r.classList.add("movable");
                    r.addEventListener("mousedown", start);
                    r.addEventListener("touchstart", start);
                }

                r.start = function () {
                    if (marks[rlo]) marks[rlo].start();
                    if (marks[rhi]) marks[rhi].start();
                };

                r.move = function (t) {
                    model.moveRange(i, t);
                };

                r.update = function () {
                    r.style.left = (model.normalizeAt(rlo) * 100) + "%";
                    r.style.width = ((model.normalizeAt(rhi) - model.normalizeAt(rlo)) * 100) + '%';
                };

                r.end = function () {
                    if (marks[rlo]) marks[rlo].end();
                    if (marks[rhi]) marks[rhi].end();
                };

                r.label = function () {
                    return "[" + model.labelAt(rlo) + " – " + model.labelAt(rhi) + "]";
                };

                slider.appendChild(r);

                return r;
            });

            var scale = document.createElement('div');
            scale.classList.add("xlider-scale");
            slider.appendChild(scale);

            ///////////////////////////
            // Slider event handling //
            ///////////////////////////

            function EventIdentifier(evt) {
                if (window.PointerEvent && evt instanceof PointerEvent) {
                    return function (e) {
                        return "POINTER " + e.pointerId;
                    }
                }
                else if (window.MouseEvent && evt instanceof MouseEvent) {
                    return function (e) {
                        return "MOUSE " + e.button;
                    }
                }
                else if (window.TouchEvent && evt instanceof TouchEvent) {
                    return function (e) {
                        return "TOUCH " + e.changedTouches.item(0).identifier;
                    }
                }
            }

            function EventNormalizer(evt) {
                if (window.PointerEvent && evt instanceof PointerEvent) {
                    return function (e) {
                        return e
                    };
                }
                else if (window.MouseEvent && evt instanceof MouseEvent) {
                    return function (e) {
                        return e
                    };
                }
                else if (window.TouchEvent && evt instanceof TouchEvent) {
                    return function (e) {
                        return e.changedTouches.item(0);
                    };
                }
            }

            container.addEventListener('mouseenter', function () {
                container.classList.add('hovering');
            });
            container.addEventListener('mouseleave', function () {
                container.classList.remove('hovering');
            });

            function start(evt) {
                if (evt instanceof MouseEvent && evt.button != 0) return;
                // console.log("Handle Press");

                slider.classList.add("dragging");
                document.body.style.cursor = "move";

                evt.preventDefault();
                evt.stopPropagation();

                var eIdentify = EventIdentifier(evt);
                var eNormalize = EventNormalizer(evt);

                var id = eIdentify(evt);
                var e = eNormalize(evt);

                var target = evt.currentTarget;
                var offset = e.clientX - target.getBoundingClientRect().left;

                if (target == slider) { // When event was on the slider background
                    offset = 0;
                    var t = relativePosition(e.clientX, offset);

                    var closest = 0; // Find the closest mark
                    var min_dt = Number.POSITIVE_INFINITY;
                    model.marks.forEach(function (v, i) {
                        var dt = Math.abs(t - model.normalize(v));
                        if (dt < min_dt) {
                            min_dt = dt;
                            closest = i;
                        }
                    });

                    target = marks[closest]; // Set closest mark as the target to be moved in subsequent events
                    target.move(t); // Move the target immediately to the pointers position
                }

                target.start();

                function move(evt) {
                    if (eIdentify(evt) != id) return;
                    // console.log("Handle Drag");

                    evt.preventDefault();
                    evt.stopPropagation();

                    var e = eNormalize(evt);

                    if (subslider) {
                        if (subslider.inTargetZone(e)) {
                            target.move(relativePosition(e.clientX, offset));
                            subslider.updatesub(e);
                        }
                        else if (subslider.inSubZone(e)) {
                            subslider.movesub(e);
                        }
                    }
                    else {
                        target.move(relativePosition(e.clientX, offset));
                    }
                }

                function end(evt) {
                    if (eIdentify(evt) != id) return;
                    // console.log("Handle Release");

                    slider.classList.remove("dragging");
                    document.body.style.cursor = "";

                    evt.preventDefault();
                    evt.stopPropagation();

                    target.end();

                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("touchmove", move);

                    window.removeEventListener("mouseup", end);
                    window.removeEventListener("touchend", end);

                    if (subslider) subslider.ui.detachUI();
                }

                window.addEventListener("mousemove", move);
                window.addEventListener("touchmove", move);

                window.addEventListener("mouseup", end);
                window.addEventListener("touchend", end);

                if (!options.no_subslider) {
                    var subslider = subXlider(target);
                    subslider.updatesub(e);
                }
            }

            function relativePosition(x, offset) {
                var bounds = slider.getBoundingClientRect();
                x = x - bounds.left - offset;
                return x / bounds.width;
            }

            function generateScaleLabels(n, t) {
                var labels = [];
                var i;
                for (i = 0; i < n; i++) {
                    labels[i] = {};
                    labels[i].value = model.denormalize(i / (n - 1));
                    labels[i].text = model.labelize(labels[i].value);
                    labels[i].type = (i % t == 0) ? "tack" : "tick";
                }
                return labels;
            }

            function updateScaleLabels() {
                scale.innerHTML = "";

                var ticks = document.createElement('div');
                ticks.classList.add("xlider-ticks");
                scale.appendChild(ticks);

                var labels = document.createElement('div');
                labels.classList.add("xlider-labels");
                scale.appendChild(labels);

                generateScaleLabels(5, 2).forEach(function (l) {
                    var left = "calc((100% - 1px) * ";
                    left += (l.value - model.min) / (model.max - model.min);
                    left += ")";

                    var tick = document.createElement('div');
                    tick.classList.add("xlider-tick");
                    tick.classList.add(l.type);
                    tick.style.left = left;
                    ticks.appendChild(tick);

                    var label = document.createElement('div');
                    label.classList.add("xlider-label");
                    label.style.left = left;
                    labels.appendChild(label);

                    var text = document.createElement('div');
                    text.textContent = l.text;
                    text.classList.add("xlider-label-text");
                    label.appendChild(text);
                });
            }

            function update(m) {
                // Update individual mark
                if (m != undefined) {
                    marks[m].update();
                }
                // Update everything
                else {
                    marks.forEach(function (m) {
                        m.update();
                    });

                    ranges.forEach(function (r) {
                        r.update();
                    });

                    updateScaleLabels();
                }
            }

            function attachUI(elem) {
                elem.appendChild(container);
            }

            function detachUI() {
                container.parentNode.removeChild(container);
            }

            ////////////////
            // Sub-Slider //
            ////////////////

            function subXlider(target) {
                var options = {
                    min: model.min,
                    max: model.max,
                    marks: [model.marks[target.mark]],
                    domain: domain,
                    ranges: []
                };

                var sub = CustomXlider(undefined, options); // Provide NO id so that sub's UI is not attached upon creation

                sub.ui.attachUI(container.parentNode);
                sub.ui.container.classList.add("subslider");

                sub.ui.markone.label = target.label;

                sub.ui.markone.start();

                sub.movesub = function (e) { // Give the subslider a top-level move function that ...
                    sub.ui.container.style.opacity = 1;
                    var t = sub.ui.relativePosition(e.clientX, 0);
                    t = (t < 0) ? 0 : (t > 1) ? 1 : t;
                    target.move(model.normalize(sub.model.denormalize(t))); // ... propagates the move to the parent's target
                    sub.model.marks[0] = model.marks[target.mark];
                    sub.ui.update(0);
                };

                var targetZone = 50;

                sub.inTargetZone = function (e) {
                    var bounds = slider.getBoundingClientRect();
                    return (e.clientY >= bounds.top - targetZone && e.clientY <= bounds.bottom + targetZone);
                };

                sub.inSubZone = function (e) {
                    var bounds = sub.ui.container.getBoundingClientRect();
                    return (e.clientY >= bounds.top && e.clientY <= bounds.bottom);
                };

                sub.updatesub = function (e) {
                    var slider_bb = slider.getBoundingClientRect();
                    var sub_container_bb = sub.ui.container.getBoundingClientRect();

                    // Center subslider wrt. target
                    sub.ui.container.style.left = (e.clientX - sub_container_bb.width / 2) + "px";

                    // Set position of subslider depending on y-position of pointer
                    var yCenter, yDist, ySign;
                    yCenter = slider_bb.top + slider_bb.height / 2;
                    yDist = e.clientY - yCenter;
                    ySign = (yDist < 0) ? -1 : 1;
                    yDist *= ySign;

                    if (ySign < 0) {
                        if (yCenter - sub_container_bb.height - targetZone > 0) { // Prevent off-page subslider
                            sub.ui.container.style.top = (yCenter - sub_container_bb.height - targetZone) + "px";
                            sub.ui.container.style.opacity = (yDist - 10) / (targetZone - 10);
                        }
                    }
                    else {
                        if (yCenter + sub_container_bb.height + targetZone < window.innerHeight) { // Prevent off-page subslider
                            sub.ui.container.style.top = (yCenter + targetZone) + "px";
                            sub.ui.container.style.opacity = (yDist - 10) / (targetZone - 10);
                        }
                    }

                    // Update model of subslider range
                    var options = {
                        min: model.denormalize(model.normalizeAt(target.mark) - 0.05),
                        max: model.denormalize(model.normalizeAt(target.mark) + 0.05),
                        marks: [model.marks[target.mark]]
                    };
                    sub.model.setModel(options);
                };

                return sub;
            }

            update();

            ////////////
            // UI API //
            ////////////
            return {
                container: container,
                markone: marks[0],
                update: update,
                relativePosition: relativePosition,
                attachUI: attachUI,
                detachUI: detachUI
            };
        })();

        ////////////////////
        // Event handling //
        ////////////////////
        var listeners = [];

        function addChangeListener(l) {
            listeners.push(l);
        }

        function removeChangeListener(l) {
            var i = listeners.indexOf(l);
            if (i != -1) listeners.splice(i, 1);
        }

        function firechange(type, index, value) {
            var evt = {
                type: type,
                index: index,
                value: value
            };

            listeners.forEach(function (l) {
                l(evt);
            });
        }

        function append(elem) {
            if (typeof elem == "string") {
                elem = document.getElementById(elem);
            }

            if (elem) {
                var stack = document.createElement('div');
                stack.classList.add("xlider-stack");
                ui.attachUI(stack);
                elem.appendChild(stack);
            }
        }

        append(id);

        ////////////////
        // Xlider API //
        ////////////////
        return {
            domain: domain,
            model: model,
            ui: ui,
            addChangeListener: addChangeListener,
            removeChangeListener: removeChangeListener
        };
    }

    function ValueXlider(id, options) {
        options = options || {};
        options.min = options.min || 0;
        options.max = options.max || 100;
        options.marks = options.marks || [options.min];
        options.ranges = options.ranges || [[Number.NEGATIVE_INFINITY, 0]]; // [[0, Number.POSITIVE_INFINITY]];
        options.align = options.align || ['center'];

        return CustomXlider(id, options);
    }

    function RangeXlider(id, options) {
        options = options || {};
        options.min = options.min || 0;
        options.max = options.max || 100;
        options.marks = options.marks || [options.min, options.max];
        options.ranges = options.ranges || [[0, 1]];
        options.align = options.align || ['left', 'right'];

        return CustomXlider(id, options);
    }

    function Xwitch(id, options) {
        options = options || {};
        options.min = 0;
        options.max = 1;
        options.marks = options.marks || [options.min];
        options.ranges = options.ranges || [[Number.NEGATIVE_INFINITY, 0]]; // [[0, Number.POSITIVE_INFINITY]];
        options.align = ['center'];
        options.no_subslider = true;

        options.domain = Object.create(Domain.Boolean);
        options.domain.toLabel = function (value) {
            return (value) ? "On" : "Off";
        };

        return CustomXlider(id, options);
    }

    var Domain = {
        Integer: {

            name: "Integer",

            format: new Intl.NumberFormat('en-US', {useGrouping: false}).format,

            toNumber: function (value) {
                // value is already a number
                return value;
            },

            toDomainValue: function (number) {
                // number needs to be rounded to make an integer
                return Math.round(number);
            },

            toLabel: function (value) {
                return this.format(value);
            }
        },

        Float: {

            name: "Float",

            format: new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format,

            toNumber: function (value) {
                // value is already a number
                return value;
            },

            toDomainValue: function (number) {
                // value remains a number
                return number;
            },

            toLabel: function (value) {
                return this.format(value);
            }
        },

        Date: {
            name: "Date",

            format: new Intl.DateTimeFormat('en-US', {day: "2-digit", month: "2-digit", year: "numeric"}).format,

            toNumber: function (value) {
                // value is a Date, use milliseconds since 1970 to represent it as a number
                return value.getTime();
            },

            toDomainValue: function (number) {
                // value is milliseconds since 1970, convert it back to a Date
                var d = new Date();
                d.setTime(Math.round(number));
                return d;
            },

            toLabel: function (value) {
                return this.format(value);
            }
        },

        Boolean: {
            name: "Boolean",

            toNumber: function (value) {
                // value is a true/false, use 0/1 to represent it as a number
                return +value;
            },

            toDomainValue: function (number) {
                return (Math.round(number) || 0);
            },

            toLabel: function (value) {
                return value.toString();
            }
        }

    };

    ////////////////
    // Module API //
    ////////////////
    return {
        CustomXlider: CustomXlider,
        ValueXlider: ValueXlider,
        RangeXlider: RangeXlider,
        Xwitch: Xwitch,
        Domain: Domain
    };
})();
