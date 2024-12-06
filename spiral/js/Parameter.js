"use strict";

function Parameter(type, label, value, min, max) {

    const listeners = [];

    function fireChange() {
        listeners.forEach(function (l) {
            l(parameter);
        });
    }

    const parameter = {

        get type() {
            return type;
        },

        get label() {
            return label;
        },

        get min() {
            return min;
        },

        get max() {
            return max;
        },

        get value() {
            return value;
        },

        set value(val) {
            if (val != val) return; // Is NaN?
            if (val < min || val > max) return; // I out of range?
            if (val == value) return; // Is same value?
            value = val;
            fireChange(parameter);

        },

        removeChangeListener: function (l) {
            const i = listeners.indexOf(l);
            if (i != -1) listeners.splice(i, 1);
        },

        addChangeListener: function (l) {
            listeners.push(l);
            l(parameter);
        }
    };

    return parameter;
}

function ParameterUI(container, params, title) {

    const grp = document.createElement("div");
    grp.classList.add("param-group");

    params.forEach(function (p) {
        const div = document.createElement("div"); // Create div element for the parameter container
        div.classList.add("param-container");

        const label = document.createElement("span"); // Create a span for the label
        label.textContent = p.label;
        label.classList.add("param-label");
        div.appendChild(label);

        ParameterUI[p.type](p, div);

        grp.appendChild(div);
    });

    container.appendChild(grp);
}

ParameterUI.slider = function (p, div) {
    const input = document.createElement("input"); // Create an input field for keyboard input
    input.classList.add("param-input");
    input.type = "text";
    input.value = p.value;
    div.appendChild(input);

    const slider = document.createElement("div");
    slider.classList.add("param-slider");
    const xSlider = Xlider.ValueXlider(slider, {
        min: p.min,
        max: p.max,
        marks: [p.value],
        /* no_subslider: true */
    });
    div.appendChild(slider);

    p.addChangeListener(function (param) {
        input.value = p.value;
        xSlider.model.setModel({marks: [p.value]});
    });

    xSlider.addChangeListener(function (evt) {
        p.value = evt.value;
        input.value = p.value;
    });

    input.addEventListener("input", function () {
        p.value = parseFloat(this.value);
        xSlider.model.setModel({marks: [p.value]});
    });

    input.addEventListener("keydown", function (evt) {
        switch (evt.keyCode) {
            case Constants.KEY_UP:
                evt.preventDefault();
                p.value += 1;
                break;
            case Constants.KEY_DOWN:
                evt.preventDefault();
                p.value -= 1;
                break;
        }
    });
};

ParameterUI.switch = function (p, div) {
    const span = document.createElement("span");
    span.classList.add("param-switch");
    const xSwitch = Xlider.Xwitch(span, {
        marks: [p.value],
    });
    div.appendChild(span);

    p.addChangeListener(function (param) {
        xSwitch.model.setModel([p.value]);
    });

    xSwitch.addChangeListener(function (evt) {
       p.value = evt.value;
    });
};

ParameterUI.colorselector = function (p, div) {
    const cs = new ColorSelector(div, p.value);
    cs.onselect = function (cmname) {
        p.value = cmname;
    };
};