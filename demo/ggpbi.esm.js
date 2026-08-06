// node_modules/d3-array/src/ascending.js
function ascending(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

// node_modules/d3-array/src/descending.js
function descending(a, b) {
  return a == null || b == null ? NaN : b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
}

// node_modules/d3-array/src/bisector.js
function bisector(f) {
  let compare1, compare2, delta;
  if (f.length !== 2) {
    compare1 = ascending;
    compare2 = (d, x2) => ascending(f(d), x2);
    delta = (d, x2) => f(d) - x2;
  } else {
    compare1 = f === ascending || f === descending ? f : zero;
    compare2 = f;
    delta = f;
  }
  function left2(a, x2, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a[mid], x2) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function right2(a, x2, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x2, x2) !== 0) return hi;
      do {
        const mid = lo + hi >>> 1;
        if (compare2(a[mid], x2) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }
  function center2(a, x2, lo = 0, hi = a.length) {
    const i = left2(a, x2, lo, hi - 1);
    return i > lo && delta(a[i - 1], x2) > -delta(a[i], x2) ? i - 1 : i;
  }
  return { left: left2, center: center2, right: right2 };
}
function zero() {
  return 0;
}

// node_modules/d3-array/src/number.js
function number(x2) {
  return x2 === null ? NaN : +x2;
}

// node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector(ascending);
var bisectRight = ascendingBisect.right;
var bisectLeft = ascendingBisect.left;
var bisectCenter = bisector(number).center;
var bisect_default = bisectRight;

// node_modules/d3-array/src/extent.js
function extent(values, valueof) {
  let min2;
  let max2;
  if (valueof === void 0) {
    for (const value of values) {
      if (value != null) {
        if (min2 === void 0) {
          if (value >= value) min2 = max2 = value;
        } else {
          if (min2 > value) min2 = value;
          if (max2 < value) max2 = value;
        }
      }
    }
  } else {
    let index2 = -1;
    for (let value of values) {
      if ((value = valueof(value, ++index2, values)) != null) {
        if (min2 === void 0) {
          if (value >= value) min2 = max2 = value;
        } else {
          if (min2 > value) min2 = value;
          if (max2 < value) max2 = value;
        }
      }
    }
  }
  return [min2, max2];
}

// node_modules/internmap/src/index.js
var InternMap = class extends Map {
  constructor(entries, key = keyof) {
    super();
    Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
    if (entries != null) for (const [key2, value] of entries) this.set(key2, value);
  }
  get(key) {
    return super.get(intern_get(this, key));
  }
  has(key) {
    return super.has(intern_get(this, key));
  }
  set(key, value) {
    return super.set(intern_set(this, key), value);
  }
  delete(key) {
    return super.delete(intern_delete(this, key));
  }
};
function intern_get({ _intern, _key }, value) {
  const key = _key(value);
  return _intern.has(key) ? _intern.get(key) : value;
}
function intern_set({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key)) return _intern.get(key);
  _intern.set(key, value);
  return value;
}
function intern_delete({ _intern, _key }, value) {
  const key = _key(value);
  if (_intern.has(key)) {
    value = _intern.get(key);
    _intern.delete(key);
  }
  return value;
}
function keyof(value) {
  return value !== null && typeof value === "object" ? value.valueOf() : value;
}

// node_modules/d3-array/src/identity.js
function identity(x2) {
  return x2;
}

// node_modules/d3-array/src/group.js
function group(values, ...keys) {
  return nest(values, identity, identity, keys);
}
function nest(values, map2, reduce, keys) {
  return (function regroup(values2, i) {
    if (i >= keys.length) return reduce(values2);
    const groups2 = new InternMap();
    const keyof2 = keys[i++];
    let index2 = -1;
    for (const value of values2) {
      const key = keyof2(value, ++index2, values2);
      const group2 = groups2.get(key);
      if (group2) group2.push(value);
      else groups2.set(key, [value]);
    }
    for (const [key, values3] of groups2) {
      groups2.set(key, regroup(values3, i));
    }
    return map2(groups2);
  })(values, 0);
}

// node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50);
var e5 = Math.sqrt(10);
var e2 = Math.sqrt(2);
function tickSpec(start2, stop, count) {
  const step = (stop - start2) / Math.max(0, count), power = Math.floor(Math.log10(step)), error = step / Math.pow(10, power), factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
  let i1, i2, inc;
  if (power < 0) {
    inc = Math.pow(10, -power) / factor;
    i1 = Math.round(start2 * inc);
    i2 = Math.round(stop * inc);
    if (i1 / inc < start2) ++i1;
    if (i2 / inc > stop) --i2;
    inc = -inc;
  } else {
    inc = Math.pow(10, power) * factor;
    i1 = Math.round(start2 / inc);
    i2 = Math.round(stop / inc);
    if (i1 * inc < start2) ++i1;
    if (i2 * inc > stop) --i2;
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start2, stop, count * 2);
  return [i1, i2, inc];
}
function ticks(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  if (!(count > 0)) return [];
  if (start2 === stop) return [start2];
  const reverse = stop < start2, [i1, i2, inc] = reverse ? tickSpec(stop, start2, count) : tickSpec(start2, stop, count);
  if (!(i2 >= i1)) return [];
  const n = i2 - i1 + 1, ticks2 = new Array(n);
  if (reverse) {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) / -inc;
    else for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) * inc;
  } else {
    if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) / -inc;
    else for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) * inc;
  }
  return ticks2;
}
function tickIncrement(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  return tickSpec(start2, stop, count)[2];
}
function tickStep(start2, stop, count) {
  stop = +stop, start2 = +start2, count = +count;
  const reverse = stop < start2, inc = reverse ? tickIncrement(stop, start2, count) : tickIncrement(start2, stop, count);
  return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
}

// node_modules/d3-array/src/quantile.js
function quantileSorted(values, p, valueof = number) {
  if (!(n = values.length) || isNaN(p = +p)) return;
  if (p <= 0 || n < 2) return +valueof(values[0], 0, values);
  if (p >= 1) return +valueof(values[n - 1], n - 1, values);
  var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = +valueof(values[i0], i0, values), value1 = +valueof(values[i0 + 1], i0 + 1, values);
  return value0 + (value1 - value0) * (i - i0);
}

// node_modules/d3-array/src/range.js
function range(start2, stop, step) {
  start2 = +start2, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start2, start2 = 0, 1) : n < 3 ? 1 : +step;
  var i = -1, n = Math.max(0, Math.ceil((stop - start2) / step)) | 0, range2 = new Array(n);
  while (++i < n) {
    range2[i] = start2 + i * step;
  }
  return range2;
}

// node_modules/d3-axis/src/identity.js
function identity_default(x2) {
  return x2;
}

// node_modules/d3-axis/src/axis.js
var top = 1;
var right = 2;
var bottom = 3;
var left = 4;
var epsilon = 1e-6;
function translateX(x2) {
  return "translate(" + x2 + ",0)";
}
function translateY(y2) {
  return "translate(0," + y2 + ")";
}
function number2(scale) {
  return (d) => +scale(d);
}
function center(scale, offset) {
  offset = Math.max(0, scale.bandwidth() - offset * 2) / 2;
  if (scale.round()) offset = Math.round(offset);
  return (d) => +scale(d) + offset;
}
function entering() {
  return !this.__axis;
}
function axis(orient, scale) {
  var tickArguments = [], tickValues = null, tickFormat2 = null, tickSizeInner = 6, tickSizeOuter = 6, tickPadding = 3, offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : 0.5, k = orient === top || orient === left ? -1 : 1, x2 = orient === left || orient === right ? "x" : "y", transform2 = orient === top || orient === bottom ? translateX : translateY;
  function axis2(context) {
    var values = tickValues == null ? scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain() : tickValues, format2 = tickFormat2 == null ? scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity_default : tickFormat2, spacing = Math.max(tickSizeInner, 0) + tickPadding, range2 = scale.range(), range0 = +range2[0] + offset, range1 = +range2[range2.length - 1] + offset, position = (scale.bandwidth ? center : number2)(scale.copy(), offset), selection2 = context.selection ? context.selection() : context, path2 = selection2.selectAll(".domain").data([null]), tick = selection2.selectAll(".tick").data(values, scale).order(), tickExit = tick.exit(), tickEnter = tick.enter().append("g").attr("class", "tick"), line = tick.select("line"), text = tick.select("text");
    path2 = path2.merge(path2.enter().insert("path", ".tick").attr("class", "domain").attr("stroke", "currentColor"));
    tick = tick.merge(tickEnter);
    line = line.merge(tickEnter.append("line").attr("stroke", "currentColor").attr(x2 + "2", k * tickSizeInner));
    text = text.merge(tickEnter.append("text").attr("fill", "currentColor").attr(x2, k * spacing).attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));
    if (context !== selection2) {
      path2 = path2.transition(context);
      tick = tick.transition(context);
      line = line.transition(context);
      text = text.transition(context);
      tickExit = tickExit.transition(context).attr("opacity", epsilon).attr("transform", function(d) {
        return isFinite(d = position(d)) ? transform2(d + offset) : this.getAttribute("transform");
      });
      tickEnter.attr("opacity", epsilon).attr("transform", function(d) {
        var p = this.parentNode.__axis;
        return transform2((p && isFinite(p = p(d)) ? p : position(d)) + offset);
      });
    }
    tickExit.remove();
    path2.attr("d", orient === left || orient === right ? tickSizeOuter ? "M" + k * tickSizeOuter + "," + range0 + "H" + offset + "V" + range1 + "H" + k * tickSizeOuter : "M" + offset + "," + range0 + "V" + range1 : tickSizeOuter ? "M" + range0 + "," + k * tickSizeOuter + "V" + offset + "H" + range1 + "V" + k * tickSizeOuter : "M" + range0 + "," + offset + "H" + range1);
    tick.attr("opacity", 1).attr("transform", function(d) {
      return transform2(position(d) + offset);
    });
    line.attr(x2 + "2", k * tickSizeInner);
    text.attr(x2, k * spacing).text(format2);
    selection2.filter(entering).attr("fill", "none").attr("font-size", 10).attr("font-family", "sans-serif").attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");
    selection2.each(function() {
      this.__axis = position;
    });
  }
  axis2.scale = function(_) {
    return arguments.length ? (scale = _, axis2) : scale;
  };
  axis2.ticks = function() {
    return tickArguments = Array.from(arguments), axis2;
  };
  axis2.tickArguments = function(_) {
    return arguments.length ? (tickArguments = _ == null ? [] : Array.from(_), axis2) : tickArguments.slice();
  };
  axis2.tickValues = function(_) {
    return arguments.length ? (tickValues = _ == null ? null : Array.from(_), axis2) : tickValues && tickValues.slice();
  };
  axis2.tickFormat = function(_) {
    return arguments.length ? (tickFormat2 = _, axis2) : tickFormat2;
  };
  axis2.tickSize = function(_) {
    return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis2) : tickSizeInner;
  };
  axis2.tickSizeInner = function(_) {
    return arguments.length ? (tickSizeInner = +_, axis2) : tickSizeInner;
  };
  axis2.tickSizeOuter = function(_) {
    return arguments.length ? (tickSizeOuter = +_, axis2) : tickSizeOuter;
  };
  axis2.tickPadding = function(_) {
    return arguments.length ? (tickPadding = +_, axis2) : tickPadding;
  };
  axis2.offset = function(_) {
    return arguments.length ? (offset = +_, axis2) : offset;
  };
  return axis2;
}
function axisBottom(scale) {
  return axis(bottom, scale);
}
function axisLeft(scale) {
  return axis(left, scale);
}

// node_modules/d3-dispatch/src/dispatch.js
var noop = { value: () => {
} };
function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}
function Dispatch(_) {
  this._ = _;
}
function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return { type: t, name };
  });
}
Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }
    return this;
  },
  copy: function() {
    var copy2 = {}, _ = this._;
    for (var t in _) copy2[t] = _[t].slice();
    return new Dispatch(copy2);
  },
  call: function(type2, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type2, that, args) {
    if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
    for (var t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};
function get(type2, name) {
  for (var i = 0, n = type2.length, c; i < n; ++i) {
    if ((c = type2[i]).name === name) {
      return c.value;
    }
  }
}
function set(type2, name, callback) {
  for (var i = 0, n = type2.length; i < n; ++i) {
    if (type2[i].name === name) {
      type2[i] = noop, type2 = type2.slice(0, i).concat(type2.slice(i + 1));
      break;
    }
  }
  if (callback != null) type2.push({ name, value: callback });
  return type2;
}
var dispatch_default = dispatch;

// node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
  svg: "http://www.w3.org/2000/svg",
  xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

// node_modules/d3-selection/src/namespace.js
function namespace_default(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name } : name;
}

// node_modules/d3-selection/src/creator.js
function creatorInherit(name) {
  return function() {
    var document2 = this.ownerDocument, uri = this.namespaceURI;
    return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
  };
}
function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}
function creator_default(name) {
  var fullname = namespace_default(name);
  return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

// node_modules/d3-selection/src/selector.js
function none() {
}
function selector_default(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

// node_modules/d3-selection/src/selection/select.js
function select_default(select) {
  if (typeof select !== "function") select = selector_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group2[i]) && (subnode = select.call(node, node.__data__, i, group2))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/array.js
function array(x2) {
  return x2 == null ? [] : Array.isArray(x2) ? x2 : Array.from(x2);
}

// node_modules/d3-selection/src/selectorAll.js
function empty() {
  return [];
}
function selectorAll_default(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

// node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
  return function() {
    return array(select.apply(this, arguments));
  };
}
function selectAll_default(select) {
  if (typeof select === "function") select = arrayAll(select);
  else select = selectorAll_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, node, i = 0; i < n; ++i) {
      if (node = group2[i]) {
        subgroups.push(select.call(node, node.__data__, i, group2));
        parents.push(node);
      }
    }
  }
  return new Selection(subgroups, parents);
}

// node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
  return function() {
    return this.matches(selector);
  };
}
function childMatcher(selector) {
  return function(node) {
    return node.matches(selector);
  };
}

// node_modules/d3-selection/src/selection/selectChild.js
var find = Array.prototype.find;
function childFind(match) {
  return function() {
    return find.call(this.children, match);
  };
}
function childFirst() {
  return this.firstElementChild;
}
function selectChild_default(match) {
  return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/selectChildren.js
var filter = Array.prototype.filter;
function children() {
  return Array.from(this.children);
}
function childrenFilter(match) {
  return function() {
    return filter.call(this.children, match);
  };
}
function selectChildren_default(match) {
  return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

// node_modules/d3-selection/src/selection/filter.js
function filter_default(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group2[i]) && match.call(node, node.__data__, i, group2)) {
        subgroup.push(node);
      }
    }
  }
  return new Selection(subgroups, this._parents);
}

// node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
  return new Array(update.length);
}

// node_modules/d3-selection/src/selection/enter.js
function enter_default() {
  return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum2) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum2;
}
EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) {
    return this._parent.insertBefore(child, this._next);
  },
  insertBefore: function(child, next) {
    return this._parent.insertBefore(child, next);
  },
  querySelector: function(selector) {
    return this._parent.querySelector(selector);
  },
  querySelectorAll: function(selector) {
    return this._parent.querySelectorAll(selector);
  }
};

// node_modules/d3-selection/src/constant.js
function constant_default(x2) {
  return function() {
    return x2;
  };
}

// node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group2, enter, update, exit, data) {
  var i = 0, node, groupLength = group2.length, dataLength = data.length;
  for (; i < dataLength; ++i) {
    if (node = group2[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (; i < groupLength; ++i) {
    if (node = group2[i]) {
      exit[i] = node;
    }
  }
}
function bindKey(parent, group2, enter, update, exit, data, key) {
  var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group2.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
  for (i = 0; i < groupLength; ++i) {
    if (node = group2[i]) {
      keyValues[i] = keyValue = key.call(node, node.__data__, i, group2) + "";
      if (nodeByKeyValue.has(keyValue)) {
        exit[i] = node;
      } else {
        nodeByKeyValue.set(keyValue, node);
      }
    }
  }
  for (i = 0; i < dataLength; ++i) {
    keyValue = key.call(parent, data[i], i, data) + "";
    if (node = nodeByKeyValue.get(keyValue)) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue.delete(keyValue);
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }
  for (i = 0; i < groupLength; ++i) {
    if ((node = group2[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
      exit[i] = node;
    }
  }
}
function datum(node) {
  return node.__data__;
}
function data_default(value, key) {
  if (!arguments.length) return Array.from(this, datum);
  var bind = key ? bindKey : bindIndex, parents = this._parents, groups2 = this._groups;
  if (typeof value !== "function") value = constant_default(value);
  for (var m = groups2.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j], group2 = groups2[j], groupLength = group2.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
    bind(parent, group2, enterGroup, updateGroup, exitGroup, data, key);
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
        previous._next = next || null;
      }
    }
  }
  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}
function arraylike(data) {
  return typeof data === "object" && "length" in data ? data : Array.from(data);
}

// node_modules/d3-selection/src/selection/exit.js
function exit_default() {
  return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
}

// node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  if (typeof onenter === "function") {
    enter = onenter(enter);
    if (enter) enter = enter.selection();
  } else {
    enter = enter.append(onenter + "");
  }
  if (onupdate != null) {
    update = onupdate(update);
    if (update) update = update.selection();
  }
  if (onexit == null) exit.remove();
  else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

// node_modules/d3-selection/src/selection/merge.js
function merge_default(context) {
  var selection2 = context.selection ? context.selection() : context;
  for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Selection(merges, this._parents);
}

// node_modules/d3-selection/src/selection/order.js
function order_default() {
  for (var groups2 = this._groups, j = -1, m = groups2.length; ++j < m; ) {
    for (var group2 = groups2[j], i = group2.length - 1, next = group2[i], node; --i >= 0; ) {
      if (node = group2[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/sort.js
function sort_default(compare) {
  if (!compare) compare = ascending2;
  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }
  for (var groups2 = this._groups, m = groups2.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group2[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }
  return new Selection(sortgroups, this._parents).order();
}
function ascending2(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

// node_modules/d3-selection/src/selection/call.js
function call_default() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

// node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
  return Array.from(this);
}

// node_modules/d3-selection/src/selection/node.js
function node_default() {
  for (var groups2 = this._groups, j = 0, m = groups2.length; j < m; ++j) {
    for (var group2 = groups2[j], i = 0, n = group2.length; i < n; ++i) {
      var node = group2[i];
      if (node) return node;
    }
  }
  return null;
}

// node_modules/d3-selection/src/selection/size.js
function size_default() {
  let size = 0;
  for (const node of this) ++size;
  return size;
}

// node_modules/d3-selection/src/selection/empty.js
function empty_default() {
  return !this.node();
}

// node_modules/d3-selection/src/selection/each.js
function each_default(callback) {
  for (var groups2 = this._groups, j = 0, m = groups2.length; j < m; ++j) {
    for (var group2 = groups2[j], i = 0, n = group2.length, node; i < n; ++i) {
      if (node = group2[i]) callback.call(node, node.__data__, i, group2);
    }
  }
  return this;
}

// node_modules/d3-selection/src/selection/attr.js
function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}
function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}
function attrFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}
function attrFunctionNS(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}
function attr_default(name, value) {
  var fullname = namespace_default(name);
  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
  }
  return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
}

// node_modules/d3-selection/src/window.js
function window_default(node) {
  return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

// node_modules/d3-selection/src/selection/style.js
function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}
function styleFunction(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}
function style_default(name, value, priority) {
  return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
  return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
}

// node_modules/d3-selection/src/selection/property.js
function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}
function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}
function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}
function property_default(name, value) {
  return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}

// node_modules/d3-selection/src/selection/classed.js
function classArray(string) {
  return string.trim().split(/^|\s+/);
}
function classList(node) {
  return node.classList || new ClassList(node);
}
function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};
function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}
function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}
function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}
function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}
function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}
function classed_default(name, value) {
  var names = classArray(name + "");
  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }
  return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}

// node_modules/d3-selection/src/selection/text.js
function textRemove() {
  this.textContent = "";
}
function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}
function text_default(value) {
  return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
}

// node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
  this.innerHTML = "";
}
function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}
function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}
function html_default(value) {
  return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

// node_modules/d3-selection/src/selection/raise.js
function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
  return this.each(raise);
}

// node_modules/d3-selection/src/selection/lower.js
function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
  return this.each(lower);
}

// node_modules/d3-selection/src/selection/append.js
function append_default(name) {
  var create2 = typeof name === "function" ? name : creator_default(name);
  return this.select(function() {
    return this.appendChild(create2.apply(this, arguments));
  });
}

// node_modules/d3-selection/src/selection/insert.js
function constantNull() {
  return null;
}
function insert_default(name, before) {
  var create2 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
  return this.select(function() {
    return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

// node_modules/d3-selection/src/selection/remove.js
function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}
function remove_default() {
  return this.each(remove);
}

// node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
  var clone = this.cloneNode(false), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
  var clone = this.cloneNode(true), parent = this.parentNode;
  return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

// node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
  return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

// node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
  return function(event) {
    listener.call(this, event, this.__data__);
  };
}
function parseTypenames2(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return { type: t, name };
  });
}
function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}
function onAdd(typename, value, options) {
  return function() {
    var on = this.__on, o, listener = contextListener(value);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.options);
        this.addEventListener(o.type, o.listener = listener, o.options = options);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, options);
    o = { type: typename.type, name: typename.name, value, listener, options };
    if (!on) this.__on = [o];
    else on.push(o);
  };
}
function on_default(typename, value, options) {
  var typenames = parseTypenames2(typename + ""), i, n = typenames.length, t;
  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }
  on = value ? onAdd : onRemove;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
  return this;
}

// node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type2, params) {
  var window2 = window_default(node), event = window2.CustomEvent;
  if (typeof event === "function") {
    event = new event(type2, params);
  } else {
    event = window2.document.createEvent("Event");
    if (params) event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type2, false, false);
  }
  node.dispatchEvent(event);
}
function dispatchConstant(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params);
  };
}
function dispatchFunction(type2, params) {
  return function() {
    return dispatchEvent(this, type2, params.apply(this, arguments));
  };
}
function dispatch_default2(type2, params) {
  return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
}

// node_modules/d3-selection/src/selection/iterator.js
function* iterator_default() {
  for (var groups2 = this._groups, j = 0, m = groups2.length; j < m; ++j) {
    for (var group2 = groups2[j], i = 0, n = group2.length, node; i < n; ++i) {
      if (node = group2[i]) yield node;
    }
  }
}

// node_modules/d3-selection/src/selection/index.js
var root = [null];
function Selection(groups2, parents) {
  this._groups = groups2;
  this._parents = parents;
}
function selection() {
  return new Selection([[document.documentElement]], root);
}
function selection_selection() {
  return this;
}
Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: select_default,
  selectAll: selectAll_default,
  selectChild: selectChild_default,
  selectChildren: selectChildren_default,
  filter: filter_default,
  data: data_default,
  enter: enter_default,
  exit: exit_default,
  join: join_default,
  merge: merge_default,
  selection: selection_selection,
  order: order_default,
  sort: sort_default,
  call: call_default,
  nodes: nodes_default,
  node: node_default,
  size: size_default,
  empty: empty_default,
  each: each_default,
  attr: attr_default,
  style: style_default,
  property: property_default,
  classed: classed_default,
  text: text_default,
  html: html_default,
  raise: raise_default,
  lower: lower_default,
  append: append_default,
  insert: insert_default,
  remove: remove_default,
  clone: clone_default,
  datum: datum_default,
  on: on_default,
  dispatch: dispatch_default2,
  [Symbol.iterator]: iterator_default
};
var selection_default = selection;

// node_modules/d3-selection/src/select.js
function select_default2(selector) {
  return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
}

// node_modules/d3-selection/src/sourceEvent.js
function sourceEvent_default(event) {
  let sourceEvent;
  while (sourceEvent = event.sourceEvent) event = sourceEvent;
  return event;
}

// node_modules/d3-selection/src/pointer.js
function pointer_default(event, node) {
  event = sourceEvent_default(event);
  if (node === void 0) node = event.currentTarget;
  if (node) {
    var svg = node.ownerSVGElement || node;
    if (svg.createSVGPoint) {
      var point2 = svg.createSVGPoint();
      point2.x = event.clientX, point2.y = event.clientY;
      point2 = point2.matrixTransform(node.getScreenCTM().inverse());
      return [point2.x, point2.y];
    }
    if (node.getBoundingClientRect) {
      var rect = node.getBoundingClientRect();
      return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
    }
  }
  return [event.pageX, event.pageY];
}

// node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}
function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

// node_modules/d3-color/src/color.js
function Color() {
}
var darker = 0.7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*";
var reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
var reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
var reHex = /^#([0-9a-f]{3,8})$/;
var reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
var reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
var reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
var reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
var reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
var reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
};
define_default(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor(), this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});
function color_formatHex() {
  return this.rgb().formatHex();
}
function color_formatHex8() {
  return this.rgb().formatHex8();
}
function color_formatHsl() {
  return hslConvert(this).formatHsl();
}
function color_formatRgb() {
  return this.rgb().formatRgb();
}
function color(format2) {
  var m, l;
  format2 = (format2 + "").trim().toLowerCase();
  return (m = reHex.exec(format2)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format2)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format2)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format2)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format2)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format2) ? rgbn(named[format2]) : format2 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
  return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}
function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb();
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex,
  // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));
function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}
function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}
function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl();
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255, g = o.g / 255, b = o.b / 255, min2 = Math.min(r, g, b), max2 = Math.max(r, g, b), h = NaN, s = max2 - min2, l = (max2 + min2) / 2;
  if (s) {
    if (r === max2) h = (g - b) / s + (g < b) * 6;
    else if (g === max2) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max2 + min2 : 2 - max2 - min2;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}
function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));
function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}
function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

// node_modules/d3-interpolate/src/basis.js
function basis(t12, v0, v1, v2, v3) {
  var t2 = t12 * t12, t3 = t2 * t12;
  return ((1 - 3 * t12 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t12 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
}
function basis_default(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default(values) {
  var n = values.length;
  return function(t) {
    var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

// node_modules/d3-interpolate/src/constant.js
var constant_default2 = (x2) => () => x2;

// node_modules/d3-interpolate/src/color.js
function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}
function exponential(a, b, y2) {
  return a = Math.pow(a, y2), b = Math.pow(b, y2) - a, y2 = 1 / y2, function(t) {
    return Math.pow(a + t * b, y2);
  };
}
function gamma(y2) {
  return (y2 = +y2) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y2) : constant_default2(isNaN(a) ? b : a);
  };
}
function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant_default2(isNaN(a) ? b : a);
}

// node_modules/d3-interpolate/src/rgb.js
var rgb_default = (function rgbGamma(y2) {
  var color2 = gamma(y2);
  function rgb2(start2, end) {
    var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
    return function(t) {
      start2.r = r(t);
      start2.g = g(t);
      start2.b = b(t);
      start2.opacity = opacity(t);
      return start2 + "";
    };
  }
  rgb2.gamma = rgbGamma;
  return rgb2;
})(1);
function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
    for (i = 0; i < n; ++i) {
      color2 = rgb(colors[i]);
      r[i] = color2.r || 0;
      g[i] = color2.g || 0;
      b[i] = color2.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color2.opacity = 1;
    return function(t) {
      color2.r = r(t);
      color2.g = g(t);
      color2.b = b(t);
      return color2 + "";
    };
  };
}
var rgbBasis = rgbSpline(basis_default);
var rgbBasisClosed = rgbSpline(basisClosed_default);

// node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}
function isNumberArray(x2) {
  return ArrayBuffer.isView(x2) && !(x2 instanceof DataView);
}

// node_modules/d3-interpolate/src/array.js
function genericArray(a, b) {
  var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x2 = new Array(na), c = new Array(nb), i;
  for (i = 0; i < na; ++i) x2[i] = value_default(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];
  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x2[i](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/date.js
function date_default(a, b) {
  var d = /* @__PURE__ */ new Date();
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

// node_modules/d3-interpolate/src/number.js
function number_default(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

// node_modules/d3-interpolate/src/object.js
function object_default(a, b) {
  var i = {}, c = {}, k;
  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};
  for (k in b) {
    if (k in a) {
      i[k] = value_default(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }
  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

// node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
var reB = new RegExp(reA.source, "g");
function zero2(b) {
  return function() {
    return b;
  };
}
function one(b) {
  return function(t) {
    return b(t) + "";
  };
}
function string_default(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q2 = [];
  a = a + "", b = b + "";
  while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) {
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) {
      if (s[i]) s[i] += bm;
      else s[++i] = bm;
    } else {
      s[++i] = null;
      q2.push({ i, x: number_default(am, bm) });
    }
    bi = reB.lastIndex;
  }
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs;
    else s[++i] = bs;
  }
  return s.length < 2 ? q2[0] ? one(q2[0].x) : zero2(b) : (b = q2.length, function(t) {
    for (var i2 = 0, o; i2 < b; ++i2) s[(o = q2[i2]).i] = o.x(t);
    return s.join("");
  });
}

// node_modules/d3-interpolate/src/value.js
function value_default(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant_default2(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
}

// node_modules/d3-interpolate/src/round.js
function round_default(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

// node_modules/d3-interpolate/src/transform/decompose.js
var degrees = 180 / Math.PI;
var identity2 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};
function decompose_default(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX,
    scaleY
  };
}

// node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
  const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
  return m.isIdentity ? identity2 : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
}
function parseSvg(value) {
  if (value == null) return identity2;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity2;
  value = value.matrix;
  return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

// node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse, pxComma, pxParen, degParen) {
  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }
  function translate(xa, ya, xb, yb, s, q2) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q2.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }
  function rotate(a, b, s, q2) {
    if (a !== b) {
      if (a - b > 180) b += 360;
      else if (b - a > 180) a += 360;
      q2.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number_default(a, b) });
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }
  function skewX(a, b, s, q2) {
    if (a !== b) {
      q2.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number_default(a, b) });
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }
  function scale(xa, ya, xb, yb, s, q2) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q2.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }
  return function(a, b) {
    var s = [], q2 = [];
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q2);
    rotate(a.rotate, b.rotate, s, q2);
    skewX(a.skewX, b.skewX, s, q2);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q2);
    a = b = null;
    return function(t) {
      var i = -1, n = q2.length, o;
      while (++i < n) s[(o = q2[i]).i] = o.x(t);
      return s.join("");
    };
  };
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

// node_modules/d3-timer/src/timer.js
var frame = 0;
var timeout = 0;
var interval = 0;
var pokeDelay = 1e3;
var taskHead;
var taskTail;
var clockLast = 0;
var clockNow = 0;
var clockSkew = 0;
var clock = typeof performance === "object" && performance.now ? performance : Date;
var setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
  setTimeout(f, 17);
};
function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
  clockNow = 0;
}
function Timer() {
  this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time2) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time2 = (time2 == null ? now() : +time2) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time2;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};
function timer(callback, delay, time2) {
  var t = new Timer();
  t.restart(callback, delay, time2);
  return t;
}
function timerFlush() {
  now();
  ++frame;
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
    t = t._next;
  }
  --frame;
}
function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}
function poke() {
  var now2 = clock.now(), delay = now2 - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
}
function nap() {
  var t02, t12 = taskHead, t2, time2 = Infinity;
  while (t12) {
    if (t12._call) {
      if (time2 > t12._time) time2 = t12._time;
      t02 = t12, t12 = t12._next;
    } else {
      t2 = t12._next, t12._next = null;
      t12 = t02 ? t02._next = t2 : taskHead = t2;
    }
  }
  taskTail = t02;
  sleep(time2);
}
function sleep(time2) {
  if (frame) return;
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time2 - clockNow;
  if (delay > 24) {
    if (time2 < Infinity) timeout = setTimeout(wake, time2 - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

// node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time2) {
  var t = new Timer();
  delay = delay == null ? 0 : +delay;
  t.restart((elapsed) => {
    t.stop();
    callback(elapsed + delay);
  }, delay, time2);
  return t;
}

// node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name, id2, index2, group2, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id2 in schedules) return;
  create(node, id2, {
    name,
    index: index2,
    // For context during callback.
    group: group2,
    // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}
function init(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}
function set2(node, id2) {
  var schedule = get2(node, id2);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}
function get2(node, id2) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
  return schedule;
}
function create(node, id2, self) {
  var schedules = node.__transition, tween;
  schedules[id2] = self;
  self.timer = timer(schedule, 0, self.time);
  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start2, self.delay, self.time);
    if (self.delay <= elapsed) start2(elapsed - self.delay);
  }
  function start2(elapsed) {
    var i, j, n, o;
    if (self.state !== SCHEDULED) return stop();
    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;
      if (o.state === STARTED) return timeout_default(start2);
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      } else if (+i < id2) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }
    timeout_default(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return;
    self.state = STARTED;
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }
  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
    while (++i < n) {
      tween[i].call(node, t);
    }
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }
  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id2];
    for (var i in schedules) return;
    delete node.__transition;
  }
}

// node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name) {
  var schedules = node.__transition, schedule, active, empty2 = true, i;
  if (!schedules) return;
  name = name == null ? null : name + "";
  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) {
      empty2 = false;
      continue;
    }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }
  if (empty2) delete node.__transition;
}

// node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default2(name) {
  return this.each(function() {
    interrupt_default(this, name);
  });
}

// node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id2, name) {
  var tween0, tween1;
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }
    schedule.tween = tween1;
  };
}
function tweenFunction(id2, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error();
  return function() {
    var schedule = set2(this, id2), tween = schedule.tween;
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = { name, value }, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }
    schedule.tween = tween1;
  };
}
function tween_default(name, value) {
  var id2 = this._id;
  name += "";
  if (arguments.length < 2) {
    var tween = get2(this.node(), id2).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }
  return this.each((value == null ? tweenRemove : tweenFunction)(id2, name, value));
}
function tweenValue(transition2, name, value) {
  var id2 = transition2._id;
  transition2.each(function() {
    var schedule = set2(this, id2);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });
  return function(node) {
    return get2(node, id2).value[name];
  };
}

// node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default(a, b) {
  var c;
  return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
}

// node_modules/d3-transition/src/transition/attr.js
function attrRemove2(name) {
  return function() {
    this.removeAttribute(name);
  };
}
function attrRemoveNS2(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}
function attrConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrConstantNS2(fullname, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function attrFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attrFunctionNS2(fullname, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function attr_default2(name, value) {
  var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
  return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value));
}

// node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i.call(this, t));
  };
}
function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
  };
}
function attrTweenNS(fullname, value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function attrTween(name, value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && attrInterpolate(name, i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function attrTween_default(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  var fullname = namespace_default(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

// node_modules/d3-transition/src/transition/delay.js
function delayFunction(id2, value) {
  return function() {
    init(this, id2).delay = +value.apply(this, arguments);
  };
}
function delayConstant(id2, value) {
  return value = +value, function() {
    init(this, id2).delay = value;
  };
}
function delay_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
}

// node_modules/d3-transition/src/transition/duration.js
function durationFunction(id2, value) {
  return function() {
    set2(this, id2).duration = +value.apply(this, arguments);
  };
}
function durationConstant(id2, value) {
  return value = +value, function() {
    set2(this, id2).duration = value;
  };
}
function duration_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
}

// node_modules/d3-transition/src/transition/ease.js
function easeConstant(id2, value) {
  if (typeof value !== "function") throw new Error();
  return function() {
    set2(this, id2).ease = value;
  };
}
function ease_default(value) {
  var id2 = this._id;
  return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
}

// node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id2, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (typeof v !== "function") throw new Error();
    set2(this, id2).ease = v;
  };
}
function easeVarying_default(value) {
  if (typeof value !== "function") throw new Error();
  return this.each(easeVarying(this._id, value));
}

// node_modules/d3-transition/src/transition/filter.js
function filter_default2(match) {
  if (typeof match !== "function") match = matcher_default(match);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group2[i]) && match.call(node, node.__data__, i, group2)) {
        subgroup.push(node);
      }
    }
  }
  return new Transition(subgroups, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/merge.js
function merge_default2(transition2) {
  if (transition2._id !== this._id) throw new Error();
  for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }
  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }
  return new Transition(merges, this._parents, this._name, this._id);
}

// node_modules/d3-transition/src/transition/on.js
function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}
function onFunction(id2, name, listener) {
  var on0, on1, sit = start(name) ? init : set2;
  return function() {
    var schedule = sit(this, id2), on = schedule.on;
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
    schedule.on = on1;
  };
}
function on_default2(name, listener) {
  var id2 = this._id;
  return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
}

// node_modules/d3-transition/src/transition/remove.js
function removeFunction(id2) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id2) return;
    if (parent) parent.removeChild(this);
  };
}
function remove_default2() {
  return this.on("end.remove", removeFunction(this._id));
}

// node_modules/d3-transition/src/transition/select.js
function select_default3(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function") select = selector_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group2[i]) && (subnode = select.call(node, node.__data__, i, group2))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule_default(subgroup[i], name, id2, i, subgroup, get2(node, id2));
      }
    }
  }
  return new Transition(subgroups, this._parents, name, id2);
}

// node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default2(select) {
  var name = this._name, id2 = this._id;
  if (typeof select !== "function") select = selectorAll_default(select);
  for (var groups2 = this._groups, m = groups2.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, node, i = 0; i < n; ++i) {
      if (node = group2[i]) {
        for (var children2 = select.call(node, node.__data__, i, group2), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
          if (child = children2[k]) {
            schedule_default(child, name, id2, k, children2, inherit2);
          }
        }
        subgroups.push(children2);
        parents.push(node);
      }
    }
  }
  return new Transition(subgroups, parents, name, id2);
}

// node_modules/d3-transition/src/transition/selection.js
var Selection2 = selection_default.prototype.constructor;
function selection_default2() {
  return new Selection2(this._groups, this._parents);
}

// node_modules/d3-transition/src/transition/style.js
function styleNull(name, interpolate) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}
function styleRemove2(name) {
  return function() {
    this.style.removeProperty(name);
  };
}
function styleConstant2(name, interpolate, value1) {
  var string00, string1 = value1 + "", interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
  };
}
function styleFunction2(name, interpolate, value) {
  var string00, string10, interpolate0;
  return function() {
    var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}
function styleMaybeRemove(id2, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
  return function() {
    var schedule = set2(this, id2), on = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
    schedule.on = on1;
  };
}
function style_default2(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
  return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove2(name)) : typeof value === "function" ? this.styleTween(name, styleFunction2(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i, value), priority).on("end.style." + name, null);
}

// node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i.call(this, t), priority);
  };
}
function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}
function styleTween_default(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

// node_modules/d3-transition/src/transition/text.js
function textConstant2(value) {
  return function() {
    this.textContent = value;
  };
}
function textFunction2(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}
function text_default2(value) {
  return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
}

// node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i) {
  return function(t) {
    this.textContent = i.call(this, t);
  };
}
function textTween(value) {
  var t02, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t02 = (i0 = i) && textInterpolate(i);
    return t02;
  }
  tween._value = value;
  return tween;
}
function textTween_default(value) {
  var key = "text";
  if (arguments.length < 1) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error();
  return this.tween(key, textTween(value));
}

