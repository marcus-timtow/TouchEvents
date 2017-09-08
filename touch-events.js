;
(function (name, definition) {
    if (typeof define === "function" && typeof define.amd === "object") {
        define(definition);
    } else {
        this[name] = definition();
    }
}("TouchEvents", function () {
    let events = {};
    const SWIPE_OPTIONS = {
        direction: ["left", "right", "up", "down"],
        threshold: 40,
        velocity: 1,
        falsePositiveThreshold: 40,
        scroll: true
    };

    let emit = function (element, name) {
        let event;
        try {
            event = new Event(name);
        } catch (err) { // Event constructor not defined
            event = document.createEvent("Event");
            event.initEvent(name, true, true);
        }
        element.dispatchEvent(event);
    };

    let Gesture = function () {
        this._scrollX;
        this._scrollY;
        this.scrollX; // x was scrolled during the gesture
        this.scrollY; // y was scrolled during the gesture
        this.x;
        this.y;
        this.startX;
        this.startY;
        this.endX;
        this.endY;
        this.dx;
        this.dy;

        this.startTime;
        this.endTime;
        this.dt;

        this.started = false;
        this.ended = false;
        this.canceled = false;

        this.is = this.equals = function (touch) {
            return this.identifier === touch.identifier;
        };

        this.start = function (touch) {
            if (this.started) {
                this.cancel();
            }
            this.identifier = touch.identifier;

            this.started = true;
            this.ended = false;
            this.canceled = false;

            this.startTime = Date.now();
            this.x = this.startX = touch.clientX;
            this.y = this.startY = touch.clientY;
            this._scrollX = touch.pageX - touch.clientX;
            this._scrollY = touch.pageY - touch.clientY;
            this.scrollX = this.scrollY = false;
        };

        this.set = function (touch) {
            if (!this.started) {
                this.start(touch);
            } else if (!this.equals(touch)) {
                return;
            }
            this.x = touch.clientX;
            this.y = touch.clientY;

            if (!this.scrollX) {
                let _scrollX = touch.pageX - touch.clientX;
                if (_scrollX !== this._scrollX) {
                    this.scrollX = true;
                }
            }
            if (!this.scrollY) {
                let _scrollY = touch.pageY - touch.clientY;
                if (_scrollY !== this._scrollY) {
                    this.scrollY = true;
                }
            }
        };

        this.cancel = function () {
            if (!this.started) {
                return;
            }
            this.end();
            this.canceled = true;
        };

        this.end = function () {
            if (!this.started) {
                return;
            }
            this.identifier;

            this.started = false;
            this.ended = true;

            this.endX = this.x;
            this.endY = this.y;
            this.dx = this.endX - this.startX;
            this.dy = this.endY - this.startY;

            this.endTime = Date.now();
            this.dt = this.endTime - this.startTime;

        };
    };
    Gesture.make = function (object, key = "gesture") {
        if (typeof object === "string") {
            key = object;
            object = null;
        }
        let gesture = new Gesture();

        object && Object.defineProperty(object, key, {
            get: function () {
                return gesture;
            },
            set: function (_touch) {
                gesture.set(_touch);
            }
        });

        return gesture;
    };

    /**
     * 
     * @param {Element} element
     * @param {object} options
     *  * direction : "all"|"up"|"down"|"right"|"left"|array<...>
     *  * threshold : number
     *  * velocity : number
     *  * falsePositiveThreshold: number
     *  * scroll: boolean // cancel all gesture if the element observed was scrolled during the swipe.
     * 
     * @returns {Element}
     */
    let Swipe = function (element, options) {
        options = options || {};
        if (typeof options.direction === "string") {
            if (options.direction === "all") {
                options.direction = ["up", "down", "left", "right"];
            } else {
                options.direction = [options.direction];
            }
        } else if (!Array.isArray(options.direction)) {
            options.direction = SWIPE_OPTIONS.direction;
        }
        options.threshold = typeof options.threshold === "number" ? options.threshold : SWIPE_OPTIONS.threshold;
        options.velocity = typeof options.velocity === "number" ? options.velocity : SWIPE_OPTIONS.velocity;
        options.falsePositiveThreshold = typeof options.falsePositiveThreshold === "number" ? options.falsePositiveThreshold : SWIPE_OPTIONS.falsePositiveThreshold;
        options.scroll = typeof options.scroll === "boolean" ? options.scroll : SWIPE_OPTIONS.scroll;

        let gesture = Gesture.make(this);

        let onStart = function (event) {
            if (gesture.started) {
                gesture.cancel();
                return;
            }

            let touches = event.touches;
            if (touches.length > 1) {
                return;
            }

            gesture.start(touches[0]);
        };
        let onMove = function (event) {
            var touches = event.changedTouches;
            if (touches.length > 1) {
                gesture.cancel();
                return;
            }
            let touch = touches[0];
            if (!gesture.equals(touch)) {
                gesture.cancel();
                return;
            }
            gesture.set(touch);
        };
        let onEnd = function (event) {
            var touches = event.changedTouches;
            if (touches.length > 1) {
                gesture.cancel();
                return;
            }
            let touch = touches[0];
            if (!gesture.equals(touch)) {
                gesture.cancel();
                return;
            }
            gesture.set(touch);
            gesture.end();
            Swipe.processGesture(element, gesture, options);
        };
        let onCancel = function (event) {
            var touches = event.changedTouches;
            if (touches.length > 1) {
                gesture.cancel();
                return;
            }
            let touch = touches[0];
            if (!gesture.equals(touch)) {
                gesture.cancel();
                return;
            }
            gesture.set(touch);
            gesture.cancel();
        };

        element.addEventListener("touchstart", onStart, false);
        element.addEventListener("touchend", onEnd, false);
        element.addEventListener("touchcancel", onCancel, false);
        element.addEventListener("touchmove", onMove, false);

        return element;
    };
    let test = function (w, h, dx, dy, dt, scrollX, options) {
        if (options.scroll && scrollX) {
            return false;
        }

        if (dx > 0) {
            return false;
        }
        dx = Math.abs(dx);
        dy = Math.abs(dy);

        if (dx < options.threshold) {
            return false;
        }
        if (options.hasOwnProperty("falsePositiveThreshold") && dy >= options.falsePositiveThreshold) {
            return false;
        }
        if (options.velocity) {
            let trace = dx * dx + dy * dy;
            let win = w * w + h * h;
            let p = Math.sqrt(trace / win);
            let m = p / options.threshold;
            let velocity = dt / m;
            if (velocity < options.velocity) {
                return false;
            }
        }
        return true;
    };
    Swipe.processGesture = function (element, gesture, options) {
        if (!gesture.ended || gesture.canceled) {
            return false;
        }
        // we convert the coordinate to considere all swipes as right to left swipes
        // (a successful right to left swipe must have dx<0) 

        let dx = gesture.dx,
                dy = gesture.dy,
                w = window.innerWidth,
                h = window.innerHeight,
                dt = gesture.dt,
                scrollX = gesture.scrollX,
                scrollY = gesture.scrollY;

        if (options.direction.includes("up")) {
            if (test(h, w, dy, dx, dt, scrollY, options)) {
                emit(element, "swipe-up");
            }
        }
        if (options.direction.includes("down")) {
            if (test(h, w, -dy, dx, dt, scrollY, options)) {
                emit(element, "swipe-down");
            }
        }
        if (options.direction.includes("left")) {
            if (test(w, h, dx, dy, dt, scrollX, options)) {
                emit(element, "swipe-left");
            }
        }
        if (options.direction.includes("right")) {
            if (test(w, h, -dx, dy, dt, scrollX, options)) {
                emit(element, "swipe-right");
            }
        }
    };


    events.Swipe = Swipe;
    return events;
}));

