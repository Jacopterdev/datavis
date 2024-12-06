"use strict";

function ColorSelector(container, init) {
    const colorselector = document.createElement("div");
    colorselector.classList.add("colorselector");
    container.appendChild(colorselector);

    const head = document.createElement("div");
    head.classList.add("colorselector-head");
    head.onclick = function (evt) {
        toggleEntries();
    };
    colorselector.appendChild(head);

    const bars = document.createElement("i");
    bars.classList.add("fa");
    bars.classList.add("fa-bars");
    head.appendChild(bars);

    const label = document.createElement("span");
    label.classList.add("colorselector-label");
    label.textContent = init || "Spectral";
    head.appendChild(label);

    const list = document.createElement("div");
    list.classList.add("colorselector-entries");
    colorselector.appendChild(list);

    const brewerMaps = Object.keys(Constants.COLORBREWER).sort();
    brewerMaps.forEach(function (colormapname) {
        const entry = document.createElement("div");
        entry.classList.add("colorselector-entry");
        entry.textContent = colormapname;
        list.appendChild(entry);

        const mapper = new ColorMapper(Constants.COLORBREWER[colormapname]["7"]);
        entry.style.backgroundImage = 'url("' + mapper.gradient() + '")';

        entry.onclick = function (evt) {
            label.textContent = evt.target.textContent;
            toggleEntries();
            this.onselect(evt.target.textContent)
        }.bind(this);
    }, this);

    function toggleEntries () {
        if (colorselector.classList.contains("colorselector-expand")) {
            colorselector.classList.remove("colorselector-expand");
        }
        else {
            colorselector.classList.add("colorselector-expand");
        }
    }

    this.onselect = function (colormapname) {

    };
}