// node_modules/d3-transition/src/transition/transition.js
function transition_default() {
  var name = this._name, id0 = this._id, id1 = newId();
  for (var groups2 = this._groups, m = groups2.length, j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, node, i = 0; i < n; ++i) {
      if (node = group2[i]) {
        var inherit2 = get2(node, id0);
        schedule_default(node, name, id1, i, group2, {
          time: inherit2.time + inherit2.delay + inherit2.duration,
          delay: 0,
          duration: inherit2.duration,
          ease: inherit2.ease
        });
      }
    }
  }
  return new Transition(groups2, this._parents, name, id1);
}

// node_modules/d3-transition/src/transition/end.js
function end_default() {
  var on0, on1, that = this, id2 = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = { value: reject }, end = { value: function() {
      if (--size === 0) resolve();
    } };
    that.each(function() {
      var schedule = set2(this, id2), on = schedule.on;
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }
      schedule.on = on1;
    });
    if (size === 0) resolve();
  });
}

// node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups2, parents, name, id2) {
  this._groups = groups2;
  this._parents = parents;
  this._name = name;
  this._id = id2;
}
function transition(name) {
  return selection_default().transition(name);
}
function newId() {
  return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: select_default3,
  selectAll: selectAll_default2,
  selectChild: selection_prototype.selectChild,
  selectChildren: selection_prototype.selectChildren,
  filter: filter_default2,
  merge: merge_default2,
  selection: selection_default2,
  transition: transition_default,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: on_default2,
  attr: attr_default2,
  attrTween: attrTween_default,
  style: style_default2,
  styleTween: styleTween_default,
  text: text_default2,
  textTween: textTween_default,
  remove: remove_default2,
  tween: tween_default,
  delay: delay_default,
  duration: duration_default,
  ease: ease_default,
  easeVarying: easeVarying_default,
  end: end_default,
  [Symbol.iterator]: selection_prototype[Symbol.iterator]
};

// node_modules/d3-ease/src/cubic.js
function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

// node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
  time: null,
  // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};
function inherit(node, id2) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id2])) {
    if (!(node = node.parentNode)) {
      throw new Error(`transition ${id2} not found`);
    }
  }
  return timing;
}
function transition_default2(name) {
  var id2, timing;
  if (name instanceof Transition) {
    id2 = name._id, name = name._name;
  } else {
    id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }
  for (var groups2 = this._groups, m = groups2.length, j = 0; j < m; ++j) {
    for (var group2 = groups2[j], n = group2.length, node, i = 0; i < n; ++i) {
      if (node = group2[i]) {
        schedule_default(node, name, id2, i, group2, timing || inherit(node, id2));
      }
    }
  }
  return new Transition(groups2, this._parents, name, id2);
}

// node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default2;
selection_default.prototype.transition = transition_default2;

// node_modules/d3-brush/src/brush.js
var { abs, max, min } = Math;
function number1(e) {
  return [+e[0], +e[1]];
}
function number22(e) {
  return [number1(e[0]), number1(e[1])];
}
var X = {
  name: "x",
  handles: ["w", "e"].map(type),
  input: function(x2, e) {
    return x2 == null ? null : [[+x2[0], e[0][1]], [+x2[1], e[1][1]]];
  },
  output: function(xy) {
    return xy && [xy[0][0], xy[1][0]];
  }
};
var Y = {
  name: "y",
  handles: ["n", "s"].map(type),
  input: function(y2, e) {
    return y2 == null ? null : [[e[0][0], +y2[0]], [e[1][0], +y2[1]]];
  },
  output: function(xy) {
    return xy && [xy[0][1], xy[1][1]];
  }
};
var XY = {
  name: "xy",
  handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
  input: function(xy) {
    return xy == null ? null : number22(xy);
  },
  output: function(xy) {
    return xy;
  }
};
function type(t) {
  return { type: t };
}

