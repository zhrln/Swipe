/*
 * Swipe 2.0
 *
 * Brad Birdsall
 * Copyright 2013, MIT License
 *
*/

/* eslint-disable no-use-before-define */

const noop = () => {};
const offloadFn = fn => setTimeout(fn || noop, 0);

// check browser capabilities
const browser = {
  addEventListener: !!window.addEventListener,
  touch: 'ontouchstart' in window,
  transitions: (function (temp) {
    const props = ['transitionProperty', 'WebkitTransition', 'MozTransition'];
    return Object.keys(props).some(i => temp.style[props[i]] !== undefined);
  }(document.createElement('swipe')))
};

export default function Swipe(container, options = {}) {

  // quit if no root element
  if (!container) return {};

  const element = container.children[0];
  const GlobalSpeed = options.speed || 300;

  let GlobalSlides, slidePos, width, length;
  let GlobalIndex = parseInt(options.startSlide, 10) || 0;
  let delay = options.auto || 0; // setup auto slideshow
  let interval;

  options.continuous = options.continuous !== undefined
    ? options.continuous
    : true;

  // setup initial vars
  let delta = {};
  let start = {};
  let isScrolling;

  // setup event capturing
  const events = {

    handleEvent: function (event) {

      switch (event.type) {
        case 'touchstart': this.start(event); break;
        case 'touchmove': this.move(event); break;
        case 'touchend': offloadFn(this.end(event)); break;
        case 'webkitTransitionEnd':
        case 'transitionend': offloadFn(this.transitionEnd(event)); break;
        case 'resize': offloadFn(setup); break;
        default: break;
      }

      if (options.stopPropagation) event.stopPropagation();

    },
    start: function (event) {

      const touches = event.touches[0];

      // measure start values
      start = {

        // get initial touch coords
        x: touches.pageX,
        y: touches.pageY,

        // store time to determine touch duration
        time: +new Date()

      };

      // used for testing first move event
      isScrolling = undefined;

      // reset delta and end measurements
      delta = {};

      // attach touchmove and touchend listeners
      element.addEventListener('touchmove', this, false);
      element.addEventListener('touchend', this, false);

    },
    move: function (event) {

      // ensure swiping with one touch and not pinching
      if (event.touches.length > 1 || event.scale && event.scale !== 1) return;

      if (options.disableScroll) event.preventDefault();

      const touches = event.touches[0];

      // measure change in x and y
      delta = {
        x: touches.pageX - start.x,
        y: touches.pageY - start.y
      };

      // determine if scrolling test has run - one time test
      if (typeof isScrolling === 'undefined') {
        isScrolling = !!(isScrolling || Math.abs(delta.x) < Math.abs(delta.y));
      }

      // if user is not trying to scroll vertically
      if (!isScrolling) {

        // prevent native scrolling
        event.preventDefault();

        // stop slideshow
        stop();

        // increase resistance if first or last slide
        if (options.continuous) { // we don't add resistance at the end

          translate(
            circle(GlobalIndex - 1),
            delta.x + slidePos[circle(GlobalIndex - 1)],
            0
          );

          translate(
            GlobalIndex,
            delta.x + slidePos[GlobalIndex],
            0
          );

          translate(
            circle(GlobalIndex + 1),
            delta.x + slidePos[circle(GlobalIndex + 1)],
            0
          );

        } else {
          delta.x /=
            ((!GlobalIndex && delta.x > 0 // if first slide and sliding left
              // or if last slide and sliding right
              || GlobalIndex === GlobalSlides.length - 1
              && delta.x < 0) // and if sliding at all
              ? (Math.abs(delta.x) / width + 1) // determine resistance level
              : 1); // no resistance if false

          // translate 1:1
          translate(GlobalIndex - 1, delta.x + slidePos[GlobalIndex - 1], 0);
          translate(GlobalIndex, delta.x + slidePos[GlobalIndex], 0);
          translate(GlobalIndex + 1, delta.x + slidePos[GlobalIndex + 1], 0);
        }

      }

    },
    end: function () {

      // measure duration
      const duration = +new Date() - start.time;

      // determine if slide attempt triggers next/prev slide
      const isValidSlide =
        // if slide duration is less than 250ms
        Number(duration) < 250
        // and if slide amt is greater than 20px
        && Math.abs(delta.x) > 20
        // or if slide amt is greater than half the width
        || Math.abs(delta.x) > width / 2;

      // determine if slide attempt is past start and end
      let isPastBounds =
        // if first slide and slide amt is greater than 0
        !GlobalIndex && delta.x > 0
        // or if last slide and slide amt is less than 0
        || GlobalIndex === GlobalSlides.length - 1 && delta.x < 0;

      if (options.continuous) isPastBounds = false;

      // determine direction of swipe (true:right, false:left)
      const direction = delta.x < 0;

      // if not scrolling vertically
      if (!isScrolling) {

        if (isValidSlide && !isPastBounds) {

          if (direction) {
            // we need to get the next in this direction in place
            if (options.continuous) {
              move(circle(GlobalIndex - 1), -width, 0);
              move(circle(GlobalIndex + 2), width, 0);
            } else {
              move(GlobalIndex - 1, -width, 0);
            }
            const _gIndex = circle(GlobalIndex + 1);
            move(GlobalIndex, slidePos[GlobalIndex] - width, GlobalSpeed);
            move(_gIndex, slidePos[_gIndex] - width, GlobalSpeed);
            GlobalIndex = _gIndex;
          } else {
            // we need to get the next in this direction in place
            if (options.continuous) {
              move(circle(GlobalIndex + 1), width, 0);
              move(circle(GlobalIndex - 2), -width, 0);
            } else {
              move(GlobalIndex + 1, width, 0);
            }
            const _gIndex = circle(GlobalIndex - 1);
            move(GlobalIndex, slidePos[GlobalIndex] + width, GlobalSpeed);
            move(_gIndex, slidePos[_gIndex] + width, GlobalSpeed);
            GlobalIndex = _gIndex;
          }
          options.callback && options.callback(
            GlobalIndex, GlobalSlides[GlobalIndex]
          );
        } else if (options.continuous) {
          move(circle(GlobalIndex - 1), -width, GlobalSpeed);
          move(GlobalIndex, 0, GlobalSpeed);
          move(circle(GlobalIndex + 1), width, GlobalSpeed);
        } else {
          move(GlobalIndex - 1, -width, GlobalSpeed);
          move(GlobalIndex, 0, GlobalSpeed);
          move(GlobalIndex + 1, width, GlobalSpeed);
        }
      }

      // kill touchmove and touchend event
      // listeners until touchstart called again
      element.removeEventListener('touchmove', events, false);
      element.removeEventListener('touchend', events, false);

    },
    transitionEnd: function (event) {
      if (parseInt(event.target.getAttribute('data-index'), 10) === GlobalIndex) {
        if (delay) begin();
        options.transitionEnd && options.transitionEnd.call(
          event, GlobalIndex, GlobalSlides[GlobalIndex]
        );
      }
    }

  };

  function next() {
    if (options.continuous) slide(GlobalIndex + 1);
    else if (GlobalIndex < GlobalSlides.length - 1) slide(GlobalIndex + 1);
  }

  function begin() {
    interval = setTimeout(next, delay);
  }

  function stop() {
    delay = 0;
    clearTimeout(interval);
  }

  function circle(index) {
    // a simple positive modulo using slides.length
    const _t = (GlobalSlides.length + (index % GlobalSlides.length));
    return _t % GlobalSlides.length;
  }

  function translate(index, dist, speed) {

    const _slide = GlobalSlides[index];
    const style = _slide && _slide.style;

    if (!style) return;

    style.webkitTransitionDuration
      = style.transitionDuration
      = speed + 'ms';

    style.webkitTransform = 'translate(' + dist + 'px,0)translateZ(0)';

  }

  function move(index, dist, speed) {

    translate(index, dist, speed);
    slidePos[index] = dist;

  }

  function animate(from, to, speed) {

    // if not an animation, just reposition
    if (!speed) {
      element.style.left = to + 'px';
      return;
    }

    const _start = +new Date();

    const timer = setInterval(() => {

      const timeElap = +new Date() - _start;

      if (timeElap > speed) {

        element.style.left = to + 'px';

        if (delay) begin();

        options.transitionEnd && options.transitionEnd.call(
          event, GlobalIndex, GlobalSlides[GlobalIndex]
        );

        clearInterval(timer);
        return;

      }

      element.style.left = (((to - from) * (Math.floor((timeElap / speed) * 100) / 100)) + from) + 'px';

    }, 4);

  }

  function slide(to, slideSpeed) {

    // do nothing if already on requested slide
    if (GlobalIndex === to) return;

    if (browser.transitions) {

      // 1: backward, -1: forward
      let direction = Math.abs(GlobalIndex - to) / (GlobalIndex - to);

      // get the actual position of the slide
      if (options.continuous) {
        const naturalDirection = direction;
        direction = -slidePos[circle(to)] / width;

        // if going forward but to < index, use to = GlobalSlides.length + to
        // if going backward but to > index, use to = -GlobalSlides.length + to
        if (direction !== naturalDirection) {
          to = -direction * GlobalSlides.length + to;
        }

      }

      let diff = Math.abs(GlobalIndex - to) - 1;

      // move all the slides between index and to in the right direction
      while (diff--) {
        move(
          circle((to > GlobalIndex ? to : GlobalIndex) - diff - 1),
          width * direction,
          0
        );
      }

      to = circle(to);

      move(GlobalIndex, width * direction, slideSpeed || GlobalSpeed);
      move(to, 0, slideSpeed || GlobalSpeed);

      // we need to get the next in place
      if (options.continuous) {
        move(circle(to - direction), -(width * direction), 0);
      }

    } else {
      to = circle(to);
      animate(GlobalIndex * -width, to * -width, slideSpeed || GlobalSpeed);
      // no fallback for a circular continuous if the
      // browser does not accept transitions
    }

    GlobalIndex = to;
    offloadFn(
      options.callback
      && options.callback(GlobalIndex, GlobalSlides[GlobalIndex])
    );
  }

  function prev() {
    if (options.continuous) slide(GlobalIndex - 1);
    else if (GlobalIndex) slide(GlobalIndex - 1);
  }

  function setup() {

    // cache slides
    GlobalSlides = element.children;
    length = GlobalSlides.length;

    // set continuous to false if only one slide
    if (GlobalSlides.length < 2) options.continuous = false;

    // special case if two slides
    if (browser.transitions && options.continuous && GlobalSlides.length < 3) {
      element.appendChild(GlobalSlides[0].cloneNode(true));
      element.appendChild(element.children[1].cloneNode(true));
      GlobalSlides = element.children;
    }

    // create an array to store current positions of each slide
    slidePos = new Array(GlobalSlides.length);

    // determine width of each slide
    width = container.getBoundingClientRect().width || container.offsetWidth;

    element.style.width = (GlobalSlides.length * width) + 'px';

    // stack elements
    let pos = GlobalSlides.length;
    while (pos--) {

      const _slide = GlobalSlides[pos];

      _slide.style.width = width + 'px';
      _slide.setAttribute('data-index', pos);

      if (browser.transitions) {
        _slide.style.left = (pos * -width) + 'px';
        move(
          pos,
          GlobalIndex > pos ? -width : (GlobalIndex < pos ? width : 0),
          0
        );
      }

    }

    // reposition elements before and after index
    if (options.continuous && browser.transitions) {
      move(circle(GlobalIndex - 1), -width, 0);
      move(circle(GlobalIndex + 1), width, 0);
    }

    if (!browser.transitions) element.style.left = (GlobalIndex * -width) + 'px';
    container.style.visibility = 'visible';
  }

  // trigger setup
  setup();

  // start auto slideshow if applicable
  if (delay) begin();

  // add event listeners
  if (browser.addEventListener) {
    // set touchstart event on element
    if (browser.touch) element.addEventListener('touchstart', events, false);
    if (browser.transitions) {
      element.addEventListener('webkitTransitionEnd', events, false);
      element.addEventListener('transitionend', events, false);
    }
    // set resize event on window
    window.addEventListener('resize', events, false);
  } else {
    window.onresize = function () { setup(); }; // to play nice with old IE
  }

  // expose the Swipe API
  return {
    setup: function () {
      setup();
    },
    slide: function (to, speed) {
      // cancel slideshow
      stop();
      slide(to, speed);
    },
    prev: function () {
      // cancel slideshow
      stop();
      prev();
    },
    next: function () {
      // cancel slideshow
      stop();
      next();
    },
    stop: function () {
      // cancel slideshow
      stop();
    },
    getPos: function () {
      // return current index position
      return GlobalIndex;
    },
    getNumSlides: function () {
      // return total number of slides
      return length;
    },
    kill: function () {
      // cancel slideshow
      stop();
      // reset element
      element.style.width = '';
      element.style.left = '';

      // reset slides
      let pos = GlobalSlides.length;
      while (pos--) {
        const _slide = GlobalSlides[pos];
        _slide.style.width = '';
        _slide.style.left = '';
        if (browser.transitions) translate(pos, 0, 0);
      }
      // removed event listeners
      if (browser.addEventListener) {
        // remove current event listeners
        element.removeEventListener('touchstart', events, false);
        element.removeEventListener('webkitTransitionEnd', events, false);
        element.removeEventListener('transitionend', events, false);
        window.removeEventListener('resize', events, false);
      } else {
        window.onresize = null;
      }

    }
  };

}
