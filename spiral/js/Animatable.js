"use strict";

function Animatable(init) {
    init = init || [0];

    this.cur = init.slice();
    this.dst = init.slice();

    this.dist = [];
    this.force = [];
    this.velo = [];
    this.accel = [];

    let i = init.length;
    while (i--) {
        this.dist[i] = 0;
        this.force[i] = 0;
        this.velo[i] = 0;
        this.accel[i] = 0;
    }

    this.oldTime = -1; // Timestamp of the last update
    this.done = true; // Indicates when destination has been reached
}

Animatable.prototype.springK = 192; // Spring constant
Animatable.prototype.dampK = 24; // Damping constant
Animatable.prototype.massK = 1; // Mass constant
Animatable.prototype.epsilonK = 0.01; // Epsilon neighborhood to converge to destination

Animatable.prototype.get = function () {
    return this.cur;
};

Animatable.prototype.getDestination = function () {
    return this.dst;
};

Animatable.prototype.set = function (newDst) {
    this.dst = newDst;
    if (this.done) {
        this.oldTime = -1;
        this.done = false; // Reset animation
    }
};

Animatable.prototype.goTo = function (newDst) {
    let i = newDst.length;
    while (i--) {
        this.cur[i] = newDst[i];
        this.dst[i] = newDst[i];
        this.dist[i] = 0;
        this.force[i] = 0;
        this.velo[i] = 0;
        this.accel[i] = 0;
    }

    if (this.done) {
        this.oldTime = -1;
        this.done = false; // Reset animation
    }
};

Animatable.prototype.update = function (time) {
    return this.forceUpdate(time);
};

Animatable.prototype.forceUpdate = function (time) {
    if (!this.done) {
        const n = this.cur.length; // Length of array
        let i; // Loop variable
        let e = 0; // Energy

        if (this.oldTime == -1) this.oldTime = time;
        let dt = (time - this.oldTime) / 1000;
        this.oldTime = time;
        if (dt > 0.05) dt = 0.05;

        for (i = 0; i < n; i++) {
            // Compute displacement
            this.dist[i] = this.cur[i] - this.dst[i];

            // Compute force = spring force + damping force
            this.force[i] = -this.springK * this.dist[i] + -this.dampK * this.velo[i];

            // Compute acceleration
            this.accel[i] = this.force[i] / this.massK;

            // Update velocity
            this.velo[i] += dt * this.accel[i];

            // Update current position
            this.cur[i] += dt * this.velo[i];
        }

        // Compute energy (constant factors spring constant and mass ignored)
        for (i = 0; i < n; i++) {
            e += this.velo[i] * this.velo[i]; // Kinetic energy
            e += this.dist[i] * this.dist[i]; // Potential energy
        }

        if (e < this.epsilonK) {
            this.done = true;
            this.cur = this.dst.slice(); // Switch exactly to the destination
        }
    }

    return !this.done;
};