// node_modules/d3-path/src/path.js
var pi = Math.PI;
var tau = 2 * pi;
var epsilon2 = 1e-6;
var tauEpsilon = tau - epsilon2;
function append(strings) {
  this._ += strings[0];
  for (let i = 1, n = strings.length; i < n; ++i) {
    this._ += arguments[i] + strings[i];
  }
}
function appendRound(digits) {
  let d = Math.floor(digits);
  if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
  if (d > 15) return append;
  const k = 10 ** d;
  return function(strings) {
    this._ += strings[0];
    for (let i = 1, n = strings.length; i < n; ++i) {
      this._ += Math.round(arguments[i] * k) / k + strings[i];
    }
  };
}
var Path = class {
  constructor(digits) {
    this._x0 = this._y0 = // start of current subpath
    this._x1 = this._y1 = null;
    this._ = "";
    this._append = digits == null ? append : appendRound(digits);
  }
  moveTo(x2, y2) {
    this._append`M${this._x0 = this._x1 = +x2},${this._y0 = this._y1 = +y2}`;
  }
  closePath() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._append`Z`;
    }
  }
  lineTo(x2, y2) {
    this._append`L${this._x1 = +x2},${this._y1 = +y2}`;
  }
  quadraticCurveTo(x1, y1, x2, y2) {
    this._append`Q${+x1},${+y1},${this._x1 = +x2},${this._y1 = +y2}`;
  }
  bezierCurveTo(x1, y1, x2, y2, x3, y3) {
    this._append`C${+x1},${+y1},${+x2},${+y2},${this._x1 = +x3},${this._y1 = +y3}`;
  }
  arcTo(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
    if (r < 0) throw new Error(`negative radius: ${r}`);
    let x0 = this._x1, y0 = this._y1, x21 = x2 - x1, y21 = y2 - y1, x01 = x0 - x1, y01 = y0 - y1, l01_2 = x01 * x01 + y01 * y01;
    if (this._x1 === null) {
      this._append`M${this._x1 = x1},${this._y1 = y1}`;
    } else if (!(l01_2 > epsilon2)) ;
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon2) || !r) {
      this._append`L${this._x1 = x1},${this._y1 = y1}`;
    } else {
      let x20 = x2 - x0, y20 = y2 - y0, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l = r * Math.tan((pi - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l / l01, t21 = l / l21;
      if (Math.abs(t01 - 1) > epsilon2) {
        this._append`L${x1 + t01 * x01},${y1 + t01 * y01}`;
      }
      this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1 + t21 * x21},${this._y1 = y1 + t21 * y21}`;
    }
  }
  arc(x2, y2, r, a0, a1, ccw) {
    x2 = +x2, y2 = +y2, r = +r, ccw = !!ccw;
    if (r < 0) throw new Error(`negative radius: ${r}`);
    let dx = r * Math.cos(a0), dy = r * Math.sin(a0), x0 = x2 + dx, y0 = y2 + dy, cw = 1 ^ ccw, da = ccw ? a0 - a1 : a1 - a0;
    if (this._x1 === null) {
      this._append`M${x0},${y0}`;
    } else if (Math.abs(this._x1 - x0) > epsilon2 || Math.abs(this._y1 - y0) > epsilon2) {
      this._append`L${x0},${y0}`;
    }
    if (!r) return;
    if (da < 0) da = da % tau + tau;
    if (da > tauEpsilon) {
      this._append`A${r},${r},0,1,${cw},${x2 - dx},${y2 - dy}A${r},${r},0,1,${cw},${this._x1 = x0},${this._y1 = y0}`;
    } else if (da > epsilon2) {
      this._append`A${r},${r},0,${+(da >= pi)},${cw},${this._x1 = x2 + r * Math.cos(a1)},${this._y1 = y2 + r * Math.sin(a1)}`;
    }
  }
  rect(x2, y2, w, h) {
    this._append`M${this._x0 = this._x1 = +x2},${this._y0 = this._y1 = +y2}h${w = +w}v${+h}h${-w}Z`;
  }
  toString() {
    return this._;
  }
};
function path() {
  return new Path();
}
path.prototype = Path.prototype;

// node_modules/d3-format/src/formatDecimal.js
function formatDecimal_default(x2) {
  return Math.abs(x2 = Math.round(x2)) >= 1e21 ? x2.toLocaleString("en").replace(/,/g, "") : x2.toString(10);
}
function formatDecimalParts(x2, p) {
  if (!isFinite(x2) || x2 === 0) return null;
  var i = (x2 = p ? x2.toExponential(p - 1) : x2.toExponential()).indexOf("e"), coefficient = x2.slice(0, i);
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x2.slice(i + 1)
  ];
}

// node_modules/d3-format/src/exponent.js
function exponent_default(x2) {
  return x2 = formatDecimalParts(Math.abs(x2)), x2 ? x2[1] : NaN;
}

// node_modules/d3-format/src/formatGroup.js
function formatGroup_default(grouping, thousands) {
  return function(value, width) {
    var i = value.length, t = [], j = 0, g = grouping[0], length = 0;
    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }
    return t.reverse().join(thousands);
  };
}

// node_modules/d3-format/src/formatNumerals.js
function formatNumerals_default(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// node_modules/d3-format/src/formatSpecifier.js
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}
formatSpecifier.prototype = FormatSpecifier.prototype;
function FormatSpecifier(specifier) {
  this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
  this.align = specifier.align === void 0 ? ">" : specifier.align + "";
  this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === void 0 ? void 0 : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === void 0 ? "" : specifier.type + "";
}
FormatSpecifier.prototype.toString = function() {
  return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

// node_modules/d3-format/src/formatTrim.js
function formatTrim_default(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".":
        i0 = i1 = i;
        break;
      case "0":
        if (i0 === 0) i0 = i;
        i1 = i;
        break;
      default:
        if (!+s[i]) break out;
        if (i0 > 0) i0 = 0;
        break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

// node_modules/d3-format/src/formatPrefixAuto.js
var prefixExponent;
function formatPrefixAuto_default(x2, p) {
  var d = formatDecimalParts(x2, p);
  if (!d) return prefixExponent = void 0, x2.toPrecision(p);
  var coefficient = d[0], exponent = d[1], i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1, n = coefficient.length;
  return i === n ? coefficient : i > n ? coefficient + new Array(i - n + 1).join("0") : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i) : "0." + new Array(1 - i).join("0") + formatDecimalParts(x2, Math.max(0, p + i - 1))[0];
}

// node_modules/d3-format/src/formatRounded.js
function formatRounded_default(x2, p) {
  var d = formatDecimalParts(x2, p);
  if (!d) return x2 + "";
  var coefficient = d[0], exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

// node_modules/d3-format/src/formatTypes.js
var formatTypes_default = {
  "%": (x2, p) => (x2 * 100).toFixed(p),
  "b": (x2) => Math.round(x2).toString(2),
  "c": (x2) => x2 + "",
  "d": formatDecimal_default,
  "e": (x2, p) => x2.toExponential(p),
  "f": (x2, p) => x2.toFixed(p),
  "g": (x2, p) => x2.toPrecision(p),
  "o": (x2) => Math.round(x2).toString(8),
  "p": (x2, p) => formatRounded_default(x2 * 100, p),
  "r": formatRounded_default,
  "s": formatPrefixAuto_default,
  "X": (x2) => Math.round(x2).toString(16).toUpperCase(),
  "x": (x2) => Math.round(x2).toString(16)
};

// node_modules/d3-format/src/identity.js
function identity_default2(x2) {
  return x2;
}

// node_modules/d3-format/src/locale.js
var map = Array.prototype.map;
var prefixes = ["y", "z", "a", "f", "p", "n", "\xB5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
function locale_default(locale3) {
  var group2 = locale3.grouping === void 0 || locale3.thousands === void 0 ? identity_default2 : formatGroup_default(map.call(locale3.grouping, Number), locale3.thousands + ""), currencyPrefix = locale3.currency === void 0 ? "" : locale3.currency[0] + "", currencySuffix = locale3.currency === void 0 ? "" : locale3.currency[1] + "", decimal = locale3.decimal === void 0 ? "." : locale3.decimal + "", numerals = locale3.numerals === void 0 ? identity_default2 : formatNumerals_default(map.call(locale3.numerals, String)), percent = locale3.percent === void 0 ? "%" : locale3.percent + "", minus = locale3.minus === void 0 ? "\u2212" : locale3.minus + "", nan = locale3.nan === void 0 ? "NaN" : locale3.nan + "";
  function newFormat(specifier, options) {
    specifier = formatSpecifier(specifier);
    var fill = specifier.fill, align = specifier.align, sign = specifier.sign, symbol = specifier.symbol, zero3 = specifier.zero, width = specifier.width, comma = specifier.comma, precision2 = specifier.precision, trim = specifier.trim, type2 = specifier.type;
    if (type2 === "n") comma = true, type2 = "g";
    else if (!formatTypes_default[type2]) precision2 === void 0 && (precision2 = 12), trim = true, type2 = "g";
    if (zero3 || fill === "0" && align === "=") zero3 = true, fill = "0", align = "=";
    var prefix = (options && options.prefix !== void 0 ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type2) ? "0" + type2.toLowerCase() : ""), suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type2) ? percent : "") + (options && options.suffix !== void 0 ? options.suffix : "");
    var formatType = formatTypes_default[type2], maybeSuffix = /[defgprs%]/.test(type2);
    precision2 = precision2 === void 0 ? 6 : /[gprs]/.test(type2) ? Math.max(1, Math.min(21, precision2)) : Math.max(0, Math.min(20, precision2));
    function format2(value) {
      var valuePrefix = prefix, valueSuffix = suffix, i, n, c;
      if (type2 === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;
        var valueNegative = value < 0 || 1 / value < 0;
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision2);
        if (trim) value = formatTrim_default(value);
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;
        valuePrefix = (valueNegative ? sign === "(" ? sign : minus : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type2 === "s" && !isNaN(value) && prefixExponent !== void 0 ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }
      if (comma && !zero3) value = group2(value, Infinity);
      var length = valuePrefix.length + value.length + valueSuffix.length, padding = length < width ? new Array(width - length + 1).join(fill) : "";
      if (comma && zero3) value = group2(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
      switch (align) {
        case "<":
          value = valuePrefix + value + valueSuffix + padding;
          break;
        case "=":
          value = valuePrefix + padding + value + valueSuffix;
          break;
        case "^":
          value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
          break;
        default:
          value = padding + valuePrefix + value + valueSuffix;
          break;
      }
      return numerals(value);
    }
    format2.toString = function() {
      return specifier + "";
    };
    return format2;
  }
  function formatPrefix2(specifier, value) {
    var e = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k = Math.pow(10, -e), f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), { suffix: prefixes[8 + e / 3] });
    return function(value2) {
      return f(k * value2);
    };
  }
  return {
    format: newFormat,
    formatPrefix: formatPrefix2
  };
}

// node_modules/d3-format/src/defaultLocale.js
var locale;
var format;
var formatPrefix;
defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});
function defaultLocale(definition) {
  locale = locale_default(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

// node_modules/d3-format/src/precisionFixed.js
function precisionFixed_default(step) {
  return Math.max(0, -exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionPrefix.js
function precisionPrefix_default(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
}

// node_modules/d3-format/src/precisionRound.js
function precisionRound_default(step, max2) {
  step = Math.abs(step), max2 = Math.abs(max2) - step;
  return Math.max(0, exponent_default(max2) - exponent_default(step)) + 1;
}

// node_modules/d3-scale/src/init.js
function initRange(domain, range2) {
  switch (arguments.length) {
    case 0:
      break;
    case 1:
      this.range(domain);
      break;
    default:
      this.range(range2).domain(domain);
      break;
  }
  return this;
}

// node_modules/d3-scale/src/ordinal.js
var implicit = /* @__PURE__ */ Symbol("implicit");
function ordinal() {
  var index2 = new InternMap(), domain = [], range2 = [], unknown = implicit;
  function scale(d) {
    let i = index2.get(d);
    if (i === void 0) {
      if (unknown !== implicit) return unknown;
      index2.set(d, i = domain.push(d) - 1);
    }
    return range2[i % range2.length];
  }
  scale.domain = function(_) {
    if (!arguments.length) return domain.slice();
    domain = [], index2 = new InternMap();
    for (const value of _) {
      if (index2.has(value)) continue;
      index2.set(value, domain.push(value) - 1);
    }
    return scale;
  };
  scale.range = function(_) {
    return arguments.length ? (range2 = Array.from(_), scale) : range2.slice();
  };
  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };
  scale.copy = function() {
    return ordinal(domain, range2).unknown(unknown);
  };
  initRange.apply(scale, arguments);
  return scale;
}

// node_modules/d3-scale/src/band.js
function band() {
  var scale = ordinal().unknown(void 0), domain = scale.domain, ordinalRange = scale.range, r0 = 0, r1 = 1, step, bandwidth, round = false, paddingInner = 0, paddingOuter = 0, align = 0.5;
  delete scale.unknown;
  function rescale() {
    var n = domain().length, reverse = r1 < r0, start2 = reverse ? r1 : r0, stop = reverse ? r0 : r1;
    step = (stop - start2) / Math.max(1, n - paddingInner + paddingOuter * 2);
    if (round) step = Math.floor(step);
    start2 += (stop - start2 - step * (n - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round) start2 = Math.round(start2), bandwidth = Math.round(bandwidth);
    var values = range(n).map(function(i) {
      return start2 + step * i;
    });
    return ordinalRange(reverse ? values.reverse() : values);
  }
  scale.domain = function(_) {
    return arguments.length ? (domain(_), rescale()) : domain();
  };
  scale.range = function(_) {
    return arguments.length ? ([r0, r1] = _, r0 = +r0, r1 = +r1, rescale()) : [r0, r1];
  };
  scale.rangeRound = function(_) {
    return [r0, r1] = _, r0 = +r0, r1 = +r1, round = true, rescale();
  };
  scale.bandwidth = function() {
    return bandwidth;
  };
  scale.step = function() {
    return step;
  };
  scale.round = function(_) {
    return arguments.length ? (round = !!_, rescale()) : round;
  };
  scale.padding = function(_) {
    return arguments.length ? (paddingInner = Math.min(1, paddingOuter = +_), rescale()) : paddingInner;
  };
  scale.paddingInner = function(_) {
    return arguments.length ? (paddingInner = Math.min(1, _), rescale()) : paddingInner;
  };
  scale.paddingOuter = function(_) {
    return arguments.length ? (paddingOuter = +_, rescale()) : paddingOuter;
  };
  scale.align = function(_) {
    return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
  };
  scale.copy = function() {
    return band(domain(), [r0, r1]).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
  };
  return initRange.apply(rescale(), arguments);
}

// node_modules/d3-scale/src/constant.js
function constants(x2) {
  return function() {
    return x2;
  };
}

// node_modules/d3-scale/src/number.js
function number3(x2) {
  return +x2;
}

// node_modules/d3-scale/src/continuous.js
var unit = [0, 1];
function identity3(x2) {
  return x2;
}
function normalize(a, b) {
  return (b -= a = +a) ? function(x2) {
    return (x2 - a) / b;
  } : constants(isNaN(b) ? NaN : 0.5);
}
function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x2) {
    return Math.max(a, Math.min(b, x2));
  };
}
function bimap(domain, range2, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range2[0], r1 = range2[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x2) {
    return r0(d0(x2));
  };
}
function polymap(domain, range2, interpolate) {
  var j = Math.min(domain.length, range2.length) - 1, d = new Array(j), r = new Array(j), i = -1;
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range2 = range2.slice().reverse();
  }
  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range2[i], range2[i + 1]);
  }
  return function(x2) {
    var i2 = bisect_default(domain, x2, 1, j) - 1;
    return r[i2](d[i2](x2));
  };
}
function copy(source, target) {
  return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
}
function transformer() {
  var domain = unit, range2 = unit, interpolate = value_default, transform2, untransform, unknown, clamp = identity3, piecewise, output, input;
  function rescale() {
    var n = Math.min(domain.length, range2.length);
    if (clamp !== identity3) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }
  function scale(x2) {
    return x2 == null || isNaN(x2 = +x2) ? unknown : (output || (output = piecewise(domain.map(transform2), range2, interpolate)))(transform2(clamp(x2)));
  }
  scale.invert = function(y2) {
    return clamp(untransform((input || (input = piecewise(range2, domain.map(transform2), number_default)))(y2)));
  };
  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number3), rescale()) : domain.slice();
  };
  scale.range = function(_) {
    return arguments.length ? (range2 = Array.from(_), rescale()) : range2.slice();
  };
  scale.rangeRound = function(_) {
    return range2 = Array.from(_), interpolate = round_default, rescale();
  };
  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity3, rescale()) : clamp !== identity3;
  };
  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };
  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };
  return function(t, u) {
    transform2 = t, untransform = u;
    return rescale();
  };
}
function continuous() {
  return transformer()(identity3, identity3);
}

// node_modules/d3-scale/src/tickFormat.js
function tickFormat(start2, stop, count, specifier) {
  var step = tickStep(start2, stop, count), precision2;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start2), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision2 = precisionPrefix_default(step, value))) specifier.precision = precision2;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision2 = precisionRound_default(step, Math.max(Math.abs(start2), Math.abs(stop))))) specifier.precision = precision2 - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision2 = precisionFixed_default(step))) specifier.precision = precision2 - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

// node_modules/d3-scale/src/linear.js
function linearish(scale) {
  var domain = scale.domain;
  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };
  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };
  scale.nice = function(count) {
    if (count == null) count = 10;
    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start2 = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;
    if (stop < start2) {
      step = start2, start2 = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    while (maxIter-- > 0) {
      step = tickIncrement(start2, stop, count);
      if (step === prestep) {
        d[i0] = start2;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start2 = Math.floor(start2 / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start2 = Math.ceil(start2 * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }
    return scale;
  };
  return scale;
}
function linear2() {
  var scale = continuous();
  scale.copy = function() {
    return copy(scale, linear2());
  };
  initRange.apply(scale, arguments);
  return linearish(scale);
}

// node_modules/d3-scale/src/nice.js
function nice(domain, interval2) {
  domain = domain.slice();
  var i0 = 0, i1 = domain.length - 1, x0 = domain[i0], x1 = domain[i1], t;
  if (x1 < x0) {
    t = i0, i0 = i1, i1 = t;
    t = x0, x0 = x1, x1 = t;
  }
  domain[i0] = interval2.floor(x0);
  domain[i1] = interval2.ceil(x1);
  return domain;
}

// node_modules/d3-scale/src/log.js
function transformLog(x2) {
  return Math.log(x2);
}
function transformExp(x2) {
  return Math.exp(x2);
}
function transformLogn(x2) {
  return -Math.log(-x2);
}
function transformExpn(x2) {
  return -Math.exp(-x2);
}
function pow10(x2) {
  return isFinite(x2) ? +("1e" + x2) : x2 < 0 ? 0 : x2;
}
function powp(base) {
  return base === 10 ? pow10 : base === Math.E ? Math.exp : (x2) => Math.pow(base, x2);
}
function logp(base) {
  return base === Math.E ? Math.log : base === 10 && Math.log10 || base === 2 && Math.log2 || (base = Math.log(base), (x2) => Math.log(x2) / base);
}
function reflect(f) {
  return (x2, k) => -f(-x2, k);
}
function loggish(transform2) {
  const scale = transform2(transformLog, transformExp);
  const domain = scale.domain;
  let base = 10;
  let logs;
  let pows;
  function rescale() {
    logs = logp(base), pows = powp(base);
    if (domain()[0] < 0) {
      logs = reflect(logs), pows = reflect(pows);
      transform2(transformLogn, transformExpn);
    } else {
      transform2(transformLog, transformExp);
    }
    return scale;
  }
  scale.base = function(_) {
    return arguments.length ? (base = +_, rescale()) : base;
  };
  scale.domain = function(_) {
    return arguments.length ? (domain(_), rescale()) : domain();
  };
  scale.ticks = (count) => {
    const d = domain();
    let u = d[0];
    let v = d[d.length - 1];
    const r = v < u;
    if (r) [u, v] = [v, u];
    let i = logs(u);
    let j = logs(v);
    let k;
    let t;
    const n = count == null ? 10 : +count;
    let z = [];
    if (!(base % 1) && j - i < n) {
      i = Math.floor(i), j = Math.ceil(j);
      if (u > 0) for (; i <= j; ++i) {
        for (k = 1; k < base; ++k) {
          t = i < 0 ? k / pows(-i) : k * pows(i);
          if (t < u) continue;
          if (t > v) break;
          z.push(t);
        }
      }
      else for (; i <= j; ++i) {
        for (k = base - 1; k >= 1; --k) {
          t = i > 0 ? k / pows(-i) : k * pows(i);
          if (t < u) continue;
          if (t > v) break;
          z.push(t);
        }
      }
      if (z.length * 2 < n) z = ticks(u, v, n);
    } else {
      z = ticks(i, j, Math.min(j - i, n)).map(pows);
    }
    return r ? z.reverse() : z;
  };
  scale.tickFormat = (count, specifier) => {
    if (count == null) count = 10;
    if (specifier == null) specifier = base === 10 ? "s" : ",";
    if (typeof specifier !== "function") {
      if (!(base % 1) && (specifier = formatSpecifier(specifier)).precision == null) specifier.trim = true;
      specifier = format(specifier);
    }
    if (count === Infinity) return specifier;
    const k = Math.max(1, base * count / scale.ticks().length);
    return (d) => {
      let i = d / pows(Math.round(logs(d)));
      if (i * base < base - 0.5) i *= base;
      return i <= k ? specifier(d) : "";
    };
  };
  scale.nice = () => {
    return domain(nice(domain(), {
      floor: (x2) => pows(Math.floor(logs(x2))),
      ceil: (x2) => pows(Math.ceil(logs(x2)))
    }));
  };
  return scale;
}
function log() {
  const scale = loggish(transformer()).domain([1, 10]);
  scale.copy = () => copy(scale, log()).base(scale.base());
  initRange.apply(scale, arguments);
  return scale;
}

// node_modules/d3-scale/src/pow.js
function transformPow(exponent) {
  return function(x2) {
    return x2 < 0 ? -Math.pow(-x2, exponent) : Math.pow(x2, exponent);
  };
}
function transformSqrt(x2) {
  return x2 < 0 ? -Math.sqrt(-x2) : Math.sqrt(x2);
}
function transformSquare(x2) {
  return x2 < 0 ? -x2 * x2 : x2 * x2;
}
function powish(transform2) {
  var scale = transform2(identity3, identity3), exponent = 1;
  function rescale() {
    return exponent === 1 ? transform2(identity3, identity3) : exponent === 0.5 ? transform2(transformSqrt, transformSquare) : transform2(transformPow(exponent), transformPow(1 / exponent));
  }
  scale.exponent = function(_) {
    return arguments.length ? (exponent = +_, rescale()) : exponent;
  };
  return linearish(scale);
}
function pow() {
  var scale = powish(transformer());
  scale.copy = function() {
    return copy(scale, pow()).exponent(scale.exponent());
  };
  initRange.apply(scale, arguments);
  return scale;
}
function sqrt() {
  return pow.apply(null, arguments).exponent(0.5);
}

// node_modules/d3-time/src/interval.js
var t0 = /* @__PURE__ */ new Date();
var t1 = /* @__PURE__ */ new Date();
function timeInterval(floori, offseti, count, field) {
  function interval2(date2) {
    return floori(date2 = arguments.length === 0 ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(+date2)), date2;
  }
  interval2.floor = (date2) => {
    return floori(date2 = /* @__PURE__ */ new Date(+date2)), date2;
  };
  interval2.ceil = (date2) => {
    return floori(date2 = new Date(date2 - 1)), offseti(date2, 1), floori(date2), date2;
  };
  interval2.round = (date2) => {
    const d0 = interval2(date2), d1 = interval2.ceil(date2);
    return date2 - d0 < d1 - date2 ? d0 : d1;
  };
  interval2.offset = (date2, step) => {
    return offseti(date2 = /* @__PURE__ */ new Date(+date2), step == null ? 1 : Math.floor(step)), date2;
  };
  interval2.range = (start2, stop, step) => {
    const range2 = [];
    start2 = interval2.ceil(start2);
    step = step == null ? 1 : Math.floor(step);
    if (!(start2 < stop) || !(step > 0)) return range2;
    let previous;
    do
      range2.push(previous = /* @__PURE__ */ new Date(+start2)), offseti(start2, step), floori(start2);
    while (previous < start2 && start2 < stop);
    return range2;
  };
  interval2.filter = (test) => {
    return timeInterval((date2) => {
      if (date2 >= date2) while (floori(date2), !test(date2)) date2.setTime(date2 - 1);
    }, (date2, step) => {
      if (date2 >= date2) {
        if (step < 0) while (++step <= 0) {
          while (offseti(date2, -1), !test(date2)) {
          }
        }
        else while (--step >= 0) {
          while (offseti(date2, 1), !test(date2)) {
          }
        }
      }
    });
  };
  if (count) {
    interval2.count = (start2, end) => {
      t0.setTime(+start2), t1.setTime(+end);
      floori(t0), floori(t1);
      return Math.floor(count(t0, t1));
    };
    interval2.every = (step) => {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval2 : interval2.filter(field ? (d) => field(d) % step === 0 : (d) => interval2.count(0, d) % step === 0);
    };
  }
  return interval2;
}

// node_modules/d3-time/src/millisecond.js
var millisecond = timeInterval(() => {
}, (date2, step) => {
  date2.setTime(+date2 + step);
}, (start2, end) => {
  return end - start2;
});
millisecond.every = (k) => {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return timeInterval((date2) => {
    date2.setTime(Math.floor(date2 / k) * k);
  }, (date2, step) => {
    date2.setTime(+date2 + step * k);
  }, (start2, end) => {
    return (end - start2) / k;
  });
};
var milliseconds = millisecond.range;

// node_modules/d3-time/src/duration.js
var durationSecond = 1e3;
var durationMinute = durationSecond * 60;
var durationHour = durationMinute * 60;
var durationDay = durationHour * 24;
var durationWeek = durationDay * 7;
var durationMonth = durationDay * 30;
var durationYear = durationDay * 365;

// node_modules/d3-time/src/second.js
var second = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds());
}, (date2, step) => {
  date2.setTime(+date2 + step * durationSecond);
}, (start2, end) => {
  return (end - start2) / durationSecond;
}, (date2) => {
  return date2.getUTCSeconds();
});
var seconds = second.range;

// node_modules/d3-time/src/minute.js
var timeMinute = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start2, end) => {
  return (end - start2) / durationMinute;
}, (date2) => {
  return date2.getMinutes();
});
var timeMinutes = timeMinute.range;
var utcMinute = timeInterval((date2) => {
  date2.setUTCSeconds(0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationMinute);
}, (start2, end) => {
  return (end - start2) / durationMinute;
}, (date2) => {
  return date2.getUTCMinutes();
});
var utcMinutes = utcMinute.range;

// node_modules/d3-time/src/hour.js
var timeHour = timeInterval((date2) => {
  date2.setTime(date2 - date2.getMilliseconds() - date2.getSeconds() * durationSecond - date2.getMinutes() * durationMinute);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start2, end) => {
  return (end - start2) / durationHour;
}, (date2) => {
  return date2.getHours();
});
var timeHours = timeHour.range;
var utcHour = timeInterval((date2) => {
  date2.setUTCMinutes(0, 0, 0);
}, (date2, step) => {
  date2.setTime(+date2 + step * durationHour);
}, (start2, end) => {
  return (end - start2) / durationHour;
}, (date2) => {
  return date2.getUTCHours();
});
var utcHours = utcHour.range;

// node_modules/d3-time/src/day.js
var timeDay = timeInterval(
  (date2) => date2.setHours(0, 0, 0, 0),
  (date2, step) => date2.setDate(date2.getDate() + step),
  (start2, end) => (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationDay,
  (date2) => date2.getDate() - 1
);
var timeDays = timeDay.range;
var utcDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start2, end) => {
  return (end - start2) / durationDay;
}, (date2) => {
  return date2.getUTCDate() - 1;
});
var utcDays = utcDay.range;
var unixDay = timeInterval((date2) => {
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCDate(date2.getUTCDate() + step);
}, (start2, end) => {
  return (end - start2) / durationDay;
}, (date2) => {
  return Math.floor(date2 / durationDay);
});
var unixDays = unixDay.range;

// node_modules/d3-time/src/week.js
function timeWeekday(i) {
  return timeInterval((date2) => {
    date2.setDate(date2.getDate() - (date2.getDay() + 7 - i) % 7);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setDate(date2.getDate() + step * 7);
  }, (start2, end) => {
    return (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}
var timeSunday = timeWeekday(0);
var timeMonday = timeWeekday(1);
var timeTuesday = timeWeekday(2);
var timeWednesday = timeWeekday(3);
var timeThursday = timeWeekday(4);
var timeFriday = timeWeekday(5);
var timeSaturday = timeWeekday(6);
var timeSundays = timeSunday.range;
var timeMondays = timeMonday.range;
var timeTuesdays = timeTuesday.range;
var timeWednesdays = timeWednesday.range;
var timeThursdays = timeThursday.range;
var timeFridays = timeFriday.range;
var timeSaturdays = timeSaturday.range;
function utcWeekday(i) {
  return timeInterval((date2) => {
    date2.setUTCDate(date2.getUTCDate() - (date2.getUTCDay() + 7 - i) % 7);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCDate(date2.getUTCDate() + step * 7);
  }, (start2, end) => {
    return (end - start2) / durationWeek;
  });
}
var utcSunday = utcWeekday(0);
var utcMonday = utcWeekday(1);
var utcTuesday = utcWeekday(2);
var utcWednesday = utcWeekday(3);
var utcThursday = utcWeekday(4);
var utcFriday = utcWeekday(5);
var utcSaturday = utcWeekday(6);
var utcSundays = utcSunday.range;
var utcMondays = utcMonday.range;
var utcTuesdays = utcTuesday.range;
var utcWednesdays = utcWednesday.range;
var utcThursdays = utcThursday.range;
var utcFridays = utcFriday.range;
var utcSaturdays = utcSaturday.range;

// node_modules/d3-time/src/month.js
var timeMonth = timeInterval((date2) => {
  date2.setDate(1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setMonth(date2.getMonth() + step);
}, (start2, end) => {
  return end.getMonth() - start2.getMonth() + (end.getFullYear() - start2.getFullYear()) * 12;
}, (date2) => {
  return date2.getMonth();
});
var timeMonths = timeMonth.range;
var utcMonth = timeInterval((date2) => {
  date2.setUTCDate(1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCMonth(date2.getUTCMonth() + step);
}, (start2, end) => {
  return end.getUTCMonth() - start2.getUTCMonth() + (end.getUTCFullYear() - start2.getUTCFullYear()) * 12;
}, (date2) => {
  return date2.getUTCMonth();
});
var utcMonths = utcMonth.range;

// node_modules/d3-time/src/year.js
var timeYear = timeInterval((date2) => {
  date2.setMonth(0, 1);
  date2.setHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setFullYear(date2.getFullYear() + step);
}, (start2, end) => {
  return end.getFullYear() - start2.getFullYear();
}, (date2) => {
  return date2.getFullYear();
});
timeYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date2) => {
    date2.setFullYear(Math.floor(date2.getFullYear() / k) * k);
    date2.setMonth(0, 1);
    date2.setHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setFullYear(date2.getFullYear() + step * k);
  });
};
var timeYears = timeYear.range;
var utcYear = timeInterval((date2) => {
  date2.setUTCMonth(0, 1);
  date2.setUTCHours(0, 0, 0, 0);
}, (date2, step) => {
  date2.setUTCFullYear(date2.getUTCFullYear() + step);
}, (start2, end) => {
  return end.getUTCFullYear() - start2.getUTCFullYear();
}, (date2) => {
  return date2.getUTCFullYear();
});
utcYear.every = (k) => {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date2) => {
    date2.setUTCFullYear(Math.floor(date2.getUTCFullYear() / k) * k);
    date2.setUTCMonth(0, 1);
    date2.setUTCHours(0, 0, 0, 0);
  }, (date2, step) => {
    date2.setUTCFullYear(date2.getUTCFullYear() + step * k);
  });
};
var utcYears = utcYear.range;

// node_modules/d3-time/src/ticks.js
function ticker(year, month, week, day, hour, minute) {
  const tickIntervals = [
    [second, 1, durationSecond],
    [second, 5, 5 * durationSecond],
    [second, 15, 15 * durationSecond],
    [second, 30, 30 * durationSecond],
    [minute, 1, durationMinute],
    [minute, 5, 5 * durationMinute],
    [minute, 15, 15 * durationMinute],
    [minute, 30, 30 * durationMinute],
    [hour, 1, durationHour],
    [hour, 3, 3 * durationHour],
    [hour, 6, 6 * durationHour],
    [hour, 12, 12 * durationHour],
    [day, 1, durationDay],
    [day, 2, 2 * durationDay],
    [week, 1, durationWeek],
    [month, 1, durationMonth],
    [month, 3, 3 * durationMonth],
    [year, 1, durationYear]
  ];
  function ticks2(start2, stop, count) {
    const reverse = stop < start2;
    if (reverse) [start2, stop] = [stop, start2];
    const interval2 = count && typeof count.range === "function" ? count : tickInterval(start2, stop, count);
    const ticks3 = interval2 ? interval2.range(start2, +stop + 1) : [];
    return reverse ? ticks3.reverse() : ticks3;
  }
  function tickInterval(start2, stop, count) {
    const target = Math.abs(stop - start2) / count;
    const i = bisector(([, , step2]) => step2).right(tickIntervals, target);
    if (i === tickIntervals.length) return year.every(tickStep(start2 / durationYear, stop / durationYear, count));
    if (i === 0) return millisecond.every(Math.max(tickStep(start2, stop, count), 1));
    const [t, step] = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
    return t.every(step);
  }
  return [ticks2, tickInterval];
}
var [utcTicks, utcTickInterval] = ticker(utcYear, utcMonth, utcSunday, unixDay, utcHour, utcMinute);
var [timeTicks, timeTickInterval] = ticker(timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute);

// node_modules/d3-time-format/src/locale.js
function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date2 = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date2.setFullYear(d.y);
    return date2;
  }
  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}
function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date2 = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date2.setUTCFullYear(d.y);
    return date2;
  }
  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}
function newDate(y2, m, d) {
  return { y: y2, m, d, H: 0, M: 0, S: 0, L: 0 };
}
function formatLocale(locale3) {
  var locale_dateTime = locale3.dateTime, locale_date = locale3.date, locale_time = locale3.time, locale_periods = locale3.periods, locale_weekdays = locale3.days, locale_shortWeekdays = locale3.shortDays, locale_months = locale3.months, locale_shortMonths = locale3.shortMonths;
  var periodRe = formatRe(locale_periods), periodLookup = formatLookup(locale_periods), weekdayRe = formatRe(locale_weekdays), weekdayLookup = formatLookup(locale_weekdays), shortWeekdayRe = formatRe(locale_shortWeekdays), shortWeekdayLookup = formatLookup(locale_shortWeekdays), monthRe = formatRe(locale_months), monthLookup = formatLookup(locale_months), shortMonthRe = formatRe(locale_shortMonths), shortMonthLookup = formatLookup(locale_shortMonths);
  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "g": formatYearISO,
    "G": formatFullYearISO,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "q": formatQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };
  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "g": formatUTCYearISO,
    "G": formatUTCFullYearISO,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "q": formatUTCQuarter,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };
  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "g": parseYear,
    "G": parseFullYear,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "q": parseQuarter,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);
  function newFormat(specifier, formats2) {
    return function(date2) {
      var string = [], i = -1, j = 0, n = specifier.length, c, pad2, format2;
      if (!(date2 instanceof Date)) date2 = /* @__PURE__ */ new Date(+date2);
      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad2 = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
          else pad2 = c === "e" ? " " : "0";
          if (format2 = formats2[c]) c = format2(date2, pad2);
          string.push(c);
          j = i + 1;
        }
      }
      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }
  function newParse(specifier, Z) {
    return function(string) {
      var d = newDate(1900, void 0, 1), i = parseSpecifier(d, specifier, string += "", 0), week, day;
      if (i != string.length) return null;
      if ("Q" in d) return new Date(d.Q);
      if ("s" in d) return new Date(d.s * 1e3 + ("L" in d ? d.L : 0));
      if (Z && !("Z" in d)) d.Z = 0;
      if ("p" in d) d.H = d.H % 12 + d.p * 12;
      if (d.m === void 0) d.m = "q" in d ? d.q : 0;
      if ("V" in d) {
        if (d.V < 1 || d.V > 53) return null;
        if (!("w" in d)) d.w = 1;
        if ("Z" in d) {
          week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
          week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
          week = utcDay.offset(week, (d.V - 1) * 7);
          d.y = week.getUTCFullYear();
          d.m = week.getUTCMonth();
          d.d = week.getUTCDate() + (d.w + 6) % 7;
        } else {
          week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
          week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
          week = timeDay.offset(week, (d.V - 1) * 7);
          d.y = week.getFullYear();
          d.m = week.getMonth();
          d.d = week.getDate() + (d.w + 6) % 7;
        }
      } else if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
        day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
      }
      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      }
      return localDate(d);
    };
  }
  function parseSpecifier(d, specifier, string, j) {
    var i = 0, n = specifier.length, m = string.length, c, parse;
    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);
      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || (j = parse(d, string, j)) < 0) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }
    return j;
  }
  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
  }
  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }
  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }
  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }
  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }
  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }
  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }
  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }
  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }
  function formatQuarter(d) {
    return 1 + ~~(d.getMonth() / 3);
  }
  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }
  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }
  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }
  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }
  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }
  function formatUTCQuarter(d) {
    return 1 + ~~(d.getUTCMonth() / 3);
  }
  return {
    format: function(specifier) {
      var f = newFormat(specifier += "", formats);
      f.toString = function() {
        return specifier;
      };
      return f;
    },
    parse: function(specifier) {
      var p = newParse(specifier += "", false);
      p.toString = function() {
        return specifier;
      };
      return p;
    },
    utcFormat: function(specifier) {
      var f = newFormat(specifier += "", utcFormats);
      f.toString = function() {
        return specifier;
      };
      return f;
    },
    utcParse: function(specifier) {
      var p = newParse(specifier += "", true);
      p.toString = function() {
        return specifier;
      };
      return p;
    }
  };
}
var pads = { "-": "", "_": " ", "0": "0" };
var numberRe = /^\s*\d+/;
var percentRe = /^%/;
var requoteRe = /[\\^$*+?|[\]().{}]/g;
function pad(value, fill, width) {
  var sign = value < 0 ? "-" : "", string = (sign ? -value : value) + "", length = string.length;
  return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}
function requote(s) {
  return s.replace(requoteRe, "\\$&");
}
function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}
function formatLookup(names) {
  return new Map(names.map((name, i) => [name.toLowerCase(), i]));
}
function parseWeekdayNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}
function parseWeekdayNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.u = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberISO(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.V = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}
function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}
function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2e3), i + n[0].length) : -1;
}
function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}
function parseQuarter(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
}
function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}
function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}
function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}
function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}
function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}
function parseSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}
function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}
function parseMicroseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 6));
  return n ? (d.L = Math.floor(n[0] / 1e3), i + n[0].length) : -1;
}
function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}
function parseUnixTimestamp(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = +n[0], i + n[0].length) : -1;
}
function parseUnixTimestampSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.s = +n[0], i + n[0].length) : -1;
}
function formatDayOfMonth(d, p) {
  return pad(d.getDate(), p, 2);
}
function formatHour24(d, p) {
  return pad(d.getHours(), p, 2);
}
function formatHour12(d, p) {
  return pad(d.getHours() % 12 || 12, p, 2);
}
function formatDayOfYear(d, p) {
  return pad(1 + timeDay.count(timeYear(d), d), p, 3);
}
function formatMilliseconds(d, p) {
  return pad(d.getMilliseconds(), p, 3);
}
function formatMicroseconds(d, p) {
  return formatMilliseconds(d, p) + "000";
}
function formatMonthNumber(d, p) {
  return pad(d.getMonth() + 1, p, 2);
}
function formatMinutes(d, p) {
  return pad(d.getMinutes(), p, 2);
}
function formatSeconds(d, p) {
  return pad(d.getSeconds(), p, 2);
}
function formatWeekdayNumberMonday(d) {
  var day = d.getDay();
  return day === 0 ? 7 : day;
}
function formatWeekNumberSunday(d, p) {
  return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
}
function dISO(d) {
  var day = d.getDay();
  return day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
}
function formatWeekNumberISO(d, p) {
  d = dISO(d);
  return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
}
function formatWeekdayNumberSunday(d) {
  return d.getDay();
}
function formatWeekNumberMonday(d, p) {
  return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
}
function formatYear(d, p) {
  return pad(d.getFullYear() % 100, p, 2);
}
function formatYearISO(d, p) {
  d = dISO(d);
  return pad(d.getFullYear() % 100, p, 2);
}
function formatFullYear(d, p) {
  return pad(d.getFullYear() % 1e4, p, 4);
}
function formatFullYearISO(d, p) {
  var day = d.getDay();
  d = day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
  return pad(d.getFullYear() % 1e4, p, 4);
}
function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+")) + pad(z / 60 | 0, "0", 2) + pad(z % 60, "0", 2);
}
function formatUTCDayOfMonth(d, p) {
  return pad(d.getUTCDate(), p, 2);
}
function formatUTCHour24(d, p) {
  return pad(d.getUTCHours(), p, 2);
}
function formatUTCHour12(d, p) {
  return pad(d.getUTCHours() % 12 || 12, p, 2);
}
function formatUTCDayOfYear(d, p) {
  return pad(1 + utcDay.count(utcYear(d), d), p, 3);
}
function formatUTCMilliseconds(d, p) {
  return pad(d.getUTCMilliseconds(), p, 3);
}
function formatUTCMicroseconds(d, p) {
  return formatUTCMilliseconds(d, p) + "000";
}
function formatUTCMonthNumber(d, p) {
  return pad(d.getUTCMonth() + 1, p, 2);
}
function formatUTCMinutes(d, p) {
  return pad(d.getUTCMinutes(), p, 2);
}
function formatUTCSeconds(d, p) {
  return pad(d.getUTCSeconds(), p, 2);
}
function formatUTCWeekdayNumberMonday(d) {
  var dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}
function formatUTCWeekNumberSunday(d, p) {
  return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
}
function UTCdISO(d) {
  var day = d.getUTCDay();
  return day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
}
function formatUTCWeekNumberISO(d, p) {
  d = UTCdISO(d);
  return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
}
function formatUTCWeekdayNumberSunday(d) {
  return d.getUTCDay();
}
function formatUTCWeekNumberMonday(d, p) {
  return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
}
function formatUTCYear(d, p) {
  return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCYearISO(d, p) {
  d = UTCdISO(d);
  return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCFullYear(d, p) {
  return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCFullYearISO(d, p) {
  var day = d.getUTCDay();
  d = day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
  return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCZone() {
  return "+0000";
}
function formatLiteralPercent() {
  return "%";
}
function formatUnixTimestamp(d) {
  return +d;
}
function formatUnixTimestampSeconds(d) {
  return Math.floor(+d / 1e3);
}

// node_modules/d3-time-format/src/defaultLocale.js
var locale2;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;
defaultLocale2({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});
function defaultLocale2(definition) {
  locale2 = formatLocale(definition);
  timeFormat = locale2.format;
  timeParse = locale2.parse;
  utcFormat = locale2.utcFormat;
  utcParse = locale2.utcParse;
  return locale2;
}

// node_modules/d3-scale/src/time.js
function date(t) {
  return new Date(t);
}
function number4(t) {
  return t instanceof Date ? +t : +/* @__PURE__ */ new Date(+t);
}
function calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second2, format2) {
  var scale = continuous(), invert = scale.invert, domain = scale.domain;
  var formatMillisecond = format2(".%L"), formatSecond = format2(":%S"), formatMinute = format2("%I:%M"), formatHour = format2("%I %p"), formatDay = format2("%a %d"), formatWeek = format2("%b %d"), formatMonth = format2("%B"), formatYear2 = format2("%Y");
  function tickFormat2(date2) {
    return (second2(date2) < date2 ? formatMillisecond : minute(date2) < date2 ? formatSecond : hour(date2) < date2 ? formatMinute : day(date2) < date2 ? formatHour : month(date2) < date2 ? week(date2) < date2 ? formatDay : formatWeek : year(date2) < date2 ? formatMonth : formatYear2)(date2);
  }
  scale.invert = function(y2) {
    return new Date(invert(y2));
  };
  scale.domain = function(_) {
    return arguments.length ? domain(Array.from(_, number4)) : domain().map(date);
  };
  scale.ticks = function(interval2) {
    var d = domain();
    return ticks2(d[0], d[d.length - 1], interval2 == null ? 10 : interval2);
  };
  scale.tickFormat = function(count, specifier) {
    return specifier == null ? tickFormat2 : format2(specifier);
  };
  scale.nice = function(interval2) {
    var d = domain();
    if (!interval2 || typeof interval2.range !== "function") interval2 = tickInterval(d[0], d[d.length - 1], interval2 == null ? 10 : interval2);
    return interval2 ? domain(nice(d, interval2)) : scale;
  };
  scale.copy = function() {
    return copy(scale, calendar(ticks2, tickInterval, year, month, week, day, hour, minute, second2, format2));
  };
  return scale;
}
function time() {
  return initRange.apply(calendar(timeTicks, timeTickInterval, timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute, second, timeFormat).domain([new Date(2e3, 0, 1), new Date(2e3, 0, 2)]), arguments);
}

// node_modules/d3-shape/src/constant.js
function constant_default4(x2) {
  return function constant() {
    return x2;
  };
}

// node_modules/d3-shape/src/math.js
var cos = Math.cos;
var sin = Math.sin;
var sqrt2 = Math.sqrt;
var pi2 = Math.PI;
var halfPi = pi2 / 2;
var tau2 = 2 * pi2;

// node_modules/d3-shape/src/path.js
function withPath(shape) {
  let digits = 3;
  shape.digits = function(_) {
    if (!arguments.length) return digits;
    if (_ == null) {
      digits = null;
    } else {
      const d = Math.floor(_);
      if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
      digits = d;
    }
    return shape;
  };
  return () => new Path(digits);
}

// node_modules/d3-shape/src/array.js
var slice = Array.prototype.slice;
function array_default(x2) {
  return typeof x2 === "object" && "length" in x2 ? x2 : Array.from(x2);
}

// node_modules/d3-shape/src/curve/linear.js
function Linear(context) {
  this._context = context;
}
Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x2, y2) {
    x2 = +x2, y2 = +y2;
    switch (this._point) {
      case 0:
        this._point = 1;
        this._line ? this._context.lineTo(x2, y2) : this._context.moveTo(x2, y2);
        break;
      case 1:
        this._point = 2;
      // falls through
      default:
        this._context.lineTo(x2, y2);
        break;
    }
  }
};
function linear_default(context) {
  return new Linear(context);
}

// node_modules/d3-shape/src/point.js
function x(p) {
  return p[0];
}
function y(p) {
  return p[1];
}

// node_modules/d3-shape/src/line.js
function line_default(x2, y2) {
  var defined = constant_default4(true), context = null, curve = linear_default, output = null, path2 = withPath(line);
  x2 = typeof x2 === "function" ? x2 : x2 === void 0 ? x : constant_default4(x2);
  y2 = typeof y2 === "function" ? y2 : y2 === void 0 ? y : constant_default4(y2);
  function line(data) {
    var i, n = (data = array_default(data)).length, d, defined0 = false, buffer;
    if (context == null) output = curve(buffer = path2());
    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) output.lineStart();
        else output.lineEnd();
      }
      if (defined0) output.point(+x2(d, i, data), +y2(d, i, data));
    }
    if (buffer) return output = null, buffer + "" || null;
  }
  line.x = function(_) {
    return arguments.length ? (x2 = typeof _ === "function" ? _ : constant_default4(+_), line) : x2;
  };
  line.y = function(_) {
    return arguments.length ? (y2 = typeof _ === "function" ? _ : constant_default4(+_), line) : y2;
  };
  line.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default4(!!_), line) : defined;
  };
  line.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
  };
  line.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
  };
  return line;
}

// node_modules/d3-shape/src/area.js
function area_default(x0, y0, y1) {
  var x1 = null, defined = constant_default4(true), context = null, curve = linear_default, output = null, path2 = withPath(area);
  x0 = typeof x0 === "function" ? x0 : x0 === void 0 ? x : constant_default4(+x0);
  y0 = typeof y0 === "function" ? y0 : y0 === void 0 ? constant_default4(0) : constant_default4(+y0);
  y1 = typeof y1 === "function" ? y1 : y1 === void 0 ? y : constant_default4(+y1);
  function area(data) {
    var i, j, k, n = (data = array_default(data)).length, d, defined0 = false, buffer, x0z = new Array(n), y0z = new Array(n);
    if (context == null) output = curve(buffer = path2());
    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) {
          j = i;
          output.areaStart();
          output.lineStart();
        } else {
          output.lineEnd();
          output.lineStart();
          for (k = i - 1; k >= j; --k) {
            output.point(x0z[k], y0z[k]);
          }
          output.lineEnd();
          output.areaEnd();
        }
      }
      if (defined0) {
        x0z[i] = +x0(d, i, data), y0z[i] = +y0(d, i, data);
        output.point(x1 ? +x1(d, i, data) : x0z[i], y1 ? +y1(d, i, data) : y0z[i]);
      }
    }
    if (buffer) return output = null, buffer + "" || null;
  }
  function arealine() {
    return line_default().defined(defined).curve(curve).context(context);
  }
  area.x = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant_default4(+_), x1 = null, area) : x0;
  };
  area.x0 = function(_) {
    return arguments.length ? (x0 = typeof _ === "function" ? _ : constant_default4(+_), area) : x0;
  };
  area.x1 = function(_) {
    return arguments.length ? (x1 = _ == null ? null : typeof _ === "function" ? _ : constant_default4(+_), area) : x1;
  };
  area.y = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant_default4(+_), y1 = null, area) : y0;
  };
  area.y0 = function(_) {
    return arguments.length ? (y0 = typeof _ === "function" ? _ : constant_default4(+_), area) : y0;
  };
  area.y1 = function(_) {
    return arguments.length ? (y1 = _ == null ? null : typeof _ === "function" ? _ : constant_default4(+_), area) : y1;
  };
  area.lineX0 = area.lineY0 = function() {
    return arealine().x(x0).y(y0);
  };
  area.lineY1 = function() {
    return arealine().x(x0).y(y1);
  };
  area.lineX1 = function() {
    return arealine().x(x1).y(y0);
  };
  area.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default4(!!_), area) : defined;
  };
  area.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), area) : curve;
  };
  area.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area) : context;
  };
  return area;
}

// node_modules/d3-shape/src/symbol/circle.js
var circle_default = {
  draw(context, size) {
    const r = sqrt2(size / pi2);
    context.moveTo(r, 0);
    context.arc(0, 0, r, 0, tau2);
  }
};

// node_modules/d3-shape/src/symbol/diamond.js
var tan30 = sqrt2(1 / 3);
var tan30_2 = tan30 * 2;
var diamond_default = {
  draw(context, size) {
    const y2 = sqrt2(size / tan30_2);
    const x2 = y2 * tan30;
    context.moveTo(0, -y2);
    context.lineTo(x2, 0);
    context.lineTo(0, y2);
    context.lineTo(-x2, 0);
    context.closePath();
  }
};

// node_modules/d3-shape/src/symbol/square.js
var square_default = {
  draw(context, size) {
    const w = sqrt2(size);
    const x2 = -w / 2;
    context.rect(x2, x2, w, w);
  }
};

// node_modules/d3-shape/src/symbol/star.js
var ka = 0.8908130915292852;
var kr = sin(pi2 / 10) / sin(7 * pi2 / 10);
var kx = sin(tau2 / 10) * kr;
var ky = -cos(tau2 / 10) * kr;
var star_default = {
  draw(context, size) {
    const r = sqrt2(size * ka);
    const x2 = kx * r;
    const y2 = ky * r;
    context.moveTo(0, -r);
    context.lineTo(x2, y2);
    for (let i = 1; i < 5; ++i) {
      const a = tau2 * i / 5;
      const c = cos(a);
      const s = sin(a);
      context.lineTo(s * r, -c * r);
      context.lineTo(c * x2 - s * y2, s * x2 + c * y2);
    }
    context.closePath();
  }
};

// node_modules/d3-shape/src/symbol/triangle.js
var sqrt3 = sqrt2(3);
var triangle_default = {
  draw(context, size) {
    const y2 = -sqrt2(size / (sqrt3 * 3));
    context.moveTo(0, y2 * 2);
    context.lineTo(-sqrt3 * y2, -y2);
    context.lineTo(sqrt3 * y2, -y2);
    context.closePath();
  }
};

// node_modules/d3-shape/src/symbol.js
function Symbol2(type2, size) {
  let context = null, path2 = withPath(symbol);
  type2 = typeof type2 === "function" ? type2 : constant_default4(type2 || circle_default);
  size = typeof size === "function" ? size : constant_default4(size === void 0 ? 64 : +size);
  function symbol() {
    let buffer;
    if (!context) context = buffer = path2();
    type2.apply(this, arguments).draw(context, +size.apply(this, arguments));
    if (buffer) return context = null, buffer + "" || null;
  }
  symbol.type = function(_) {
    return arguments.length ? (type2 = typeof _ === "function" ? _ : constant_default4(_), symbol) : type2;
  };
  symbol.size = function(_) {
    return arguments.length ? (size = typeof _ === "function" ? _ : constant_default4(+_), symbol) : size;
  };
  symbol.context = function(_) {
    return arguments.length ? (context = _ == null ? null : _, symbol) : context;
  };
  return symbol;
}

// node_modules/d3-zoom/src/transform.js
function Transform(k, x2, y2) {
  this.k = k;
  this.x = x2;
  this.y = y2;
}
Transform.prototype = {
  constructor: Transform,
  scale: function(k) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  },
  translate: function(x2, y2) {
    return x2 === 0 & y2 === 0 ? this : new Transform(this.k, this.x + this.k * x2, this.y + this.k * y2);
  },
  apply: function(point2) {
    return [point2[0] * this.k + this.x, point2[1] * this.k + this.y];
  },
  applyX: function(x2) {
    return x2 * this.k + this.x;
  },
  applyY: function(y2) {
    return y2 * this.k + this.y;
  },
  invert: function(location) {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  },
  invertX: function(x2) {
    return (x2 - this.x) / this.k;
  },
  invertY: function(y2) {
    return (y2 - this.y) / this.k;
  },
  rescaleX: function(x2) {
    return x2.copy().domain(x2.range().map(this.invertX, this).map(x2.invert, x2));
  },
  rescaleY: function(y2) {
    return y2.copy().domain(y2.range().map(this.invertY, this).map(y2.invert, y2));
  },
  toString: function() {
    return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
  }
};
var identity4 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
  while (!node.__zoom) if (!(node = node.parentNode)) return identity4;
  return node.__zoom;
}

// src/scales.ts
function createScale(data, field, type2, range2, bandOptions) {
  const values = data.map((d) => d[field]);
  const asNumber = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const s = v.trim();
      if (s !== "" && Number.isFinite(Number(s))) return Number(s);
    }
    return null;
  };
  const isBlank = (v) => v == null || typeof v === "number" && Number.isNaN(v);
  if (values.length === 0 || values.every(isBlank)) {
    throw new Error(`ggpbi: field "${field}" has no values in the current filter context`);
  }
  switch (type2) {
    case "linear": {
      const numeric = values.map(asNumber).filter((v) => v != null);
      if (numeric.length === 0) throw new Error(`ggpbi: no numeric values in field "${field}" for linear scale`);
      const extent2 = extent(numeric);
      return linear2().domain(extent2).range(range2);
    }
    case "log": {
      const positive = values.map(asNumber).filter((v) => v != null && v > 0);
      if (positive.length === 0) throw new Error(`ggpbi: no positive values in field "${field}" for log scale`);
      const extent2 = extent(positive);
      return log().domain(extent2).range(range2);
    }
    case "sqrt": {
      const nonNeg = values.map(asNumber).filter((v) => v != null && v >= 0);
      if (nonNeg.length === 0) throw new Error(`ggpbi: no non-negative values in field "${field}" for sqrt scale`);
      const extent2 = extent(nonNeg);
      return sqrt().domain(extent2).range(range2);
    }
    case "time": {
      const dates = values.filter((v) => v instanceof Date);
      if (dates.length === 0) throw new Error(`ggpbi: no Date values in field "${field}" for time scale`);
      const extent2 = extent(dates);
      return time().domain(extent2).range(range2);
    }
    case "ordinal":
    case "category": {
      const unique = Array.from(new Set(values.map(String)));
      if (unique.length === 0) throw new Error(`ggpbi: no values in field "${field}" for ordinal scale`);
      const band2 = band().domain(unique).range(range2).paddingInner(bandOptions?.paddingInner ?? 0.1).paddingOuter(bandOptions?.paddingOuter ?? 0.5);
      return Object.assign(
        ((v) => band2(String(v))),
        band2
      );
    }
    default:
      throw new Error(`Unknown scale type: ${type2}`);
  }
}
function inferScaleType(data, field) {
  const sample = data.find((d) => d[field] !== null && d[field] !== void 0);
  if (!sample) return "linear";
  const value = sample[field];
  if (value instanceof Date) return "time";
  if (typeof value === "number") return "linear";
  if (typeof value === "string") {
    const s = value.trim();
    if (s !== "" && Number.isFinite(Number(s))) return "linear";
  }
  return "ordinal";
}
function createSizeScale(data, field, range2 = [2, 12]) {
  const values = data.map((d) => {
    const v = d[field];
    return typeof v === "number" && Number.isFinite(v) ? v : NaN;
  }).filter((v) => !Number.isNaN(v));
  if (values.length === 0) {
    return linear2().domain([0, 1]).range(range2);
  }
  const extent2 = extent(values);
  if (extent2[0] === extent2[1]) {
    const mid = (range2[0] + range2[1]) / 2;
    return linear2().domain(extent2).range([mid, mid]);
  }
  const [lo, hi] = extent2;
  const [rMin, rMax] = range2;
  const scale = ((value) => {
    const v = Number(value);
    if (!Number.isFinite(v)) return rMin;
    const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return rMin + (rMax - rMin) * Math.sqrt(t);
  });
  scale.domain = (() => extent2);
  scale.range = (() => range2);
  return scale;
}

// src/format.ts
function breakDecimals(breaks) {
  const unique = [...new Set(breaks.filter(Number.isFinite))];
  if (unique.length <= 1) return 0;
  unique.sort((a, b) => a - b);
  let smallestDiff = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 0 && d < smallestDiff) smallestDiff = d;
  }
  if (smallestDiff < Math.sqrt(Number.EPSILON)) return 1;
  let p = Math.pow(10, Math.floor(Math.log10(smallestDiff)) - 1);
  if (unique.every((v) => Math.round(v / p) % 10 === 0)) p *= 10;
  p = Math.min(p, 1);
  return Math.max(0, -Math.floor(Math.log10(p)));
}
function intl(locale3, opts) {
  const safe = opts.style === "currency" && !/^[A-Za-z]{3}$/.test(opts.currency ?? "") ? { ...opts, style: "decimal", currency: void 0 } : opts;
  try {
    const nf = new Intl.NumberFormat(locale3, safe);
    nf.format(0);
    return nf;
  } catch {
    return new Intl.NumberFormat(void 0, {
      ...safe,
      style: safe.style === "currency" ? "decimal" : safe.style,
      currency: void 0
    });
  }
}
function formatPlain(breaks, opts = {}) {
  const decimals = breakDecimals(breaks);
  const nf = intl(opts.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false
  });
  return breaks.map((v) => nf.format(v));
}
function formatThousands(breaks, opts = {}) {
  const decimals = breakDecimals(breaks);
  const nf = intl(opts.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  });
  return breaks.map((v) => nf.format(v));
}
function formatCompact(breaks, opts = {}) {
  const nf = intl(opts.locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  });
  return breaks.map((v) => nf.format(v));
}
function formatCurrency(breaks, opts = {}) {
  const decimals = Math.min(breakDecimals(breaks), 2);
  const nf = intl(opts.locale, {
    style: "currency",
    currency: opts.currency || "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return breaks.map((v) => nf.format(v));
}
function formatPercent(breaks, opts = {}) {
  const scaled = breaks.map((v) => v * 100);
  const decimals = breakDecimals(scaled);
  const nf = intl(opts.locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return breaks.map((v) => nf.format(v));
}
var DATE_OPTIONS = {
  year: { year: "numeric" },
  monthYear: { year: "numeric", month: "short" },
  monthDay: { month: "short", day: "numeric" },
  date: { year: "numeric", month: "2-digit", day: "2-digit" },
  dateTime: { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }
};
function autoDateFormat(ticks2) {
  if (ticks2.length < 2) return "date";
  const step = Math.abs(ticks2[1].getTime() - ticks2[0].getTime());
  const DAY = 864e5;
  if (step < DAY) return "dateTime";
  if (step < 28 * DAY) return "monthDay";
  if (step < 300 * DAY) return "monthYear";
  return "year";
}
function formatDates(ticks2, format2 = "auto", opts = {}) {
  const resolved = format2 === "auto" ? autoDateFormat(ticks2) : format2;
  let df;
  try {
    df = new Intl.DateTimeFormat(opts.locale, DATE_OPTIONS[resolved]);
  } catch {
    df = new Intl.DateTimeFormat(void 0, DATE_OPTIONS[resolved]);
  }
  return ticks2.map((d) => df.format(d));
}

// src/breaks.ts
var EPS = Number.EPSILON * 100;
function simplicity(q2, Q, j, lmin, _lmax, lstep) {
  const n = Q.length;
  const i = Q.indexOf(q2);
  const v = (lmin % lstep < EPS || lstep - lmin % lstep < EPS) && lmin <= 0 && _lmax >= 0 ? 1 : 0;
  return 1 - i / (n - 1) - j + v;
}
function simplicityMax(q2, Q, j) {
  const n = Q.length;
  const i = Q.indexOf(q2);
  return 1 - i / (n - 1) - j + 1;
}
function coverage(dmin, dmax, lmin, lmax) {
  const range2 = dmax - dmin;
  return 1 - 0.5 * ((dmax - lmax) ** 2 + (dmin - lmin) ** 2) / (0.1 * range2) ** 2;
}
function coverageMax(dmin, dmax, span) {
  const range2 = dmax - dmin;
  if (span > range2) {
    const half = (span - range2) / 2;
    return 1 - 0.5 * (half ** 2 + half ** 2) / (0.1 * range2) ** 2;
  }
  return 1;
}
function density(k, m, dmin, dmax, lmin, lmax) {
  const r = (k - 1) / (lmax - lmin);
  const rt = (m - 1) / (Math.max(lmax, dmax) - Math.min(dmin, lmin));
  return 2 - Math.max(r / rt, rt / r);
}
function densityMax(k, m) {
  if (k >= m) return 2 - (k - 1) / (m - 1);
  return 1;
}
function extendedBreaks(dmin, dmax, m = 5, Q = [1, 5, 2, 2.5, 4, 3], onlyLoose = false, w = [0.25, 0.2, 0.5, 0.05]) {
  if (dmin > dmax) {
    const tmp = dmin;
    dmin = dmax;
    dmax = tmp;
  }
  if (dmax - dmin < EPS) {
    const out = [];
    for (let i = 0; i < m; i++) out.push(dmin + (dmax - dmin) * i / (m - 1 || 1));
    return out;
  }
  const _nQ = Q.length;
  let best = { lmin: dmin, lmax: dmax, lstep: (dmax - dmin) / (m - 1 || 1), score: -2 };
  let j = 1;
  outer:
    while (j < Infinity) {
      for (const q2 of Q) {
        const sm = simplicityMax(q2, Q, j);
        if (w[0] * sm + w[1] + w[2] + w[3] < best.score) {
          break outer;
        }
        let k = 2;
        while (k < Infinity) {
          const dm = densityMax(k, m);
          if (w[0] * sm + w[1] + w[2] * dm + w[3] < best.score) break;
          const delta = (dmax - dmin) / (k + 1) / j / q2;
          let z = Math.ceil(Math.log10(delta));
          while (z < Infinity) {
            const step = j * q2 * Math.pow(10, z);
            const cm = coverageMax(dmin, dmax, step * (k - 1));
            if (w[0] * sm + w[1] * cm + w[2] * dm + w[3] < best.score) break;
            const minStart = Math.floor(dmax / step) * j - (k - 1) * j;
            const maxStart = Math.ceil(dmin / step) * j;
            if (minStart > maxStart) {
              z++;
              continue;
            }
            for (let start2 = minStart; start2 <= maxStart; start2++) {
              const lmin = start2 * (step / j);
              const lmax = lmin + step * (k - 1);
              const lstep = step;
              const s = simplicity(q2, Q, j, lmin, lmax, lstep);
              const c = coverage(dmin, dmax, lmin, lmax);
              const g = density(k, m, dmin, dmax, lmin, lmax);
              const l = 1;
              const score = w[0] * s + w[1] * c + w[2] * g + w[3] * l;
              if (score > best.score && (!onlyLoose || lmin <= dmin && lmax >= dmax)) {
                best = { lmin, lmax, lstep, score };
              }
            }
            z++;
          }
          k++;
        }
      }
      j++;
    }
  const result = [];
  const count = Math.round((best.lmax - best.lmin) / best.lstep);
  for (let i = 0; i <= count; i++) {
    result.push(best.lmin + i * best.lstep);
  }
  return result;
}
function minorBreaks(majorBreaks, dmin, dmax) {
  if (majorBreaks.length < 2) return [];
  const result = [];
  for (let i = 0; i < majorBreaks.length - 1; i++) {
    const mid = (majorBreaks[i] + majorBreaks[i + 1]) / 2;
    if (mid >= dmin && mid <= dmax) {
      result.push(mid);
    }
  }
  return result;
}
function precision(breaks) {
  const unique = [...new Set(breaks.filter(Number.isFinite))];
  if (unique.length <= 1) return 1;
  unique.sort((a, b) => a - b);
  let smallestDiff = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 0 && d < smallestDiff) smallestDiff = d;
  }
  if (smallestDiff < Math.sqrt(Number.EPSILON)) return 1;
  let p = Math.pow(10, Math.floor(Math.log10(smallestDiff)) - 1);
  if (unique.every((v) => Math.round(v / p) % 10 === 0)) {
    p *= 10;
  }
  return Math.min(p, 1);
}
function formatBreaks(breaks) {
  const p = precision(breaks);
  const decimals = Math.max(0, -Math.floor(Math.log10(p)));
  return breaks.map((v) => v.toFixed(decimals));
}
function formatBreaksAs(breaks, format2, opts = {}) {
  if (typeof format2 === "function") return breaks.map((v) => format2(v));
  switch (format2) {
    case "percent":
      return formatPercent(breaks, opts);
    case "compact":
      return formatCompact(breaks, opts);
    case "thousands":
      return formatThousands(breaks, opts);
    case "currency":
      return formatCurrency(breaks, opts);
    default:
      return formatPlain(breaks, opts);
  }
}

// src/bind-data.ts
function validateAes(data, aes, geomTypes) {
  const isBoxplotOnly = geomTypes != null && geomTypes.length > 0 && geomTypes.every((t) => t === "boxplot");
  if (!isBoxplotOnly) {
    if (!aes.x) throw new Error("ggpbi: aes.x is not set \u2014 which column should map to the x-axis?");
  }
  if (!aes.y) throw new Error("ggpbi: aes.y is not set \u2014 which column should map to the y-axis?");
  const sample = data[0];
  if (!sample) return;
  if (aes.x && !(aes.x in sample)) {
    const available = Object.keys(sample).join(", ");
    throw new Error(`ggpbi: field "${aes.x}" not found in data. Available: ${available}`);
  }
  if (!(aes.y in sample)) {
    const available = Object.keys(sample).join(", ");
    throw new Error(`ggpbi: field "${aes.y}" not found in data. Available: ${available}`);
  }
}
function bindData(data, aes) {
  return data.map((datum2) => {
    const bound = {
      x: aes.x ? datum2[aes.x] : void 0,
      y: aes.y ? datum2[aes.y] : void 0,
      datum: datum2
    };
    if (aes.color) bound.color = datum2[aes.color];
    if (aes.size) bound.size = datum2[aes.size];
    if (aes.shape) bound.shape = datum2[aes.shape];
    if (aes.alpha) bound.alpha = datum2[aes.alpha];
    if (aes.fill) bound.fill = datum2[aes.fill];
    if (aes.label) bound.label = datum2[aes.label];
    if (aes.weight) bound.weight = datum2[aes.weight];
    if (aes.group) bound.group = datum2[aes.group];
    if (aes.xend) bound.xend = datum2[aes.xend];
    if (aes.yend) bound.yend = datum2[aes.yend];
    if (aes.xmin) bound.xmin = datum2[aes.xmin];
    if (aes.xmax) bound.xmax = datum2[aes.xmax];
    if (aes.ymin) bound.ymin = datum2[aes.ymin];
    if (aes.ymax) bound.ymax = datum2[aes.ymax];
    return bound;
  });
}

// src/geoms/util.ts
var GEOM_DEFAULT_COLOR = "#4682B4";
var REFLINE_DEFAULT_COLOR = "#333333";
function sortByX(points) {
  return [...points].sort((a, b) => {
    if (a.x instanceof Date && b.x instanceof Date) return a.x.getTime() - b.x.getTime();
    return Number(a.x) - Number(b.x);
  });
}
function groupByColor(points) {
  if (!points.some((p) => p.color !== void 0)) return null;
  return group(points, (d) => d.color);
}
function filterNA(points, naRm = false, geomName = "geom", fields = ["x", "y"]) {
  const isNA = (p) => {
    for (const f of fields) {
      const v = p[f];
      if (v == null) return true;
      if (typeof v === "number" && isNaN(v)) return true;
      if (v instanceof Date && isNaN(v.getTime())) return true;
    }
    return false;
  };
  let naCount = 0;
  const filtered = [];
  for (const p of points) {
    if (isNA(p)) {
      naCount++;
    } else {
      filtered.push(p);
    }
  }
  if (naCount > 0 && !naRm) {
    console.warn(
      `ggpbi: removed ${naCount} rows containing non-finite values (${geomName}).`
    );
  }
  return filtered;
}
function linetypeToDasharray(linetype) {
  switch (linetype) {
    case "dashed":
      return "6 4";
    case "dotted":
      return "2 3";
    case "dashdot":
      return "6 3 2 3";
    case "longdash":
      return "10 4";
    case "twodash":
      return "2 2 8 2";
    default:
      return null;
  }
}
function bandOffset(scale) {
  return typeof scale.bandwidth === "function" ? scale.bandwidth() / 2 : 0;
}
var symbolPlus = {
  draw(context, size) {
    const r = Math.sqrt(size / Math.PI);
    context.moveTo(0, -r);
    context.lineTo(0, r);
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
  }
};
var symbolXCross = {
  draw(context, size) {
    const r = Math.sqrt(size / Math.PI) * 0.707;
    context.moveTo(-r, -r);
    context.lineTo(r, r);
    context.moveTo(r, -r);
    context.lineTo(-r, r);
  }
};
var symbolAsterisk = {
  draw(context, size) {
    const r = Math.sqrt(size / Math.PI);
    const r2 = r * 0.707;
    context.moveTo(0, -r);
    context.lineTo(0, r);
    context.moveTo(-r, 0);
    context.lineTo(r, 0);
    context.moveTo(-r2, -r2);
    context.lineTo(r2, r2);
    context.moveTo(r2, -r2);
    context.lineTo(-r2, r2);
  }
};
var SHAPE_MAP = {
  // Filled (colour only — pch 19, 15, 17, 18)
  circle: { symbol: circle_default, category: "filled" },
  square: { symbol: square_default, category: "filled" },
  triangle: { symbol: triangle_default, category: "filled" },
  diamond: { symbol: diamond_default, category: "filled" },
  // Open (border only — pch 1, 0, 2, 5)
  circleOpen: { symbol: circle_default, category: "open" },
  squareOpen: { symbol: square_default, category: "open" },
  triangleOpen: { symbol: triangle_default, category: "open" },
  diamondOpen: { symbol: diamond_default, category: "open" },
  // Fill + Border (two-tone — pch 21, 22, 24, 23)
  circleFilled: { symbol: circle_default, category: "fillBorder" },
  squareFilled: { symbol: square_default, category: "fillBorder" },
  triangleFilled: { symbol: triangle_default, category: "fillBorder" },
  diamondFilled: { symbol: diamond_default, category: "fillBorder" },
  // Line shapes (stroke only — pch 3, 4, 8, 11)
  plus: { symbol: symbolPlus, category: "line" },
  cross: { symbol: symbolXCross, category: "line" },
  asterisk: { symbol: symbolAsterisk, category: "line" },
  star: { symbol: star_default, category: "line" }
};
function getShapeInfo(shape) {
  if (!shape) return SHAPE_MAP.circle;
  return SHAPE_MAP[shape] ?? SHAPE_MAP.circle;
}

// src/geoms/point.ts
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function resolveColour(d, colorScale, defaultColor) {
  if (d.color && colorScale) return colorScale(d.color);
  return defaultColor;
}
function svgFill(d, colorScale, defaultColor, defaultFill, defaultShape) {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case "filled":
      return resolveColour(d, colorScale, defaultColor);
    case "open":
      return "none";
    case "fillBorder":
      return d.fill ?? defaultFill;
    case "line":
      return "none";
  }
}
function svgStroke(d, colorScale, defaultColor, defaultShape) {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case "filled":
      return null;
    case "open":
      return resolveColour(d, colorScale, defaultColor);
    case "fillBorder":
      return resolveColour(d, colorScale, defaultColor);
    case "line":
      return resolveColour(d, colorScale, defaultColor);
  }
}
function svgStrokeWidth(d, defaultStrokeWidth, defaultShape) {
  const cat = getShapeInfo(d.shape ?? defaultShape).category;
  switch (cat) {
    case "filled":
      return null;
    case "open":
      return 1.5;
    case "fillBorder":
      return defaultStrokeWidth;
    case "line":
      return 1.5;
  }
}
function pointsToScene(points, xScale, yScale, config, colorScale) {
  if (points.length === 0) return [];
  const filtered = filterNA(points, config.naRm, "geom_point");
  if (filtered.length === 0) return [];
  const defaultSize = config.size ?? 4;
  const defaultAlpha = config.alpha ?? 0.8;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const defaultShape = config.shape ?? "circle";
  const defaultFill = config.fill ?? "#FFFFFF";
  const defaultStrokeWidth = config.strokeWidth ?? 0.5;
  const isJitter = config.position === "jitter";
  const jitterW = config.jitterWidth ?? 0.4;
  const jitterH = config.jitterHeight ?? 0;
  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const isBandX = typeof xScale.bandwidth === "function";
  const isBandY = typeof yScale.bandwidth === "function";
  const rng = isJitter ? mulberry32(42) : void 0;
  const jitterXOffsets = [];
  const jitterYOffsets = [];
  if (isJitter) {
    const xJitterRange = isBandX ? xScale.bandwidth() * jitterW : jitterW * 20;
    const yJitterRange = isBandY ? yScale.bandwidth() * jitterH : jitterH * 20;
    for (let i = 0; i < filtered.length; i++) {
      jitterXOffsets.push((rng() - 0.5) * xJitterRange);
      jitterYOffsets.push(yJitterRange > 0 ? (rng() - 0.5) * yJitterRange : 0);
    }
  }
  const symbolGen = Symbol2().type((d) => getShapeInfo(d.shape ?? defaultShape).symbol).size((d) => {
    const r = d.size ?? defaultSize;
    return Math.PI * r * r;
  });
  const nodes = [];
  for (let i = 0; i < filtered.length; i++) {
    const d = filtered[i];
    const xPos = xScale(d.x) + xBandOffset + (isJitter ? jitterXOffsets[i] : 0);
    const yPos = yScale(d.y) + yBandOffset + (isJitter ? jitterYOffsets[i] : 0);
    const pathD = symbolGen(d) ?? "";
    const fill = svgFill(d, colorScale, defaultColor, defaultFill, defaultShape);
    const stroke = svgStroke(d, colorScale, defaultColor, defaultShape);
    const strokeWidth = svgStrokeWidth(d, defaultStrokeWidth, defaultShape);
    const opacity = d.alpha ?? defaultAlpha;
    const style = { fill, opacity };
    if (stroke != null) style.stroke = stroke;
    if (strokeWidth != null) style.strokeWidth = strokeWidth;
    const xVal = typeof d.x === "number" ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === "number" ? d.y.toLocaleString() : String(d.y);
    nodes.push({
      type: "path",
      class: "ggpbi-point",
      d: pathD,
      transform: `translate(${xPos},${yPos})`,
      style,
      aria: { role: "listitem", tabindex: "0", label: `${xVal}: ${yVal}` },
      data: d
    });
  }
  return nodes;
}

// src/geoms/line.ts
function splitAtNA(points) {
  const segments = [];
  let current = [];
  for (const p of points) {
    const isNA = p.x == null || p.y == null || typeof p.x === "number" && isNaN(p.x) || typeof p.y === "number" && isNaN(p.y);
    if (isNA) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}
function linesToScene(points, xScale, yScale, config, colorScale) {
  if (points.length === 0) return [];
  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? "butt";
  const linejoin = config.linejoin ?? "round";
  const linemitre = config.linemitre ?? 10;
  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const isBandY = typeof yScale.bandwidth === "function";
  const line = line_default().x((d) => xScale(d.x) + xBandOffset).y((d) => yScale(d.y) + yBandOffset);
  const buildStyle = (color2) => {
    const style = {
      fill: "none",
      stroke: color2,
      strokeWidth,
      opacity: defaultAlpha,
      strokeLinecap: lineend,
      strokeLinejoin: linejoin
    };
    if (linejoin === "miter") {
      style.strokeMiterlimit = linemitre;
    }
    if (dasharray) {
      style.strokeDasharray = dasharray;
    }
    return style;
  };
  const showArrow = config.arrowShow ?? false;
  const arrowEnds = config.arrowEnds ?? "last";
  const arrowAngle = config.arrowAngle ?? 30;
  const arrowLength = config.arrowLength ?? 8;
  const arrowType = config.arrowType ?? "open";
  let arrowCounter = 0;
  const buildMarker = (color2, end) => {
    const safeColor = color2.replace(/[^a-zA-Z0-9]/g, "");
    const fillColor = config.arrowFill ?? (arrowType === "closed" ? color2 : "none");
    return {
      id: `ggpbi-arrow-${end}-${safeColor}-${arrowCounter}`,
      angle: arrowAngle,
      length: arrowLength,
      color: color2,
      fill: fillColor,
      type: arrowType
    };
  };
  const buildSegments = (pts, color2) => {
    const sorted = sortByX(pts);
    const segments = config.naRm ? [filterNA(sorted, true, "geom_line")] : splitAtNA(sorted);
    const nodes = [];
    for (const segment of segments) {
      if (segment.length < 2) continue;
      const pathD = line(segment) ?? "";
      if (!pathD) continue;
      const pathNode = {
        type: "path",
        class: "ggpbi-line",
        d: pathD,
        style: buildStyle(color2),
        data: segment[0]
        // first point as representative
      };
      nodes.push(pathNode);
    }
    if (showArrow && nodes.length > 0) {
      if (arrowEnds === "last" || arrowEnds === "both") {
        nodes[nodes.length - 1].markerEnd = buildMarker(color2, "end");
      }
      if (arrowEnds === "first" || arrowEnds === "both") {
        nodes[0].markerStart = buildMarker(color2, "start");
      }
      arrowCounter++;
    }
    return nodes;
  };
  const hasColor = points.some((p) => p.color !== void 0);
  const hasGroup = points.some((p) => p.group !== void 0);
  const groupKey = (p) => {
    const parts = [];
    if (hasGroup) parts.push(`group:${String(p.group)}`);
    if (hasColor) parts.push(`color:${String(p.color)}`);
    if (isBandY) parts.push(`y:${String(p.y)}`);
    return parts.join("|") || "__all";
  };
  const result = [];
  const groups2 = group(points, groupKey);
  for (const groupPoints of groups2.values()) {
    const first = groupPoints[0];
    const color2 = hasColor && first.color !== void 0 && colorScale ? colorScale(String(first.color)) : defaultColor;
    result.push(...buildSegments(groupPoints, color2));
  }
  return result;
}

// src/geoms/bar.ts
function computeBarStyle(d, config, colorScale) {
  const defaultAlpha = config.alpha ?? 0.85;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const stroke = config.stroke ?? null;
  const strokeWidth = config.strokeWidth ?? 0;
  const dasharray = linetypeToDasharray(config.linetype);
  const fill = d.color && colorScale ? colorScale(d.color) : defaultColor;
  const opacity = d.alpha ?? defaultAlpha;
  const style = { fill, opacity };
  if (stroke) {
    style.stroke = stroke;
  }
  if (strokeWidth > 0) {
    style.strokeWidth = strokeWidth;
    if (!stroke) style.stroke = "#333333";
  }
  if (dasharray) {
    style.strokeDasharray = dasharray;
  }
  if (strokeWidth > 0 || stroke) {
    style.strokeLinecap = config.lineend ?? "butt";
    style.strokeLinejoin = config.linejoin ?? "miter";
    if ((config.linejoin ?? "miter") === "miter") {
      style.strokeMiterlimit = config.linemitre ?? 10;
    }
  }
  return style;
}
function barAriaLabel(d, isHorizontal) {
  const xVal = typeof d.x === "number" ? d.x.toLocaleString() : String(d.x);
  const yVal = typeof d.y === "number" ? d.y.toLocaleString() : String(d.y);
  return isHorizontal ? `${yVal}: ${xVal}` : `${xVal}: ${yVal}`;
}
function barsToScene(points, xScale, yScale, config, colorScale, innerWidth) {
  const isHorizontal = config.orientation === "y";
  const barPoints = filterNA(
    points,
    config.naRm,
    "geom_bar",
    isHorizontal ? ["x"] : ["y"]
  );
  if (barPoints.length === 0) return [];
  const position = config.position ?? "stack";
  const widthFraction = config.width ?? 0.9;
  const just = config.just ?? 0.5;
  const catScale = isHorizontal ? yScale : xScale;
  const valScale = isHorizontal ? xScale : yScale;
  const isBand = typeof catScale.bandwidth === "function";
  const catGroups = group(barPoints, (d) => String(isHorizontal ? d.y : d.x));
  const nCategories = catGroups.size || barPoints.length;
  const baseBandWidth = isBand ? catScale.bandwidth() * widthFraction : innerWidth ? Math.max(1, innerWidth / nCategories * 0.8 * widthFraction) : 20;
  const bandSpace = isBand ? catScale.bandwidth() : baseBandWidth;
  const justOffset = (bandSpace - baseBandWidth) * just;
  const barCatPos = (d) => {
    const catVal = isHorizontal ? d.y : d.x;
    const pos = catScale(catVal);
    return isBand ? pos + justOffset : pos - baseBandWidth * just;
  };
  const valZero = (() => {
    try {
      return valScale(0);
    } catch {
      return isHorizontal ? 0 : valScale.range()[0];
    }
  })();
  const nodes = [];
  let dodgeWidth = baseBandWidth;
  let dodgePadding = 0;
  if (position === "dodge" || position === "dodge2") {
    const sample = barPoints[0];
    const nColors = sample._dodgeN ?? 1;
    const padded = sample._dodgePadded ?? false;
    dodgePadding = padded ? baseBandWidth / nColors * 0.1 : 0;
    dodgeWidth = (baseBandWidth - dodgePadding * (nColors - 1)) / nColors;
  }
  for (const d of barPoints) {
    const style = computeBarStyle(d, config, colorScale);
    const aria = { role: "listitem", tabindex: "0", label: barAriaLabel(d, isHorizontal) };
    let x2, y2, width, height;
    if (position === "dodge" || position === "dodge2") {
      const catPos = barCatPos(d) + (d._dodgeIndex ?? 0) * (dodgeWidth + dodgePadding);
      if (isHorizontal) {
        x2 = Math.min(valScale(d.x), valZero);
        y2 = catPos;
        width = Math.abs(valScale(d.x) - valZero);
        height = dodgeWidth;
      } else {
        x2 = catPos;
        y2 = Math.min(valScale(d.y), valZero);
        width = dodgeWidth;
        height = Math.abs(valScale(d.y) - valZero);
      }
    } else if (position === "stack" || position === "fill") {
      const v0 = d._v0 ?? 0;
      const v1 = d._v1 ?? 0;
      if (isHorizontal) {
        x2 = Math.min(valScale(v0), valScale(v1));
        y2 = barCatPos(d);
        width = Math.abs(valScale(v0) - valScale(v1));
        height = baseBandWidth;
      } else {
        x2 = barCatPos(d);
        y2 = valScale(v1);
        width = baseBandWidth;
        height = Math.abs(valScale(v0) - valScale(v1));
      }
    } else {
      if (isHorizontal) {
        x2 = Math.min(valScale(d.x), valZero);
        y2 = barCatPos(d);
        width = Math.abs(valScale(d.x) - valZero);
        height = baseBandWidth;
      } else {
        const yVal = valScale(d.y);
        x2 = barCatPos(d);
        y2 = Math.min(yVal, valZero);
        width = baseBandWidth;
        height = Math.abs(yVal - valZero);
      }
    }
    nodes.push({ type: "rect", class: "ggpbi-bar", x: x2, y: y2, width, height, style, aria, data: d });
  }
  return nodes;
}

// src/geoms/area.ts
function areaToScene(points, xScale, yScale, config, colorScale) {
  const areaPoints = filterNA(points, config.naRm, "geom_area");
  if (areaPoints.length === 0) return [];
  const defaultAlpha = config.alpha ?? 0.3;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const bw = bandOffset(xScale);
  const area = area_default().x((d) => xScale(d.x) + bw).y0(yScale(0)).y1((d) => yScale(d.y));
  const buildNode = (pts, color2) => {
    const sorted = sortByX(pts);
    const pathD = area(sorted) ?? "";
    if (!pathD) return null;
    const style = {
      fill: color2,
      opacity: defaultAlpha
    };
    return {
      type: "path",
      class: "ggpbi-area",
      d: pathD,
      style,
      data: sorted[0]
      // first point as representative
    };
  };
  const result = [];
  const groups2 = groupByColor(areaPoints);
  if (groups2) {
    groups2.forEach((groupPoints, key) => {
      const color2 = colorScale ? colorScale(String(key)) : defaultColor;
      const node = buildNode(groupPoints, color2);
      if (node) result.push(node);
    });
  } else {
    const node = buildNode(areaPoints, defaultColor);
    if (node) result.push(node);
  }
  return result;
}

// src/geoms/text.ts
function renderLabelTemplate(template, d) {
  return template.replace(/\{(label|x|y)(?::([^}]+))?\}/g, (_m, key, spec) => {
    const v = d[key];
    if (v == null) return "";
    if (spec && typeof v === "number") {
      try {
        return format(spec)(v);
      } catch {
        return String(v);
      }
    }
    return String(v);
  });
}
var REPEL_MAX_LABELS = 250;
function repelLayout(boxes, anchors, innerWidth, innerHeight, placed = []) {
  const PAD = 3;
  const POINT_R = 6;
  const DIRS = [
    [0, -1],
    [0, 1],
    [1, 0],
    [-1, 0],
    [0.7071, -0.7071],
    [-0.7071, -0.7071],
    [0.7071, 0.7071],
    [-0.7071, 0.7071]
  ];
  const overlapArea = (b, x2, y2) => {
    let area = 0;
    for (const o of placed) {
      const ox = Math.max(0, (b.w + o.w) / 2 + PAD - Math.abs(x2 - o.x));
      const oy = Math.max(0, (b.h + o.h) / 2 + PAD - Math.abs(y2 - o.y));
      area += ox * oy;
    }
    for (const p of anchors) {
      const ox = Math.max(0, b.w / 2 + POINT_R - Math.abs(x2 - p.x));
      const oy = Math.max(0, b.h / 2 + POINT_R - Math.abs(y2 - p.y));
      area += ox * oy;
    }
    return area;
  };
  for (const b of boxes) {
    let best = null;
    outer:
      for (const ring of [1.4, 2.2, 3.2, 4.5, 6.5, 9, 12]) {
        for (const [dx, dy] of DIRS) {
          const r = ring * b.fontSize;
          let x2 = b.ax + dx * (r + (dx !== 0 ? b.w / 2 - b.fontSize : 0));
          let y2 = b.ay + dy * r;
          x2 = Math.min(Math.max(x2, b.w / 2), innerWidth - b.w / 2);
          y2 = Math.min(Math.max(y2, b.h / 2), innerHeight - b.h / 2);
          const area = overlapArea(b, x2, y2);
          if (area === 0) {
            best = { x: x2, y: y2, area };
            break outer;
          }
          if (!best || area < best.area) best = { x: x2, y: y2, area };
        }
      }
    if (best && best.area === 0) {
      b.x = best.x;
      b.y = best.y;
      placed.push(b);
    } else {
      b.hidden = true;
    }
  }
}
function boxEntryPoint(b) {
  const dx = b.x - b.ax;
  const dy = b.y - b.ay;
  const tx = dx !== 0 ? 1 - (b.w / 2 + 1) / Math.abs(dx) : 0;
  const ty = dy !== 0 ? 1 - (b.h / 2 + 1) / Math.abs(dy) : 0;
  const t = Math.max(0, Math.min(1, Math.max(tx, ty)));
  return { x: b.ax + t * dx, y: b.ay + t * dy };
}
function textToScene(points, xScale, yScale, config, colorScale, innerWidth = 0, innerHeight = 0, shared) {
  const textPoints = filterNA(points, config.naRm, "geom_text");
  if (textPoints.length === 0) return [];
  const defaultColor = config.color ?? "#333333";
  const defaultSize = config.size ?? 12;
  const configAnchor = config.textAnchor ?? "middle";
  const angle = config.angle ?? 0;
  const fontFamily = config.fontFamily ?? "sans-serif";
  const configDy = config.dy ?? "0.35em";
  const xBandOffset = bandOffset(xScale);
  const yBandOffset = bandOffset(yScale);
  const hasExplicitLabel = textPoints.some((p) => Object.prototype.hasOwnProperty.call(p, "label"));
  const labelOf = (d) => config.labelTemplate ? renderLabelTemplate(config.labelTemplate, d) : String(d.label ?? d.y ?? "");
  const occupied = [];
  const emOf = (dy) => {
    const m = /^(-?[\d.]+)em$/.exec(dy.trim());
    return m ? Number(m[1]) : 0;
  };
  if (config.repel) {
    const anchors = [];
    const boxes = [];
    for (const d of textPoints) {
      const ax = xScale(d.x) + xBandOffset;
      const ay = yScale(d.y) + yBandOffset;
      if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;
      anchors.push({ x: ax, y: ay });
      if (hasExplicitLabel && (d.label == null || d.label === "")) continue;
      const fontSize = d.size ?? defaultSize;
      const label = labelOf(d);
      boxes.push({
        x: ax,
        y: ay - fontSize * 1.2,
        w: label.length * fontSize * 0.62 + 6,
        h: fontSize * 1.3,
        ax,
        ay,
        prefY: ay - fontSize * 1.2,
        d,
        label,
        fontSize
      });
    }
    if (boxes.length > REPEL_MAX_LABELS) {
      console.warn(`ggpbi: repel \u2014 ${boxes.length} labels exceed ${REPEL_MAX_LABELS}, showing only non-overlapping ones.`);
      const kept = [];
      for (const b of boxes) {
        const collides = kept.some((o) => Math.abs(b.x - o.x) < (b.w + o.w) / 2 + 2 && Math.abs(b.y - o.y) < (b.h + o.h) / 2 + 2);
        if (collides) b.hidden = true;
        else kept.push(b);
      }
    } else {
      const avoidAnchors = shared ? [...shared.repelAnchors, ...anchors] : anchors;
      repelLayout(boxes, avoidAnchors, innerWidth, innerHeight, shared?.repelPlaced ?? []);
      shared?.repelAnchors.push(...anchors);
      const dropped = boxes.filter((b) => b.hidden).length;
      if (dropped > 0) {
        console.warn(`ggpbi: repel \u2014 ${dropped} unlabeled data points (no room). Enlarge the visual or filter the data.`);
      }
    }
    const out = [];
    for (const b of boxes) {
      if (b.hidden) continue;
      const dist = Math.hypot(b.x - b.ax, b.y - b.ay);
      if (dist > b.fontSize * 1.8) {
        const entry = boxEntryPoint(b);
        out.push({
          type: "line",
          class: "ggpbi-text-segment",
          x1: b.ax,
          y1: b.ay,
          x2: entry.x,
          y2: entry.y,
          style: { stroke: "#999999", strokeWidth: 0.5, opacity: 0.8 }
        });
      }
    }
    for (const b of boxes) {
      if (b.hidden) continue;
      const fill = b.d.color !== void 0 && colorScale ? colorScale(String(b.d.color)) : defaultColor;
      out.push({
        type: "text",
        class: "ggpbi-text",
        x: b.x,
        y: b.y,
        text: b.label,
        textAnchor: "middle",
        dy: "0.35em",
        fontSize: b.fontSize,
        fontFamily,
        style: { fill },
        aria: { role: "listitem", tabindex: "0", label: b.label },
        data: b.d
      });
    }
    return out;
  }
  const nodes = [];
  for (const d of textPoints) {
    if (hasExplicitLabel && (d.label == null || d.label === "")) continue;
    const xPos = xScale(d.x) + xBandOffset;
    const yPos = yScale(d.y) + yBandOffset;
    const textAnchor = config.hjust === "inward" ? xPos < innerWidth / 2 ? "start" : "end" : configAnchor;
    const dy = config.vjust === "inward" ? yPos < innerHeight / 2 ? "1.1em" : "-0.5em" : configDy;
    if (config.checkOverlap) {
      const fontSize = d.size ?? defaultSize;
      const label = labelOf(d);
      const w = label.length * fontSize * 0.6;
      const x0 = textAnchor === "start" ? xPos : textAnchor === "end" ? xPos - w : xPos - w / 2;
      const cy = yPos + emOf(dy) * fontSize;
      const box = { x0, x1: x0 + w, y0: cy - fontSize * 0.8, y1: cy + fontSize * 0.2 };
      const pad2 = 1;
      const collides = occupied.some((o) => box.x0 - pad2 < o.x1 && box.x1 + pad2 > o.x0 && box.y0 - pad2 < o.y1 && box.y1 + pad2 > o.y0);
      if (collides) continue;
      occupied.push(box);
    }
    const fill = d.color !== void 0 && colorScale ? colorScale(String(d.color)) : defaultColor;
    const style = { fill };
    const xVal = typeof d.x === "number" ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === "number" ? d.y.toLocaleString() : String(d.y);
    const node = {
      type: "text",
      class: "ggpbi-text",
      x: xPos,
      y: yPos,
      text: labelOf(d),
      textAnchor,
      dy,
      fontSize: d.size ?? defaultSize,
      fontFamily,
      style,
      aria: { role: "listitem", tabindex: "0", label: `${xVal}: ${yVal}` },
      data: d
    };
    if (angle !== 0) {
      node.transform = `rotate(${angle}, ${xPos}, ${yPos})`;
    }
    nodes.push(node);
  }
  return nodes;
}

// src/stats.ts
var STAT_COUNT_FIELD = "__count";
function statCount(data, xField, colorField, weightField) {
  const groups2 = /* @__PURE__ */ new Map();
  for (const row of data) {
    const xVal = row[xField];
    const colorVal = colorField ? row[colorField] : void 0;
    const key = colorVal !== void 0 ? `${xVal}|||${colorVal}` : String(xVal);
    if (!groups2.has(key)) {
      groups2.set(key, { count: 0, weightSum: 0, representative: row });
    }
    const entry = groups2.get(key);
    entry.count++;
    if (weightField) {
      entry.weightSum += Number(row[weightField]) || 0;
    }
  }
  const result = [];
  for (const [, entry] of groups2) {
    result.push({
      ...entry.representative,
      [STAT_COUNT_FIELD]: weightField ? entry.weightSum : entry.count
    });
  }
  return result;
}
function computeBoxplotStats(points, coef = 1.5, naRm = false) {
  const byGroup = group(
    points,
    (d) => `${String(d.x)}\0${String(d.color ?? "__none__")}`
  );
  const result = [];
  for (const [, group2] of byGroup) {
    const x2 = group2[0]?.x;
    const color2 = group2[0]?.color;
    const validPoints = [];
    let naCount = 0;
    for (const p of group2) {
      const y2 = Number(p.y);
      if (Number.isNaN(y2) || p.y == null) {
        naCount++;
      } else {
        validPoints.push(p);
      }
    }
    if (!naRm && naCount > 0) {
      console.warn(
        `ggpbi: removed ${naCount} rows containing non-finite values (stat_boxplot).`
      );
    }
    if (validPoints.length === 0) continue;
    const ys = validPoints.map((d) => Number(d.y)).sort(ascending);
    const n = ys.length;
    const q1 = quantileSorted(ys, 0.25);
    const median = quantileSorted(ys, 0.5);
    const q3 = quantileSorted(ys, 0.75);
    const iqr = q3 - q1;
    let whiskerLow;
    let whiskerHigh;
    let outliers;
    if (!isFinite(coef) || coef === Infinity) {
      whiskerLow = ys[0];
      whiskerHigh = ys[n - 1];
      outliers = [];
    } else {
      const lowFence = q1 - coef * iqr;
      const highFence = q3 + coef * iqr;
      whiskerLow = ys.find((v) => v >= lowFence) ?? q1;
      whiskerHigh = [...ys].reverse().find((v) => v <= highFence) ?? q3;
      outliers = validPoints.filter((d) => {
        const y2 = Number(d.y);
        return y2 < whiskerLow || y2 > whiskerHigh;
      });
    }
    const notchSpread = 1.58 * iqr / Math.sqrt(n);
    const notchLower = median - notchSpread;
    const notchUpper = median + notchSpread;
    result.push({
      x: x2,
      color: color2,
      n,
      q1,
      median,
      q3,
      iqr,
      whiskerLow,
      whiskerHigh,
      notchLower,
      notchUpper,
      outliers
    });
  }
  return result;
}
var STAT_BIN_COUNT = "__bin_count";
var STAT_BIN_DENSITY = "__bin_density";
var STAT_BIN_NCOUNT = "__bin_ncount";
var STAT_BIN_NDENSITY = "__bin_ndensity";
var STAT_BIN_WIDTH = "__bin_width";
var STAT_BIN_X = "__bin_x";
var STAT_BIN_XMIN = "__bin_xmin";
var STAT_BIN_XMAX = "__bin_xmax";
function binBreaksBins(xMin, xMax, bins, center2, boundary) {
  const range2 = xMax - xMin;
  if (range2 === 0) {
    return binBreaksWidth(xMin, xMax, 0.1, center2, boundary);
  }
  if (bins === 1) {
    return binBreaksWidth(xMin, xMax, range2, center2, xMin);
  }
  const width = range2 / (bins - 1);
  const effectiveBoundary = boundary ?? (center2 != null ? center2 - width / 2 : void 0);
  return binBreaksWidth(xMin, xMax, width, center2, effectiveBoundary);
}
function binBreaksWidth(xMin, xMax, width, center2, boundary) {
  if (width <= 0) throw new Error("ggpbi: binwidth must be positive");
  let bnd;
  if (boundary != null && center2 != null) {
    bnd = center2 - width / 2;
  } else if (center2 != null) {
    bnd = center2 - width / 2;
  } else if (boundary != null) {
    bnd = boundary;
  } else {
    bnd = 0;
  }
  const origin = bnd + Math.floor((xMin - bnd) / width) * width;
  const nBins = Math.ceil((xMax - origin) / width) + 1;
  if (nBins > 1e6) {
    throw new Error(`ggpbi: stat_bin would produce ${nBins} bins \u2014 binwidth too small`);
  }
  const breaks = [];
  for (let i = 0; i <= nBins; i++) {
    breaks.push(origin + i * width);
  }
  if (breaks.length === 1) {
    breaks.push(breaks[0] + width);
  }
  return breaks;
}
function computeBinBreaks(xs, params) {
  if (xs.length === 0) return [];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  if (params.breaks && params.breaks.length > 0) {
    return [...params.breaks].sort((a, b) => a - b);
  }
  if (params.binwidth != null) {
    return binBreaksWidth(xMin, xMax, params.binwidth, params.center, params.boundary);
  }
  const nBins = params.bins ?? 30;
  return binBreaksBins(xMin, xMax, nBins, params.center, params.boundary);
}
function statBin(data, xField, params = {}, colorField, weightField) {
  const validRows = [];
  for (const row of data) {
    const raw = row[xField];
    if (raw == null) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) continue;
    validRows.push({ row, x: v });
  }
  if (validRows.length === 0) return [];
  const groups2 = /* @__PURE__ */ new Map();
  for (const vr of validRows) {
    const key = colorField ? String(vr.row[colorField]) : "__all__";
    if (!groups2.has(key)) groups2.set(key, { rows: [] });
    groups2.get(key).rows.push(vr);
  }
  const allXs = validRows.map((vr) => vr.x);
  const breaks = computeBinBreaks(allXs, params);
  if (breaks.length < 2) return [];
  const closed = params.closed ?? "right";
  const pad2 = params.pad ?? false;
  const drop = params.drop ?? "none";
  const diffs = [];
  for (let i = 1; i < breaks.length; i++) {
    diffs.push(breaks[i] - breaks[i - 1]);
  }
  diffs.sort((a, b) => a - b);
  const medianDiff = diffs.length > 0 ? diffs.length % 2 === 0 ? (diffs[diffs.length / 2 - 1] + diffs[diffs.length / 2]) / 2 : diffs[Math.floor(diffs.length / 2)] : 0;
  const fuzz = Number.isFinite(medianDiff) && medianDiff > 0 ? 1e-8 * medianDiff : Number.EPSILON * 1e3;
  const fuzzyBreaks = breaks.map((b, i) => {
    if (closed === "right") {
      return i === 0 ? b - fuzz : b + fuzz;
    } else {
      return i === breaks.length - 1 ? b + fuzz : b - fuzz;
    }
  });
  const result = [];
  for (const [groupKey, group2] of groups2) {
    const nBins = breaks.length - 1;
    const counts = new Array(nBins).fill(0);
    for (const vr of group2.rows) {
      const x2 = vr.x;
      const w = weightField ? Number(vr.row[weightField]) || 0 : 1;
      let binIdx = -1;
      if (closed === "right") {
        for (let i = 0; i < nBins; i++) {
          if (x2 > fuzzyBreaks[i] && x2 <= fuzzyBreaks[i + 1]) {
            binIdx = i;
            break;
          }
        }
      } else {
        for (let i = 0; i < nBins; i++) {
          if (x2 >= fuzzyBreaks[i] && x2 < fuzzyBreaks[i + 1]) {
            binIdx = i;
            break;
          }
        }
      }
      if (binIdx === -1) {
        if (x2 <= fuzzyBreaks[0]) binIdx = 0;
        else if (x2 >= fuzzyBreaks[nBins]) binIdx = nBins - 1;
      }
      if (binIdx >= 0 && binIdx < nBins) {
        counts[binIdx] += w;
      }
    }
    const totalCount = counts.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...counts);
    const binWidths = [];
    const binMidpoints = [];
    for (let i = 0; i < nBins; i++) {
      binWidths.push(breaks[i + 1] - breaks[i]);
      binMidpoints.push((breaks[i] + breaks[i + 1]) / 2);
    }
    const densities = counts.map((c, i) => totalCount > 0 ? c / totalCount / binWidths[i] : 0);
    const maxDensity = Math.max(...densities);
    const groupResult = [];
    for (let i = 0; i < nBins; i++) {
      const count = counts[i];
      const density2 = densities[i];
      const ncount = maxCount > 0 ? count / maxCount : 0;
      const ndensity = maxDensity > 0 ? density2 / maxDensity : 0;
      const row = {
        [STAT_BIN_X]: binMidpoints[i],
        [STAT_BIN_XMIN]: breaks[i],
        [STAT_BIN_XMAX]: breaks[i + 1],
        [STAT_BIN_COUNT]: count,
        [STAT_BIN_DENSITY]: density2,
        [STAT_BIN_NCOUNT]: ncount,
        [STAT_BIN_NDENSITY]: ndensity,
        [STAT_BIN_WIDTH]: binWidths[i],
        [xField]: binMidpoints[i]
      };
      if (colorField && groupKey !== "__all__") {
        row[colorField] = groupKey;
      }
      groupResult.push(row);
    }
    if (pad2 && nBins > 0) {
      const firstWidth = binWidths[0];
      const lastWidth = binWidths[nBins - 1];
      const padRow = (x2, xmin, xmax, w) => {
        const r = {
          [STAT_BIN_X]: x2,
          [STAT_BIN_XMIN]: xmin,
          [STAT_BIN_XMAX]: xmax,
          [STAT_BIN_COUNT]: 0,
          [STAT_BIN_DENSITY]: 0,
          [STAT_BIN_NCOUNT]: 0,
          [STAT_BIN_NDENSITY]: 0,
          [STAT_BIN_WIDTH]: w,
          [xField]: x2
        };
        if (colorField && groupKey !== "__all__") {
          r[colorField] = groupKey;
        }
        return r;
      };
      const padXmin = breaks[0] - firstWidth;
      groupResult.unshift(
        padRow(padXmin + firstWidth / 2, padXmin, breaks[0], firstWidth)
      );
      const padXmax = breaks[nBins] + lastWidth;
      groupResult.push(
        padRow(breaks[nBins] + lastWidth / 2, breaks[nBins], padXmax, lastWidth)
      );
    }
    if (drop === "all") {
      result.push(...groupResult.filter((row) => Number(row[STAT_BIN_COUNT]) !== 0));
    } else if (drop === "extremes") {
      const firstNonEmpty = groupResult.findIndex((row) => Number(row[STAT_BIN_COUNT]) !== 0);
      let lastNonEmpty = groupResult.length - 1;
      while (lastNonEmpty >= 0 && Number(groupResult[lastNonEmpty][STAT_BIN_COUNT]) === 0) {
        lastNonEmpty--;
      }
      if (firstNonEmpty >= 0) {
        result.push(...groupResult.slice(firstNonEmpty, lastNonEmpty + 1));
      }
    } else {
      result.push(...groupResult);
    }
  }
  return result;
}
var STAT_SMOOTH_X = "__smooth_x";
var STAT_SMOOTH_Y = "__smooth_y";
var STAT_SMOOTH_YMIN = "__smooth_ymin";
var STAT_SMOOTH_YMAX = "__smooth_ymax";
var STAT_SMOOTH_SE = "__smooth_se";
function tricube(u) {
  const absU = Math.abs(u);
  if (absU >= 1) return 0;
  const t = 1 - absU * absU * absU;
  return t * t * t;
}
function loessFit(xs, ys, evalPoints, span) {
  const n = xs.length;
  const bandwidth = Math.max(3, Math.ceil(span * n));
  const fitted = [];
  const seValues = [];
  let hatTrace = 0;
  const fittedAtData = new Array(n);
  const hatDiag = new Array(n);
  for (let di = 0; di < n; di++) {
    const xEval = xs[di];
    const dists = xs.map((x2, i) => ({ dist: Math.abs(x2 - xEval), idx: i }));
    dists.sort((a, b) => a.dist - b.dist);
    const neighbours = dists.slice(0, bandwidth);
    const maxDist = neighbours[neighbours.length - 1].dist || 1;
    const weights = neighbours.map((nb) => tricube(nb.dist / (maxDist * 1.0001)));
    const result = weightedPolyFit(neighbours, weights, xs, ys, xEval, 2);
    fittedAtData[di] = result.yPred;
    const selfIdx = neighbours.findIndex((nb) => nb.idx === di);
    hatDiag[di] = selfIdx >= 0 ? weights[selfIdx] / (weights.reduce((s, w) => s + w, 0) || 1) : 0;
    hatTrace += hatDiag[di];
  }
  const effectiveDf = Math.max(1, n - hatTrace);
  let ssResid = 0;
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - fittedAtData[i];
    ssResid += resid * resid;
  }
  const sigma2 = effectiveDf > 0 ? ssResid / effectiveDf : 0;
  for (const xEval of evalPoints) {
    const dists = xs.map((x2, i) => ({ dist: Math.abs(x2 - xEval), idx: i }));
    dists.sort((a, b) => a.dist - b.dist);
    const neighbours = dists.slice(0, bandwidth);
    const maxDist = neighbours[neighbours.length - 1].dist || 1;
    const weights = neighbours.map((nb) => tricube(nb.dist / (maxDist * 1.0001)));
    const result = weightedPolyFit(neighbours, weights, xs, ys, xEval, 2);
    fitted.push(result.yPred);
    const sumW = weights.reduce((s, w) => s + w, 0);
    const se = Math.sqrt(sigma2 / Math.max(1, sumW));
    seValues.push(se);
  }
  return { fitted, se: seValues, effectiveDf };
}
function weightedPolyFit(neighbours, weights, xs, ys, xEval, degree) {
  const p = degree + 1;
  const XtWX = Array.from({ length: p }, () => new Array(p).fill(0));
  const XtWy = new Array(p).fill(0);
  for (let j = 0; j < neighbours.length; j++) {
    const idx = neighbours[j].idx;
    const w = weights[j];
    const xi = xs[idx];
    const yi = ys[idx];
    const xvec = new Array(p);
    xvec[0] = 1;
    for (let k = 1; k < p; k++) {
      xvec[k] = xvec[k - 1] * xi;
    }
    for (let r = 0; r < p; r++) {
      for (let c = 0; c < p; c++) {
        XtWX[r][c] += w * xvec[r] * xvec[c];
      }
      XtWy[r] += w * xvec[r] * yi;
    }
  }
  const beta = solveLinearSystem(XtWX, XtWy, p);
  let yPred = beta[0];
  let xPow = 1;
  for (let k = 1; k < p; k++) {
    xPow *= xEval;
    yPred += beta[k] * xPow;
  }
  return { yPred };
}
function solveLinearSystem(A, b, n) {
  const a = A.map((row) => [...row]);
  const rhs = [...b];
  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(a[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > maxVal) {
        maxVal = Math.abs(a[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [a[col], a[maxRow]] = [a[maxRow], a[col]];
      [rhs[col], rhs[maxRow]] = [rhs[maxRow], rhs[col]];
    }
    if (Math.abs(a[col][col]) < 1e-15) {
      continue;
    }
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let c = col; c < n; c++) {
        a[row][c] -= factor * a[col][c];
      }
      rhs[row] -= factor * rhs[col];
    }
  }
  const x2 = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    if (Math.abs(a[row][row]) < 1e-15) continue;
    let sum = rhs[row];
    for (let col = row + 1; col < n; col++) {
      sum -= a[row][col] * x2[col];
    }
    x2[row] = sum / a[row][row];
  }
  return x2;
}
function lmFit(xs, ys, evalPoints) {
  const n = xs.length;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let ssXX = 0, ssXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    ssXX += dx * dx;
    ssXY += dx * (ys[i] - meanY);
  }
  const slope = ssXX > 0 ? ssXY / ssXX : 0;
  const intercept = meanY - slope * meanX;
  let ssResid = 0;
  for (let i = 0; i < n; i++) {
    const resid = ys[i] - (intercept + slope * xs[i]);
    ssResid += resid * resid;
  }
  const mse = n > 2 ? ssResid / (n - 2) : 0;
  const fitted = evalPoints.map((x2) => intercept + slope * x2);
  const se = evalPoints.map((x2) => {
    const dx = x2 - meanX;
    return Math.sqrt(mse * (1 / n + dx * dx / ssXX));
  });
  return { fitted, se };
}
function movingAverageFit(xs, ys, evalPoints, windowSize) {
  const sorted = xs.map((x2, i) => ({ x: x2, y: ys[i] })).sort((a, b) => a.x - b.x);
  const sortedXs = sorted.map((d) => d.x);
  const sortedYs = sorted.map((d) => d.y);
  const n = sorted.length;
  const halfWin = Math.floor(windowSize / 2);
  const fitted = [];
  const seValues = [];
  for (const xEval of evalPoints) {
    let closestIdx = 0;
    let minDist = Math.abs(sortedXs[0] - xEval);
    for (let i = 1; i < n; i++) {
      const dist = Math.abs(sortedXs[i] - xEval);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }
    const lo = Math.max(0, closestIdx - halfWin);
    const hi = Math.min(n - 1, closestIdx + halfWin);
    let sum = 0;
    let count = 0;
    for (let i = lo; i <= hi; i++) {
      sum += sortedYs[i];
      count++;
    }
    const mean = sum / count;
    fitted.push(mean);
    let sumSq = 0;
    for (let i = lo; i <= hi; i++) {
      const d = sortedYs[i] - mean;
      sumSq += d * d;
    }
    const variance = count > 1 ? sumSq / (count - 1) : 0;
    seValues.push(Math.sqrt(variance / count));
  }
  return { fitted, se: seValues };
}
function normalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < 0.5) return -normalQuantile(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 1308e-6 * t * t * t);
}
function tCritical(level, df) {
  if (df <= 0) return normalQuantile((1 + level) / 2);
  const alpha = (1 - level) / 2;
  const z = normalQuantile(1 - alpha);
  if (df > 1e3) return z;
  const g1 = (z * z * z + z) / (4 * df);
  const g2 = (5 * z * z * z * z * z + 16 * z * z * z + 3 * z) / (96 * df * df);
  return z + g1 + g2;
}
function statSmooth(data, xField, yField, params = {}, colorField) {
  const method = params.method ?? "auto";
  const span = params.span ?? 0.75;
  const nEval = params.n ?? 80;
  const level = params.level ?? 0.95;
  const computeSE = params.se !== false;
  const fullrange = params.fullrange ?? false;
  const windowSize = params.window ?? 5;
  const groups2 = /* @__PURE__ */ new Map();
  for (const row of data) {
    const xRaw = row[xField];
    const yRaw = row[yField];
    if (xRaw == null || yRaw == null) continue;
    const x2 = Number(xRaw);
    const y2 = Number(yRaw);
    if (!Number.isFinite(x2) || !Number.isFinite(y2)) continue;
    const key = colorField ? String(row[colorField]) : "__all__";
    if (!groups2.has(key)) groups2.set(key, { rows: [], xs: [], ys: [] });
    const g = groups2.get(key);
    g.rows.push(row);
    g.xs.push(x2);
    g.ys.push(y2);
  }
  const result = [];
  for (const [groupKey, group2] of groups2) {
    const { xs, ys } = group2;
    const n = xs.length;
    const uniqueX = new Set(xs);
    if (uniqueX.size < 2) continue;
    let xMin, xMax;
    if (fullrange) {
      xMin = Infinity;
      xMax = -Infinity;
      for (const row of data) {
        const v = Number(row[xField]);
        if (Number.isFinite(v)) {
          if (v < xMin) xMin = v;
          if (v > xMax) xMax = v;
        }
      }
    } else {
      xMin = Math.min(...xs);
      xMax = Math.max(...xs);
    }
    const evalPoints = [];
    for (let i = 0; i < nEval; i++) {
      evalPoints.push(xMin + (xMax - xMin) * i / (nEval - 1));
    }
    let effectiveMethod = method;
    if (effectiveMethod === "auto") {
      effectiveMethod = n < 1e3 ? "loess" : "lm";
    }
    let fitResult;
    try {
      switch (effectiveMethod) {
        case "loess":
          fitResult = loessFit(xs, ys, evalPoints, span);
          break;
        case "lm":
          fitResult = lmFit(xs, ys, evalPoints);
          break;
        case "movingAverage":
          fitResult = movingAverageFit(xs, ys, evalPoints, windowSize);
          break;
        default:
          fitResult = loessFit(xs, ys, evalPoints, span);
      }
    } catch {
      console.warn(`ggpbi: fitting failed for group "${groupKey}". Skipping.`);
      continue;
    }
    const df = Math.max(1, fitResult.effectiveDf ?? n - 2);
    const tCrit = tCritical(level, df);
    for (let i = 0; i < nEval; i++) {
      const row = {
        [xField]: evalPoints[i],
        [STAT_SMOOTH_X]: evalPoints[i],
        [STAT_SMOOTH_Y]: fitResult.fitted[i],
        [yField]: fitResult.fitted[i]
      };
      if (computeSE) {
        const margin = tCrit * fitResult.se[i];
        row[STAT_SMOOTH_SE] = fitResult.se[i];
        row[STAT_SMOOTH_YMIN] = fitResult.fitted[i] - margin;
        row[STAT_SMOOTH_YMAX] = fitResult.fitted[i] + margin;
      }
      if (colorField && groupKey !== "__all__") {
        row[colorField] = groupKey;
      }
      result.push(row);
    }
  }
  return result;
}
var STAT_DENSITY_X = "__density_x";
var STAT_DENSITY_Y = "__density";
function bwNrd0(xs) {
  const n = xs.length;
  const mean = xs.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(xs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / (n - 1));
  const sorted = [...xs].sort((a, b) => a - b);
  const quantile2 = (p) => {
    const h = (n - 1) * p;
    const lo2 = Math.floor(h);
    const hi = Math.ceil(h);
    return sorted[lo2] + (h - lo2) * (sorted[hi] - sorted[lo2]);
  };
  const iqr = quantile2(0.75) - quantile2(0.25);
  let lo = Math.min(sd, iqr / 1.34);
  if (lo === 0) lo = sd || Math.abs(sorted[0]) || 1;
  return 0.9 * lo * Math.pow(n, -1 / 5);
}
function statDensity(data, xField, params = {}, colorField) {
  const adjust = params.adjust ?? 1;
  const nEval = params.n ?? 512;
  const trim = params.trim ?? false;
  const groups2 = /* @__PURE__ */ new Map();
  for (const row of data) {
    const raw = row[xField];
    if (raw == null) continue;
    const x2 = raw instanceof Date ? raw.getTime() : Number(raw);
    if (!Number.isFinite(x2)) continue;
    const key = colorField ? String(row[colorField]) : "__all__";
    if (!groups2.has(key)) groups2.set(key, []);
    groups2.get(key).push(x2);
  }
  const result = [];
  const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);
  for (const [groupKey, xs] of groups2) {
    if (xs.length < 2) {
      console.warn(`ggpbi: stat_density needs at least 2 observations, group "${groupKey}" skipped.`);
      continue;
    }
    const bw = (params.bw ?? bwNrd0(xs)) * adjust;
    if (!Number.isFinite(bw) || bw <= 0) {
      console.warn(`ggpbi: non-positive density bandwidth for group "${groupKey}", skipped.`);
      continue;
    }
    const dataMin = Math.min(...xs);
    const dataMax = Math.max(...xs);
    const gridMin = trim ? dataMin : dataMin - 3 * bw;
    const gridMax = trim ? dataMax : dataMax + 3 * bw;
    const invNBw = 1 / (xs.length * bw);
    for (let i = 0; i < nEval; i++) {
      const gx = gridMin + (gridMax - gridMin) * i / (nEval - 1);
      let sum = 0;
      for (const xi of xs) {
        const z = (gx - xi) / bw;
        sum += Math.exp(-0.5 * z * z);
      }
      const density2 = sum * INV_SQRT_2PI * invNBw;
      const row = {
        [xField]: gx,
        [STAT_DENSITY_X]: gx,
        [STAT_DENSITY_Y]: density2
      };
      if (colorField && groupKey !== "__all__") row[colorField] = groupKey;
      result.push(row);
    }
  }
  return result;
}
var statIdentity = (data) => ({ data });
var statCountFn = (data, aes, geomConfig) => {
  const horizontal = geomConfig != null && (geomConfig.type === "bar" || geomConfig.type === "col") && geomConfig.orientation === "y";
  if (!aes.x && horizontal && aes.y) {
    const aggregated2 = statCount(data, aes.y, aes.color, aes.weight);
    return {
      data: aggregated2,
      aesOverrides: { x: STAT_COUNT_FIELD }
    };
  }
  if (!aes.x) return { data };
  const aggregated = statCount(data, aes.x, aes.color, aes.weight);
  return {
    data: aggregated,
    aesOverrides: { y: STAT_COUNT_FIELD }
  };
};
var statBinFn = (data, aes, geomConfig) => {
  if (!aes.x) return { data };
  const params = {};
  if (geomConfig && geomConfig.type === "histogram") {
    const h = geomConfig;
    if (h.bins != null) params.bins = h.bins;
    if (h.binwidth != null) params.binwidth = h.binwidth;
    if (h.breaks) params.breaks = h.breaks;
    if (h.center != null) params.center = h.center;
    if (h.boundary != null) params.boundary = h.boundary;
    if (h.closed) params.closed = h.closed;
    if (h.pad != null) params.pad = h.pad;
    if (h.drop) params.drop = h.drop;
  }
  const binned = statBin(data, aes.x, params, aes.color, aes.weight);
  const yField = geomConfig?.type === "histogram" ? {
    count: STAT_BIN_COUNT,
    density: STAT_BIN_DENSITY,
    ncount: STAT_BIN_NCOUNT,
    ndensity: STAT_BIN_NDENSITY
  }[geomConfig.yAxis ?? "count"] : STAT_BIN_COUNT;
  return {
    data: binned,
    aesOverrides: { y: yField }
  };
};
var statSmoothFn = (data, aes, geomConfig) => {
  if (!aes.x || !aes.y) return { data };
  const params = {};
  if (geomConfig && geomConfig.type === "smooth") {
    const s = geomConfig;
    if (s.method != null) params.method = s.method;
    if (s.span != null) params.span = s.span;
    if (s.n != null) params.n = s.n;
    if (s.level != null) params.level = s.level;
    if (s.fullrange != null) params.fullrange = s.fullrange;
    if (s.se != null) params.se = s.se;
    if (s.window != null) params.window = s.window;
  }
  const smoothed = statSmooth(data, aes.x, aes.y, params, aes.color);
  return {
    data: smoothed,
    aesOverrides: { y: STAT_SMOOTH_Y }
  };
};
var statDensityFn = (data, aes, geomConfig) => {
  if (!aes.x) return { data };
  const params = {};
  if (geomConfig && geomConfig.type === "density") {
    const d = geomConfig;
    if (d.bw != null) params.bw = d.bw;
    if (d.adjust != null) params.adjust = d.adjust;
    if (d.n != null) params.n = d.n;
    if (d.trim != null) params.trim = d.trim;
  }
  const densities = statDensity(data, aes.x, params, aes.color);
  return {
    data: densities,
    aesOverrides: { y: STAT_DENSITY_Y }
  };
};
var STAT_SUM_FIELD = "__sum";
var statSumFn = (data, aes, geomConfig) => {
  const horizontal = geomConfig != null && (geomConfig.type === "bar" || geomConfig.type === "col") && geomConfig.orientation === "y";
  const catField = horizontal ? aes.y : aes.x;
  const valField = horizontal ? aes.x : aes.y;
  if (!catField || !valField) return { data };
  const keyFields = [catField, aes.color, aes.group, aes.facetRow, aes.facetCol].filter((f) => !!f);
  const groups2 = /* @__PURE__ */ new Map();
  for (const d of data) {
    const key = keyFields.map((f) => String(d[f])).join("\0");
    const value = Number(d[valField]);
    const existing = groups2.get(key);
    if (existing) {
      if (Number.isFinite(value)) {
        existing[STAT_SUM_FIELD] = Number(existing[STAT_SUM_FIELD]) + value;
      }
    } else {
      groups2.set(key, { ...d, [STAT_SUM_FIELD]: Number.isFinite(value) ? value : 0 });
    }
  }
  return {
    data: Array.from(groups2.values()),
    aesOverrides: horizontal ? { x: STAT_SUM_FIELD } : { y: STAT_SUM_FIELD }
  };
};
var stats = {
  identity: statIdentity,
  sum: statSumFn,
  count: statCountFn,
  bin: statBinFn,
  smooth: statSmoothFn,
  density: statDensityFn,
  boxplot: statIdentity
  // boxplot stats are computed inside the geom (needs scale info)
};
var DEFAULT_GEOM_STAT = {
  bar: "count",
  histogram: "bin",
  boxplot: "boxplot",
  smooth: "smooth",
  density: "density"
};

// src/geoms/boxplot.ts
function notchPath(pos, q1y, q3y, medianY, notchUpperY, notchLowerY, notchWidthFrac) {
  const indent = pos.width * (1 - notchWidthFrac) / 2;
  const lx = pos.left;
  const rx = pos.left + pos.width;
  const nlx = lx + indent;
  const nrx = rx - indent;
  const nuY = Math.max(notchUpperY, q3y);
  const nlY = Math.min(notchLowerY, q1y);
  if (notchUpperY < q3y || notchLowerY > q1y) {
    console.warn(
      "ggpbi: notch went outside hinges. Try setting notch=false."
    );
  }
  return [
    `M${lx},${q3y}`,
    `L${lx},${nuY}`,
    `L${nlx},${medianY}`,
    `L${lx},${nlY}`,
    `L${lx},${q1y}`,
    `L${rx},${q1y}`,
    `L${rx},${nlY}`,
    `L${nrx},${medianY}`,
    `L${rx},${nuY}`,
    `L${rx},${q3y}`,
    "Z"
  ].join(" ");
}
function boxplotToScene(points, xScale, yScale, config, colorScale, innerWidth) {
  if (points.length === 0) return [];
  const coef = config.boxCoef ?? 1.5;
  const notch = config.boxNotch ?? false;
  const notchWidthFrac = config.boxNotchWidth ?? 0.5;
  const varwidth = config.boxVarWidth ?? false;
  const stapleWidth = config.boxStapleWidth ?? 0;
  const fatten = config.boxFatten ?? 2;
  const naRm = config.naRm ?? false;
  const showOutliers = config.boxOutlierShow ?? true;
  const defaultFill = config.color ?? "#FFFFFF";
  const defaultAlpha = config.alpha ?? 1;
  const baseStroke = config.stroke ?? "#333333";
  const baseStrokeWidth = config.strokeWidth ?? 0.5;
  const baseLinetype = config.linetype;
  const widthFraction = config.width ?? 0.9;
  const boxBorderColor = config.boxBorderColor ?? baseStroke;
  const boxBorderLineStyle = config.boxBorderLineStyle ?? baseLinetype;
  const boxBorderLineWidth = config.boxBorderLineWidth ?? baseStrokeWidth;
  const whiskerColor = config.boxWhiskerColor ?? baseStroke;
  const whiskerLineStyle = config.boxWhiskerLineStyle ?? baseLinetype;
  const whiskerLineWidth = config.boxWhiskerLineWidth ?? baseStrokeWidth;
  const stapleColor = config.boxStapleColor ?? baseStroke;
  const stapleLineStyle = config.boxStapleLineStyle ?? baseLinetype;
  const stapleLineWidth = config.boxStapleLineWidth ?? baseStrokeWidth;
  const medianColor = config.boxMedianColor ?? baseStroke;
  const medianLineStyle = config.boxMedianLineStyle ?? baseLinetype;
  const medianLineWidth = (config.boxMedianLineWidth ?? baseStrokeWidth) * fatten;
  const outlierColor = config.boxOutlierColor ?? baseStroke;
  const outlierFill = config.boxOutlierFill;
  const outlierShape = config.boxOutlierShape ?? "circle";
  const outlierSize = config.boxOutlierSize ?? 1.5;
  const outlierStrokeW = config.boxOutlierStroke ?? 0.5;
  const outlierAlpha = config.boxOutlierAlpha ?? defaultAlpha;
  const stats2 = computeBoxplotStats(points, coef, naRm);
  if (stats2.length === 0) return [];
  const isBand = typeof xScale.bandwidth === "function";
  const byX = group(stats2, (d) => String(d.x));
  const nCategories = byX.size || stats2.length;
  const baseWidth = isBand ? xScale.bandwidth() * widthFraction : innerWidth ? Math.max(6, innerWidth / nCategories * 0.6 * widthFraction) : 24;
  const maxN = varwidth ? Math.max(...stats2.map((s) => s.n)) : 0;
  const positionFor = (d) => {
    const x0 = xScale(d.x);
    const group2 = byX.get(String(d.x)) ?? [d];
    const n = group2.length;
    const idx = group2.findIndex(
      (s) => String(s.color ?? "__none__") === String(d.color ?? "__none__")
    );
    let effectiveBaseWidth = baseWidth;
    if (varwidth && maxN > 0) {
      effectiveBaseWidth = baseWidth * Math.sqrt(d.n) / Math.sqrt(maxN);
    }
    if (n <= 1) {
      const left3 = isBand ? x0 + (xScale.bandwidth() - effectiveBaseWidth) / 2 : x0 - effectiveBaseWidth / 2;
      return { left: left3, width: effectiveBaseWidth, center: left3 + effectiveBaseWidth / 2 };
    }
    const dodgePadding = 0.1;
    const totalAvail = isBand ? xScale.bandwidth() : baseWidth;
    const paddingPx = totalAvail * dodgePadding / (n - 1 || 1);
    const groupWidth = (totalAvail - paddingPx * Math.max(0, n - 1)) / n;
    const dodgeWidth = varwidth && maxN > 0 ? groupWidth * Math.sqrt(d.n) / Math.sqrt(maxN) : groupWidth;
    const leftBase = isBand ? x0 : x0 - totalAvail / 2;
    const groupCenter = leftBase + idx * (groupWidth + paddingPx) + groupWidth / 2;
    const left2 = groupCenter - dodgeWidth / 2;
    return { left: left2, width: dodgeWidth, center: groupCenter };
  };
  const fillFor = (d) => {
    if (d.color != null && colorScale) return colorScale(String(d.color));
    return defaultFill;
  };
  const outlierFillFor = () => {
    if (outlierFill) return outlierFill;
    const shapeInfo2 = getShapeInfo(outlierShape);
    if (shapeInfo2.category === "filled") return outlierColor;
    return "none";
  };
  const outlierStrokeFor = () => {
    const shapeInfo2 = getShapeInfo(outlierShape);
    if (shapeInfo2.category === "filled") return "none";
    return outlierColor;
  };
  const dashFor = (linestyle) => {
    const d = linetypeToDasharray(linestyle);
    return d ?? void 0;
  };
  const shapeInfo = getShapeInfo(outlierShape);
  const symbolSize = Math.PI * Math.pow(outlierSize * 2, 2);
  const symbolGen = Symbol2().type(shapeInfo.symbol).size(symbolSize);
  const result = [];
  for (const stat of stats2) {
    const pos = positionFor(stat);
    const children2 = [];
    if (showOutliers) {
      for (const p of stat.outliers) {
        const cx = pos.center;
        const cy = yScale(Number(p.y));
        children2.push({
          type: "path",
          class: "ggpbi-boxplot-outlier",
          d: symbolGen() ?? "",
          transform: `translate(${cx},${cy})`,
          style: {
            fill: outlierFillFor(),
            stroke: outlierStrokeFor(),
            strokeWidth: outlierStrokeW,
            opacity: outlierAlpha
          },
          data: p
        });
      }
    }
    if (stapleWidth > 0) {
      const capHalfW = pos.width * stapleWidth / 2;
      for (const wy of [stat.whiskerLow, stat.whiskerHigh]) {
        children2.push({
          type: "line",
          class: "ggpbi-boxplot-staple",
          x1: pos.center - capHalfW,
          x2: pos.center + capHalfW,
          y1: yScale(wy),
          y2: yScale(wy),
          style: {
            stroke: stapleColor,
            strokeWidth: stapleLineWidth,
            strokeLinecap: "butt",
            opacity: 1,
            strokeDasharray: dashFor(stapleLineStyle)
          }
        });
      }
    }
    for (const [wy1, wy2] of [[stat.q1, stat.whiskerLow], [stat.q3, stat.whiskerHigh]]) {
      children2.push({
        type: "line",
        class: "ggpbi-boxplot-whisker",
        x1: pos.center,
        x2: pos.center,
        y1: yScale(wy1),
        y2: yScale(wy2),
        style: {
          stroke: whiskerColor,
          strokeWidth: whiskerLineWidth,
          strokeLinecap: "butt",
          opacity: 1,
          strokeDasharray: dashFor(whiskerLineStyle)
        }
      });
    }
    if (notch) {
      children2.push({
        type: "path",
        class: "ggpbi-boxplot-box",
        d: notchPath(
          pos,
          yScale(stat.q1),
          yScale(stat.q3),
          yScale(stat.median),
          yScale(stat.notchUpper),
          yScale(stat.notchLower),
          notchWidthFrac
        ),
        style: {
          fill: fillFor(stat),
          opacity: defaultAlpha,
          stroke: boxBorderColor,
          strokeWidth: boxBorderLineWidth,
          strokeLinejoin: "miter",
          strokeLinecap: "butt",
          strokeDasharray: dashFor(boxBorderLineStyle)
        }
      });
    } else {
      const q1y = yScale(stat.q1);
      const q3y = yScale(stat.q3);
      children2.push({
        type: "rect",
        class: "ggpbi-boxplot-box",
        x: pos.left,
        y: Math.min(q3y, q1y),
        width: pos.width,
        height: Math.abs(q3y - q1y),
        style: {
          fill: fillFor(stat),
          opacity: defaultAlpha,
          stroke: boxBorderColor,
          strokeWidth: boxBorderLineWidth,
          strokeLinejoin: "miter",
          strokeLinecap: "butt",
          strokeDasharray: dashFor(boxBorderLineStyle)
        }
      });
    }
    children2.push({
      type: "line",
      class: "ggpbi-boxplot-median",
      x1: pos.left,
      x2: pos.left + pos.width,
      y1: yScale(stat.median),
      y2: yScale(stat.median),
      style: {
        stroke: medianColor,
        strokeWidth: medianLineWidth,
        strokeLinecap: "butt",
        strokeDasharray: dashFor(medianLineStyle)
      }
    });
    result.push({
      type: "group",
      class: "ggpbi-boxplot",
      children: children2,
      style: {},
      aria: {
        role: "listitem",
        tabindex: "0",
        label: `${String(stat.x)}: median ${stat.median.toLocaleString()}, Q1 ${stat.q1.toLocaleString()}, Q3 ${stat.q3.toLocaleString()}, n=${stat.n}`
      }
    });
  }
  return result;
}

// src/geoms/histogram.ts
function computeHistStyle(d, config, colorScale) {
  const defaultAlpha = config.alpha ?? 0.85;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const stroke = config.stroke ?? "#333333";
  const strokeWidth = config.strokeWidth ?? 0.5;
  const dasharray = linetypeToDasharray(config.linetype);
  const fill = d.color && colorScale ? colorScale(d.color) : defaultColor;
  const opacity = d.alpha ?? defaultAlpha;
  const style = { fill, opacity };
  if (stroke) {
    style.stroke = stroke;
  }
  if (strokeWidth > 0) {
    style.strokeWidth = strokeWidth;
    if (!stroke) style.stroke = "#333333";
  }
  if (dasharray) {
    style.strokeDasharray = dasharray;
  }
  if (strokeWidth > 0 || stroke) {
    style.strokeLinecap = config.lineend ?? "butt";
    style.strokeLinejoin = config.linejoin ?? "miter";
    if ((config.linejoin ?? "miter") === "miter") {
      style.strokeMiterlimit = config.linemitre ?? 10;
    }
  }
  return style;
}
function histAriaLabel(d) {
  const datum2 = d.datum ?? {};
  const xmin = datum2[STAT_BIN_XMIN];
  const xmax = datum2[STAT_BIN_XMAX];
  const count = typeof d.y === "number" ? d.y.toLocaleString() : String(d.y);
  if (xmin != null && xmax != null) {
    return `${Number(xmin).toLocaleString()}\u2013${Number(xmax).toLocaleString()}: ${count}`;
  }
  const xVal = typeof d.x === "number" ? d.x.toLocaleString() : String(d.x);
  return `${xVal}: ${count}`;
}
function histogramToScene(points, xScale, yScale, config, colorScale, _innerWidth) {
  const isHorizontal = config.orientation === "y";
  const histPoints = filterNA(
    points,
    config.naRm,
    "geom_histogram",
    isHorizontal ? ["x"] : ["y"]
  );
  if (histPoints.length === 0) return [];
  const position = config.position ?? "stack";
  const valScale = isHorizontal ? xScale : yScale;
  const catScale = isHorizontal ? yScale : xScale;
  const valZero = (() => {
    try {
      return valScale(0);
    } catch {
      return isHorizontal ? 0 : valScale.range()[0];
    }
  })();
  const nodes = [];
  for (const d of histPoints) {
    const style = computeHistStyle(d, config, colorScale);
    const aria = { role: "listitem", tabindex: "0", label: histAriaLabel(d) };
    const datum2 = d.datum ?? {};
    const binXmin = datum2[STAT_BIN_XMIN];
    const binXmax = datum2[STAT_BIN_XMAX];
    let x2, y2, width, height;
    if (position === "stack" || position === "fill") {
      const v0 = d._v0 ?? 0;
      const v1 = d._v1 ?? 0;
      if (isHorizontal) {
        x2 = Math.min(valScale(v0), valScale(v1));
        width = Math.abs(valScale(v0) - valScale(v1));
        if (binXmin != null && binXmax != null) {
          y2 = catScale(binXmin);
          height = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          y2 = catScale(d.y);
          height = 20;
        }
      } else {
        if (binXmin != null && binXmax != null) {
          x2 = catScale(binXmin);
          width = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          x2 = catScale(d.x) - 10;
          width = 20;
        }
        y2 = valScale(v1);
        height = Math.abs(valScale(v0) - valScale(v1));
      }
    } else if (position === "dodge" || position === "dodge2") {
      const dodgeN = d._dodgeN ?? 1;
      const dodgeIdx = d._dodgeIndex ?? 0;
      const padded = d._dodgePadded ?? false;
      if (binXmin != null && binXmax != null) {
        const totalWidth = Math.abs(catScale(binXmax) - catScale(binXmin));
        const dodgePad = padded ? totalWidth / dodgeN * 0.1 : 0;
        const dodgeW = (totalWidth - dodgePad * (dodgeN - 1)) / dodgeN;
        if (isHorizontal) {
          x2 = Math.min(valScale(Number(d.x)), valZero);
          width = Math.abs(valScale(Number(d.x)) - valZero);
          y2 = catScale(binXmin) + dodgeIdx * (dodgeW + dodgePad);
          height = dodgeW;
        } else {
          x2 = catScale(binXmin) + dodgeIdx * (dodgeW + dodgePad);
          width = dodgeW;
          y2 = Math.min(valScale(Number(d.y)), valZero);
          height = Math.abs(valScale(Number(d.y)) - valZero);
        }
      } else {
        if (isHorizontal) {
          x2 = Math.min(valScale(Number(d.x)), valZero);
          y2 = catScale(d.y);
          width = Math.abs(valScale(Number(d.x)) - valZero);
          height = 20 / dodgeN;
        } else {
          x2 = catScale(d.x) - 10;
          y2 = Math.min(valScale(Number(d.y)), valZero);
          width = 20 / dodgeN;
          height = Math.abs(valScale(Number(d.y)) - valZero);
        }
      }
    } else {
      if (isHorizontal) {
        x2 = Math.min(valScale(Number(d.x)), valZero);
        width = Math.abs(valScale(Number(d.x)) - valZero);
        if (binXmin != null && binXmax != null) {
          y2 = catScale(binXmin);
          height = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          y2 = catScale(d.y);
          height = 20;
        }
      } else {
        if (binXmin != null && binXmax != null) {
          x2 = catScale(binXmin);
          width = Math.abs(catScale(binXmax) - catScale(binXmin));
        } else {
          x2 = catScale(d.x) - 10;
          width = 20;
        }
        const yVal = valScale(Number(d.y));
        y2 = Math.min(yVal, valZero);
        height = Math.abs(yVal - valZero);
      }
    }
    nodes.push({ type: "rect", class: "ggpbi-bar", x: x2, y: y2, width, height, style, aria, data: d });
  }
  return nodes;
}

// src/geoms/smooth.ts
function smoothToScene(points, xScale, yScale, config, colorScale) {
  const smoothPoints = filterNA(points, config.naRm ?? true, "geom_smooth");
  if (smoothPoints.length === 0) return [];
  const showSE = config.se !== false;
  const defaultColor = config.color ?? "#3366FF";
  const fillAlpha = config.fillAlpha ?? 0.4;
  const lineWidth = config.lineWidth ?? config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? "butt";
  const linejoin = config.linejoin ?? "round";
  const bw = bandOffset(xScale);
  const line = line_default().x((d) => xScale(d.x) + bw).y((d) => yScale(d.y));
  const ribbon = area_default().x((d) => xScale(d.x) + bw).y0((d) => {
    const ymin = d.datum?.[STAT_SMOOTH_YMIN];
    return ymin != null ? yScale(ymin) : yScale(d.y);
  }).y1((d) => {
    const ymax = d.datum?.[STAT_SMOOTH_YMAX];
    return ymax != null ? yScale(ymax) : yScale(d.y);
  });
  const buildGroup = (pts, color2) => {
    const sorted = sortByX(pts);
    const nodes = [];
    if (showSE) {
      const hasCI = sorted.some(
        (p) => p.datum?.[STAT_SMOOTH_YMIN] != null && p.datum?.[STAT_SMOOTH_YMAX] != null
      );
      if (hasCI) {
        const ribbonD = ribbon(sorted) ?? "";
        if (ribbonD) {
          const fillColor = config.fill ?? "#999999";
          const ribbonStyle = {
            fill: fillColor,
            stroke: "none",
            opacity: fillAlpha
          };
          nodes.push({
            type: "path",
            class: "ggpbi-smooth-ribbon",
            d: ribbonD,
            style: ribbonStyle,
            data: sorted[0]
          });
        }
      }
    }
    const lineD = line(sorted) ?? "";
    if (lineD) {
      const lineStyle = {
        fill: "none",
        stroke: color2,
        strokeWidth: lineWidth,
        opacity: 1,
        // ggplot2: line is always fully opaque
        strokeLinecap: lineend,
        strokeLinejoin: linejoin
      };
      if (dasharray) {
        lineStyle.strokeDasharray = dasharray;
      }
      nodes.push({
        type: "path",
        class: "ggpbi-smooth-line",
        d: lineD,
        style: lineStyle,
        data: sorted[0]
      });
    }
    return nodes;
  };
  const result = [];
  const groups2 = groupByColor(smoothPoints);
  if (groups2) {
    groups2.forEach((groupPoints, key) => {
      const color2 = colorScale ? colorScale(String(key)) : defaultColor;
      result.push(...buildGroup(groupPoints, color2));
    });
  } else {
    result.push(...buildGroup(smoothPoints, defaultColor));
  }
  return result;
}

// src/geoms/density.ts
function densityToScene(points, xScale, yScale, config, colorScale) {
  if (points.length === 0) return [];
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype) ?? void 0;
  const lineAlpha = config.alpha ?? 1;
  const fillAlpha = config.fillAlpha ?? 0.3;
  const line = line_default().x((d) => xScale(d.x)).y((d) => yScale(d.y));
  const area = area_default().x((d) => xScale(d.x)).y0(yScale(0)).y1((d) => yScale(d.y));
  const buildNodes = (pts, color2) => {
    const sorted = sortByX(pts);
    const nodes = [];
    if (config.fill) {
      const fillColor = config.fill === true ? color2 : config.fill;
      const areaD = area(sorted) ?? "";
      if (areaD) {
        nodes.push({
          type: "path",
          class: "ggpbi-density-area",
          d: areaD,
          style: { fill: fillColor, opacity: fillAlpha },
          data: sorted[0]
        });
      }
    }
    const lineD = line(sorted) ?? "";
    if (lineD) {
      const style = {
        fill: "none",
        stroke: color2,
        strokeWidth,
        strokeDasharray: dasharray,
        strokeLinejoin: "round",
        opacity: lineAlpha
      };
      nodes.push({
        type: "path",
        class: "ggpbi-density",
        d: lineD,
        style,
        data: sorted[0]
      });
    }
    return nodes;
  };
  const result = [];
  const groups2 = groupByColor(points);
  if (groups2) {
    groups2.forEach((groupPoints, key) => {
      const color2 = colorScale ? colorScale(String(key)) : defaultColor;
      result.push(...buildNodes(groupPoints, color2));
    });
  } else {
    result.push(...buildNodes(points, defaultColor));
  }
  return result;
}

// src/geoms/violin.ts
function violinToScene(points, xScale, yScale, config, colorScale, innerWidth) {
  if (points.length === 0) return [];
  const adjust = config.adjust ?? 1;
  const nEval = config.n ?? 512;
  const trim = config.trim ?? true;
  const scaleMode = config.violinScale ?? "area";
  const widthFraction = config.width ?? 0.9;
  const naRm = config.naRm ?? false;
  const defaultFill = config.fill ?? "#FFFFFF";
  const stroke = config.stroke ?? "#333333";
  const strokeWidth = config.strokeWidth ?? 0.5;
  const dasharray = linetypeToDasharray(config.linetype) ?? void 0;
  const alpha = config.alpha ?? 1;
  const groups2 = /* @__PURE__ */ new Map();
  for (const p of points) {
    const yNum = typeof p.y === "number" ? p.y : Number(p.y);
    if (p.x == null || p.y == null || !Number.isFinite(yNum)) {
      if (!naRm) console.warn("ggpbi: geom_violin removed a non-finite observation.");
      continue;
    }
    const key = `${String(p.x)}\0${String(p.color ?? "__none__")}`;
    if (!groups2.has(key)) groups2.set(key, []);
    groups2.get(key).push(p);
  }
  const allStats = [];
  for (const groupPoints of groups2.values()) {
    const rows = groupPoints.map((p) => ({ v: Number(p.y) }));
    const kde = statDensity(rows, "v", { bw: config.bw, adjust, n: nEval, trim });
    if (kde.length === 0) continue;
    allStats.push({
      x: groupPoints[0].x,
      color: groupPoints[0].color,
      n: groupPoints.length,
      curve: kde.map((r) => ({ y: r[STAT_DENSITY_X], density: r[STAT_DENSITY_Y] })),
      representative: groupPoints[0]
    });
  }
  if (allStats.length === 0) return [];
  const panelMaxDensity = Math.max(...allStats.flatMap((s) => s.curve.map((c) => c.density)));
  const panelMaxDensityN = Math.max(...allStats.flatMap((s) => s.curve.map((c) => c.density * s.n)));
  const violinWidthFor = (s, density2) => {
    switch (scaleMode) {
      case "width": {
        const groupMax = Math.max(...s.curve.map((c) => c.density));
        return groupMax > 0 ? density2 / groupMax : 0;
      }
      case "count":
        return panelMaxDensityN > 0 ? density2 * s.n / panelMaxDensityN : 0;
      case "area":
      default:
        return panelMaxDensity > 0 ? density2 / panelMaxDensity : 0;
    }
  };
  const isBand = typeof xScale.bandwidth === "function";
  const byX = group(allStats, (s) => String(s.x));
  const nCategories = byX.size || allStats.length;
  const baseWidth = isBand ? xScale.bandwidth() * widthFraction : innerWidth ? Math.max(6, innerWidth / nCategories * 0.6 * widthFraction) : 24;
  const positionFor = (s) => {
    const x0 = xScale(s.x);
    const group2 = byX.get(String(s.x)) ?? [s];
    const n = group2.length;
    if (n <= 1) {
      const center3 = isBand ? x0 + xScale.bandwidth() / 2 : x0;
      return { center: center3, width: baseWidth };
    }
    const idx = group2.findIndex(
      (g) => String(g.color ?? "__none__") === String(s.color ?? "__none__")
    );
    const dodgePadding = 0.1;
    const totalAvail = isBand ? xScale.bandwidth() : baseWidth;
    const paddingPx = totalAvail * dodgePadding / (n - 1 || 1);
    const groupWidth = (totalAvail - paddingPx * Math.max(0, n - 1)) / n;
    const leftBase = isBand ? x0 : x0 - totalAvail / 2;
    const center2 = leftBase + idx * (groupWidth + paddingPx) + groupWidth / 2;
    return { center: center2, width: groupWidth };
  };
  const result = [];
  for (const s of allStats) {
    const pos = positionFor(s);
    const halfWidth = pos.width / 2;
    const right2 = s.curve.map((c) => {
      const offset = violinWidthFor(s, c.density) * halfWidth;
      return `${pos.center + offset},${yScale(c.y)}`;
    });
    const left2 = [...s.curve].reverse().map((c) => {
      const offset = violinWidthFor(s, c.density) * halfWidth;
      return `${pos.center - offset},${yScale(c.y)}`;
    });
    const d = `M${right2[0]} L${right2.slice(1).join(" L")} L${left2.join(" L")} Z`;
    if (/NaN/.test(d)) continue;
    result.push({
      type: "path",
      class: "ggpbi-violin",
      d,
      style: {
        fill: s.color != null && colorScale ? colorScale(String(s.color)) : defaultFill,
        stroke,
        strokeWidth,
        strokeDasharray: dasharray,
        strokeLinejoin: "round",
        opacity: alpha
      },
      data: s.representative,
      aria: { role: "listitem", label: `Violin ${String(s.x)}` }
    });
  }
  return result;
}

// src/geoms/hline.ts
function hlineToScene(_points, _xScale, yScale, config, _colorScale, innerWidth = 0) {
  const intercepts = Array.isArray(config.yintercept) ? config.yintercept : [config.yintercept];
  const nodes = [];
  for (const intercept of intercepts) {
    const y2 = Number(yScale(intercept));
    if (!Number.isFinite(y2)) continue;
    nodes.push({
      type: "line",
      class: "ggpbi-hline",
      x1: 0,
      x2: innerWidth,
      y1: y2,
      y2,
      style: {
        stroke: config.color ?? REFLINE_DEFAULT_COLOR,
        strokeWidth: config.size ?? 1,
        strokeDasharray: linetypeToDasharray(config.linetype) ?? void 0,
        opacity: config.alpha ?? 1
      }
    });
  }
  return nodes;
}

// src/geoms/vline.ts
function vlineToScene(_points, xScale, _yScale, config, _colorScale, _innerWidth = 0, innerHeight = 0) {
  const intercepts = Array.isArray(config.xintercept) ? config.xintercept : [config.xintercept];
  const nodes = [];
  for (const intercept of intercepts) {
    const x2 = Number(xScale(intercept));
    if (!Number.isFinite(x2)) continue;
    nodes.push({
      type: "line",
      class: "ggpbi-vline",
      x1: x2,
      x2,
      y1: 0,
      y2: innerHeight,
      style: {
        stroke: config.color ?? REFLINE_DEFAULT_COLOR,
        strokeWidth: config.size ?? 1,
        strokeDasharray: linetypeToDasharray(config.linetype) ?? void 0,
        opacity: config.alpha ?? 1
      }
    });
  }
  return nodes;
}

// src/geoms/abline.ts
function ablineToScene(_points, xScale, yScale, config) {
  if (typeof xScale.bandwidth === "function" || typeof yScale.bandwidth === "function") return [];
  const slope = config.slope ?? 1;
  const intercept = config.intercept ?? 0;
  const [x0, x1] = xScale.domain();
  const y0 = intercept + slope * Number(x0);
  const y1 = intercept + slope * Number(x1);
  const sx0 = Number(xScale(x0));
  const sx1 = Number(xScale(x1));
  const sy0 = Number(yScale(y0));
  const sy1 = Number(yScale(y1));
  if (![sx0, sx1, sy0, sy1].every(Number.isFinite)) return [];
  return [{
    type: "line",
    class: "ggpbi-abline",
    x1: sx0,
    y1: sy0,
    x2: sx1,
    y2: sy1,
    style: {
      stroke: config.color ?? REFLINE_DEFAULT_COLOR,
      strokeWidth: config.size ?? 1,
      strokeDasharray: linetypeToDasharray(config.linetype) ?? void 0,
      opacity: config.alpha ?? 1
    }
  }];
}

// src/geoms/segment.ts
function segmentsToScene(points, xScale, yScale, config, colorScale) {
  if (points.length === 0) return [];
  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const strokeWidth = config.size ?? 2;
  const dasharray = linetypeToDasharray(config.linetype);
  const lineend = config.lineend ?? "butt";
  const xOff = bandOffset(xScale);
  const yOff = bandOffset(yScale);
  const showArrow = config.arrowShow ?? false;
  const arrowEnds = config.arrowEnds ?? "last";
  const arrowType = config.arrowType ?? "open";
  let arrowCounter = 0;
  const buildMarker = (color2, end) => ({
    id: `ggpbi-segment-arrow-${end}-${color2.replace(/[^a-zA-Z0-9]/g, "")}-${arrowCounter++}`,
    angle: config.arrowAngle ?? 30,
    length: config.arrowLength ?? 8,
    color: color2,
    fill: config.arrowFill ?? (arrowType === "closed" ? color2 : "none"),
    type: arrowType
  });
  const nodes = [];
  for (const d of points) {
    const x1 = xScale(d.x) + xOff;
    const y1 = yScale(d.y) + yOff;
    const x2 = xScale(d.xend ?? d.x) + xOff;
    const y2 = yScale(d.yend ?? d.y) + yOff;
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const color2 = d.color !== void 0 && colorScale ? colorScale(String(d.color)) : defaultColor;
    const style = {
      stroke: color2,
      strokeWidth,
      opacity: d.alpha ?? defaultAlpha,
      strokeLinecap: lineend
    };
    if (dasharray) style.strokeDasharray = dasharray;
    const node = {
      type: "line",
      class: "ggpbi-segment",
      x1,
      y1,
      x2,
      y2,
      style,
      aria: { role: "listitem", tabindex: "0", label: `${String(d.x)} \u2192 ${String(d.xend ?? d.x)}` },
      data: d
    };
    if (showArrow) {
      if (arrowEnds === "last" || arrowEnds === "both") node.markerEnd = buildMarker(color2, "end");
      if (arrowEnds === "first" || arrowEnds === "both") node.markerStart = buildMarker(color2, "start");
    }
    nodes.push(node);
  }
  return nodes;
}

// src/geoms/pointrange.ts
function pointrangeToScene(points, xScale, yScale, config, colorScale) {
  if (points.length === 0) return [];
  const defaultAlpha = config.alpha ?? 1;
  const defaultColor = config.color ?? GEOM_DEFAULT_COLOR;
  const lineWidth = config.size ?? 1;
  const fatten = config.fatten ?? 4;
  const shape = config.shape ?? "circle";
  const defaultFill = config.fill ?? "#FFFFFF";
  const xOff = bandOffset(xScale);
  const yOff = bandOffset(yScale);
  const symbolGen = Symbol2().type(() => getShapeInfo(shape).symbol).size(() => {
    const r = Math.max(1, lineWidth * fatten);
    return Math.PI * r * r;
  });
  const nodes = [];
  for (const d of points) {
    const cx = xScale(d.x) + xOff;
    const cy = yScale(d.y) + yOff;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
    const color2 = d.color !== void 0 && colorScale ? colorScale(String(d.color)) : defaultColor;
    const opacity = d.alpha ?? defaultAlpha;
    const hasYRange = d.ymin != null || d.ymax != null;
    const hasXRange = d.xmin != null || d.xmax != null;
    let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
    if (hasYRange) {
      y1 = yScale(d.ymin ?? d.y) + yOff;
      y2 = yScale(d.ymax ?? d.y) + yOff;
    } else if (hasXRange) {
      x1 = xScale(d.xmin ?? d.x) + xOff;
      x2 = xScale(d.xmax ?? d.x) + xOff;
    }
    if ((hasYRange || hasXRange) && [x1, y1, x2, y2].every(Number.isFinite)) {
      const lineStyle = {
        stroke: color2,
        strokeWidth: lineWidth,
        opacity
      };
      nodes.push({
        type: "line",
        class: "ggpbi-pointrange-line",
        x1,
        y1,
        x2,
        y2,
        style: lineStyle,
        data: d
      });
    }
    const shapeCat = getShapeInfo(shape).category;
    const dotStyle = {
      fill: shapeCat === "open" || shapeCat === "line" ? "none" : shapeCat === "fillBorder" ? d.fill ?? defaultFill : color2,
      opacity
    };
    if (shapeCat !== "filled") {
      dotStyle.stroke = color2;
      dotStyle.strokeWidth = 1.5;
    }
    const xVal = typeof d.x === "number" ? d.x.toLocaleString() : String(d.x);
    const yVal = typeof d.y === "number" ? d.y.toLocaleString() : String(d.y);
    nodes.push({
      type: "path",
      class: "ggpbi-pointrange-dot",
      d: symbolGen(d) ?? "",
      transform: `translate(${cx},${cy})`,
      style: dotStyle,
      aria: { role: "listitem", tabindex: "0", label: `${xVal}: ${yVal}` },
      data: d
    });
  }
  return nodes;
}

// src/geoms/registry.ts
var sceneBuilders = {
  point: (pts, xs, ys, cfg, cs) => pointsToScene(pts, xs, ys, cfg, cs),
  line: (pts, xs, ys, cfg, cs) => linesToScene(pts, xs, ys, cfg, cs),
  bar: (pts, xs, ys, cfg, cs, iw) => barsToScene(pts, xs, ys, cfg, cs, iw),
  col: (pts, xs, ys, cfg, cs, iw) => barsToScene(pts, xs, ys, { ...cfg, type: "bar", stat: "identity" }, cs, iw),
  area: (pts, xs, ys, cfg, cs) => areaToScene(pts, xs, ys, cfg, cs),
  text: (pts, xs, ys, cfg, cs, iw, ih, shared) => textToScene(pts, xs, ys, cfg, cs, iw, ih, shared),
  boxplot: (pts, xs, ys, cfg, cs, iw) => boxplotToScene(pts, xs, ys, cfg, cs, iw),
  histogram: (pts, xs, ys, cfg, cs, iw) => histogramToScene(pts, xs, ys, cfg, cs, iw),
  smooth: (pts, xs, ys, cfg, cs) => smoothToScene(pts, xs, ys, cfg, cs),
  density: (pts, xs, ys, cfg, cs) => densityToScene(pts, xs, ys, cfg, cs),
  violin: (pts, xs, ys, cfg, cs, iw) => violinToScene(pts, xs, ys, cfg, cs, iw),
  hline: (pts, xs, ys, cfg, cs, iw) => hlineToScene(pts, xs, ys, cfg, cs, iw),
  vline: (pts, xs, ys, cfg, cs, iw, ih) => vlineToScene(pts, xs, ys, cfg, cs, iw, ih),
  abline: (pts, xs, ys, cfg) => ablineToScene(pts, xs, ys, cfg),
  segment: (pts, xs, ys, cfg, cs) => segmentsToScene(pts, xs, ys, cfg, cs),
  pointrange: (pts, xs, ys, cfg, cs) => pointrangeToScene(pts, xs, ys, cfg, cs)
};

// src/tooltip.ts
var Tooltip = class {
  constructor(container, config = {}, aes = {}) {
    this.config = { enabled: true, ...config };
    this.aes = aes;
    this.element = document.createElement("div");
    this.element.className = "ggpbi-tooltip";
    this.element.style.cssText = `
      position: absolute;
      display: none;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
      z-index: 1000;
      max-width: 300px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;
    container.appendChild(this.element);
  }
  /** The tooltip DOM element (for external positioning). */
  getElement() {
    return this.element;
  }
  /** The tooltip's parent container. */
  getContainer() {
    return this.element.parentElement ?? document.body;
  }
  /**
   * Show tooltip with data point info
   */
  show(point2, x2, y2) {
    if (!this.config.enabled) return;
    this.element.replaceChildren();
    this.renderContent(point2);
    this.element.style.display = "block";
    this.element.style.left = `${x2 + 12}px`;
    this.element.style.top = `${y2 - 12}px`;
  }
  /**
   * Hide tooltip
   */
  hide() {
    this.element.style.display = "none";
  }
  /**
   * Render tooltip content safely (no innerHTML)
   */
  renderContent(point2) {
    if (this.config.format) {
      this.element.textContent = this.config.format(point2);
      return;
    }
    const fields = this.config.fields || Object.keys(this.aes).filter((k) => this.aes[k]);
    const presentFields = fields.filter((field) => point2[field] !== void 0);
    if (presentFields.length === 0) {
      const noData = document.createElement("div");
      noData.textContent = "No data";
      this.element.appendChild(noData);
      return;
    }
    for (const field of presentFields) {
      const value = point2[field];
      const formatted = typeof value === "number" ? value.toLocaleString() : String(value);
      const row = document.createElement("div");
      const label = document.createElement("strong");
      label.textContent = `${field}: `;
      row.appendChild(label);
      row.appendChild(document.createTextNode(formatted));
      this.element.appendChild(row);
    }
  }
  /**
   * Remove tooltip from DOM
   */
  destroy() {
    this.element.remove();
  }
};
function attachTooltip(selection2, _dataPoints, tooltip) {
  selection2.on("mouseover", function(event, d) {
    const point2 = "datum" in d ? d.datum : d;
    const [x2, y2] = pointer_default(event, tooltip.getContainer());
    tooltip.show(point2, x2, y2);
  }).on("mousemove", function(event) {
    const [x2, y2] = pointer_default(event, tooltip.getContainer());
    const el = tooltip.getElement();
    el.style.left = `${x2 + 12}px`;
    el.style.top = `${y2 - 12}px`;
  }).on("mouseout", function() {
    tooltip.hide();
  });
}
function attachPbiTooltip(selection2, tooltipService, aes) {
  selection2.on("mouseover", function(event, d) {
    const point2 = "datum" in d ? d.datum : d;
    const [x2, y2] = pointer_default(event, event.currentTarget.closest("svg"));
    const dataItems = buildPbiTooltipItems(point2, aes);
    tooltipService.show({
      dataItems,
      coordinates: [x2, y2],
      identities: point2.__selectionId ? [point2.__selectionId] : [],
      isTouchEvent: false
    });
  }).on("mousemove", function(event, d) {
    const point2 = "datum" in d ? d.datum : d;
    const [x2, y2] = pointer_default(event, event.currentTarget.closest("svg"));
    const dataItems = buildPbiTooltipItems(point2, aes);
    tooltipService.move({
      dataItems,
      coordinates: [x2, y2],
      identities: point2.__selectionId ? [point2.__selectionId] : [],
      isTouchEvent: false
    });
  }).on("mouseout", function() {
    tooltipService.hide({ isTouchEvent: false, immediately: false });
  });
}
function buildPbiTooltipItems(point2, aes) {
  const fields = Object.keys(aes).filter(
    (k) => aes[k] && point2[aes[k]] !== void 0
  );
  return fields.map((field) => {
    const dataField = aes[field];
    const value = point2[dataField];
    return {
      displayName: dataField,
      value: typeof value === "number" ? value.toLocaleString() : String(value)
    };
  });
}

// src/selection.ts
var Selection3 = class {
  constructor(config = {}) {
    this.selectedKeys = /* @__PURE__ */ new Set();
    this.keyToDatum = /* @__PURE__ */ new Map();
    this.config = {
      enabled: config.enabled ?? true,
      mode: config.mode ?? "multi",
      key: config.key ?? ((d) => d),
      onSelectionChange: config.onSelectionChange ?? (() => {
      }),
      selectedStyle: {
        strokeWidth: 2,
        stroke: "#ff6b00",
        opacity: 1,
        ...config.selectedStyle
      },
      unselectedStyle: {
        opacity: 0.3,
        ...config.unselectedStyle
      }
    };
    this.selectionManager = config.selectionManager;
    this.onSelectionChange = this.config.onSelectionChange;
  }
  /**
   * Attach selection handlers to a D3 selection
   */
  attach(selection2) {
    if (!this.config.enabled) return;
    this.attachedSelection = selection2;
    this.injectFocusStyle(selection2);
    selection2.style("cursor", "pointer").on("click", (event, d) => {
      event.stopPropagation();
      const key = this.config.key(d.datum);
      this.keyToDatum.set(key, d.datum);
      const isMulti = this.config.mode === "multi" && event.shiftKey;
      if (isMulti) {
        if (this.selectedKeys.has(key)) {
          this.selectedKeys.delete(key);
        } else {
          this.selectedKeys.add(key);
        }
      } else {
        if (this.selectedKeys.has(key) && this.selectedKeys.size === 1) {
          this.selectedKeys.clear();
        } else {
          this.selectedKeys.clear();
          this.selectedKeys.add(key);
        }
      }
      if (this.selectionManager) {
        const clickedId = d.datum?.__selectionId;
        if (isMulti) {
          if (clickedId) this.adoptAfter(this.selectionManager.select(clickedId, true));
          else if (this.selectedKeys.size === 0) this.adoptAfter(this.selectionManager.clear(), []);
        } else if (this.selectedKeys.size === 0) {
          this.adoptAfter(this.selectionManager.clear(), []);
        } else if (clickedId) {
          this.adoptAfter(this.selectionManager.select(clickedId, false));
        }
      }
      this.updateStyles(selection2);
      this.notifyChange();
    }).on("contextmenu", (event, d) => {
      this.openContextMenu(event, d?.datum?.__selectionId);
    });
  }
  /**
   * Right-click → Power BI's own data-point menu (Drill through, Include /
   * Exclude, Show as a table). Every native visual offers it, so its
   * absence reads as a broken visual rather than a missing feature.
   *
   * The host renders and positions the menu; the visual only reports where
   * the click landed and which point it hit. Passing no selection id opens
   * the menu for the visual as a whole, which is what a click on empty
   * plot area means.
   */
  openContextMenu(event, selectionId) {
    if (!this.selectionManager?.showContextMenu) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectionManager.showContextMenu(selectionId ?? {}, {
      x: event.clientX,
      y: event.clientY
    });
  }
  /**
   * Attach the context menu to the plot background, so right-clicking
   * empty space still reaches the host menu.
   */
  attachBackgroundContextMenu(target) {
    if (!this.selectionManager?.showContextMenu) return;
    target.on("contextmenu", (event) => this.openContextMenu(event));
  }
  /**
   * Adopt the SelectionManager's resolved state once a select()/clear()
   * promise settles. `fallback` is used when the manager resolves without
   * an id array (clear() resolves void).
   */
  adoptAfter(managerResult, fallback) {
    Promise.resolve(managerResult).then((ids) => {
      const resolved = Array.isArray(ids) ? ids : fallback;
      if (resolved) this.adoptManagerState(resolved);
    }).catch(() => {
    });
  }
  /** Stable comparison key for Power BI ISelectionIds. */
  managerIdKey(id2) {
    if (typeof id2?.getKey === "function") return id2.getKey();
    try {
      return JSON.stringify(id2);
    } catch {
      return id2;
    }
  }
  /**
   * Sync local highlight state to a set of Power BI selection ids —
   * the manager's answer after select()/clear(), or a restored selection.
   * Matches ids against the data bound to the attached marks.
   */
  adoptManagerState(ids) {
    const keys = new Set(ids.map((id2) => this.managerIdKey(id2)));
    const selected = [];
    this.attachedSelection?.each((d) => {
      const sid = d?.datum?.__selectionId;
      if (sid != null && keys.has(this.managerIdKey(sid))) selected.push(d.datum);
    });
    this.syncFromExternal(selected);
  }
  /**
   * Toggle selection of a whole group of rows — a legend entry or a
   * categorical axis label was clicked.
   *
   * Plain click: the group becomes the selection; clicking the same group
   * again clears it (re-click is always a stable off-switch). Shift-click
   * adds/removes the group from the current selection. Manager results
   * are adopted as authoritative, like single-mark clicks.
   */
  toggleValueGroup(rows, additive = false) {
    if (!this.config.enabled || rows.length === 0) return;
    const keys = rows.map((d) => this.config.key(d));
    rows.forEach((d, i) => this.keyToDatum.set(keys[i], d));
    const allSelected = keys.every((k) => this.selectedKeys.has(k));
    const isExactlyCurrent = allSelected && this.selectedKeys.size === keys.length;
    if (additive) {
      if (allSelected) keys.forEach((k) => this.selectedKeys.delete(k));
      else keys.forEach((k) => this.selectedKeys.add(k));
    } else if (isExactlyCurrent) {
      this.selectedKeys.clear();
    } else {
      this.selectedKeys = new Set(keys);
    }
    if (this.selectionManager) {
      const ids = rows.map((d) => d.__selectionId).filter((id2) => id2 != null);
      if (this.selectedKeys.size === 0) {
        this.adoptAfter(this.selectionManager.clear(), []);
      } else if (ids.length > 0) {
        this.adoptAfter(this.selectionManager.select(ids, additive));
      }
    }
    if (this.attachedSelection) this.updateStyles(this.attachedSelection);
    this.notifyChange();
  }
  /**
   * Update visual styles based on selection state
   */
  updateStyles(selection2) {
    const hasSelection = this.selectedKeys.size > 0;
    selection2.each((d, i, nodes) => {
      const elem = select_default2(nodes[i]);
      const key = this.config.key(d.datum);
      this.keyToDatum.set(key, d.datum);
      const isSelected = this.selectedKeys.has(key);
      if (hasSelection) {
        if (isSelected) {
          elem.style("opacity", this.config.selectedStyle.opacity ?? 1).attr("stroke", this.config.selectedStyle.stroke ?? "none").attr("stroke-width", this.config.selectedStyle.strokeWidth ?? 0);
        } else {
          elem.style("opacity", this.config.unselectedStyle.opacity ?? 1).attr("stroke", "none").attr("stroke-width", 0);
        }
      } else {
        elem.style("opacity", 1).attr("stroke", "none").attr("stroke-width", 0);
      }
    });
  }
  /**
   * Programmatically select items
   */
  select(data) {
    this.selectedKeys = new Set(data.map((d) => this.config.key(d)));
    for (const d of data) {
      this.keyToDatum.set(this.config.key(d), d);
    }
    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }
  /**
   * Clear the selection when the chart background is clicked.
   *
   * Listens at the document level: the container and SVG root are
   * pointer-events: none (so Power BI can drag-move the visual by its
   * body), which means background clicks never target the container —
   * they land on the document body. Mark clicks call stopPropagation,
   * so any click that reaches the document is a background click.
   * No-op while nothing is selected.
   */
  attachBackgroundClear(container) {
    if (!this.config.enabled) return;
    const doc = container.ownerDocument ?? document;
    select_default2(doc).on("click.ggpbi-clear", () => {
      if (this.selectedKeys.size > 0) this.clear();
    });
  }
  /**
   * Sync local state from an external source (Power BI SelectionManager
   * after a re-render, bookmarks via registerOnSelectCallback).
   *
   * Sets keys and styles WITHOUT writing back to the SelectionManager —
   * the manager is the source of this state, echoing it back would loop.
   */
  syncFromExternal(selected) {
    this.selectedKeys = new Set(selected.map((d) => this.config.key(d)));
    for (const d of selected) {
      this.keyToDatum.set(this.config.key(d), d);
    }
    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }
  /**
   * Clear all selections
   */
  clear() {
    this.selectedKeys.clear();
    if (this.selectionManager) {
      this.selectionManager.clear();
    }
    if (this.attachedSelection) {
      this.updateStyles(this.attachedSelection);
    }
    this.notifyChange();
  }
  /**
   * Get currently selected data
   */
  getSelected() {
    const out = [];
    for (const k of this.selectedKeys) {
      const d = this.keyToDatum.get(k);
      if (d) out.push(d);
    }
    return out;
  }
  /**
   * Check if a datum is selected
   */
  isSelected(datum2) {
    return this.selectedKeys.has(this.config.key(datum2));
  }
  /**
   * Collect Power BI SelectionIds for currently selected data points.
   */
  getSelectedSelectionIds() {
    const ids = [];
    for (const k of this.selectedKeys) {
      const d = this.keyToDatum.get(k);
      if (d?.__selectionId) ids.push(d.__selectionId);
    }
    return ids;
  }
  /**
   * Attach keyboard navigation to the SVG container.
   * ArrowRight/ArrowLeft move focus, Enter/Space select, Escape clears.
   */
  attachKeyboard(svg) {
    if (!this.config.enabled || !this.attachedSelection) return;
    if (this.selectionManager) return;
    svg.attr("tabindex", "0").style("outline", "none");
    svg.on("keydown", (event) => {
      const nodes = this.attachedSelection?.nodes() ?? [];
      if (nodes.length === 0) return;
      const active = document.activeElement;
      const idx = nodes.indexOf(active);
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown": {
          event.preventDefault();
          const next = idx < nodes.length - 1 ? idx + 1 : 0;
          nodes[next]?.focus();
          break;
        }
        case "ArrowLeft":
        case "ArrowUp": {
          event.preventDefault();
          const prev = idx > 0 ? idx - 1 : nodes.length - 1;
          nodes[prev]?.focus();
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          if (idx >= 0) {
            const d = select_default2(nodes[idx]).datum();
            if (d?.datum) {
              const key = this.config.key(d.datum);
              this.keyToDatum.set(key, d.datum);
              if (this.selectedKeys.has(key)) {
                this.selectedKeys.delete(key);
              } else {
                this.selectedKeys.add(key);
              }
              if (this.selectionManager) {
                const toggledId = d.datum?.__selectionId;
                if (toggledId) this.adoptAfter(this.selectionManager.select(toggledId, true));
                if (this.selectedKeys.size === 0) this.adoptAfter(this.selectionManager.clear(), []);
              }
              this.updateStyles(this.attachedSelection);
              this.notifyChange();
            }
          }
          break;
        }
        case "Escape": {
          event.preventDefault();
          this.clear();
          svg.node()?.focus();
          break;
        }
      }
    });
  }
  /** Inject CSS for keyboard focus ring (once per document). */
  injectFocusStyle(selection2) {
    const node = selection2.node();
    if (!node) return;
    const doc = node.ownerDocument;
    if (!doc || doc.getElementById("ggpbi-focus-style")) return;
    const style = doc.createElement("style");
    style.id = "ggpbi-focus-style";
    style.textContent = `
      .ggpbi-point:focus, .ggpbi-bar:focus, .ggpbi-text:focus {
        outline: 2px solid #118DFF;
        outline-offset: 2px;
      }
    `;
    doc.head.appendChild(style);
  }
  notifyChange() {
    this.onSelectionChange(this.getSelected());
  }
};

// src/auto-geom.ts
function inferScaleLevel(data, field) {
  for (const d of data) {
    const v = d[field];
    if (v === null || v === void 0) continue;
    if (v instanceof Date) return "time";
    if (typeof v === "number") return "numeric";
    if (typeof v === "string") {
      const s = v.trim();
      if (s !== "" && Number.isFinite(Number(s))) return "numeric";
    }
    return "categorical";
  }
  return "categorical";
}
function inferGeom(data, aes) {
  const hasX = !!aes.x;
  const hasY = !!aes.y;
  const xLevel = hasX ? inferScaleLevel(data, aes.x) : void 0;
  const yLevel = hasY ? inferScaleLevel(data, aes.y) : void 0;
  if (!hasX && hasY && yLevel === "numeric") {
    return { type: "boxplot" };
  }
  if (!hasX && hasY && yLevel === "categorical") {
    return { type: "bar", orientation: "y" };
  }
  if (hasX && !hasY) {
    if (xLevel === "numeric") {
      return { type: "histogram" };
    }
    return { type: "bar" };
  }
  if (hasX && hasY) {
    if (xLevel === "time" && yLevel === "numeric") {
      return { type: "line" };
    }
    if (xLevel === "numeric" && yLevel === "numeric") {
      return { type: "point" };
    }
    if (xLevel === "categorical" && yLevel === "numeric") {
      return { type: "bar" };
    }
    if (xLevel === "categorical") {
      return { type: "bar" };
    }
    if (xLevel === "numeric" && yLevel === "categorical") {
      const yVals = data.map((d) => d[aes.y]).filter((v) => v != null);
      const unique = new Set(yVals.map(String));
      if (unique.size === yVals.length) {
        return { type: "bar", orientation: "y" };
      }
      return { type: "point" };
    }
    if (yLevel === "categorical") {
      return { type: "point" };
    }
    if (xLevel === "time") {
      return { type: "bar" };
    }
  }
  return { type: "point" };
}

// src/legend.ts
function geomToKeyShape(geoms) {
  const primary = geoms[0]?.type;
  if (primary === "point") return "circle";
  if (primary === "line") return "line";
  return "square";
}
function estimateLegendWidth(entries, title, theme) {
  const charWidth = theme.legendTextSize * 0.55;
  const keyWidth = theme.legendTextSize * 1.2;
  const padding = theme.halfLine * 3;
  const maxLabelLen = Math.max(
    title.length,
    ...entries.map((e) => e.label.length)
  );
  return Math.ceil(keyWidth + maxLabelLen * charWidth + padding);
}
function renderLegend(parent, entries, title, geoms, theme, innerWidth) {
  const keyShape = geomToKeyShape(geoms);
  const keySize = theme.legendTextSize;
  const rowHeight = keySize * 1.8;
  const keyPad = keySize * 0.5;
  const legendX = innerWidth + theme.halfLine * 2;
  const legendG = parent.append("g").attr("class", "ggpbi-legend").attr("transform", `translate(${legendX}, 0)`);
  legendG.append("text").attr("x", 0).attr("y", keySize).text(title).style("font-size", `${theme.legendTextSize}px`).style("font-weight", "600").style("fill", theme.ink);
  const startY = keySize + rowHeight * 0.6;
  entries.forEach((entry, i) => {
    const y2 = startY + i * rowHeight;
    const entryG = legendG.append("g").attr("class", "ggpbi-legend-entry").attr("data-label", entry.label);
    if (keyShape === "circle") {
      entryG.append("circle").attr("cx", keySize / 2).attr("cy", y2 + keySize / 2).attr("r", keySize * 0.35).attr("fill", entry.color);
    } else if (keyShape === "line") {
      entryG.append("line").attr("x1", 0).attr("y1", y2 + keySize / 2).attr("x2", keySize).attr("y2", y2 + keySize / 2).attr("stroke", entry.color).attr("stroke-width", 2);
    } else {
      entryG.append("rect").attr("x", 0).attr("y", y2).attr("width", keySize).attr("height", keySize).attr("fill", entry.color).attr("rx", 2);
    }
    entryG.append("text").attr("x", keySize + keyPad).attr("y", y2 + keySize * 0.8).text(entry.label).style("font-size", `${theme.legendTextSize}px`).style("fill", theme.axisTextColor);
  });
}

// src/theme.ts
var PBI_DEFAULT_PALETTE = [
  "#118DFF",
  // blue
  "#12239E",
  // dark blue
  "#E66C37",
  // orange
  "#6B007B",
  // purple
  "#E044A7",
  // pink
  "#744EC2",
  // violet
  "#D9B300",
  // gold
  "#D64550"
  // red
];
var DEFAULT_CONFIG = {
  baseSize: 11,
  axisTextOverlap: "hide",
  axisTextDodge: 1,
  nBreaks: 5,
  ink: "#333333",
  paper: "#ffffff",
  accent: "#118DFF",
  panelFill: "#EBEBEB",
  gridColor: "#ffffff",
  colorPalette: PBI_DEFAULT_PALETTE,
  isHighContrast: false
};
function mixColor(hex1, hex2, ratio) {
  const parse = (h) => {
    const c = h.replace("#", "");
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const mix = (a, b) => Math.round(a + (b - a) * ratio);
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`;
}
function resolveTheme(config = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const halfLine = c.baseSize / 2;
  const baseLineSize = c.baseSize / 22;
  const margin = {
    top: Math.round(halfLine * 2),
    right: Math.round(halfLine * 2),
    bottom: Math.round(halfLine * 2 + c.baseSize * 0.8 + halfLine / 2 + c.baseSize + halfLine / 2),
    left: Math.round(halfLine * 2 + c.baseSize * 0.8 + halfLine / 2 + c.baseSize + halfLine / 2)
  };
  return {
    config: c,
    halfLine,
    baseLineSize,
    axisTextSize: c.baseSize * 0.8,
    axisTitleSize: c.baseSize,
    plotTitleSize: c.baseSize * 1.2,
    plotCaptionSize: c.baseSize * 0.8,
    legendTextSize: c.baseSize * 0.8,
    tickLength: 0.5 * halfLine,
    axisTextMargin: 0.8 * halfLine / 2,
    axisTitleMargin: halfLine / 2,
    margin,
    ink: c.ink,
    paper: c.paper,
    accent: c.accent,
    axisTextColor: mixColor(c.ink, c.paper, 0.3),
    axisTickColor: mixColor(c.ink, c.paper, 0.2),
    panelFill: c.panelFill,
    gridColor: c.gridColor,
    axisTextOverlap: c.axisTextOverlap,
    axisTextDodge: c.axisTextDodge,
    nBreaks: c.nBreaks,
    pointSize: c.baseSize / 11 * 1.5,
    colorPalette: c.colorPalette,
    isHighContrast: c.isHighContrast,
    highContrastStrokeWidth: c.isHighContrast ? 2 : 0
  };
}
function axisLabelPriority(n) {
  if (n <= 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];
  const result = [0, n - 1];
  function between(lo, hi) {
    const span = hi - lo + 1;
    if (span <= 2) return;
    const mid = lo + Math.floor((span - 1) / 2);
    result.push(mid);
    between(lo, mid);
    between(mid, hi);
  }
  between(0, n - 1);
  return result;
}
function themeGrey(baseSize = 11) {
  return { baseSize, ...GREY_DEFAULTS };
}
var GREY_DEFAULTS = {
  panelFill: "#EBEBEB",
  gridColor: "#ffffff",
  ink: "#333333",
  paper: "#ffffff"
};
function themeMinimal(baseSize = 11) {
  return { baseSize, panelFill: "#ffffff", gridColor: "#e0e0e0", ink: "#333333" };
}
function themeDark(baseSize = 11) {
  return {
    baseSize,
    panelFill: "#2d2d2d",
    gridColor: "#444444",
    ink: "#e0e0e0",
    paper: "#1a1a1a",
    accent: "#5599ff"
  };
}

// src/scene-renderer.ts
function applyNodeStyle(el, style) {
  if (style.fill != null) el.attr("fill", style.fill);
  if (style.stroke != null) el.attr("stroke", style.stroke);
  if (style.strokeWidth != null) el.attr("stroke-width", style.strokeWidth);
  if (style.strokeDasharray != null) el.attr("stroke-dasharray", style.strokeDasharray);
  if (style.strokeLinecap != null) el.attr("stroke-linecap", style.strokeLinecap);
  if (style.strokeLinejoin != null) el.attr("stroke-linejoin", style.strokeLinejoin);
  if (style.strokeMiterlimit != null) el.attr("stroke-miterlimit", style.strokeMiterlimit);
  if (style.opacity != null) el.attr("opacity", style.opacity);
}
function applyAria(el, aria) {
  if (!aria) return;
  if (aria.role) el.attr("role", aria.role);
  if (aria.tabindex) el.attr("tabindex", aria.tabindex);
  if (aria.label) el.attr("aria-label", aria.label);
}
function bindDatum(el, data) {
  if (data) el.datum(data);
}
function ensureMarker(parent, marker) {
  const svg = select_default2(parent.node().ownerSVGElement);
  let defs = svg.select("defs");
  if (defs.empty()) {
    defs = svg.append("defs");
  }
  if (!defs.select(`#${marker.id}`).empty()) return;
  const halfAngleRad = marker.angle / 2 * (Math.PI / 180);
  const dx = marker.length * Math.cos(halfAngleRad);
  const dy = marker.length * Math.sin(halfAngleRad);
  const m = defs.append("marker").attr("id", marker.id).attr("viewBox", `0 0 ${marker.length} ${marker.length}`).attr("refX", marker.length).attr("refY", marker.length / 2).attr("markerWidth", marker.length).attr("markerHeight", marker.length).attr("orient", "auto-start-reverse");
  const tipX = marker.length;
  const tipY = marker.length / 2;
  const pathData = marker.type === "closed" ? `M${tipX - dx},${tipY - dy} L${tipX},${tipY} L${tipX - dx},${tipY + dy} Z` : `M${tipX - dx},${tipY - dy} L${tipX},${tipY} L${tipX - dx},${tipY + dy}`;
  m.append("path").attr("d", pathData).attr("fill", marker.fill).attr("stroke", marker.color).attr("stroke-width", 1);
}
function renderNode(parent, node) {
  switch (node.type) {
    case "rect": {
      const el = parent.append("rect").attr("class", node.class).attr("x", node.x).attr("y", node.y).attr("width", node.width).attr("height", node.height);
      applyNodeStyle(el, node.style);
      applyAria(el, node.aria);
      bindDatum(el, node.data);
      return el.node();
    }
    case "path": {
      const el = parent.append("path").attr("class", node.class).attr("d", node.d);
      if (node.transform) el.attr("transform", node.transform);
      if (node.markerEnd) {
        ensureMarker(parent, node.markerEnd);
        el.attr("marker-end", `url(#${node.markerEnd.id})`);
      }
      if (node.markerStart) {
        ensureMarker(parent, node.markerStart);
        el.attr("marker-start", `url(#${node.markerStart.id})`);
      }
      applyNodeStyle(el, node.style);
      applyAria(el, node.aria);
      bindDatum(el, node.data);
      return el.node();
    }
    case "line": {
      const el = parent.append("line").attr("class", node.class).attr("x1", node.x1).attr("y1", node.y1).attr("x2", node.x2).attr("y2", node.y2);
      if (node.markerEnd) {
        ensureMarker(parent, node.markerEnd);
        el.attr("marker-end", `url(#${node.markerEnd.id})`);
      }
      if (node.markerStart) {
        ensureMarker(parent, node.markerStart);
        el.attr("marker-start", `url(#${node.markerStart.id})`);
      }
      applyNodeStyle(el, node.style);
      applyAria(el, node.aria);
      bindDatum(el, node.data);
      return el.node();
    }
    case "text": {
      const el = parent.append("text").attr("class", node.class).attr("x", node.x).attr("y", node.y).text(node.text);
      if (node.textAnchor) el.attr("text-anchor", node.textAnchor);
      if (node.dy) el.attr("dy", node.dy);
      if (node.fontSize != null) el.attr("font-size", node.fontSize);
      if (node.fontFamily) el.attr("font-family", node.fontFamily);
      if (node.transform) el.attr("transform", node.transform);
      applyNodeStyle(el, node.style);
      applyAria(el, node.aria);
      bindDatum(el, node.data);
      return el.node();
    }
    case "group": {
      const el = parent.append("g").attr("class", node.class);
      if (node.transform) el.attr("transform", node.transform);
      applyNodeStyle(el, node.style);
      applyAria(el, node.aria);
      bindDatum(el, node.data);
      for (const child of node.children) {
        renderNode(el, child);
      }
      return el.node();
    }
  }
}
function renderSceneNodes(g, nodes) {
  for (const node of nodes) {
    renderNode(g, node);
  }
}

// src/panel.ts
var clipCounter = 0;
function nextClipId(suffix) {
  clipCounter += 1;
  return `ggpbi-clip-${suffix}-${clipCounter}`;
}
function ggBreaks(scale, nBreaks, labelFormat, fmt = {}) {
  if (typeof scale.bandwidth === "function") return void 0;
  if (typeof scale.domain !== "function") return void 0;
  const dom = scale.domain();
  if (dom.length < 2) return void 0;
  if (dom[0] instanceof Date || dom[1] instanceof Date) {
    if (typeof scale.ticks !== "function") return void 0;
    const dateTicks = scale.ticks(nBreaks);
    if (dateTicks.length === 0) return void 0;
    return { ticks: dateTicks, labels: formatDates(dateTicks, fmt.dateFormat, fmt) };
  }
  const lo = Number(dom[0]);
  const hi = Number(dom[1]);
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return void 0;
  const allTicks = extendedBreaks(lo, hi, nBreaks);
  const ticks2 = allTicks.filter((t) => t >= lo && t <= hi);
  const labels = formatBreaksAs(ticks2, labelFormat, fmt);
  return { ticks: ticks2, labels };
}
function applyOverlapCheck(axisGroup, direction) {
  const texts = axisGroup.selectAll("text");
  const nodes = texts.nodes();
  if (nodes.length <= 1) return;
  const priority = axisLabelPriority(nodes.length);
  const occupied = [];
  nodes.forEach((n) => n.style.display = "");
  for (const idx of priority) {
    const node = nodes[idx];
    if (!node) continue;
    if (typeof node.getBoundingClientRect !== "function") continue;
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    let lo, hi;
    if (direction === "x") {
      lo = rect.left;
      hi = rect.right;
    } else {
      lo = rect.top;
      hi = rect.bottom;
    }
    const pad2 = 2;
    const overlaps = occupied.some(([oLo, oHi]) => lo - pad2 < oHi && hi + pad2 > oLo);
    if (overlaps) {
      node.style.display = "none";
    } else {
      occupied.push([lo, hi]);
    }
  }
}
function renderPanel(ctx) {
  const { panelG, svg, innerWidth, innerHeight, xScale, yScale, theme, colorScale, geoms, layerData } = ctx;
  panelG.insert("rect", ":first-child").attr("class", "ggpbi-panel").attr("width", innerWidth).attr("height", innerHeight).attr("fill", theme.panelFill);
  const xBreaks = ggBreaks(
    xScale,
    theme.nBreaks,
    ctx.xLabelFormat,
    { ...ctx.format, dateFormat: ctx.xDateFormat }
  );
  const yBreaks = ggBreaks(
    yScale,
    theme.nBreaks,
    ctx.yLabelFormat,
    { ...ctx.format, dateFormat: ctx.yDateFormat }
  );
  const isBandX = typeof xScale.bandwidth === "function";
  const xTicks = isBandX ? [] : xBreaks?.ticks ?? (xScale.ticks ? xScale.ticks(theme.nBreaks) : []);
  const yTicks = yBreaks?.ticks ?? (yScale.ticks ? yScale.ticks(theme.nBreaks) : []);
  const yDom = yScale.domain?.();
  const xDom = xScale.domain?.();
  const yMinor = yDom ? minorBreaks(yTicks, yDom[0], yDom[1]) : [];
  const xMinor = isBandX ? [] : xDom ? minorBreaks(xTicks, xDom[0], xDom[1]) : [];
  for (const tick of yMinor) {
    panelG.append("line").attr("class", "ggpbi-grid-minor").attr("x1", 0).attr("x2", innerWidth).attr("y1", yScale(tick)).attr("y2", yScale(tick)).attr("stroke", theme.gridColor).attr("stroke-width", theme.baseLineSize * 0.5);
  }
  for (const tick of xMinor) {
    panelG.append("line").attr("class", "ggpbi-grid-minor").attr("y1", 0).attr("y2", innerHeight).attr("x1", xScale(tick)).attr("x2", xScale(tick)).attr("stroke", theme.gridColor).attr("stroke-width", theme.baseLineSize * 0.5);
  }
  for (const tick of yTicks) {
    panelG.append("line").attr("class", "ggpbi-grid").attr("x1", 0).attr("x2", innerWidth).attr("y1", yScale(tick)).attr("y2", yScale(tick)).attr("stroke", theme.gridColor).attr("stroke-width", theme.baseLineSize);
  }
  for (const tick of xTicks) {
    panelG.append("line").attr("class", "ggpbi-grid").attr("y1", 0).attr("y2", innerHeight).attr("x1", xScale(tick)).attr("x2", xScale(tick)).attr("stroke", theme.gridColor).attr("stroke-width", theme.baseLineSize);
  }
  const clipId = nextClipId(ctx.clipSuffix ?? "panel");
  svg.insert("defs", ":first-child").append("clipPath").attr("id", clipId).append("rect").attr("x", 0).attr("y", 0).attr("width", innerWidth).attr("height", innerHeight);
  const geomClipGroup = panelG.append("g").attr("class", "ggpbi-geom-clip").attr("clip-path", `url(#${clipId})`);
  const xAxis = axisBottom(xScale).tickSize(theme.tickLength).tickSizeOuter(0);
  if (xBreaks) {
    xAxis.tickValues(xBreaks.ticks).tickFormat((_d, i) => xBreaks.labels[i] ?? "");
  } else {
    xAxis.ticks(theme.nBreaks);
  }
  const yAxis = axisLeft(yScale).tickSize(theme.tickLength).tickSizeOuter(0);
  if (yBreaks) {
    yAxis.tickValues(yBreaks.ticks).tickFormat((_d, i) => yBreaks.labels[i] ?? "");
  } else {
    yAxis.ticks(theme.nBreaks);
  }
  const xAxisGroup = panelG.append("g").attr("class", "ggpbi-axis-x").attr("transform", `translate(0,${innerHeight})`).call(xAxis);
  xAxisGroup.selectAll("text").style("font-size", `${theme.axisTextSize}px`).style("fill", theme.axisTextColor);
  xAxisGroup.selectAll(".tick line").style("stroke", theme.axisTickColor);
  xAxisGroup.select(".domain").style("display", "none");
  const yAxisGroup = panelG.append("g").attr("class", "ggpbi-axis-y").call(yAxis);
  yAxisGroup.selectAll("text").style("font-size", `${theme.axisTextSize}px`).style("fill", theme.axisTextColor);
  yAxisGroup.selectAll(".tick line").style("stroke", theme.axisTickColor);
  yAxisGroup.select(".domain").style("display", "none");
  if (theme.axisTextOverlap === "hide") {
    applyOverlapCheck(xAxisGroup, "x");
    applyOverlapCheck(yAxisGroup, "y");
  } else if (theme.axisTextOverlap === "rotate") {
    xAxisGroup.selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end").attr("dx", "-0.5em").attr("dy", "0.25em");
  }
  const repelShared = { repelPlaced: [], repelAnchors: [] };
  for (let li = 0; li < geoms.length; li++) {
    const geom = geoms[li];
    const layerBound = layerData[li] ?? [];
    const layerGroup = geomClipGroup.append("g").attr("class", `ggpbi-layer-${geom.type}`).attr("role", "list").attr("aria-label", "Data points");
    try {
      const sceneBuilder = sceneBuilders[geom.type];
      const layerColorScale = geom.highlight === false ? ctx.colorScaleBase ?? colorScale : colorScale;
      if (geom.type === "point") {
        const xo = bandOffset(xScale);
        const yo = bandOffset(yScale);
        for (const bp of layerBound) {
          const px = xScale(bp.x) + xo;
          const py = yScale(bp.y) + yo;
          if (Number.isFinite(px) && Number.isFinite(py)) {
            repelShared.repelAnchors.push({ x: px, y: py });
          }
        }
      }
      const nodes = sceneBuilder(layerBound, xScale, yScale, geom, layerColorScale, innerWidth, innerHeight, repelShared);
      renderSceneNodes(layerGroup, nodes);
    } catch (err) {
      console.warn(`ggpbi: layer ${li} (${geom.type}) failed to render, skipping.`, err);
      layerGroup.append("text").attr("class", "ggpbi-layer-error").attr("x", innerWidth / 2).attr("y", innerHeight / 2).attr("text-anchor", "middle").attr("fill", theme.axisTextColor).attr("font-size", `${theme.axisTextSize}px`).attr("opacity", 0.6).text(`Layer "${geom.type}" failed`);
    }
  }
  if (theme.isHighContrast) {
    panelG.selectAll(".ggpbi-bar").attr("stroke", theme.ink).attr("stroke-width", theme.highContrastStrokeWidth);
    panelG.selectAll(".ggpbi-point").attr("stroke", theme.ink).attr("stroke-width", theme.highContrastStrokeWidth);
  }
}

// src/codegen.ts
var AES_ORDER = [
  "x",
  "y",
  "color",
  "fill",
  "size",
  "shape",
  "alpha",
  "group",
  "label",
  "facetCol",
  "facetRow",
  "xend",
  "yend",
  "xmin",
  "xmax",
  "ymin",
  "ymax"
];
var GEOM_DEFAULTS = {
  position: "identity",
  alpha: 1,
  repel: false,
  trim: void 0,
  orientation: "x",
  linetype: "solid",
  shape: "circle",
  notch: false,
  varwidth: false,
  se: true
};
var SKIP_GEOM_KEYS = /* @__PURE__ */ new Set(["type", "aes", "stat"]);
var LITERAL_ARRAY_LIMIT = 6;
var q = (s) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
function literal(value) {
  if (typeof value === "string") return q(value);
  if (typeof value === "number") return String(Math.round(value * 1e3) / 1e3);
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return `new Date(${q(value.toISOString().slice(0, 10))})`;
  if (Array.isArray(value)) {
    if (value.length > LITERAL_ARRAY_LIMIT) return `[/* ${value.length} values */]`;
    return `[${value.map(literal).join(", ")}]`;
  }
  if (value && typeof value === "object") return objectLiteral(value);
  return String(value);
}
function objectLiteral(obj) {
  const parts = Object.entries(obj).filter(([, v]) => v !== void 0 && v !== null && v !== "").map(([k, v]) => `${k}: ${literal(v)}`);
  return parts.length > 0 ? `{ ${parts.join(", ")} }` : "";
}
function fieldName(aes, key, labels) {
  const bound = aes[key];
  if (typeof bound !== "string" || !bound) return void 0;
  if (bound.startsWith("__")) return void 0;
  return labels[key] ?? bound;
}
function geomOptions(geom) {
  const out = {};
  for (const [key, value] of Object.entries(geom)) {
    if (SKIP_GEOM_KEYS.has(key)) continue;
    if (value === void 0 || value === null || value === "") continue;
    if (key in GEOM_DEFAULTS && GEOM_DEFAULTS[key] === value) continue;
    if (typeof value === "function") continue;
    out[key] = value;
  }
  return objectLiteral(out);
}
function scaleOptions(cfg) {
  if (!cfg) return "";
  if (typeof cfg === "string") return q(cfg);
  const out = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (value === void 0 || value === null || value === "") continue;
    if (key === "type" && value === "auto") continue;
    if (typeof value === "function") continue;
    out[key] = value;
  }
  return objectLiteral(out);
}
function specToCode(spec, labels = {}) {
  const lines = ["ggpbi()"];
  const rowCount = spec.data?.length ?? 0;
  lines.push(`  .data(data)${rowCount ? `                       // ${rowCount.toLocaleString()} rows` : ""}`);
  const aesParts = [];
  for (const key of AES_ORDER) {
    const name = fieldName(spec.aes, key, labels);
    if (name) aesParts.push(`${key}: ${q(name)}`);
  }
  if (aesParts.length > 0) lines.push(`  .aes({ ${aesParts.join(", ")} })`);
  for (const layer of spec.layers) {
    const opts = geomOptions(layer.geom);
    lines.push(`  .geom(${q(layer.geom.type)}${opts ? `, ${opts}` : ""})`);
  }
  if (spec.layers.length === 0) lines.push("  // no explicit layer \u2014 ggpbi picks one from the fields");
  const scaleParts = [];
  for (const axis2 of ["x", "y"]) {
    const opts = scaleOptions(spec.scales?.[axis2]);
    if (opts) scaleParts.push(`${axis2}: ${opts}`);
  }
  if (scaleParts.length > 0) lines.push(`  .scale({ ${scaleParts.join(", ")} })`);
  if (spec.facet) {
    const facet = objectLiteral(spec.facet);
    if (facet) lines.push(`  .facet(${facet})`);
  }
  if (spec.highlight) {
    const values = spec.highlight.values;
    lines.push(Array.isArray(values) ? `  .highlight({ values: ${literal(values)} })` : "  .highlight({ filter: d => /* \u2026 */ })");
  }
  const theme = objectLiteral(spec.theme ?? {});
  if (theme) lines.push(`  .theme(${theme})`);
  if (typeof spec.subtitle === "string" && spec.subtitle !== "auto") {
    lines.push(`  .subtitle(${q(spec.subtitle)})`);
  }
  if (spec.format?.locale) lines.push(`  .format({ locale: ${q(spec.format.locale)} })`);
  if (spec.width && spec.height) lines.push(`  .size(${Math.round(spec.width)}, ${Math.round(spec.height)})`);
  lines.push("  .renderTo(element);");
  return lines.join("\n");
}
var CALL_RE = /\.[a-zA-Z_$][\w$]*(?=\()/y;
var STRING_RE = /'(?:[^'\\]|\\.)*'/y;
var NUMBER_RE = /-?\d+(?:\.\d+)?/y;
var KEYWORD_RE = /\b(?:true|false|null|undefined|new|Date)\b/y;
var PROPERTY_RE = /[a-zA-Z_$][\w$]*(?=\s*:)/y;
var IDENT_RE = /[a-zA-Z_$][\w$]*/y;
var COMMENT_RE = /\/\/[^\n]*/y;
function highlight(code) {
  const tokens = [];
  let i = 0;
  const tryMatch = (re2, kind) => {
    re2.lastIndex = i;
    const m = re2.exec(code);
    if (!m) return false;
    tokens.push({ text: m[0], kind });
    i += m[0].length;
    return true;
  };
  while (i < code.length) {
    if (tryMatch(COMMENT_RE, "plain") || tryMatch(CALL_RE, "call") || tryMatch(STRING_RE, "string") || tryMatch(KEYWORD_RE, "keyword") || tryMatch(NUMBER_RE, "number") || tryMatch(PROPERTY_RE, "property") || tryMatch(IDENT_RE, "plain")) continue;
    const ch = code[i];
    const kind = "{}()[].,:;".includes(ch) ? "punct" : "plain";
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += ch;
    else tokens.push({ text: ch, kind });
    i += 1;
  }
  return tokens.map((t) => t.text.startsWith("//") ? { ...t, kind: "plain" } : t);
}

// src/code-view.ts
var PALETTE = {
  light: {
    plain: "#6a737d",
    call: "#6f42c1",
    string: "#032f62",
    number: "#005cc5",
    keyword: "#d73a49",
    property: "#22863a",
    punct: "#586069"
  },
  dark: {
    plain: "#8b949e",
    call: "#d2a8ff",
    string: "#a5d6ff",
    number: "#79c0ff",
    keyword: "#ff7b72",
    property: "#7ee787",
    punct: "#8b949e"
  }
};
function isDarkSurface(hex2) {
  const m = /^#?([\da-f]{6})$/i.exec(hex2.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}
function renderCodeView(container, code, theme, options = {}) {
  const dark = isDarkSurface(theme.paper ?? "#ffffff");
  const colors = PALETTE[dark ? "dark" : "light"];
  const surface = dark ? "#0d1117" : "#f6f8fa";
  const border = dark ? "#30363d" : "#d0d7de";
  const headerInk = dark ? "#8b949e" : "#57606a";
  const panel = container.ownerDocument.createElement("div");
  panel.className = "ggpbi-code-view";
  panel.style.cssText = [
    "position:absolute",
    "top:8px",
    "left:8px",
    "right:8px",
    "max-height:calc(100% - 16px)",
    "display:flex",
    "flex-direction:column",
    `background-color:${surface}`,
    `border:1px solid ${border}`,
    "border-radius:6px",
    "box-shadow:0 2px 8px rgba(0,0,0,0.15)",
    "z-index:10",
    "overflow:hidden",
    // The chart underneath stays interactive except where the panel is.
    "pointer-events:auto"
  ].join(";");
  const header = container.ownerDocument.createElement("div");
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:8px",
    "padding:6px 10px",
    `border-bottom:1px solid ${border}`,
    `color:${headerInk}`,
    'font:600 11px/1.4 "Segoe UI",sans-serif',
    "flex:0 0 auto"
  ].join(";");
  const title = container.ownerDocument.createElement("span");
  title.textContent = "ggpbi code";
  header.appendChild(title);
  const actions = container.ownerDocument.createElement("span");
  actions.style.cssText = "display:flex;gap:6px;align-items:center";
  const button = (label) => {
    const b = container.ownerDocument.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = [
      "cursor:pointer",
      "padding:2px 8px",
      "background-color:transparent",
      `border:1px solid ${border}`,
      "border-radius:4px",
      `color:${headerInk}`,
      "font:inherit"
    ].join(";");
    return b;
  };
  const copyBtn = button("Copy");
  copyBtn.addEventListener("click", () => {
    void copyText(container, code).then((ok) => {
      copyBtn.textContent = ok ? "Copied" : "Press Ctrl+C";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 2e3);
    });
  });
  actions.appendChild(copyBtn);
  if (options.onClose) {
    const closeBtn = button("\u2715");
    closeBtn.setAttribute("aria-label", "Hide code");
    closeBtn.addEventListener("click", options.onClose);
    actions.appendChild(closeBtn);
  }
  header.appendChild(actions);
  panel.appendChild(header);
  const pre = container.ownerDocument.createElement("pre");
  pre.style.cssText = [
    "margin:0",
    "padding:10px 12px",
    "overflow:auto",
    "flex:1 1 auto",
    'font:12px/1.55 "Cascadia Code",Consolas,"SF Mono",Menlo,monospace',
    `color:${colors.plain}`,
    "white-space:pre",
    "tab-size:2",
    // Selectable so Ctrl+C works when the clipboard API is blocked.
    "user-select:text",
    "-webkit-user-select:text"
  ].join(";");
  const codeEl = container.ownerDocument.createElement("code");
  for (const token of highlight(code)) {
    const span = container.ownerDocument.createElement("span");
    span.textContent = token.text;
    span.style.color = colors[token.kind];
    codeEl.appendChild(span);
  }
  pre.appendChild(codeEl);
  panel.appendChild(pre);
  container.appendChild(panel);
  return panel;
}
async function copyText(container, text) {
  try {
    const clipboard = container.ownerDocument.defaultView?.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  try {
    const doc = container.ownerDocument;
    const area = doc.createElement("textarea");
    area.value = text;
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    doc.body.appendChild(area);
    area.select();
    const ok = doc.execCommand?.("copy") ?? false;
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// src/position.ts
function applyDodge(points, padded = false) {
  const colorGroups = Array.from(
    new Set(points.map((d) => String(d.color ?? "__none__")))
  );
  const nColors = colorGroups.length;
  return points.map((d) => ({
    ...d,
    _dodgeIndex: colorGroups.indexOf(String(d.color ?? "__none__")),
    _dodgeN: nColors,
    _dodgePadded: padded
  }));
}
function applyStack(points, orientation = "x") {
  const isHorizontal = orientation === "y";
  const catKey = (d) => String(isHorizontal ? d.y : d.x);
  const seriesKey = (d) => `${String(d.group ?? "")}|${String(d.color ?? "")}`;
  const groups2 = /* @__PURE__ */ new Map();
  for (const d of points) {
    const key = catKey(d);
    if (!groups2.has(key)) groups2.set(key, []);
    groups2.get(key).push(d);
  }
  const seriesOrder = /* @__PURE__ */ new Map();
  for (const d of points) {
    const key = seriesKey(d);
    if (!seriesOrder.has(key)) seriesOrder.set(key, seriesOrder.size);
  }
  if (seriesOrder.size > 1) {
    for (const group2 of groups2.values()) {
      group2.sort((a, b) => seriesOrder.get(seriesKey(a)) - seriesOrder.get(seriesKey(b)));
    }
  }
  const result = new Array(points.length);
  const pointIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < points.length; i++) {
    pointIndex.set(points[i], i);
  }
  for (const [, group2] of groups2) {
    let cumPos = 0;
    let cumNeg = 0;
    for (const d of group2) {
      const val = Number(isHorizontal ? d.x : d.y);
      const idx = pointIndex.get(d);
      if (!Number.isFinite(val)) {
        result[idx] = { ...d, _v0: cumPos, _v1: cumPos };
        continue;
      }
      if (val >= 0) {
        result[idx] = { ...d, _v0: cumPos, _v1: cumPos + val };
        cumPos += val;
      } else {
        result[idx] = { ...d, _v0: cumNeg + val, _v1: cumNeg };
        cumNeg += val;
      }
    }
  }
  return result;
}
function applyFill(points, orientation = "x") {
  const stacked = applyStack(points, orientation);
  const isHorizontal = orientation === "y";
  const catKey = (d) => String(isHorizontal ? d.y : d.x);
  const posTotal = /* @__PURE__ */ new Map();
  const negTotal = /* @__PURE__ */ new Map();
  for (const d of stacked) {
    const key = catKey(d);
    const v1 = d._v1;
    const v0 = d._v0;
    if (v1 > 0) posTotal.set(key, Math.max(posTotal.get(key) ?? 0, v1));
    if (v0 < 0) negTotal.set(key, Math.min(negTotal.get(key) ?? 0, v0));
  }
  return stacked.map((d) => {
    const key = catKey(d);
    const v0 = d._v0;
    const v1 = d._v1;
    if (v1 > 0 && v0 >= 0) {
      const total = posTotal.get(key) ?? 1;
      if (total === 0) return d;
      return { ...d, _v0: v0 / total, _v1: v1 / total };
    } else if (v0 < 0 && v1 <= 0) {
      const total = Math.abs(negTotal.get(key) ?? -1);
      if (total === 0) return d;
      return { ...d, _v0: v0 / total, _v1: v1 / total };
    }
    return d;
  });
}
function computePosition(points, geom) {
  const position = geom.position ?? "stack";
  const orientation = ("orientation" in geom ? geom.orientation : void 0) ?? "x";
  switch (position) {
    case "dodge":
      return applyDodge(points);
    case "dodge2":
      return applyDodge(points, true);
    case "stack":
      return applyStack(points, orientation);
    case "fill":
      return applyFill(points, orientation);
    case "identity":
    case "jitter":
      return points.map((d) => ({ ...d }));
  }
}

// src/describe.ts
var GEOM_NOUN = {
  point: "Values",
  line: "Values",
  area: "Values",
  bar: "Values",
  col: "Values",
  boxplot: "Boxplot",
  violin: "Violin",
  density: "Density",
  histogram: "Histogram",
  smooth: "Trend",
  segment: "Segments",
  pointrange: "Ranges",
  text: "Labels"
};
function leadPhrase(layer, labels) {
  const y2 = labels.y;
  const x2 = labels.x;
  switch (layer.stat) {
    case "sum":
      return y2 ? `Sum of ${y2}` : "Sum";
    case "count":
      return "Count of rows";
    case "bin":
      return x2 ? `Histogram of ${x2}` : "Histogram";
    case "density":
      return x2 ? `Density of ${x2}` : "Density";
    case "boxplot":
      return y2 ? `Boxplot of ${y2}` : "Boxplot";
    case "smooth":
      return y2 ? `Trend of ${y2}` : "Trend";
    default: {
      const noun = GEOM_NOUN[layer.geom] ?? "Values";
      if (noun === "Values") return y2 ? y2 : x2 ?? "Values";
      return y2 ? `${noun} of ${y2}` : noun;
    }
  }
}
function describePlot(layers, labels, options = {}) {
  if (layers.length === 0) return null;
  if (!labels.x && !labels.y) return null;
  const primary = layers[0];
  const parts = [leadPhrase(primary, labels)];
  const statOwnsX = primary.stat === "bin" || primary.stat === "density";
  if (labels.x && !statOwnsX && labels.x !== labels.y) {
    parts.push(`by ${labels.x}`);
  }
  let sentence = parts.join(" ");
  if (labels.color) sentence += `, coloured by ${labels.color}`;
  if (labels.size) sentence += `, sized by ${labels.size}`;
  if (labels.facetCol || labels.facetRow) {
    sentence += `, split by ${labels.facetCol ?? labels.facetRow}`;
  }
  const extras = layers.slice(1).map((l) => l.stat === "smooth" ? "trend line" : GEOM_NOUN[l.geom]?.toLowerCase()).filter((n) => !!n && n !== "values");
  const uniqueExtras = [...new Set(extras)];
  if (uniqueExtras.length > 0) sentence += ` \xB7 with ${uniqueExtras.join(", ")}`;
  if (options.showRowCount && options.rowCount != null) {
    sentence += ` \xB7 ${options.rowCount.toLocaleString()} rows`;
  }
  return sentence;
}
function hasHiddenTransform(layers) {
  return layers.some(
    (l) => l.autoGeom || l.stat === "sum" || l.stat === "count" || l.stat === "bin" || l.stat === "density"
  );
}
function fieldLabelsFor(spec, overrides = {}) {
  const aes = spec.aes;
  const pick = (key) => {
    if (overrides[key]) return overrides[key];
    const field = aes[key];
    if (typeof field !== "string") return void 0;
    if (field.startsWith("__")) return void 0;
    return field;
  };
  return {
    x: pick("x"),
    y: pick("y"),
    color: pick("color"),
    size: pick("size"),
    facetCol: pick("facetCol"),
    facetRow: pick("facetRow")
  };
}

// src/row-identity.ts
var ROW_COUNTING_STATS = /* @__PURE__ */ new Set([
  "bin",
  "count",
  "boxplot",
  "density"
]);
var ROW_COUNTING_GEOMS = /* @__PURE__ */ new Set(["histogram", "boxplot", "violin", "density"]);
function hasRowIdentity(data, fields) {
  if (data.length <= 1) return true;
  for (const field of fields) {
    const seen = /* @__PURE__ */ new Set();
    for (const row of data) {
      const v = row[field];
      seen.add(v instanceof Date ? v.getTime() : v);
    }
    if (seen.size === data.length) return true;
  }
  return false;
}
function boundFields(aes) {
  const out = [];
  for (const value of Object.values(aes)) {
    if (typeof value === "string" && value && !out.includes(value)) out.push(value);
  }
  return out;
}
function shouldWarnAggregated(layers, aes, data) {
  const counts = layers.some(
    (l) => ROW_COUNTING_STATS.has(l.stat) || ROW_COUNTING_GEOMS.has(l.geom)
  );
  if (!counts) return false;
  return !hasRowIdentity(data, boundFields(aes));
}
var AGGREGATION_NOTE = "rows may be aggregated \u2014 add a unique field to Detail to count rows";

// src/pipeline.ts
function resolveGeoms(spec) {
  if (spec.layers.length > 0) return spec;
  const data = spec.data ?? [];
  if (data.length === 0) return spec;
  const autoGeom = inferGeom(data, spec.aes);
  return { ...spec, layers: [{ geom: autoGeom }] };
}
function inferBarOrientation(spec, data) {
  const isBar = (g) => g.type === "bar" || g.type === "col";
  const needsInference = spec.layers.some(
    (l) => isBar(l.geom) && !l.geom.orientation
  );
  if (!needsInference || !spec.aes.x || !spec.aes.y || data.length === 0) return spec;
  const declaredType = (s) => typeof s === "string" ? s : s?.type;
  const xType = declaredType(spec.scales?.x) ?? inferScaleType(data, spec.aes.x);
  const yType = declaredType(spec.scales?.y) ?? inferScaleType(data, spec.aes.y);
  const xContinuous = xType === "linear" || xType === "log" || xType === "sqrt" || xType === "time";
  const yDiscrete = yType === "ordinal" || yType === "category";
  if (!(xContinuous && yDiscrete)) return spec;
  return {
    ...spec,
    layers: spec.layers.map(
      (l) => isBar(l.geom) && !l.geom.orientation ? { ...l, geom: { ...l.geom, orientation: "y" } } : l
    )
  };
}
function mergeAes(base, overrides) {
  if (!overrides) return base;
  const filtered = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== void 0 && v !== null && v !== "") {
      filtered[k] = v;
    }
  }
  return { ...base, ...filtered };
}
function computeLayerBindings(data, globalAes, layers, scales) {
  const globalBound = bindData(data, globalAes);
  return layers.map((layer) => {
    const layerAes = layer.aes ?? layer.geom.aes;
    const merged = layerAes ? mergeAes(globalAes, layerAes) : globalAes;
    const layerData = applyLayerFilter(data, layer.geom, merged, scales);
    const statType = resolveLayerStat(layer, globalAes, data);
    if (statType === "smooth") {
      const statFn = stats[statType];
      const result = statFn(layerData, merged, layer.geom);
      const smoothAes = result.aesOverrides ? mergeAes(merged, result.aesOverrides) : merged;
      return bindData(result.data, smoothAes);
    }
    if (layerAes || layerData !== data) {
      return bindData(layerData, merged);
    }
    return globalBound;
  });
}
function applyLayerFilter(data, geom, aes, scales) {
  const filter2 = geom.filter;
  if (!filter2) return data;
  if (typeof filter2 === "function") return data.filter(filter2);
  const declaredType = (axis2) => {
    const s = scales?.[axis2];
    if (!s) return void 0;
    return typeof s === "string" ? s : s.type;
  };
  const axisType = (axis2, field) => declaredType(axis2) ?? (field ? inferScaleType(data, field) : void 0);
  const isDiscrete = (t) => t === "ordinal" || t === "category";
  const xDiscrete = isDiscrete(axisType("x", aes.x));
  const yDiscrete = isDiscrete(axisType("y", aes.y));
  let groupField;
  let valueField;
  if (yDiscrete && !xDiscrete) {
    groupField = aes.y;
    valueField = aes.x;
  } else if (xDiscrete && !yDiscrete) {
    groupField = aes.x;
    valueField = aes.y;
  } else {
    groupField = aes.group ?? aes.color;
    valueField = aes.y ?? aes.x;
  }
  if (!valueField) return data;
  const groups2 = /* @__PURE__ */ new Map();
  for (const d of data) {
    const v = d[valueField];
    if (v == null || typeof v === "number" && isNaN(v)) continue;
    const key = groupField ? String(d[groupField]) : "";
    const rows = groups2.get(key);
    if (rows) rows.push(d);
    else groups2.set(key, [d]);
  }
  const keep = /* @__PURE__ */ new Set();
  for (const rows of groups2.values()) {
    let lo = rows[0];
    let hi = rows[0];
    for (const r of rows) {
      if (Number(r[valueField]) < Number(lo[valueField])) lo = r;
      if (Number(r[valueField]) > Number(hi[valueField])) hi = r;
    }
    if (filter2 === "min" || filter2 === "extremes") keep.add(lo);
    if (filter2 === "max" || filter2 === "extremes") keep.add(hi);
  }
  return data.filter((d) => keep.has(d));
}
function hasMultipleRowsPerGroup(data, aes, horizontal) {
  if (!data || data.length === 0) return false;
  const catField = horizontal ? aes.y : aes.x;
  if (!catField) return false;
  const keyFields = [catField, aes.color, aes.group, aes.facetRow, aes.facetCol].filter((f) => !!f);
  const seen = /* @__PURE__ */ new Set();
  for (const d of data) {
    const key = keyFields.map((f) => String(d[f])).join("\0");
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
function resolveLayerStat(layer, globalAes, data) {
  const explicit = layer.stat ?? layer.geom.stat;
  if (explicit) return explicit;
  const defaultStat = DEFAULT_GEOM_STAT[layer.geom.type];
  if (!defaultStat) return "identity";
  if (defaultStat === "count") {
    const horizontal = "orientation" in layer.geom && layer.geom.orientation === "y";
    const valueMapped = horizontal ? !!globalAes.x : !!globalAes.y;
    if (valueMapped) {
      return hasMultipleRowsPerGroup(data, globalAes, horizontal) ? "sum" : "identity";
    }
  }
  if (defaultStat === "bin") return "bin";
  if (defaultStat === "smooth") return "smooth";
  return defaultStat;
}
function stripStatAes(layers, keys) {
  const strip = (a) => {
    if (!a) return a;
    let changed = false;
    const out = { ...a };
    for (const k of keys) {
      if (k in out) {
        delete out[k];
        changed = true;
      }
    }
    return changed ? out : a;
  };
  return layers.map((layer) => {
    const layerAes = strip(layer.aes);
    const geomAes = strip(layer.geom.aes);
    if (layerAes === layer.aes && geomAes === layer.geom.aes) return layer;
    return {
      ...layer,
      ...layerAes !== layer.aes && { aes: layerAes },
      ...geomAes !== layer.geom.aes && { geom: { ...layer.geom, aes: geomAes } }
    };
  });
}
function computeStat(spec, data) {
  for (const layer of spec.layers) {
    const statType = resolveLayerStat(layer, spec.aes, data);
    if (statType === "identity" || statType === "boxplot" || statType === "smooth") continue;
    const statFn = stats[statType];
    const result = statFn(data, spec.aes, layer.geom);
    if (data.length > 0 && result.data.length === 0) {
      throw new Error(`ggpbi: stat "${statType}" needs at least 2 values per group`);
    }
    const newAes = result.aesOverrides ? { ...spec.aes, ...result.aesOverrides } : spec.aes;
    const newLayers = result.aesOverrides ? stripStatAes(spec.layers, Object.keys(result.aesOverrides)) : spec.layers;
    return {
      spec: { ...spec, data: result.data, aes: newAes, layers: newLayers },
      data: result.data
    };
  }
  return { spec, data };
}
function computeSizeScale(layerBindings, data, sizeField) {
  if (!sizeField) return layerBindings;
  const sizeScale = createSizeScale(data, sizeField);
  return layerBindings.map(
    (layer) => layer.map((bp) => {
      if (bp.size != null) {
        return { ...bp, size: sizeScale(Number(bp.size)) };
      }
      return bp;
    })
  );
}
var EXPAND_MULT = 0.05;
function parseScaleConfig(cfg) {
  if (!cfg) return {};
  if (typeof cfg === "string") return { type: cfg };
  return cfg;
}
function normalizeScaleType(chosen, inferred, axis2, warn = true) {
  if (!chosen) return inferred;
  const isCategorical = (t) => t === "ordinal" || t === "category";
  const isContinuousNumeric = (t) => t === "linear" || t === "log" || t === "sqrt";
  if (isCategorical(inferred) && !isCategorical(chosen)) {
    if (warn) console.warn(`ggpbi: incompatible ${axis2}-scale "${chosen}" for categorical data; falling back to "${inferred}"`);
    return inferred;
  }
  if (inferred === "time" && (chosen === "log" || chosen === "sqrt")) {
    if (warn) console.warn(`ggpbi: incompatible ${axis2}-scale "${chosen}" for time data; falling back to "time"`);
    return "time";
  }
  if (isContinuousNumeric(inferred) && chosen === "time") {
    if (warn) console.warn(`ggpbi: incompatible ${axis2}-scale "${chosen}" for numeric data; falling back to "${inferred}"`);
    return inferred;
  }
  return chosen;
}
function applyExpandAndLimits(scale, scaleType, limits, extraPadPx = 0) {
  if (scaleType === "ordinal" || scaleType === "category") return;
  const dom = scale.domain();
  if (!dom || dom.length < 2) return;
  const range2 = Number(dom[1]) - Number(dom[0]);
  const expandAmount = range2 * EXPAND_MULT;
  let newMin = Number(dom[0]) - expandAmount;
  let newMax = Number(dom[1]) + expandAmount;
  if (extraPadPx > 0 && typeof scale.range === "function") {
    try {
      const r = scale.range();
      const rLen = Math.abs(Number(r[1]) - Number(r[0]));
      if (rLen > 2 * extraPadPx) {
        const fwd = scaleType === "log" ? Math.log : scaleType === "sqrt" ? Math.sqrt : (v) => v;
        const inv = scaleType === "log" ? Math.exp : scaleType === "sqrt" ? (t) => t * t : (t) => t;
        const t02 = fwd(Number(dom[0]));
        const t12 = fwd(Number(dom[1]));
        const tSpan = t12 - t02;
        if (Number.isFinite(tSpan) && tSpan > 0) {
          const delta = extraPadPx * tSpan / (rLen - 2 * extraPadPx);
          const lo = inv(t02 - delta);
          const hi = inv(t12 + delta);
          if (Number.isFinite(lo)) newMin = Math.min(newMin, lo);
          if (Number.isFinite(hi)) newMax = Math.max(newMax, hi);
        }
      }
    } catch {
    }
  }
  if (limits?.min !== void 0) newMin = limits.min;
  if (limits?.max !== void 0) newMax = limits.max;
  scale.domain([newMin, newMax]);
}
function applyBaselineSemantics(spec, xScale, yScale, xType, yType) {
  const geoms = spec.layers.map((l) => l.geom);
  const isBarLike = (g) => g.type === "bar" || g.type === "col" || g.type === "histogram";
  const hasFillPosition = geoms.some((g) => isBarLike(g) && g.position === "fill");
  const hasHorizontalBars = geoms.some((g) => isBarLike(g) && ("orientation" in g ? g.orientation : void 0) === "y");
  const needsZeroBaseline = geoms.some((g) => isBarLike(g) || g.type === "area");
  if (needsZeroBaseline && !hasHorizontalBars && (yType === "linear" || yType === "sqrt")) {
    const continuous2 = yScale;
    if (hasFillPosition) {
      continuous2.domain([0, 1]);
    } else {
      const dom = continuous2.domain();
      continuous2.domain([Math.min(dom[0], 0), Math.max(dom[1], 0)]);
    }
  }
  if (hasHorizontalBars && (xType === "linear" || xType === "sqrt")) {
    const continuous2 = xScale;
    const dom = continuous2.domain();
    continuous2.domain([Math.min(dom[0], 0), Math.max(dom[1], 0)]);
  }
}
function computeGeomPadding(geoms, layerBindings, spec, xType, yType, innerWidth, innerHeight) {
  let xPad = 0;
  let yPad = 0;
  for (let gi = 0; gi < geoms.length; gi++) {
    const geom = geoms[gi];
    switch (geom.type) {
      case "point": {
        const defaultR = geom.size ?? 4;
        const strokeW = geom.strokeWidth ?? 0.5;
        const pts = layerBindings[gi] ?? [];
        let maxR = defaultR;
        for (const p of pts) {
          const r = p?.size ?? defaultR;
          if (typeof r === "number" && Number.isFinite(r)) maxR = Math.max(maxR, r);
        }
        const pad2 = maxR + strokeW + 1;
        xPad = Math.max(xPad, pad2);
        yPad = Math.max(yPad, pad2);
        break;
      }
      case "line":
      case "area":
      case "smooth": {
        const pad2 = (geom.size ?? 2) / 2 + 1;
        xPad = Math.max(xPad, pad2);
        yPad = Math.max(yPad, pad2);
        break;
      }
      case "text": {
        const fontSize = geom.size ?? 12;
        xPad = Math.max(xPad, fontSize * 2);
        yPad = Math.max(yPad, fontSize / 2);
        break;
      }
      case "bar":
      case "col":
      case "histogram":
      case "boxplot": {
        const isHoriz = "orientation" in geom ? geom.orientation === "y" : false;
        const catAxis = isHoriz ? "y" : "x";
        const catType = catAxis === "x" ? xType : yType;
        if (catType === "ordinal" || catType === "category") {
          const pad2 = 2;
          if (catAxis === "x") xPad = Math.max(xPad, pad2);
          else yPad = Math.max(yPad, pad2);
          break;
        }
        const catSize = catAxis === "x" ? innerWidth : innerHeight;
        const field = spec.aes[catAxis];
        if (!field) break;
        const nCat = new Set(
          (layerBindings[gi] ?? []).map((d) => String(d[catAxis === "x" ? "x" : "y"]))
        ).size || 1;
        const widthFraction = geom.width ?? 0.9;
        const multiplier = geom.type === "boxplot" ? 0.6 : 0.8;
        const halfBarWidth = catSize / nCat * multiplier * widthFraction / 2;
        if (catAxis === "x") xPad = Math.max(xPad, halfBarWidth);
        else yPad = Math.max(yPad, halfBarWidth);
        break;
      }
    }
  }
  return { x: xPad, y: yPad };
}
function createColorScale(data, aes, theme) {
  if (!aes.color) return void 0;
  const unique = Array.from(new Set(data.map((d) => d[aes.color])));
  return ordinal().domain(unique.map(String)).range(theme.colorPalette);
}
function trainScales(spec, data, layerBindings, innerWidth, innerHeight, theme) {
  const xCfg = parseScaleConfig(spec.scales?.x);
  const yCfg = parseScaleConfig(spec.scales?.y);
  const inferredX = inferScaleType(data, spec.aes.x);
  const inferredY = inferScaleType(data, spec.aes.y);
  const xType = normalizeScaleType(xCfg.type, inferredX, "x");
  const yType = normalizeScaleType(yCfg.type, inferredY, "y");
  const geoms = spec.layers.map((l) => l.geom);
  const geomPad = computeGeomPadding(geoms, layerBindings, spec, xType, yType, innerWidth, innerHeight);
  const xBandOpts = xType === "ordinal" || xType === "category" ? { paddingInner: xCfg.paddingInner, paddingOuter: xCfg.paddingOuter } : void 0;
  if (xBandOpts && geomPad.x > 0) {
    const domainLen = new Set(data.map((d) => String(d[spec.aes.x]))).size;
    const step = domainLen > 0 ? innerWidth / domainLen : innerWidth;
    const extraFrac = step > 0 ? Math.min(1, geomPad.x / step) : 0;
    const baseOuter = xBandOpts.paddingOuter ?? 0.5;
    xBandOpts.paddingOuter = Math.max(baseOuter, extraFrac);
  }
  const collectRangeFields = (axis2) => {
    const keys = axis2 === "x" ? ["xend", "xmin", "xmax"] : ["yend", "ymin", "ymax"];
    const fields = [];
    const layerAesList = [spec.aes, ...spec.layers.map((l) => l.aes ?? l.geom.aes)];
    for (const a of layerAesList) {
      if (!a) continue;
      for (const k of keys) {
        const f = a[k];
        if (typeof f === "string" && f) fields.push(f);
      }
    }
    return fields;
  };
  const xScale = createScale(data, spec.aes.x, xType, [0, innerWidth], xBandOpts);
  const xRangeFields = collectRangeFields("x");
  if (xRangeFields.length > 0 && xType !== "ordinal" && xType !== "category") {
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const field of [spec.aes.x, ...xRangeFields]) {
      for (const d of data) {
        const v = Number(d[field]);
        if (!isNaN(v)) {
          if (v < xMin) xMin = v;
          if (v > xMax) xMax = v;
        }
      }
    }
    if (isFinite(xMin) && isFinite(xMax)) {
      xScale.domain([xMin, xMax]);
    }
  }
  applyExpandAndLimits(xScale, xType, xCfg, geomPad.x);
  const allYFields = /* @__PURE__ */ new Set();
  if (spec.aes.y) allYFields.add(spec.aes.y);
  for (const layer of spec.layers) {
    const layerAes = layer.aes ?? layer.geom.aes;
    if (layerAes?.y) allYFields.add(layerAes.y);
  }
  for (const f of collectRangeFields("y")) {
    if (yType !== "ordinal" && yType !== "category") allYFields.add(f);
  }
  let yScale;
  if (allYFields.size > 1) {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const field of allYFields) {
      for (const d of data) {
        const v = Number(d[field]);
        if (!isNaN(v)) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }
    yScale = createScale(data, spec.aes.y, yType, [innerHeight, 0]);
    if (isFinite(yMin) && isFinite(yMax)) {
      yScale.domain([yMin, yMax]);
    }
  } else {
    yScale = createScale(data, spec.aes.y, yType, [innerHeight, 0]);
  }
  applyExpandAndLimits(yScale, yType, yCfg, geomPad.y);
  applyBaselineSemantics(spec, xScale, yScale, xType, yType);
  const barLikeGeoms = geoms.filter(
    (g) => g.type === "bar" || g.type === "col" || g.type === "histogram"
  );
  if (barLikeGeoms.length > 0) {
    const hasHorizBars = barLikeGeoms.some((g) => ("orientation" in g ? g.orientation : void 0) === "y");
    let stackMin = Infinity;
    let stackMax = -Infinity;
    for (const layer of layerBindings) {
      for (const pt of layer) {
        if (pt._v0 !== void 0 && Number.isFinite(pt._v0)) {
          stackMin = Math.min(stackMin, pt._v0);
          stackMax = Math.max(stackMax, pt._v0);
        }
        if (pt._v1 !== void 0 && Number.isFinite(pt._v1)) {
          stackMin = Math.min(stackMin, pt._v1);
          stackMax = Math.max(stackMax, pt._v1);
        }
      }
    }
    if (isFinite(stackMin) && isFinite(stackMax)) {
      const expand = (lo, hi) => {
        const pad2 = (hi - lo) * 0.05;
        return [lo === 0 ? 0 : lo - pad2, hi === 0 ? 0 : hi + pad2];
      };
      if (hasHorizBars && (xType === "linear" || xType === "sqrt")) {
        const dom = xScale.domain();
        xScale.domain(
          expand(Math.min(dom[0], stackMin), Math.max(dom[1], stackMax))
        );
      } else if (!hasHorizBars && (yType === "linear" || yType === "sqrt")) {
        const dom = yScale.domain();
        yScale.domain(
          expand(Math.min(dom[0], stackMin), Math.max(dom[1], stackMax))
        );
      }
    }
  }
  const colorScale = createColorScale(data, spec.aes, theme);
  return { x: xScale, y: yScale, color: colorScale, xType, yType, geomPad };
}
function computeLegendInfo(spec, data, theme) {
  const showLegend = spec.showLegend !== false;
  if (!showLegend || !spec.aes.color || data.length === 0) {
    return { entries: [], width: 0 };
  }
  const unique = Array.from(new Set(data.map((d) => d[spec.aes.color])));
  const palette = theme.colorPalette;
  const entries = unique.map((val, i) => ({
    label: String(val),
    color: palette[i % palette.length]
  }));
  const width = estimateLegendWidth(entries, spec.aes.color, theme);
  return { entries, width };
}
function estimateTextWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}
var AXIS_TICK_PADDING = 3;
function estimateYTickLabelWidth(spec, data, theme) {
  const yField = spec.aes.y;
  if (!yField || data.length === 0) return 0;
  const yCfg = parseScaleConfig(spec.scales?.y);
  const inferred = inferScaleType(data, yField);
  const yType = normalizeScaleType(yCfg.type, inferred, "y", false);
  let labels;
  if (yType === "ordinal" || yType === "category") {
    labels = Array.from(new Set(data.map((d) => String(d[yField]))));
  } else if (yType === "time") {
    labels = ["MMMMMM"];
  } else {
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
      const v = Number(d[yField]);
      if (Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi)) return 0;
    if (yCfg.min !== void 0) lo = yCfg.min;
    if (yCfg.max !== void 0) hi = yCfg.max;
    labels = formatBreaksAs(extendedBreaks(lo, hi, theme.nBreaks), yCfg.labels);
  }
  let maxWidth = 0;
  for (const label of labels) {
    maxWidth = Math.max(maxWidth, estimateTextWidth(label, theme.axisTextSize));
  }
  return maxWidth;
}
function computeLayout(spec, theme, legendWidth, margin, hasSubtitle) {
  const width = spec.width ?? 600;
  const height = spec.height ?? 400;
  let baseMargin = margin ?? theme.margin;
  if (!margin) {
    const labelWidth = estimateYTickLabelWidth(spec, spec.data ?? [], theme);
    const required = Math.ceil(
      theme.halfLine * 2 + theme.axisTitleSize + theme.axisTitleMargin + labelWidth + theme.tickLength + AXIS_TICK_PADDING
    );
    const cap = Math.floor(width * 0.4);
    const left2 = Math.max(theme.margin.left, Math.min(required, cap));
    baseMargin = { ...theme.margin, left: left2 };
  }
  const effectiveMargin = {
    ...baseMargin,
    right: baseMargin.right + legendWidth,
    // Subtitle sits above the panel — reserve a line plus breathing room.
    top: baseMargin.top + (hasSubtitle ?? !!spec.subtitle ? Math.round(theme.plotCaptionSize * 1.9) : 0)
  };
  return {
    width,
    height,
    innerWidth: width - effectiveMargin.left - effectiveMargin.right,
    innerHeight: height - effectiveMargin.top - effectiveMargin.bottom,
    margin: effectiveMargin
  };
}
function resolveSubtitle(spec, inputSpec, preStatSpec, rawData) {
  const notes = [];
  if (spec.truncation) {
    notes.push(`showing a sample of ${spec.truncation.shown.toLocaleString()} rows \u2014 the source has more`);
  }
  if (spec.warnAggregated) {
    const descriptions2 = preStatSpec.layers.map((layer) => ({
      geom: layer.geom.type,
      stat: resolveLayerStat(layer, preStatSpec.aes, rawData)
    }));
    if (shouldWarnAggregated(descriptions2, preStatSpec.aes, rawData)) {
      notes.push(AGGREGATION_NOTE);
    }
  }
  const noteLine = notes.length > 0 ? notes.join(" \xB7 ") : void 0;
  const withNote = (line) => line && noteLine ? `${line} \xB7 ${noteLine}` : line ?? noteLine;
  const mode = spec.subtitle;
  if (!mode) return withNote(void 0);
  if (mode !== "auto" && mode !== "always") return withNote(mode);
  const autoGeom = inputSpec.layers.length === 0;
  const descriptions = preStatSpec.layers.map((layer) => ({
    geom: layer.geom.type,
    stat: resolveLayerStat(layer, preStatSpec.aes, rawData),
    autoGeom
  }));
  if (mode === "auto" && !hasHiddenTransform(descriptions)) return withNote(void 0);
  const labels = fieldLabelsFor(preStatSpec, spec.fieldLabels ?? {});
  return withNote(describePlot(descriptions, labels, {
    rowCount: rawData.length,
    showRowCount: false
  }) ?? void 0);
}
var HIGHLIGHT_UNHL = "__ggpbi_unhighlighted__";
function applyHighlightToBindings(bindings, spec) {
  const hl = spec.highlight;
  if (!hl) return bindings;
  const colorField = spec.aes.color;
  return bindings.map((points, li) => {
    const geom = spec.layers[li]?.geom;
    if (geom?.highlight === false) return points;
    const isHighlighted = (bp) => {
      if (colorField) {
        return groupVerdict(points, bp, colorField, hl.filter);
      }
      return hl.filter(bp.datum);
    };
    if (geom?.type === "text") {
      return points.filter(isHighlighted);
    }
    const unhl = [];
    const hlPts = [];
    for (const bp of points) {
      if (isHighlighted(bp)) hlPts.push(bp);
      else unhl.push(colorField ? bp : { ...bp, color: HIGHLIGHT_UNHL });
    }
    return [...unhl, ...hlPts];
  });
}
var groupVerdictCache = /* @__PURE__ */ new WeakMap();
function groupVerdict(points, bp, colorField, filter2) {
  let cache = groupVerdictCache.get(points);
  if (!cache) {
    cache = /* @__PURE__ */ new Map();
    for (const p of points) {
      const key = String(p.datum[colorField]);
      if (!cache.get(key) && filter2(p.datum)) cache.set(key, true);
      else if (!cache.has(key)) cache.set(key, false);
    }
    groupVerdictCache.set(points, cache);
  }
  return cache.get(String(bp.datum[colorField])) ?? false;
}
var X_PSEUDO_FIELD = "__x_all";
function buildPlot(inputSpec, externalMargin) {
  const data = inputSpec.data ?? [];
  const theme = resolveTheme(inputSpec.theme);
  if (data.length === 0) {
    const legend2 = computeLegendInfo(inputSpec, data, theme);
    const layout2 = computeLayout(inputSpec, theme, legend2.width, externalMargin);
    return {
      spec: inputSpec,
      data,
      layers: [],
      scales: {
        x: null,
        y: null,
        xType: "linear",
        yType: "linear",
        geomPad: { x: 0, y: 0 }
      },
      theme,
      layout: layout2,
      legend: legend2,
      geomPadPx: { x: 0, y: 0 }
    };
  }
  let spec = resolveGeoms(inputSpec);
  spec = inferBarOrientation(spec, data);
  const preStatSpec = spec;
  const statResult = computeStat(spec, data);
  spec = statResult.spec;
  let statData = statResult.data;
  if (!spec.aes.x && spec.aes.y) {
    statData = statData.map((d) => ({ ...d, [X_PSEUDO_FIELD]: "" }));
    spec = { ...spec, data: statData, aes: { ...spec.aes, x: X_PSEUDO_FIELD } };
  }
  validateAes(statData, spec.aes);
  const legend = computeLegendInfo(spec, statData, theme);
  if (spec.highlight && spec.aes.color) {
    const colorField = spec.aes.color;
    const hlGroups = new Set(
      statData.filter(spec.highlight.filter).map((d) => String(d[colorField]))
    );
    legend.entries = legend.entries.filter((e) => hlGroups.has(e.label));
    legend.width = legend.entries.length > 0 ? estimateLegendWidth(legend.entries, colorField, theme) : 0;
  }
  const subtitleText = resolveSubtitle(spec, inputSpec, preStatSpec, data);
  const codeText = spec.showCode ? specToCode(preStatSpec, fieldLabelsFor(preStatSpec, spec.fieldLabels ?? {})) : void 0;
  const layout = computeLayout(spec, theme, legend.width, externalMargin, !!subtitleText);
  let layerBindings = computeLayerBindings(statData, spec.aes, spec.layers, spec.scales);
  layerBindings = computeSizeScale(layerBindings, statData, spec.aes.size);
  const positionedBindings = spec.layers.map((layer, i) => {
    const geom = layer.geom;
    const needsPosition = geom.type === "bar" || geom.type === "col" || geom.type === "histogram";
    if (needsPosition) {
      return computePosition(layerBindings[i], geom);
    }
    return layerBindings[i];
  });
  const finalBindings = applyHighlightToBindings(positionedBindings, spec);
  const scales = trainScales(
    spec,
    statData,
    finalBindings,
    layout.innerWidth,
    layout.innerHeight,
    theme
  );
  if (spec.highlight) {
    const grey = spec.highlight.color ?? "#BEBEBE";
    scales.colorBase = scales.color;
    if (spec.aes.color && scales.color) {
      const colorField = spec.aes.color;
      const hlGroups = new Set(
        statData.filter(spec.highlight.filter).map((d) => String(d[colorField]))
      );
      const orig = scales.color;
      scales.color = Object.assign(
        ((v) => hlGroups.has(String(v)) ? orig(v) : grey),
        orig
      );
    } else {
      scales.color = Object.assign(
        ((_v) => grey),
        ordinal().domain([HIGHLIGHT_UNHL]).range([grey])
      );
    }
  }
  const builtLayers = spec.layers.map((layer, i) => {
    const layerAes = layer.aes ?? layer.geom.aes;
    return {
      geom: layer.geom,
      data: finalBindings[i],
      aes: layerAes ? mergeAes(spec.aes, layerAes) : spec.aes
    };
  });
  return {
    spec,
    data: statData,
    layers: builtLayers,
    subtitleText,
    codeText,
    scales,
    theme,
    layout,
    legend,
    geomPadPx: scales.geomPad
  };
}

// src/render.ts
function wireGroupToggles(svg, spec, data, selection2) {
  const wire = (sel, rowsFor) => {
    sel.style("pointer-events", "all").style("cursor", "pointer").on("click.ggpbi-group", function(event) {
      const rows = rowsFor(this);
      if (rows.length === 0) return;
      event.stopPropagation();
      selection2.toggleValueGroup(rows, event.shiftKey);
    });
  };
  if (spec.aes.color) {
    const colorField = spec.aes.color;
    wire(svg.selectAll(".ggpbi-legend-entry"), (el) => {
      const label = el.getAttribute("data-label");
      return label == null ? [] : data.filter((d) => String(d[colorField]) === label);
    });
  }
  for (const [axisClass, field] of [
    [".ggpbi-axis-x", spec.aes.x],
    [".ggpbi-axis-y", spec.aes.y]
  ]) {
    if (!field) continue;
    if (inferScaleLevel(data, field) !== "categorical") continue;
    wire(svg.selectAll(`${axisClass} .tick text`), (el) => {
      const label = (el.textContent ?? "").trim();
      return label === "" ? [] : data.filter((d) => String(d[field]) === label);
    });
  }
}
function wireInteractivity(svg, container, spec, data) {
  let tooltip;
  let selection2;
  if (spec.tooltip?.enabled !== false) {
    const interactive = svg.selectAll(
      ".ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text"
    ).style("pointer-events", "all");
    if (spec.tooltipService) {
      attachPbiTooltip(interactive, spec.tooltipService, spec.aes);
    } else {
      tooltip = new Tooltip(container, spec.tooltip, spec.aes);
      attachTooltip(interactive, data, tooltip);
    }
  }
  if (spec.selection?.enabled !== false) {
    selection2 = new Selection3(spec.selection);
    const interactiveElements = svg.selectAll(
      ".ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text"
    ).style("pointer-events", "all");
    selection2.attach(interactiveElements);
    selection2.attachKeyboard(svg);
    selection2.attachBackgroundClear(container);
    selection2.attachBackgroundContextMenu(svg);
    wireGroupToggles(svg, spec, data, selection2);
  }
  if (spec.drilldown?.enabled !== false && spec.drilldown?.onDrill) {
    svg.selectAll(".ggpbi-point, .ggpbi-bar, .ggpbi-layer-text text").on("dblclick", (event, d) => {
      event.stopPropagation();
      const datum2 = d && typeof d === "object" && "datum" in d ? d.datum : d;
      spec.drilldown.onDrill(datum2);
    });
  }
  return { tooltip, selection: selection2 };
}
function createSvg(container, built) {
  container.replaceChildren();
  const computedPos = container.ownerDocument?.defaultView?.getComputedStyle(container).position;
  if (!computedPos || computedPos === "static") {
    container.style.position = "relative";
  }
  const { width, height, margin } = built.layout;
  const chartLabel = [built.spec.xLabel, built.spec.yLabel].filter(Boolean).join(" vs ") || "Chart";
  const svg = select_default2(container).append("svg").attr("width", width).attr("height", height).attr("class", "ggpbi-visual").attr("role", "img").attr("aria-label", chartLabel).style("pointer-events", "none");
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g };
}
function renderFaceted(g, svg, built) {
  const { spec, data, theme, scales } = built;
  const { innerWidth, innerHeight } = built.layout;
  const facet = spec.facet;
  const rowField = facet.row;
  const colField = facet.col;
  const levelSort = (a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  };
  const wrapField = facet.wrap;
  const wrapLevels = wrapField ? Array.from(new Set(data.map((d) => String(d[wrapField])))).sort(levelSort) : [];
  const rowLevels = !wrapField && rowField ? Array.from(new Set(data.map((d) => String(d[rowField])))).sort(levelSort) : [""];
  const colLevels = !wrapField && colField ? Array.from(new Set(data.map((d) => String(d[colField])))).sort(levelSort) : [""];
  let nRows;
  let nCols;
  if (wrapField) {
    const n = wrapLevels.length;
    nCols = facet.ncol ?? (facet.nrow ? Math.ceil(n / facet.nrow) : Math.ceil(Math.sqrt(n)));
    nCols = Math.max(1, Math.min(nCols, n));
    nRows = Math.ceil(n / nCols);
  } else {
    nRows = Math.max(1, rowLevels.length);
    nCols = Math.max(1, colLevels.length);
  }
  const panelOuterWidth = innerWidth / nCols;
  const panelOuterHeight = innerHeight / nRows;
  const panelMargin = { top: 22, right: 12, bottom: 34, left: 44 };
  const xCfg = parseScaleConfig(spec.scales?.x);
  const yCfg = parseScaleConfig(spec.scales?.y);
  const { xType, yType } = scales;
  const xBandOpts = xType === "ordinal" || xType === "category" ? { paddingInner: xCfg.paddingInner, paddingOuter: xCfg.paddingOuter } : void 0;
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const wrapVal = wrapField ? wrapLevels[r * nCols + c] : void 0;
      if (wrapField && wrapVal === void 0) continue;
      const rowVal = rowLevels[r];
      const colVal = colLevels[c];
      const dataCell = data.filter((d) => {
        if (wrapField) return String(d[wrapField]) === wrapVal;
        const okRow = !rowField || String(d[rowField]) === rowVal;
        const okCol = !colField || String(d[colField]) === colVal;
        return okRow && okCol;
      });
      const facetG = g.append("g").attr("class", "ggpbi-facet").attr("transform", `translate(${c * panelOuterWidth},${r * panelOuterHeight})`);
      if (wrapField) {
        facetG.append("text").attr("class", "ggpbi-facet-strip-wrap").attr("x", panelOuterWidth / 2).attr("y", 14).attr("text-anchor", "middle").style("font-size", `${theme.axisTextSize}px`).style("fill", theme.axisTextColor).text(wrapVal);
      }
      if (!wrapField && colField && r === 0) {
        facetG.append("text").attr("class", "ggpbi-facet-strip-col").attr("x", panelOuterWidth / 2).attr("y", 14).attr("text-anchor", "middle").style("font-size", `${theme.axisTextSize}px`).style("fill", theme.axisTextColor).text(colVal);
      }
      if (!wrapField && rowField && c === 0) {
        facetG.append("text").attr("class", "ggpbi-facet-strip-row").attr("x", 4).attr("y", 14).attr("text-anchor", "start").style("font-size", `${theme.axisTextSize}px`).style("fill", theme.axisTextColor).text(rowVal);
      }
      const panelInnerWidth = panelOuterWidth - panelMargin.left - panelMargin.right;
      const panelInnerHeight = panelOuterHeight - panelMargin.top - panelMargin.bottom;
      const panelG = facetG.append("g").attr("transform", `translate(${panelMargin.left},${panelMargin.top})`);
      const xScale = facet.freeX ? createScale(dataCell, spec.aes.x, xType, [0, panelInnerWidth], xBandOpts) : createScale(data, spec.aes.x, xType, [0, panelInnerWidth], xBandOpts);
      applyExpandAndLimits(xScale, xType, xCfg, built.geomPadPx.x);
      const yScale = facet.freeY ? createScale(dataCell, spec.aes.y, yType, [panelInnerHeight, 0]) : createScale(data, spec.aes.y, yType, [panelInnerHeight, 0]);
      applyExpandAndLimits(yScale, yType, yCfg, built.geomPadPx.y);
      let cellLayerData = spec.layers.map((layer) => {
        if (dataCell.length === 0) return [];
        const layerAes = layer.aes ?? layer.geom.aes;
        const mergedAes = mergeAes(spec.aes, layerAes);
        const cellRows = applyLayerFilter(dataCell, layer.geom, mergedAes, spec.scales);
        const layerBoundCell = bindData(cellRows, mergedAes);
        if (spec.aes.size) {
          const facetSizeScale = createSizeScale(data, spec.aes.size);
          for (const bp of layerBoundCell) {
            if (bp.size != null) bp.size = facetSizeScale(Number(bp.size));
          }
        }
        return layerBoundCell;
      });
      cellLayerData = applyHighlightToBindings(cellLayerData, spec);
      renderPanel({
        panelG,
        svg,
        innerWidth: panelInnerWidth,
        innerHeight: panelInnerHeight,
        xScale,
        yScale,
        theme,
        colorScale: scales.color,
        colorScaleBase: scales.colorBase,
        geoms: spec.layers.map((l) => l.geom),
        layerData: cellLayerData,
        clipSuffix: `facet-${r}-${c}`,
        xLabelFormat: xCfg.labels,
        yLabelFormat: yCfg.labels,
        format: spec.format,
        xDateFormat: xCfg.dateLabels,
        yDateFormat: yCfg.dateLabels
      });
    }
  }
}
function renderLabelsAndLegend(g, built) {
  const { spec, theme, layout, legend } = built;
  const { innerWidth, innerHeight } = layout;
  const subtitle = built.subtitleText;
  if (subtitle) {
    g.append("text").attr("class", "ggpbi-subtitle").attr("x", 0).attr("y", -theme.halfLine).attr("text-anchor", "start").attr("font-size", `${theme.plotCaptionSize}px`).attr("fill", theme.axisTextColor).text(subtitle);
  }
  if (spec.xLabel) {
    g.append("text").attr("class", "ggpbi-axis-label-x").attr("x", innerWidth / 2).attr("y", innerHeight + theme.margin.bottom - theme.axisTitleMargin).attr("text-anchor", "middle").attr("font-size", `${theme.axisTitleSize}px`).attr("fill", theme.ink).text(spec.xLabel);
  }
  if (spec.yLabel) {
    g.append("text").attr("class", "ggpbi-axis-label-y").attr("transform", "rotate(-90)").attr("x", -innerHeight / 2).attr("y", -layout.margin.left + theme.axisTitleSize + theme.axisTitleMargin).attr("text-anchor", "middle").attr("font-size", `${theme.axisTitleSize}px`).attr("fill", theme.ink).text(spec.yLabel);
  }
  const showLegend = spec.showLegend !== false;
  if (showLegend && legend.entries.length > 0 && spec.aes.color) {
    renderLegend(g, legend.entries, spec.aes.color, spec.layers.map((l) => l.geom), theme, innerWidth);
  }
}
function renderWithState(container, spec, margin) {
  const built = buildPlot(spec, margin);
  const { svg, g } = createSvg(container, built);
  if (built.data.length === 0) {
    return { svg: svg.node() };
  }
  const facet = built.spec.facet;
  if (facet?.row || facet?.col || facet?.wrap) {
    renderFaceted(g, svg, built);
  } else {
    renderPanel({
      panelG: g,
      svg,
      innerWidth: built.layout.innerWidth,
      innerHeight: built.layout.innerHeight,
      xScale: built.scales.x,
      yScale: built.scales.y,
      theme: built.theme,
      colorScale: built.scales.color,
      colorScaleBase: built.scales.colorBase,
      geoms: built.spec.layers.map((l) => l.geom),
      layerData: built.layers.map((l) => l.data),
      xLabelFormat: parseScaleConfig(built.spec.scales?.x).labels,
      yLabelFormat: parseScaleConfig(built.spec.scales?.y).labels,
      format: built.spec.format,
      xDateFormat: parseScaleConfig(built.spec.scales?.x).dateLabels,
      yDateFormat: parseScaleConfig(built.spec.scales?.y).dateLabels
    });
  }
  renderLabelsAndLegend(g, built);
  const { tooltip, selection: selection2 } = wireInteractivity(svg, container, built.spec, built.data);
  if (built.codeText) {
    renderCodeView(container, built.codeText, built.theme);
  }
  return { svg: svg.node(), tooltip, selection: selection2 };
}
function render(container, dataOrSpec, aesOrMargin, geoms, options) {
  if (Array.isArray(dataOrSpec)) {
    const spec = {
      data: dataOrSpec,
      aes: aesOrMargin,
      layers: geoms.map((g) => ({ geom: g })),
      ...options
    };
    return renderWithState(container, spec).svg;
  }
  return renderWithState(container, dataOrSpec, aesOrMargin).svg;
}

// src/powerbi.ts
function resolveValueKey(valCol, roleMapping, fieldMapping, useDisplayNames) {
  if (roleMapping && valCol.source.roles) {
    for (const roleName of Object.keys(valCol.source.roles)) {
      if (valCol.source.roles[roleName] && roleMapping[roleName]) {
        return roleMapping[roleName];
      }
    }
  }
  const fieldName2 = useDisplayNames ? valCol.source.displayName : valCol.source.queryName || valCol.source.displayName;
  return fieldMapping[fieldName2] || fieldName2;
}
function buildValueKeys(values, roleMapping, numberedRoles, fieldMapping, useDisplayNames) {
  const baseKeys = [];
  const roleSources = [];
  const roleCount = {};
  for (const valCol of values) {
    let roleName = null;
    if (roleMapping && valCol.source.roles) {
      for (const rn of Object.keys(valCol.source.roles)) {
        if (valCol.source.roles[rn] && roleMapping[rn]) {
          roleName = rn;
          break;
        }
      }
    }
    roleSources.push(roleName);
    if (roleName && roleMapping) {
      const base = roleMapping[roleName];
      baseKeys.push(base);
      roleCount[roleName] = (roleCount[roleName] || 0) + 1;
    } else {
      baseKeys.push(resolveValueKey(valCol, roleMapping, fieldMapping, useDisplayNames));
    }
  }
  const roleIdx = {};
  const keys = [];
  for (let i = 0; i < values.length; i++) {
    const roleName = roleSources[i];
    if (roleName && roleMapping) {
      const needsNumber = numberedRoles.has(roleName) || roleCount[roleName] > 1;
      if (needsNumber) {
        roleIdx[roleName] = (roleIdx[roleName] || 0) + 1;
        keys.push(`${baseKeys[i]}${roleIdx[roleName]}`);
      } else {
        keys.push(baseKeys[i]);
      }
    } else {
      keys.push(baseKeys[i]);
    }
  }
  return keys;
}
function fromDataView(dataView, options = {}) {
  const { fieldMapping = {}, roleMapping, useDisplayNames = true, createSelectionId } = options;
  const numberedRoles = options.numberedRoles ?? /* @__PURE__ */ new Set();
  if (!dataView.categorical) {
    throw new Error("ggpbi: DataView must have categorical data");
  }
  const categorical = dataView.categorical;
  const categories = categorical.categories || [];
  const values = categorical.values || [];
  const rowCount = Math.max(
    0,
    ...categories.map((c) => c.values.length),
    ...Array.from(values).map((v) => v?.values?.length ?? 0)
  );
  if (rowCount === 0) {
    return [];
  }
  const seriesSource = values.source;
  const isGrouped = !!seriesSource && values.length > 0;
  const rows = [];
  if (isGrouped) {
    const seriesFieldName = useDisplayNames ? seriesSource.displayName : seriesSource.queryName || seriesSource.displayName;
    const mappedSeriesName = fieldMapping[seriesFieldName] || seriesFieldName;
    const groupMap = /* @__PURE__ */ new Map();
    for (const valCol of values) {
      const gn = valCol.source.groupName ?? null;
      if (!groupMap.has(gn)) groupMap.set(gn, []);
      groupMap.get(gn).push(valCol);
    }
    const groups2 = Array.from(groupMap.entries()).map(([groupName, groupCols]) => ({
      groupName,
      groupCols,
      groupKeys: buildValueKeys(groupCols, roleMapping, numberedRoles, fieldMapping, useDisplayNames)
    }));
    for (let i = 0; i < rowCount; i++) {
      for (const grp of groups2) {
        const row = {};
        for (const cat of categories) {
          const fieldName2 = useDisplayNames ? cat.source.displayName : cat.source.queryName || cat.source.displayName;
          row[fieldMapping[fieldName2] || fieldName2] = cat.values[i];
        }
        for (let gi = 0; gi < grp.groupCols.length; gi++) {
          row[grp.groupKeys[gi]] = grp.groupCols[gi].values[i];
        }
        row[mappedSeriesName] = grp.groupName;
        if (createSelectionId) {
          row.__selectionId = createSelectionId(i);
        }
        rows.push(row);
      }
    }
  } else {
    const valueKeys = buildValueKeys(
      values,
      roleMapping,
      numberedRoles,
      fieldMapping,
      useDisplayNames
    );
    for (let i = 0; i < rowCount; i++) {
      const row = {};
      for (const cat of categories) {
        const fieldName2 = useDisplayNames ? cat.source.displayName : cat.source.queryName || cat.source.displayName;
        row[fieldMapping[fieldName2] || fieldName2] = cat.values[i];
      }
      for (let vi = 0; vi < values.length; vi++) {
        row[valueKeys[vi]] = values[vi].values[i];
      }
      if (createSelectionId) {
        row.__selectionId = createSelectionId(i);
      }
      rows.push(row);
    }
  }
  return rows;
}
var DEFAULT_ROLE_MAPPING = {
  x: "x",
  y: "y",
  size: "size",
  label: "label",
  tooltip: "tooltip"
};
function resolveColor(val, palette = []) {
  if (!val) return void 0;
  if (typeof val === "string") return val;
  if (val?.solid?.color) return val.solid.color;
  const tdc = val?.expr?.ThemeDataColor ?? val?.ThemeDataColor;
  if (tdc && palette.length > 0) {
    const base = palette[tdc.ColorId % palette.length];
    return tdc.Percent ? adjustBrightness(base, tdc.Percent) : base;
  }
  return void 0;
}
function adjustBrightness(hex2, percent) {
  const r = parseInt(hex2.slice(1, 3), 16);
  const g = parseInt(hex2.slice(3, 5), 16);
  const b = parseInt(hex2.slice(5, 7), 16);
  const adjust = (c) => {
    if (percent > 0) {
      return Math.round(c + (255 - c) * (percent / 100));
    }
    return Math.round(c * (1 + percent / 100));
  };
  const nr = Math.max(0, Math.min(255, adjust(r)));
  const ng = Math.max(0, Math.min(255, adjust(g)));
  const nb = Math.max(0, Math.min(255, adjust(b)));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}
function getObjects(dataView, palette = []) {
  const objs = dataView.metadata?.objects ?? {};
  const geomType = objs.geom?.type ?? "bar";
  const alpha = objs.geomStyle?.alpha != null ? Number(objs.geomStyle.alpha) : void 0;
  const size = objs.geomStyle?.size != null ? Number(objs.geomStyle.size) : void 0;
  const color2 = objs.geomStyle?.color ?? void 0;
  const fill = resolveColor(objs.geomStyle?.fill, palette);
  const rawScaleX = objs.scaleX?.type;
  const rawScaleY = objs.scaleY?.type;
  const scaleX = rawScaleX && rawScaleX !== "auto" ? rawScaleX : void 0;
  const scaleY = rawScaleY && rawScaleY !== "auto" ? rawScaleY : void 0;
  const xLabel = objs.scaleX?.label || void 0;
  const yLabel = objs.scaleY?.label || void 0;
  const showLegend = objs.legend?.show != null ? Boolean(objs.legend.show) : void 0;
  const panelFill = resolveColor(objs.theme?.panelFill, palette) ?? void 0;
  const gridlineColor = resolveColor(objs.theme?.gridlineColor, palette) ?? void 0;
  const ink = resolveColor(objs.theme?.ink, palette) ?? void 0;
  const paper = resolveColor(objs.theme?.paper, palette) ?? void 0;
  const baseSize = objs.theme?.baseSize != null ? Number(objs.theme.baseSize) : void 0;
  return { geomType, alpha, size, color: color2, fill, scaleX, scaleY, xLabel, yLabel, showLegend, panelFill, gridlineColor, ink, paper, baseSize };
}
function getFields(dataView) {
  const categorical = dataView.categorical;
  if (!categorical) {
    return { categories: [], values: [] };
  }
  const categories = categorical.categories?.map((c) => c.source.displayName) || [];
  const values = categorical.values?.map((v) => v.source.displayName) || [];
  return { categories, values };
}

// src/index.ts
function ggpbi() {
  return new GGBIBuilder();
}
var GGBIBuilder = class {
  constructor() {
    this._data = [];
    this._aes = {};
    this._layers = [];
    this._opts = {};
  }
  data(d) {
    this._data = d;
    return this;
  }
  aes(m) {
    this._aes = { ...this._aes, ...m };
    return this;
  }
  /** Add a layer with a specific geom type and optional visual config. */
  geom(type2, config) {
    this._layers.push({ geom: { type: type2, ...config } });
    return this;
  }
  /** Add a full layer (GoG: geom + stat + per-layer aes). */
  layer(layer) {
    this._layers.push(layer);
    return this;
  }
  scale(c) {
    this._opts.scales = { ...this._opts.scales, ...c };
    return this;
  }
  tooltip(c) {
    this._opts.tooltip = { ...this._opts.tooltip, ...c };
    return this;
  }
  selection(c) {
    this._opts.selection = { ...this._opts.selection, ...c };
    return this;
  }
  drilldown(c) {
    this._opts.drilldown = { ...this._opts.drilldown, ...c };
    return this;
  }
  facet(c) {
    this._opts.facet = { ...this._opts.facet, ...c };
    return this;
  }
  theme(c) {
    this._opts.theme = { ...this._opts.theme, ...c };
    return this;
  }
  /** Data-driven highlighting, like R's gghighlight. */
  highlight(c) {
    this._opts.highlight = c;
    return this;
  }
  labels(x2, y2) {
    this._opts.xLabel = x2;
    this._opts.yLabel = y2;
    return this;
  }
  /**
   * Line above the panel describing what the plot shows (ggplot2 `subtitle`).
   * 'auto' speaks up only when the visual computed something itself
   * (auto-geom, summing, binning, density); 'always' describes every plot.
   */
  subtitle(s) {
    this._opts.subtitle = s;
    return this;
  }
  /**
   * Declare that the data is only part of the source (a host row cap).
   * The plot then says so above the panel whatever `subtitle` is set to.
   */
  truncation(shown) {
    this._opts.truncation = { shown };
    return this;
  }
  /**
   * Locale and currency for axis labels — decimal mark, group separator,
   * compact suffixes and month names. In Power BI this comes from the
   * host; in the browser it defaults to the runtime locale.
   */
  format(f) {
    this._opts.format = { ...this._opts.format, ...f };
    return this;
  }
  /**
   * Debug view: overlay the ggpbi code that would produce this chart.
   * An overlay, so switching it on does not resize the plot.
   */
  showCode(show = true) {
    this._opts.showCode = show;
    return this;
  }
  legend(show) {
    this._opts.showLegend = show;
    return this;
  }
  size(w, h) {
    this._opts.width = w;
    this._opts.height = h;
    return this;
  }
  renderTo(container) {
    return renderWithState(container, this.spec()).svg;
  }
  /**
   * Returns the current PlotSpec without rendering.
   * Useful for inspecting or serializing the chart configuration.
   */
  spec() {
    return {
      data: this._data,
      aes: this._aes,
      layers: this._layers,
      ...this._opts
    };
  }
  render(container) {
    return this.renderTo(container);
  }
};
export {
  DEFAULT_GEOM_STAT,
  DEFAULT_ROLE_MAPPING,
  PBI_DEFAULT_PALETTE,
  STAT_BIN_COUNT,
  STAT_BIN_DENSITY,
  STAT_BIN_NCOUNT,
  STAT_BIN_NDENSITY,
  STAT_BIN_WIDTH,
  STAT_BIN_X,
  STAT_BIN_XMAX,
  STAT_BIN_XMIN,
  STAT_COUNT_FIELD,
  STAT_DENSITY_X,
  STAT_DENSITY_Y,
  STAT_SMOOTH_SE,
  STAT_SMOOTH_X,
  STAT_SMOOTH_Y,
  STAT_SMOOTH_YMAX,
  STAT_SMOOTH_YMIN,
  Selection3 as Selection,
  Tooltip,
  ablineToScene,
  applyAria,
  applyDodge,
  applyFill,
  applyNodeStyle,
  applyStack,
  areaToScene,
  autoDateFormat,
  axisLabelPriority,
  barsToScene,
  bindData,
  boxplotToScene,
  breakDecimals,
  buildPlot,
  computeBoxplotStats,
  computePosition,
  createScale,
  densityToScene,
  estimateLegendWidth,
  extendedBreaks,
  formatBreaks,
  formatBreaksAs,
  formatCompact,
  formatCurrency,
  formatDates,
  formatPercent,
  formatPlain,
  formatThousands,
  fromDataView,
  getFields,
  getObjects,
  ggpbi,
  highlight,
  histogramToScene,
  hlineToScene,
  inferGeom,
  inferScaleLevel,
  inferScaleType,
  linesToScene,
  minorBreaks,
  pointrangeToScene,
  pointsToScene,
  precision,
  render,
  renderCodeView,
  renderLegend,
  renderSceneNodes,
  renderWithState,
  resolveLayerStat,
  resolveTheme,
  sceneBuilders,
  segmentsToScene,
  smoothToScene,
  specToCode,
  statBin,
  statCount,
  statDensity,
  statSmooth,
  stats,
  textToScene,
  themeDark,
  themeGrey,
  themeMinimal,
  validateAes,
  violinToScene,
  vlineToScene
};
