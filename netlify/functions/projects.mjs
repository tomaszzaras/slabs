var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/splaytree@3.2.4/node_modules/splaytree/dist/splaytree.umd.cjs
var require_splaytree_umd = __commonJS({
  "node_modules/.pnpm/splaytree@3.2.4/node_modules/splaytree/dist/splaytree.umd.cjs"(exports, module) {
    (function(e, t) {
      typeof exports == `object` && typeof module < `u` ? module.exports = t() : typeof define == `function` && define.amd ? define([], t) : (e = typeof globalThis < `u` ? globalThis : e || self, e.SplayTree = t());
    })(exports, function() {
      var e = class {
        constructor(e2, t2) {
          this.next = null, this.key = e2, this.data = t2, this.left = null, this.right = null;
        }
      };
      function t(e2, t2) {
        return e2 > t2 ? 1 : e2 < t2 ? -1 : 0;
      }
      function n(t2, n2, r2) {
        let i2 = new e(null, null), a2 = i2, o2 = i2;
        for (; ; ) {
          let e2 = r2(t2, n2.key);
          if (e2 < 0) {
            if (n2.left === null) break;
            if (r2(t2, n2.left.key) < 0) {
              let e3 = n2.left;
              if (n2.left = e3.right, e3.right = n2, n2 = e3, n2.left === null) break;
            }
            o2.left = n2, o2 = n2, n2 = n2.left;
          } else if (e2 > 0) {
            if (n2.right === null) break;
            if (r2(t2, n2.right.key) > 0) {
              let e3 = n2.right;
              if (n2.right = e3.left, e3.left = n2, n2 = e3, n2.right === null) break;
            }
            a2.right = n2, a2 = n2, n2 = n2.right;
          } else break;
        }
        return a2.right = n2.left, o2.left = n2.right, n2.left = i2.right, n2.right = i2.left, n2;
      }
      function r(t2, r2, i2, a2) {
        let o2 = new e(t2, r2);
        if (i2 === null) return o2.left = o2.right = null, o2;
        i2 = n(t2, i2, a2);
        let s2 = a2(t2, i2.key);
        return s2 < 0 ? (o2.left = i2.left, o2.right = i2, i2.left = null) : s2 >= 0 && (o2.right = i2.right, o2.left = i2, i2.right = null), o2;
      }
      function i(e2, t2, r2) {
        let i2 = null, a2 = null;
        if (t2) {
          t2 = n(e2, t2, r2);
          let o2 = r2(t2.key, e2);
          o2 === 0 ? (i2 = t2.left, a2 = t2.right) : o2 < 0 ? (a2 = t2.right, t2.right = null, i2 = t2) : (i2 = t2.left, t2.left = null, a2 = t2);
        }
        return { left: i2, right: a2 };
      }
      function a(e2, t2, r2) {
        return t2 === null ? e2 : e2 === null ? t2 : (t2 = n(e2.key, t2, r2), t2.left = e2, t2);
      }
      function o(e2, t2, n2, r2, i2) {
        if (e2) {
          r2(`${t2}${n2 ? `\u2514\u2500\u2500 ` : `\u251C\u2500\u2500 `}${i2(e2)}
`);
          let a2 = t2 + (n2 ? `    ` : `\u2502   `);
          e2.left && o(e2.left, a2, false, r2, i2), e2.right && o(e2.right, a2, true, r2, i2);
        }
      }
      var s = class {
        constructor(e2 = t) {
          this._root = null, this._size = 0, this._comparator = e2;
        }
        insert(e2, t2) {
          return this._size++, this._root = r(e2, t2, this._root, this._comparator);
        }
        add(t2, r2) {
          let i2 = new e(t2, r2);
          this._root === null && (i2.left = i2.right = null, this._size++, this._root = i2);
          let a2 = this._comparator, o2 = n(t2, this._root, a2), s2 = a2(t2, o2.key);
          return s2 === 0 ? this._root = o2 : (s2 < 0 ? (i2.left = o2.left, i2.right = o2, o2.left = null) : s2 > 0 && (i2.right = o2.right, i2.left = o2, o2.right = null), this._size++, this._root = i2), this._root;
        }
        remove(e2) {
          this._root = this._remove(e2, this._root, this._comparator);
        }
        _remove(e2, t2, r2) {
          let i2;
          return t2 === null ? null : (t2 = n(e2, t2, r2), r2(e2, t2.key) === 0 ? (t2.left === null ? i2 = t2.right : (i2 = n(e2, t2.left, r2), i2.right = t2.right), this._size--, i2) : t2);
        }
        pop() {
          let e2 = this._root;
          if (e2) {
            for (; e2.left; ) e2 = e2.left;
            return this._root = n(e2.key, this._root, this._comparator), this._root = this._remove(e2.key, this._root, this._comparator), { key: e2.key, data: e2.data };
          }
          return null;
        }
        findStatic(e2) {
          let t2 = this._root, n2 = this._comparator;
          for (; t2; ) {
            let r2 = n2(e2, t2.key);
            if (r2 === 0) return t2;
            t2 = r2 < 0 ? t2.left : t2.right;
          }
          return null;
        }
        find(e2) {
          return this._root && (this._root = n(e2, this._root, this._comparator), this._comparator(e2, this._root.key) !== 0) ? null : this._root;
        }
        contains(e2) {
          let t2 = this._root, n2 = this._comparator;
          for (; t2; ) {
            let r2 = n2(e2, t2.key);
            if (r2 === 0) return true;
            t2 = r2 < 0 ? t2.left : t2.right;
          }
          return false;
        }
        forEach(e2, t2) {
          let n2 = this._root, r2 = [], i2 = false;
          for (; !i2; ) n2 === null ? r2.length === 0 ? i2 = true : (n2 = r2.pop(), e2.call(t2, n2), n2 = n2.right) : (r2.push(n2), n2 = n2.left);
          return this;
        }
        range(e2, t2, n2, r2) {
          let i2 = [], a2 = this._comparator, o2 = this._root, s2;
          for (; i2.length !== 0 || o2; ) if (o2) i2.push(o2), o2 = o2.left;
          else {
            if (o2 = i2.pop(), s2 = a2(o2.key, t2), s2 > 0) break;
            if (a2(o2.key, e2) >= 0 && n2.call(r2, o2)) return this;
            o2 = o2.right;
          }
          return this;
        }
        keys() {
          let e2 = [];
          return this.forEach(({ key: t2 }) => {
            e2.push(t2);
          }), e2;
        }
        values() {
          let e2 = [];
          return this.forEach(({ data: t2 }) => {
            e2.push(t2);
          }), e2;
        }
        min() {
          return this._root ? this.minNode(this._root).key : null;
        }
        max() {
          return this._root ? this.maxNode(this._root).key : null;
        }
        minNode(e2 = this._root) {
          if (e2) for (; e2.left; ) e2 = e2.left;
          return e2;
        }
        maxNode(e2 = this._root) {
          if (e2) for (; e2.right; ) e2 = e2.right;
          return e2;
        }
        at(e2) {
          let t2 = this._root, n2 = false, r2 = 0, i2 = [];
          for (; !n2; ) if (t2) i2.push(t2), t2 = t2.left;
          else if (i2.length > 0) {
            if (t2 = i2.pop(), r2 === e2) return t2;
            r2++, t2 = t2.right;
          } else n2 = true;
          return null;
        }
        next(e2) {
          let t2 = this._root, n2 = null;
          if (e2.right) {
            for (n2 = e2.right; n2.left; ) n2 = n2.left;
            return n2;
          }
          let r2 = this._comparator;
          for (; t2; ) {
            let i2 = r2(e2.key, t2.key);
            if (i2 === 0) break;
            i2 < 0 ? (n2 = t2, t2 = t2.left) : t2 = t2.right;
          }
          return n2;
        }
        prev(e2) {
          let t2 = this._root, n2 = null;
          if (e2.left !== null) {
            for (n2 = e2.left; n2.right; ) n2 = n2.right;
            return n2;
          }
          let r2 = this._comparator;
          for (; t2; ) {
            let i2 = r2(e2.key, t2.key);
            if (i2 === 0) break;
            i2 < 0 ? t2 = t2.left : (n2 = t2, t2 = t2.right);
          }
          return n2;
        }
        clear() {
          return this._root = null, this._size = 0, this;
        }
        toList() {
          return u(this._root);
        }
        load(e2, t2 = [], n2 = false) {
          let r2 = e2.length, i2 = this._comparator;
          if (n2 && p(e2, t2, 0, r2 - 1, i2), this._root === null) this._root = c(e2, t2, 0, r2), this._size = r2;
          else {
            let n3 = f2(this.toList(), l(e2, t2), i2);
            r2 = this._size + r2, this._root = d({ head: n3 }, 0, r2), this._size = r2;
          }
          return this;
        }
        isEmpty() {
          return this._root === null;
        }
        get size() {
          return this._size;
        }
        get root() {
          return this._root;
        }
        toString(e2 = (e3) => String(e3.key)) {
          let t2 = [];
          return o(this._root, ``, true, (e3) => t2.push(e3), e2), t2.join(``);
        }
        update(e2, t2, o2) {
          let s2 = this._comparator;
          this._root === null ? this._size++ : (this._root = n(e2, this._root, s2), s2(e2, this._root.key) !== 0 && this._size++);
          let { left: c2, right: l2 } = i(e2, this._root, s2);
          s2(e2, t2) < 0 ? l2 = r(t2, o2, l2, s2) : c2 = r(t2, o2, c2, s2), this._root = a(c2, l2, s2);
        }
        split(e2) {
          return i(e2, this._root, this._comparator);
        }
        *[Symbol.iterator]() {
          let e2 = this._root, t2 = [], n2 = false;
          for (; !n2; ) e2 === null ? t2.length === 0 ? n2 = true : (e2 = t2.pop(), yield e2, e2 = e2.right) : (t2.push(e2), e2 = e2.left);
        }
      };
      function c(t2, n2, r2, i2) {
        let a2 = i2 - r2;
        if (a2 > 0) {
          let o2 = r2 + Math.floor(a2 / 2), s2 = t2[o2], l2 = n2[o2], u2 = new e(s2, l2);
          return u2.left = c(t2, n2, r2, o2), u2.right = c(t2, n2, o2 + 1, i2), u2;
        }
        return null;
      }
      function l(t2, n2) {
        let r2 = new e(null, null), i2 = r2;
        for (let r3 = 0; r3 < t2.length; r3++) i2 = i2.next = new e(t2[r3], n2[r3]);
        return i2.next = null, r2.next;
      }
      function u(t2) {
        let n2 = t2, r2 = [], i2 = false, a2 = new e(null, null), o2 = a2;
        for (; !i2; ) n2 ? (r2.push(n2), n2 = n2.left) : r2.length > 0 ? (n2 = o2 = o2.next = r2.pop(), n2 = n2.right) : i2 = true;
        return o2.next = null, a2.next;
      }
      function d(e2, t2, n2) {
        let r2 = n2 - t2;
        if (r2 > 0) {
          let i2 = t2 + Math.floor(r2 / 2), a2 = d(e2, t2, i2), o2 = e2.head;
          return o2.left = a2, e2.head = e2.head.next, o2.right = d(e2, i2 + 1, n2), o2;
        }
        return null;
      }
      function f2(t2, n2, r2) {
        let i2 = new e(null, null), a2 = i2, o2 = t2, s2 = n2;
        for (; o2 !== null && s2 !== null; ) r2(o2.key, s2.key) < 0 ? (a2.next = o2, o2 = o2.next) : (a2.next = s2, s2 = s2.next), a2 = a2.next;
        return o2 === null ? s2 !== null && (a2.next = s2) : a2.next = o2, i2.next;
      }
      function p(e2, t2, n2, r2, i2) {
        if (n2 >= r2) return;
        let a2 = e2[n2 + r2 >> 1], o2 = n2 - 1, s2 = r2 + 1;
        for (; ; ) {
          do
            o2++;
          while (i2(e2[o2], a2) < 0);
          do
            s2--;
          while (i2(e2[s2], a2) > 0);
          if (o2 >= s2) break;
          let n3 = e2[o2];
          e2[o2] = e2[s2], e2[s2] = n3, n3 = t2[o2], t2[o2] = t2[s2], t2[s2] = n3;
        }
        p(e2, t2, n2, s2, i2), p(e2, t2, s2 + 1, r2, i2);
      }
      return s;
    });
  }
});

// node_modules/.pnpm/polygon-clipping@0.15.7/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js
var require_polygon_clipping_cjs = __commonJS({
  "node_modules/.pnpm/polygon-clipping@0.15.7/node_modules/polygon-clipping/dist/polygon-clipping.cjs.js"(exports, module) {
    "use strict";
    var SplayTree = require_splaytree_umd();
    function _interopDefaultLegacy(e) {
      return e && typeof e === "object" && "default" in e ? e : { "default": e };
    }
    var SplayTree__default = /* @__PURE__ */ _interopDefaultLegacy(SplayTree);
    var isInBbox = (bbox, point) => {
      return bbox.ll.x <= point.x && point.x <= bbox.ur.x && bbox.ll.y <= point.y && point.y <= bbox.ur.y;
    };
    var getBboxOverlap = (b1, b2) => {
      if (b2.ur.x < b1.ll.x || b1.ur.x < b2.ll.x || b2.ur.y < b1.ll.y || b1.ur.y < b2.ll.y) return null;
      const lowerX = b1.ll.x < b2.ll.x ? b2.ll.x : b1.ll.x;
      const upperX = b1.ur.x < b2.ur.x ? b1.ur.x : b2.ur.x;
      const lowerY = b1.ll.y < b2.ll.y ? b2.ll.y : b1.ll.y;
      const upperY = b1.ur.y < b2.ur.y ? b1.ur.y : b2.ur.y;
      return {
        ll: {
          x: lowerX,
          y: lowerY
        },
        ur: {
          x: upperX,
          y: upperY
        }
      };
    };
    var epsilon$1 = Number.EPSILON;
    if (epsilon$1 === void 0) epsilon$1 = Math.pow(2, -52);
    var EPSILON_SQ = epsilon$1 * epsilon$1;
    var cmp = (a, b) => {
      if (-epsilon$1 < a && a < epsilon$1) {
        if (-epsilon$1 < b && b < epsilon$1) {
          return 0;
        }
      }
      const ab = a - b;
      if (ab * ab < EPSILON_SQ * a * b) {
        return 0;
      }
      return a < b ? -1 : 1;
    };
    var PtRounder = class {
      constructor() {
        this.reset();
      }
      reset() {
        this.xRounder = new CoordRounder();
        this.yRounder = new CoordRounder();
      }
      round(x, y) {
        return {
          x: this.xRounder.round(x),
          y: this.yRounder.round(y)
        };
      }
    };
    var CoordRounder = class {
      constructor() {
        this.tree = new SplayTree__default["default"]();
        this.round(0);
      }
      // Note: this can rounds input values backwards or forwards.
      //       You might ask, why not restrict this to just rounding
      //       forwards? Wouldn't that allow left endpoints to always
      //       remain left endpoints during splitting (never change to
      //       right). No - it wouldn't, because we snap intersections
      //       to endpoints (to establish independence from the segment
      //       angle for t-intersections).
      round(coord) {
        const node = this.tree.add(coord);
        const prevNode = this.tree.prev(node);
        if (prevNode !== null && cmp(node.key, prevNode.key) === 0) {
          this.tree.remove(coord);
          return prevNode.key;
        }
        const nextNode = this.tree.next(node);
        if (nextNode !== null && cmp(node.key, nextNode.key) === 0) {
          this.tree.remove(coord);
          return nextNode.key;
        }
        return coord;
      }
    };
    var rounder = new PtRounder();
    var epsilon = 11102230246251565e-32;
    var splitter = 134217729;
    var resulterrbound = (3 + 8 * epsilon) * epsilon;
    function sum(elen, e, flen, f2, h) {
      let Q, Qnew, hh, bvirt;
      let enow = e[0];
      let fnow = f2[0];
      let eindex = 0;
      let findex = 0;
      if (fnow > enow === fnow > -enow) {
        Q = enow;
        enow = e[++eindex];
      } else {
        Q = fnow;
        fnow = f2[++findex];
      }
      let hindex = 0;
      if (eindex < elen && findex < flen) {
        if (fnow > enow === fnow > -enow) {
          Qnew = enow + Q;
          hh = Q - (Qnew - enow);
          enow = e[++eindex];
        } else {
          Qnew = fnow + Q;
          hh = Q - (Qnew - fnow);
          fnow = f2[++findex];
        }
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
        while (eindex < elen && findex < flen) {
          if (fnow > enow === fnow > -enow) {
            Qnew = Q + enow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (enow - bvirt);
            enow = e[++eindex];
          } else {
            Qnew = Q + fnow;
            bvirt = Qnew - Q;
            hh = Q - (Qnew - bvirt) + (fnow - bvirt);
            fnow = f2[++findex];
          }
          Q = Qnew;
          if (hh !== 0) {
            h[hindex++] = hh;
          }
        }
      }
      while (eindex < elen) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
      }
      while (findex < flen) {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f2[++findex];
        Q = Qnew;
        if (hh !== 0) {
          h[hindex++] = hh;
        }
      }
      if (Q !== 0 || hindex === 0) {
        h[hindex++] = Q;
      }
      return hindex;
    }
    function estimate(elen, e) {
      let Q = e[0];
      for (let i = 1; i < elen; i++) Q += e[i];
      return Q;
    }
    function vec(n) {
      return new Float64Array(n);
    }
    var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
    var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
    var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
    var B = vec(4);
    var C1 = vec(8);
    var C2 = vec(12);
    var D = vec(16);
    var u = vec(4);
    function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
      let acxtail, acytail, bcxtail, bcytail;
      let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u3;
      const acx = ax - cx;
      const bcx = bx - cx;
      const acy = ay - cy;
      const bcy = by - cy;
      s1 = acx * bcy;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcx;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      B[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      B[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      B[2] = _j - (u3 - bvirt) + (_i - bvirt);
      B[3] = u3;
      let det = estimate(4, B);
      let errbound = ccwerrboundB * detsum;
      if (det >= errbound || -det >= errbound) {
        return det;
      }
      bvirt = ax - acx;
      acxtail = ax - (acx + bvirt) + (bvirt - cx);
      bvirt = bx - bcx;
      bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
      bvirt = ay - acy;
      acytail = ay - (acy + bvirt) + (bvirt - cy);
      bvirt = by - bcy;
      bcytail = by - (bcy + bvirt) + (bvirt - cy);
      if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
        return det;
      }
      errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
      det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
      if (det >= errbound || -det >= errbound) return det;
      s1 = acxtail * bcy;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcy;
      bhi = c - (c - bcy);
      blo = bcy - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcx;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcx;
      bhi = c - (c - bcx);
      blo = bcx - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C1len = sum(4, B, 4, u, C1);
      s1 = acx * bcytail;
      c = splitter * acx;
      ahi = c - (c - acx);
      alo = acx - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acy * bcxtail;
      c = splitter * acy;
      ahi = c - (c - acy);
      alo = acy - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const C2len = sum(C1len, C1, 4, u, C2);
      s1 = acxtail * bcytail;
      c = splitter * acxtail;
      ahi = c - (c - acxtail);
      alo = acxtail - ahi;
      c = splitter * bcytail;
      bhi = c - (c - bcytail);
      blo = bcytail - bhi;
      s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
      t1 = acytail * bcxtail;
      c = splitter * acytail;
      ahi = c - (c - acytail);
      alo = acytail - ahi;
      c = splitter * bcxtail;
      bhi = c - (c - bcxtail);
      blo = bcxtail - bhi;
      t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
      _i = s0 - t0;
      bvirt = s0 - _i;
      u[0] = s0 - (_i + bvirt) + (bvirt - t0);
      _j = s1 + _i;
      bvirt = _j - s1;
      _0 = s1 - (_j - bvirt) + (_i - bvirt);
      _i = _0 - t1;
      bvirt = _0 - _i;
      u[1] = _0 - (_i + bvirt) + (bvirt - t1);
      u3 = _j + _i;
      bvirt = u3 - _j;
      u[2] = _j - (u3 - bvirt) + (_i - bvirt);
      u[3] = u3;
      const Dlen = sum(C2len, C2, 4, u, D);
      return D[Dlen - 1];
    }
    function orient2d(ax, ay, bx, by, cx, cy) {
      const detleft = (ay - cy) * (bx - cx);
      const detright = (ax - cx) * (by - cy);
      const det = detleft - detright;
      const detsum = Math.abs(detleft + detright);
      if (Math.abs(det) >= ccwerrboundA * detsum) return det;
      return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
    }
    var crossProduct = (a, b) => a.x * b.y - a.y * b.x;
    var dotProduct = (a, b) => a.x * b.x + a.y * b.y;
    var compareVectorAngles = (basePt, endPt1, endPt2) => {
      const res = orient2d(basePt.x, basePt.y, endPt1.x, endPt1.y, endPt2.x, endPt2.y);
      if (res > 0) return -1;
      if (res < 0) return 1;
      return 0;
    };
    var length = (v) => Math.sqrt(dotProduct(v, v));
    var sineOfAngle = (pShared, pBase, pAngle) => {
      const vBase = {
        x: pBase.x - pShared.x,
        y: pBase.y - pShared.y
      };
      const vAngle = {
        x: pAngle.x - pShared.x,
        y: pAngle.y - pShared.y
      };
      return crossProduct(vAngle, vBase) / length(vAngle) / length(vBase);
    };
    var cosineOfAngle = (pShared, pBase, pAngle) => {
      const vBase = {
        x: pBase.x - pShared.x,
        y: pBase.y - pShared.y
      };
      const vAngle = {
        x: pAngle.x - pShared.x,
        y: pAngle.y - pShared.y
      };
      return dotProduct(vAngle, vBase) / length(vAngle) / length(vBase);
    };
    var horizontalIntersection = (pt, v, y) => {
      if (v.y === 0) return null;
      return {
        x: pt.x + v.x / v.y * (y - pt.y),
        y
      };
    };
    var verticalIntersection = (pt, v, x) => {
      if (v.x === 0) return null;
      return {
        x,
        y: pt.y + v.y / v.x * (x - pt.x)
      };
    };
    var intersection$1 = (pt1, v1, pt2, v2) => {
      if (v1.x === 0) return verticalIntersection(pt2, v2, pt1.x);
      if (v2.x === 0) return verticalIntersection(pt1, v1, pt2.x);
      if (v1.y === 0) return horizontalIntersection(pt2, v2, pt1.y);
      if (v2.y === 0) return horizontalIntersection(pt1, v1, pt2.y);
      const kross = crossProduct(v1, v2);
      if (kross == 0) return null;
      const ve = {
        x: pt2.x - pt1.x,
        y: pt2.y - pt1.y
      };
      const d1 = crossProduct(ve, v1) / kross;
      const d2 = crossProduct(ve, v2) / kross;
      const x1 = pt1.x + d2 * v1.x, x2 = pt2.x + d1 * v2.x;
      const y1 = pt1.y + d2 * v1.y, y2 = pt2.y + d1 * v2.y;
      const x = (x1 + x2) / 2;
      const y = (y1 + y2) / 2;
      return {
        x,
        y
      };
    };
    var SweepEvent = class _SweepEvent {
      // for ordering sweep events in the sweep event queue
      static compare(a, b) {
        const ptCmp = _SweepEvent.comparePoints(a.point, b.point);
        if (ptCmp !== 0) return ptCmp;
        if (a.point !== b.point) a.link(b);
        if (a.isLeft !== b.isLeft) return a.isLeft ? 1 : -1;
        return Segment.compare(a.segment, b.segment);
      }
      // for ordering points in sweep line order
      static comparePoints(aPt, bPt) {
        if (aPt.x < bPt.x) return -1;
        if (aPt.x > bPt.x) return 1;
        if (aPt.y < bPt.y) return -1;
        if (aPt.y > bPt.y) return 1;
        return 0;
      }
      // Warning: 'point' input will be modified and re-used (for performance)
      constructor(point, isLeft) {
        if (point.events === void 0) point.events = [this];
        else point.events.push(this);
        this.point = point;
        this.isLeft = isLeft;
      }
      link(other) {
        if (other.point === this.point) {
          throw new Error("Tried to link already linked events");
        }
        const otherEvents = other.point.events;
        for (let i = 0, iMax = otherEvents.length; i < iMax; i++) {
          const evt = otherEvents[i];
          this.point.events.push(evt);
          evt.point = this.point;
        }
        this.checkForConsuming();
      }
      /* Do a pass over our linked events and check to see if any pair
       * of segments match, and should be consumed. */
      checkForConsuming() {
        const numEvents = this.point.events.length;
        for (let i = 0; i < numEvents; i++) {
          const evt1 = this.point.events[i];
          if (evt1.segment.consumedBy !== void 0) continue;
          for (let j = i + 1; j < numEvents; j++) {
            const evt2 = this.point.events[j];
            if (evt2.consumedBy !== void 0) continue;
            if (evt1.otherSE.point.events !== evt2.otherSE.point.events) continue;
            evt1.segment.consume(evt2.segment);
          }
        }
      }
      getAvailableLinkedEvents() {
        const events = [];
        for (let i = 0, iMax = this.point.events.length; i < iMax; i++) {
          const evt = this.point.events[i];
          if (evt !== this && !evt.segment.ringOut && evt.segment.isInResult()) {
            events.push(evt);
          }
        }
        return events;
      }
      /**
       * Returns a comparator function for sorting linked events that will
       * favor the event that will give us the smallest left-side angle.
       * All ring construction starts as low as possible heading to the right,
       * so by always turning left as sharp as possible we'll get polygons
       * without uncessary loops & holes.
       *
       * The comparator function has a compute cache such that it avoids
       * re-computing already-computed values.
       */
      getLeftmostComparator(baseEvent) {
        const cache = /* @__PURE__ */ new Map();
        const fillCache = (linkedEvent) => {
          const nextEvent = linkedEvent.otherSE;
          cache.set(linkedEvent, {
            sine: sineOfAngle(this.point, baseEvent.point, nextEvent.point),
            cosine: cosineOfAngle(this.point, baseEvent.point, nextEvent.point)
          });
        };
        return (a, b) => {
          if (!cache.has(a)) fillCache(a);
          if (!cache.has(b)) fillCache(b);
          const {
            sine: asine,
            cosine: acosine
          } = cache.get(a);
          const {
            sine: bsine,
            cosine: bcosine
          } = cache.get(b);
          if (asine >= 0 && bsine >= 0) {
            if (acosine < bcosine) return 1;
            if (acosine > bcosine) return -1;
            return 0;
          }
          if (asine < 0 && bsine < 0) {
            if (acosine < bcosine) return -1;
            if (acosine > bcosine) return 1;
            return 0;
          }
          if (bsine < asine) return -1;
          if (bsine > asine) return 1;
          return 0;
        };
      }
    };
    var segmentId = 0;
    var Segment = class _Segment {
      /* This compare() function is for ordering segments in the sweep
       * line tree, and does so according to the following criteria:
       *
       * Consider the vertical line that lies an infinestimal step to the
       * right of the right-more of the two left endpoints of the input
       * segments. Imagine slowly moving a point up from negative infinity
       * in the increasing y direction. Which of the two segments will that
       * point intersect first? That segment comes 'before' the other one.
       *
       * If neither segment would be intersected by such a line, (if one
       * or more of the segments are vertical) then the line to be considered
       * is directly on the right-more of the two left inputs.
       */
      static compare(a, b) {
        const alx = a.leftSE.point.x;
        const blx = b.leftSE.point.x;
        const arx = a.rightSE.point.x;
        const brx = b.rightSE.point.x;
        if (brx < alx) return 1;
        if (arx < blx) return -1;
        const aly = a.leftSE.point.y;
        const bly = b.leftSE.point.y;
        const ary = a.rightSE.point.y;
        const bry = b.rightSE.point.y;
        if (alx < blx) {
          if (bly < aly && bly < ary) return 1;
          if (bly > aly && bly > ary) return -1;
          const aCmpBLeft = a.comparePoint(b.leftSE.point);
          if (aCmpBLeft < 0) return 1;
          if (aCmpBLeft > 0) return -1;
          const bCmpARight = b.comparePoint(a.rightSE.point);
          if (bCmpARight !== 0) return bCmpARight;
          return -1;
        }
        if (alx > blx) {
          if (aly < bly && aly < bry) return -1;
          if (aly > bly && aly > bry) return 1;
          const bCmpALeft = b.comparePoint(a.leftSE.point);
          if (bCmpALeft !== 0) return bCmpALeft;
          const aCmpBRight = a.comparePoint(b.rightSE.point);
          if (aCmpBRight < 0) return 1;
          if (aCmpBRight > 0) return -1;
          return 1;
        }
        if (aly < bly) return -1;
        if (aly > bly) return 1;
        if (arx < brx) {
          const bCmpARight = b.comparePoint(a.rightSE.point);
          if (bCmpARight !== 0) return bCmpARight;
        }
        if (arx > brx) {
          const aCmpBRight = a.comparePoint(b.rightSE.point);
          if (aCmpBRight < 0) return 1;
          if (aCmpBRight > 0) return -1;
        }
        if (arx !== brx) {
          const ay = ary - aly;
          const ax = arx - alx;
          const by = bry - bly;
          const bx = brx - blx;
          if (ay > ax && by < bx) return 1;
          if (ay < ax && by > bx) return -1;
        }
        if (arx > brx) return 1;
        if (arx < brx) return -1;
        if (ary < bry) return -1;
        if (ary > bry) return 1;
        if (a.id < b.id) return -1;
        if (a.id > b.id) return 1;
        return 0;
      }
      /* Warning: a reference to ringWindings input will be stored,
       *  and possibly will be later modified */
      constructor(leftSE, rightSE, rings, windings) {
        this.id = ++segmentId;
        this.leftSE = leftSE;
        leftSE.segment = this;
        leftSE.otherSE = rightSE;
        this.rightSE = rightSE;
        rightSE.segment = this;
        rightSE.otherSE = leftSE;
        this.rings = rings;
        this.windings = windings;
      }
      static fromRing(pt1, pt2, ring) {
        let leftPt, rightPt, winding;
        const cmpPts = SweepEvent.comparePoints(pt1, pt2);
        if (cmpPts < 0) {
          leftPt = pt1;
          rightPt = pt2;
          winding = 1;
        } else if (cmpPts > 0) {
          leftPt = pt2;
          rightPt = pt1;
          winding = -1;
        } else throw new Error(`Tried to create degenerate segment at [${pt1.x}, ${pt1.y}]`);
        const leftSE = new SweepEvent(leftPt, true);
        const rightSE = new SweepEvent(rightPt, false);
        return new _Segment(leftSE, rightSE, [ring], [winding]);
      }
      /* When a segment is split, the rightSE is replaced with a new sweep event */
      replaceRightSE(newRightSE) {
        this.rightSE = newRightSE;
        this.rightSE.segment = this;
        this.rightSE.otherSE = this.leftSE;
        this.leftSE.otherSE = this.rightSE;
      }
      bbox() {
        const y1 = this.leftSE.point.y;
        const y2 = this.rightSE.point.y;
        return {
          ll: {
            x: this.leftSE.point.x,
            y: y1 < y2 ? y1 : y2
          },
          ur: {
            x: this.rightSE.point.x,
            y: y1 > y2 ? y1 : y2
          }
        };
      }
      /* A vector from the left point to the right */
      vector() {
        return {
          x: this.rightSE.point.x - this.leftSE.point.x,
          y: this.rightSE.point.y - this.leftSE.point.y
        };
      }
      isAnEndpoint(pt) {
        return pt.x === this.leftSE.point.x && pt.y === this.leftSE.point.y || pt.x === this.rightSE.point.x && pt.y === this.rightSE.point.y;
      }
      /* Compare this segment with a point.
       *
       * A point P is considered to be colinear to a segment if there
       * exists a distance D such that if we travel along the segment
       * from one * endpoint towards the other a distance D, we find
       * ourselves at point P.
       *
       * Return value indicates:
       *
       *   1: point lies above the segment (to the left of vertical)
       *   0: point is colinear to segment
       *  -1: point lies below the segment (to the right of vertical)
       */
      comparePoint(point) {
        if (this.isAnEndpoint(point)) return 0;
        const lPt = this.leftSE.point;
        const rPt = this.rightSE.point;
        const v = this.vector();
        if (lPt.x === rPt.x) {
          if (point.x === lPt.x) return 0;
          return point.x < lPt.x ? 1 : -1;
        }
        const yDist = (point.y - lPt.y) / v.y;
        const xFromYDist = lPt.x + yDist * v.x;
        if (point.x === xFromYDist) return 0;
        const xDist = (point.x - lPt.x) / v.x;
        const yFromXDist = lPt.y + xDist * v.y;
        if (point.y === yFromXDist) return 0;
        return point.y < yFromXDist ? -1 : 1;
      }
      /**
       * Given another segment, returns the first non-trivial intersection
       * between the two segments (in terms of sweep line ordering), if it exists.
       *
       * A 'non-trivial' intersection is one that will cause one or both of the
       * segments to be split(). As such, 'trivial' vs. 'non-trivial' intersection:
       *
       *   * endpoint of segA with endpoint of segB --> trivial
       *   * endpoint of segA with point along segB --> non-trivial
       *   * endpoint of segB with point along segA --> non-trivial
       *   * point along segA with point along segB --> non-trivial
       *
       * If no non-trivial intersection exists, return null
       * Else, return null.
       */
      getIntersection(other) {
        const tBbox = this.bbox();
        const oBbox = other.bbox();
        const bboxOverlap = getBboxOverlap(tBbox, oBbox);
        if (bboxOverlap === null) return null;
        const tlp = this.leftSE.point;
        const trp = this.rightSE.point;
        const olp = other.leftSE.point;
        const orp = other.rightSE.point;
        const touchesOtherLSE = isInBbox(tBbox, olp) && this.comparePoint(olp) === 0;
        const touchesThisLSE = isInBbox(oBbox, tlp) && other.comparePoint(tlp) === 0;
        const touchesOtherRSE = isInBbox(tBbox, orp) && this.comparePoint(orp) === 0;
        const touchesThisRSE = isInBbox(oBbox, trp) && other.comparePoint(trp) === 0;
        if (touchesThisLSE && touchesOtherLSE) {
          if (touchesThisRSE && !touchesOtherRSE) return trp;
          if (!touchesThisRSE && touchesOtherRSE) return orp;
          return null;
        }
        if (touchesThisLSE) {
          if (touchesOtherRSE) {
            if (tlp.x === orp.x && tlp.y === orp.y) return null;
          }
          return tlp;
        }
        if (touchesOtherLSE) {
          if (touchesThisRSE) {
            if (trp.x === olp.x && trp.y === olp.y) return null;
          }
          return olp;
        }
        if (touchesThisRSE && touchesOtherRSE) return null;
        if (touchesThisRSE) return trp;
        if (touchesOtherRSE) return orp;
        const pt = intersection$1(tlp, this.vector(), olp, other.vector());
        if (pt === null) return null;
        if (!isInBbox(bboxOverlap, pt)) return null;
        return rounder.round(pt.x, pt.y);
      }
      /**
       * Split the given segment into multiple segments on the given points.
       *  * Each existing segment will retain its leftSE and a new rightSE will be
       *    generated for it.
       *  * A new segment will be generated which will adopt the original segment's
       *    rightSE, and a new leftSE will be generated for it.
       *  * If there are more than two points given to split on, new segments
       *    in the middle will be generated with new leftSE and rightSE's.
       *  * An array of the newly generated SweepEvents will be returned.
       *
       * Warning: input array of points is modified
       */
      split(point) {
        const newEvents = [];
        const alreadyLinked = point.events !== void 0;
        const newLeftSE = new SweepEvent(point, true);
        const newRightSE = new SweepEvent(point, false);
        const oldRightSE = this.rightSE;
        this.replaceRightSE(newRightSE);
        newEvents.push(newRightSE);
        newEvents.push(newLeftSE);
        const newSeg = new _Segment(newLeftSE, oldRightSE, this.rings.slice(), this.windings.slice());
        if (SweepEvent.comparePoints(newSeg.leftSE.point, newSeg.rightSE.point) > 0) {
          newSeg.swapEvents();
        }
        if (SweepEvent.comparePoints(this.leftSE.point, this.rightSE.point) > 0) {
          this.swapEvents();
        }
        if (alreadyLinked) {
          newLeftSE.checkForConsuming();
          newRightSE.checkForConsuming();
        }
        return newEvents;
      }
      /* Swap which event is left and right */
      swapEvents() {
        const tmpEvt = this.rightSE;
        this.rightSE = this.leftSE;
        this.leftSE = tmpEvt;
        this.leftSE.isLeft = true;
        this.rightSE.isLeft = false;
        for (let i = 0, iMax = this.windings.length; i < iMax; i++) {
          this.windings[i] *= -1;
        }
      }
      /* Consume another segment. We take their rings under our wing
       * and mark them as consumed. Use for perfectly overlapping segments */
      consume(other) {
        let consumer = this;
        let consumee = other;
        while (consumer.consumedBy) consumer = consumer.consumedBy;
        while (consumee.consumedBy) consumee = consumee.consumedBy;
        const cmp2 = _Segment.compare(consumer, consumee);
        if (cmp2 === 0) return;
        if (cmp2 > 0) {
          const tmp = consumer;
          consumer = consumee;
          consumee = tmp;
        }
        if (consumer.prev === consumee) {
          const tmp = consumer;
          consumer = consumee;
          consumee = tmp;
        }
        for (let i = 0, iMax = consumee.rings.length; i < iMax; i++) {
          const ring = consumee.rings[i];
          const winding = consumee.windings[i];
          const index2 = consumer.rings.indexOf(ring);
          if (index2 === -1) {
            consumer.rings.push(ring);
            consumer.windings.push(winding);
          } else consumer.windings[index2] += winding;
        }
        consumee.rings = null;
        consumee.windings = null;
        consumee.consumedBy = consumer;
        consumee.leftSE.consumedBy = consumer.leftSE;
        consumee.rightSE.consumedBy = consumer.rightSE;
      }
      /* The first segment previous segment chain that is in the result */
      prevInResult() {
        if (this._prevInResult !== void 0) return this._prevInResult;
        if (!this.prev) this._prevInResult = null;
        else if (this.prev.isInResult()) this._prevInResult = this.prev;
        else this._prevInResult = this.prev.prevInResult();
        return this._prevInResult;
      }
      beforeState() {
        if (this._beforeState !== void 0) return this._beforeState;
        if (!this.prev) this._beforeState = {
          rings: [],
          windings: [],
          multiPolys: []
        };
        else {
          const seg = this.prev.consumedBy || this.prev;
          this._beforeState = seg.afterState();
        }
        return this._beforeState;
      }
      afterState() {
        if (this._afterState !== void 0) return this._afterState;
        const beforeState = this.beforeState();
        this._afterState = {
          rings: beforeState.rings.slice(0),
          windings: beforeState.windings.slice(0),
          multiPolys: []
        };
        const ringsAfter = this._afterState.rings;
        const windingsAfter = this._afterState.windings;
        const mpsAfter = this._afterState.multiPolys;
        for (let i = 0, iMax = this.rings.length; i < iMax; i++) {
          const ring = this.rings[i];
          const winding = this.windings[i];
          const index2 = ringsAfter.indexOf(ring);
          if (index2 === -1) {
            ringsAfter.push(ring);
            windingsAfter.push(winding);
          } else windingsAfter[index2] += winding;
        }
        const polysAfter = [];
        const polysExclude = [];
        for (let i = 0, iMax = ringsAfter.length; i < iMax; i++) {
          if (windingsAfter[i] === 0) continue;
          const ring = ringsAfter[i];
          const poly = ring.poly;
          if (polysExclude.indexOf(poly) !== -1) continue;
          if (ring.isExterior) polysAfter.push(poly);
          else {
            if (polysExclude.indexOf(poly) === -1) polysExclude.push(poly);
            const index2 = polysAfter.indexOf(ring.poly);
            if (index2 !== -1) polysAfter.splice(index2, 1);
          }
        }
        for (let i = 0, iMax = polysAfter.length; i < iMax; i++) {
          const mp = polysAfter[i].multiPoly;
          if (mpsAfter.indexOf(mp) === -1) mpsAfter.push(mp);
        }
        return this._afterState;
      }
      /* Is this segment part of the final result? */
      isInResult() {
        if (this.consumedBy) return false;
        if (this._isInResult !== void 0) return this._isInResult;
        const mpsBefore = this.beforeState().multiPolys;
        const mpsAfter = this.afterState().multiPolys;
        switch (operation.type) {
          case "union": {
            const noBefores = mpsBefore.length === 0;
            const noAfters = mpsAfter.length === 0;
            this._isInResult = noBefores !== noAfters;
            break;
          }
          case "intersection": {
            let least;
            let most;
            if (mpsBefore.length < mpsAfter.length) {
              least = mpsBefore.length;
              most = mpsAfter.length;
            } else {
              least = mpsAfter.length;
              most = mpsBefore.length;
            }
            this._isInResult = most === operation.numMultiPolys && least < most;
            break;
          }
          case "xor": {
            const diff = Math.abs(mpsBefore.length - mpsAfter.length);
            this._isInResult = diff % 2 === 1;
            break;
          }
          case "difference": {
            const isJustSubject = (mps) => mps.length === 1 && mps[0].isSubject;
            this._isInResult = isJustSubject(mpsBefore) !== isJustSubject(mpsAfter);
            break;
          }
          default:
            throw new Error(`Unrecognized operation type found ${operation.type}`);
        }
        return this._isInResult;
      }
    };
    var RingIn = class {
      constructor(geomRing, poly, isExterior) {
        if (!Array.isArray(geomRing) || geomRing.length === 0) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        this.poly = poly;
        this.isExterior = isExterior;
        this.segments = [];
        if (typeof geomRing[0][0] !== "number" || typeof geomRing[0][1] !== "number") {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        const firstPoint = rounder.round(geomRing[0][0], geomRing[0][1]);
        this.bbox = {
          ll: {
            x: firstPoint.x,
            y: firstPoint.y
          },
          ur: {
            x: firstPoint.x,
            y: firstPoint.y
          }
        };
        let prevPoint = firstPoint;
        for (let i = 1, iMax = geomRing.length; i < iMax; i++) {
          if (typeof geomRing[i][0] !== "number" || typeof geomRing[i][1] !== "number") {
            throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
          }
          let point = rounder.round(geomRing[i][0], geomRing[i][1]);
          if (point.x === prevPoint.x && point.y === prevPoint.y) continue;
          this.segments.push(Segment.fromRing(prevPoint, point, this));
          if (point.x < this.bbox.ll.x) this.bbox.ll.x = point.x;
          if (point.y < this.bbox.ll.y) this.bbox.ll.y = point.y;
          if (point.x > this.bbox.ur.x) this.bbox.ur.x = point.x;
          if (point.y > this.bbox.ur.y) this.bbox.ur.y = point.y;
          prevPoint = point;
        }
        if (firstPoint.x !== prevPoint.x || firstPoint.y !== prevPoint.y) {
          this.segments.push(Segment.fromRing(prevPoint, firstPoint, this));
        }
      }
      getSweepEvents() {
        const sweepEvents = [];
        for (let i = 0, iMax = this.segments.length; i < iMax; i++) {
          const segment = this.segments[i];
          sweepEvents.push(segment.leftSE);
          sweepEvents.push(segment.rightSE);
        }
        return sweepEvents;
      }
    };
    var PolyIn = class {
      constructor(geomPoly, multiPoly) {
        if (!Array.isArray(geomPoly)) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        this.exteriorRing = new RingIn(geomPoly[0], this, true);
        this.bbox = {
          ll: {
            x: this.exteriorRing.bbox.ll.x,
            y: this.exteriorRing.bbox.ll.y
          },
          ur: {
            x: this.exteriorRing.bbox.ur.x,
            y: this.exteriorRing.bbox.ur.y
          }
        };
        this.interiorRings = [];
        for (let i = 1, iMax = geomPoly.length; i < iMax; i++) {
          const ring = new RingIn(geomPoly[i], this, false);
          if (ring.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = ring.bbox.ll.x;
          if (ring.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = ring.bbox.ll.y;
          if (ring.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = ring.bbox.ur.x;
          if (ring.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = ring.bbox.ur.y;
          this.interiorRings.push(ring);
        }
        this.multiPoly = multiPoly;
      }
      getSweepEvents() {
        const sweepEvents = this.exteriorRing.getSweepEvents();
        for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          const ringSweepEvents = this.interiorRings[i].getSweepEvents();
          for (let j = 0, jMax = ringSweepEvents.length; j < jMax; j++) {
            sweepEvents.push(ringSweepEvents[j]);
          }
        }
        return sweepEvents;
      }
    };
    var MultiPolyIn = class {
      constructor(geom, isSubject) {
        if (!Array.isArray(geom)) {
          throw new Error("Input geometry is not a valid Polygon or MultiPolygon");
        }
        try {
          if (typeof geom[0][0][0] === "number") geom = [geom];
        } catch (ex) {
        }
        this.polys = [];
        this.bbox = {
          ll: {
            x: Number.POSITIVE_INFINITY,
            y: Number.POSITIVE_INFINITY
          },
          ur: {
            x: Number.NEGATIVE_INFINITY,
            y: Number.NEGATIVE_INFINITY
          }
        };
        for (let i = 0, iMax = geom.length; i < iMax; i++) {
          const poly = new PolyIn(geom[i], this);
          if (poly.bbox.ll.x < this.bbox.ll.x) this.bbox.ll.x = poly.bbox.ll.x;
          if (poly.bbox.ll.y < this.bbox.ll.y) this.bbox.ll.y = poly.bbox.ll.y;
          if (poly.bbox.ur.x > this.bbox.ur.x) this.bbox.ur.x = poly.bbox.ur.x;
          if (poly.bbox.ur.y > this.bbox.ur.y) this.bbox.ur.y = poly.bbox.ur.y;
          this.polys.push(poly);
        }
        this.isSubject = isSubject;
      }
      getSweepEvents() {
        const sweepEvents = [];
        for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
          const polySweepEvents = this.polys[i].getSweepEvents();
          for (let j = 0, jMax = polySweepEvents.length; j < jMax; j++) {
            sweepEvents.push(polySweepEvents[j]);
          }
        }
        return sweepEvents;
      }
    };
    var RingOut = class _RingOut {
      /* Given the segments from the sweep line pass, compute & return a series
       * of closed rings from all the segments marked to be part of the result */
      static factory(allSegments) {
        const ringsOut = [];
        for (let i = 0, iMax = allSegments.length; i < iMax; i++) {
          const segment = allSegments[i];
          if (!segment.isInResult() || segment.ringOut) continue;
          let prevEvent = null;
          let event = segment.leftSE;
          let nextEvent = segment.rightSE;
          const events = [event];
          const startingPoint = event.point;
          const intersectionLEs = [];
          while (true) {
            prevEvent = event;
            event = nextEvent;
            events.push(event);
            if (event.point === startingPoint) break;
            while (true) {
              const availableLEs = event.getAvailableLinkedEvents();
              if (availableLEs.length === 0) {
                const firstPt = events[0].point;
                const lastPt = events[events.length - 1].point;
                throw new Error(`Unable to complete output ring starting at [${firstPt.x}, ${firstPt.y}]. Last matching segment found ends at [${lastPt.x}, ${lastPt.y}].`);
              }
              if (availableLEs.length === 1) {
                nextEvent = availableLEs[0].otherSE;
                break;
              }
              let indexLE = null;
              for (let j = 0, jMax = intersectionLEs.length; j < jMax; j++) {
                if (intersectionLEs[j].point === event.point) {
                  indexLE = j;
                  break;
                }
              }
              if (indexLE !== null) {
                const intersectionLE = intersectionLEs.splice(indexLE)[0];
                const ringEvents = events.splice(intersectionLE.index);
                ringEvents.unshift(ringEvents[0].otherSE);
                ringsOut.push(new _RingOut(ringEvents.reverse()));
                continue;
              }
              intersectionLEs.push({
                index: events.length,
                point: event.point
              });
              const comparator = event.getLeftmostComparator(prevEvent);
              nextEvent = availableLEs.sort(comparator)[0].otherSE;
              break;
            }
          }
          ringsOut.push(new _RingOut(events));
        }
        return ringsOut;
      }
      constructor(events) {
        this.events = events;
        for (let i = 0, iMax = events.length; i < iMax; i++) {
          events[i].segment.ringOut = this;
        }
        this.poly = null;
      }
      getGeom() {
        let prevPt = this.events[0].point;
        const points = [prevPt];
        for (let i = 1, iMax = this.events.length - 1; i < iMax; i++) {
          const pt2 = this.events[i].point;
          const nextPt2 = this.events[i + 1].point;
          if (compareVectorAngles(pt2, prevPt, nextPt2) === 0) continue;
          points.push(pt2);
          prevPt = pt2;
        }
        if (points.length === 1) return null;
        const pt = points[0];
        const nextPt = points[1];
        if (compareVectorAngles(pt, prevPt, nextPt) === 0) points.shift();
        points.push(points[0]);
        const step = this.isExteriorRing() ? 1 : -1;
        const iStart = this.isExteriorRing() ? 0 : points.length - 1;
        const iEnd = this.isExteriorRing() ? points.length : -1;
        const orderedPoints = [];
        for (let i = iStart; i != iEnd; i += step) orderedPoints.push([points[i].x, points[i].y]);
        return orderedPoints;
      }
      isExteriorRing() {
        if (this._isExteriorRing === void 0) {
          const enclosing = this.enclosingRing();
          this._isExteriorRing = enclosing ? !enclosing.isExteriorRing() : true;
        }
        return this._isExteriorRing;
      }
      enclosingRing() {
        if (this._enclosingRing === void 0) {
          this._enclosingRing = this._calcEnclosingRing();
        }
        return this._enclosingRing;
      }
      /* Returns the ring that encloses this one, if any */
      _calcEnclosingRing() {
        let leftMostEvt = this.events[0];
        for (let i = 1, iMax = this.events.length; i < iMax; i++) {
          const evt = this.events[i];
          if (SweepEvent.compare(leftMostEvt, evt) > 0) leftMostEvt = evt;
        }
        let prevSeg = leftMostEvt.segment.prevInResult();
        let prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
        while (true) {
          if (!prevSeg) return null;
          if (!prevPrevSeg) return prevSeg.ringOut;
          if (prevPrevSeg.ringOut !== prevSeg.ringOut) {
            if (prevPrevSeg.ringOut.enclosingRing() !== prevSeg.ringOut) {
              return prevSeg.ringOut;
            } else return prevSeg.ringOut.enclosingRing();
          }
          prevSeg = prevPrevSeg.prevInResult();
          prevPrevSeg = prevSeg ? prevSeg.prevInResult() : null;
        }
      }
    };
    var PolyOut = class {
      constructor(exteriorRing) {
        this.exteriorRing = exteriorRing;
        exteriorRing.poly = this;
        this.interiorRings = [];
      }
      addInterior(ring) {
        this.interiorRings.push(ring);
        ring.poly = this;
      }
      getGeom() {
        const geom = [this.exteriorRing.getGeom()];
        if (geom[0] === null) return null;
        for (let i = 0, iMax = this.interiorRings.length; i < iMax; i++) {
          const ringGeom = this.interiorRings[i].getGeom();
          if (ringGeom === null) continue;
          geom.push(ringGeom);
        }
        return geom;
      }
    };
    var MultiPolyOut = class {
      constructor(rings) {
        this.rings = rings;
        this.polys = this._composePolys(rings);
      }
      getGeom() {
        const geom = [];
        for (let i = 0, iMax = this.polys.length; i < iMax; i++) {
          const polyGeom = this.polys[i].getGeom();
          if (polyGeom === null) continue;
          geom.push(polyGeom);
        }
        return geom;
      }
      _composePolys(rings) {
        const polys = [];
        for (let i = 0, iMax = rings.length; i < iMax; i++) {
          const ring = rings[i];
          if (ring.poly) continue;
          if (ring.isExteriorRing()) polys.push(new PolyOut(ring));
          else {
            const enclosingRing = ring.enclosingRing();
            if (!enclosingRing.poly) polys.push(new PolyOut(enclosingRing));
            enclosingRing.poly.addInterior(ring);
          }
        }
        return polys;
      }
    };
    var SweepLine = class {
      constructor(queue) {
        let comparator = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Segment.compare;
        this.queue = queue;
        this.tree = new SplayTree__default["default"](comparator);
        this.segments = [];
      }
      process(event) {
        const segment = event.segment;
        const newEvents = [];
        if (event.consumedBy) {
          if (event.isLeft) this.queue.remove(event.otherSE);
          else this.tree.remove(segment);
          return newEvents;
        }
        const node = event.isLeft ? this.tree.add(segment) : this.tree.find(segment);
        if (!node) throw new Error(`Unable to find segment #${segment.id} [${segment.leftSE.point.x}, ${segment.leftSE.point.y}] -> [${segment.rightSE.point.x}, ${segment.rightSE.point.y}] in SweepLine tree.`);
        let prevNode = node;
        let nextNode = node;
        let prevSeg = void 0;
        let nextSeg = void 0;
        while (prevSeg === void 0) {
          prevNode = this.tree.prev(prevNode);
          if (prevNode === null) prevSeg = null;
          else if (prevNode.key.consumedBy === void 0) prevSeg = prevNode.key;
        }
        while (nextSeg === void 0) {
          nextNode = this.tree.next(nextNode);
          if (nextNode === null) nextSeg = null;
          else if (nextNode.key.consumedBy === void 0) nextSeg = nextNode.key;
        }
        if (event.isLeft) {
          let prevMySplitter = null;
          if (prevSeg) {
            const prevInter = prevSeg.getIntersection(segment);
            if (prevInter !== null) {
              if (!segment.isAnEndpoint(prevInter)) prevMySplitter = prevInter;
              if (!prevSeg.isAnEndpoint(prevInter)) {
                const newEventsFromSplit = this._splitSafely(prevSeg, prevInter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }
          let nextMySplitter = null;
          if (nextSeg) {
            const nextInter = nextSeg.getIntersection(segment);
            if (nextInter !== null) {
              if (!segment.isAnEndpoint(nextInter)) nextMySplitter = nextInter;
              if (!nextSeg.isAnEndpoint(nextInter)) {
                const newEventsFromSplit = this._splitSafely(nextSeg, nextInter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }
          if (prevMySplitter !== null || nextMySplitter !== null) {
            let mySplitter = null;
            if (prevMySplitter === null) mySplitter = nextMySplitter;
            else if (nextMySplitter === null) mySplitter = prevMySplitter;
            else {
              const cmpSplitters = SweepEvent.comparePoints(prevMySplitter, nextMySplitter);
              mySplitter = cmpSplitters <= 0 ? prevMySplitter : nextMySplitter;
            }
            this.queue.remove(segment.rightSE);
            newEvents.push(segment.rightSE);
            const newEventsFromSplit = segment.split(mySplitter);
            for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
              newEvents.push(newEventsFromSplit[i]);
            }
          }
          if (newEvents.length > 0) {
            this.tree.remove(segment);
            newEvents.push(event);
          } else {
            this.segments.push(segment);
            segment.prev = prevSeg;
          }
        } else {
          if (prevSeg && nextSeg) {
            const inter = prevSeg.getIntersection(nextSeg);
            if (inter !== null) {
              if (!prevSeg.isAnEndpoint(inter)) {
                const newEventsFromSplit = this._splitSafely(prevSeg, inter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
              if (!nextSeg.isAnEndpoint(inter)) {
                const newEventsFromSplit = this._splitSafely(nextSeg, inter);
                for (let i = 0, iMax = newEventsFromSplit.length; i < iMax; i++) {
                  newEvents.push(newEventsFromSplit[i]);
                }
              }
            }
          }
          this.tree.remove(segment);
        }
        return newEvents;
      }
      /* Safely split a segment that is currently in the datastructures
       * IE - a segment other than the one that is currently being processed. */
      _splitSafely(seg, pt) {
        this.tree.remove(seg);
        const rightSE = seg.rightSE;
        this.queue.remove(rightSE);
        const newEvents = seg.split(pt);
        newEvents.push(rightSE);
        if (seg.consumedBy === void 0) this.tree.add(seg);
        return newEvents;
      }
    };
    var POLYGON_CLIPPING_MAX_QUEUE_SIZE = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_QUEUE_SIZE || 1e6;
    var POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = typeof process !== "undefined" && process.env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS || 1e6;
    var Operation = class {
      run(type, geom, moreGeoms) {
        operation.type = type;
        rounder.reset();
        const multipolys = [new MultiPolyIn(geom, true)];
        for (let i = 0, iMax = moreGeoms.length; i < iMax; i++) {
          multipolys.push(new MultiPolyIn(moreGeoms[i], false));
        }
        operation.numMultiPolys = multipolys.length;
        if (operation.type === "difference") {
          const subject = multipolys[0];
          let i = 1;
          while (i < multipolys.length) {
            if (getBboxOverlap(multipolys[i].bbox, subject.bbox) !== null) i++;
            else multipolys.splice(i, 1);
          }
        }
        if (operation.type === "intersection") {
          for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
            const mpA = multipolys[i];
            for (let j = i + 1, jMax = multipolys.length; j < jMax; j++) {
              if (getBboxOverlap(mpA.bbox, multipolys[j].bbox) === null) return [];
            }
          }
        }
        const queue = new SplayTree__default["default"](SweepEvent.compare);
        for (let i = 0, iMax = multipolys.length; i < iMax; i++) {
          const sweepEvents = multipolys[i].getSweepEvents();
          for (let j = 0, jMax = sweepEvents.length; j < jMax; j++) {
            queue.insert(sweepEvents[j]);
            if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
              throw new Error("Infinite loop when putting segment endpoints in a priority queue (queue size too big).");
            }
          }
        }
        const sweepLine = new SweepLine(queue);
        let prevQueueSize = queue.size;
        let node = queue.pop();
        while (node) {
          const evt = node.key;
          if (queue.size === prevQueueSize) {
            const seg = evt.segment;
            throw new Error(`Unable to pop() ${evt.isLeft ? "left" : "right"} SweepEvent [${evt.point.x}, ${evt.point.y}] from segment #${seg.id} [${seg.leftSE.point.x}, ${seg.leftSE.point.y}] -> [${seg.rightSE.point.x}, ${seg.rightSE.point.y}] from queue.`);
          }
          if (queue.size > POLYGON_CLIPPING_MAX_QUEUE_SIZE) {
            throw new Error("Infinite loop when passing sweep line over endpoints (queue size too big).");
          }
          if (sweepLine.segments.length > POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS) {
            throw new Error("Infinite loop when passing sweep line over endpoints (too many sweep line segments).");
          }
          const newEvents = sweepLine.process(evt);
          for (let i = 0, iMax = newEvents.length; i < iMax; i++) {
            const evt2 = newEvents[i];
            if (evt2.consumedBy === void 0) queue.insert(evt2);
          }
          prevQueueSize = queue.size;
          node = queue.pop();
        }
        rounder.reset();
        const ringsOut = RingOut.factory(sweepLine.segments);
        const result = new MultiPolyOut(ringsOut);
        return result.getGeom();
      }
    };
    var operation = new Operation();
    var union = function(geom) {
      for (var _len = arguments.length, moreGeoms = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        moreGeoms[_key - 1] = arguments[_key];
      }
      return operation.run("union", geom, moreGeoms);
    };
    var intersection = function(geom) {
      for (var _len2 = arguments.length, moreGeoms = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        moreGeoms[_key2 - 1] = arguments[_key2];
      }
      return operation.run("intersection", geom, moreGeoms);
    };
    var xor = function(geom) {
      for (var _len3 = arguments.length, moreGeoms = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        moreGeoms[_key3 - 1] = arguments[_key3];
      }
      return operation.run("xor", geom, moreGeoms);
    };
    var difference = function(subjectGeom) {
      for (var _len4 = arguments.length, clippingGeoms = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        clippingGeoms[_key4 - 1] = arguments[_key4];
      }
      return operation.run("difference", subjectGeom, clippingGeoms);
    };
    var index = {
      union,
      intersection,
      xor,
      difference
    };
    module.exports = index;
  }
});

// node_modules/.pnpm/@netlify+runtime-utils@3.0.1/node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify, process: process2 } = globalThis;
  return Netlify?.env ?? Deno?.env ?? {
    delete: (key) => delete process2?.env[key],
    get: (key) => process2?.env[key],
    has: (key) => Boolean(process2?.env[key]),
    set: (key, value) => {
      if (process2?.env) {
        process2.env[key] = value;
      }
    },
    toObject: () => process2?.env ?? {}
  };
};

// node_modules/.pnpm/@netlify+otel@7.0.8/node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/.pnpm/@netlify+blobs@11.1.9/node_modules/@netlify/blobs/dist/chunk-SQCJ2S3G.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context, responseBody) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    const summary = `Netlify Blobs could not write to store '${storeName}' (${details}).`;
    if (context.edgeAccess) {
      return summary;
    }
    return `${summary} Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  let message = `Netlify Blobs has generated an internal error (${details})`;
  if (!res.headers.get(NF_ERROR) && responseBody) {
    message += `: ${responseBody}`;
  }
  return message;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}, responseBody) {
    super(blobsErrorMessage(res, context, responseBody));
    this.name = "BlobsInternalError";
    this.status = res.status;
    this.responseBody = responseBody;
  }
};
var createBlobsInternalError = async (res, context = {}) => {
  const responseBody = await res.clone().text().catch(() => void 0);
  return new BlobsInternalError(res, context, responseBody);
};
var discardBody = async (res) => {
  await res.body?.cancel().catch(() => {
  });
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var REGION_AUTO = "auto";
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY, getRetryUrl) => {
  try {
    const res = await fetch(url, options);
    const isRetryable = res.status === 429 || res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;
    if (attemptsLeft > 0 && isRetryable) {
      await discardBody(res);
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      const retryUrl = getRetryUrl ? await getRetryUrl() : url;
      return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    const retryUrl = getRetryUrl ? await getRetryUrl() : url;
    return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  /**
   * Whether requests reach Blobs through the edge rather than the API. Only
   * runtime environments are given an edge URL.
   */
  get edgeAccess() {
    return this.edgeURL !== void 0;
  }
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw await createBlobsInternalError(res, { edgeAccess: this.edgeAccess, method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    const usesSignedUrl = !this.edgeURL && key !== void 0 && storeName !== void 0 && method !== "head" && method !== "delete";
    let getRetryUrl;
    if (usesSignedUrl) {
      getRetryUrl = async () => {
        const finalRequest = await this.getFinalRequest({ consistency, key, metadata, method, parameters, storeName });
        return finalRequest.url;
      };
    }
    return fetchAndRetry(this.fetch, url, options, void 0, getRetryUrl);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/.pnpm/@netlify+blobs@11.1.9/node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var STATUS_CONFLICT = 409;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    await discardBody(res);
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "delete",
        storeName: this.name
      });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "delete",
          storeName: this.name
        });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      await discardBody(res);
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      await discardBody(res);
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                await discardBody(res);
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                await discardBody(res);
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getDeployStoreRegion = (clientOptions, context) => {
  if (clientOptions.region) {
    return clientOptions.region;
  }
  if (clientOptions.edgeURL || clientOptions.uncachedEdgeURL) {
    if (!context.primaryRegion) {
      throw new Error(
        "When accessing a deploy store, the Netlify Blobs client needs to be configured with a region, and one was not found in the environment. To manually set the region, set the `region` property in the store options. If you are using the Netlify CLI, you may have an outdated version; run `npm install -g netlify-cli@latest` to update and try again."
      );
    }
    return context.primaryRegion;
  }
  return REGION_AUTO;
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const context = getEnvironmentContext();
    const clientOptions = getClientOptions(input, context);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    clientOptions.region = getDeployStoreRegion(clientOptions, context);
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// packages/core/src/util.ts
var f = (v) => Math.round(v);
var stripDecimals = (t) => t.replace(/(\d+)\.\d+/g, "$1");

// packages/core/src/messages.ts
var MSG_PL = {
  minOf: (label, lo) => `${label}: najmniej ${lo}`,
  maxOf: (label, hi) => `${label}: najwi\u0119cej ${hi}`,
  shiftLabel: (i) => `przesuni\u0119cie R${i}`,
  niche: "wn\u0119ka",
  recessW: "wpust: szeroko\u015B\u0107",
  recessL: "wpust: d\u0142ugo\u015B\u0107",
  builtInW: "zabudowa: szeroko\u015B\u0107 (musi si\u0119ga\u0107 za o\u015B kalenicy)",
  builtInD: "zabudowa: g\u0142\u0119boko\u015B\u0107",
  windowGap: "okno: odst\u0119p",
  bedroomW: "szeroko\u015B\u0107 sypialni (musi si\u0119ga\u0107 za o\u015B kalenicy)",
  capH: "wysoko\u015B\u0107 p\u0142askiego sufitu",
  bathW: "szeroko\u015B\u0107 \u0142azienki",
  bandBelowRoom: "opaska (ni\u017Csza od pomieszczenia)",
  boardLeft: "Lewa strona: po\u0142a\u0107 + \u015Bciana",
  boardRightRecess: "Prawa strona, przy wpu\u015Bcie",
  boardRightWall: (x) => `Prawa strona, \u015Bciana x=${x}`,
  boardRightBuiltIn: "Prawa strona, przy zabudowie",
  boardBuiltInWall: (x) => `\u015Aciana wyci\u0119cia zabudowy x=${x}`,
  boardRightSlope: "Prawa strona: po\u0142a\u0107 + \u015Bciana",
  partition: (x) => `\u015Acianka dzia\u0142owa x=${x}`,
  gableTitle: (t) => `\u015Aciana szczytowa ${t}`,
  wallZ0: (win, always) => "\u015Bciana z=0" + (win || always ? " (okno)" : ""),
  wallRecess: (z) => `\u015Bciana z=${z} (wpust)`,
  wallBuiltIn: (z) => `\u015Bciana z=${z} (zabudowa)`,
  wallEnd: (z, cut) => `\u015Bciana z=${z}` + (cut !== null ? ` (od ${cut} cm)` : ""),
  refWhereTop: (z) => `g\xF3rna kraw\u0119d\u017A \u015Bciany, linia \u0142\u0105czenia z=${z}`,
  refWhereRidge: (z) => `g\xF3ra deski przy kalenicy, linia \u0142\u0105czenia z=${z}`,
  refWherePartition: (z) => `g\xF3ra deski przy \u015Bciance dzia\u0142owej, linia \u0142\u0105czenia z=${z}`,
  refWhereStrip: (x) => `d\xF3\u0142 paska na linii \u0142\u0105czenia x=${x}`,
  // flat ceiling
  ceilingBoards: "Sufit + zawini\u0119cie na dwie \u015Bciany",
  ceilingRef: "Sufit: siatka desek",
  ceilingWhere: (dz, zr) => `g\xF3rna kraw\u0119d\u017A deski przy \u015Bcianie, linia \u0142\u0105czenia ${dz ? "x" : "z"}=${zr}`,
  ceilingCoord: (dz, zr) => `${dz ? "x" : "z"}=${zr} od \u015Bciany ${dz ? "x=0" : "z=0"}`,
  bandWall: (n) => `Opaska: ${n}`,
  bandBoards: (n) => `${n} (deski pionowo)`,
  bandWhere: (dz, zr) => `g\xF3ra paska, linia \u0142\u0105czenia ${dz ? "z" : "x"}=${zr}`,
  bandCoord: (dz, zr) => `${dz ? "z" : "x"}=${zr} od naro\u017Cnika`,
  coordRidge: (h, z) => `x=0, wys.=${h}, z=${z}`,
  coordTop: (x, h, z) => `x=${x}, wys.=${h}, z=${z}`,
  coordStrip: (x, h, z) => `x=${x}, wys.=${h}, \u015Bciana z=${z}`,
  wallAt: (z) => `\u015Bciana z=${z}`,
  // user-language names of surfaces; the coordinates are the secondary `detail`
  lblRoof: "Dach",
  lblLeft: "Po\u0142a\u0107 lewa",
  lblRecess: "Po\u0142a\u0107 prawa przy wn\u0119ce",
  lblRightWall: "Po\u0142a\u0107 prawa",
  lblRightSlope: "Po\u0142a\u0107 prawa",
  lblBuiltIn: "Po\u0142a\u0107 prawa przy wyci\u0119ciu naro\u017Cnym",
  lblBuiltInWall: "\u015Aciana wyci\u0119cia naro\u017Cnego",
  lblPartition: "\u015Acianka dzia\u0142owa",
  lblWallStart: "Szczyt przedni",
  lblWallWin: "Szczyt przedni",
  lblWallRecess: "Szczyt przy wn\u0119ce",
  lblWallBuiltIn: "Szczyt przy wyci\u0119ciu naro\u017Cnym",
  lblWallEnd: "Szczyt tylny",
  detailCutFrom: (cm2) => `wyci\u0119cie od ${cm2} cm`,
  lblCeiling: "Sufit i zawini\u0119cie na dwie \u015Bciany",
  lblBandStart: "Opaska przy \u015Bcianie pocz\u0105tkowej",
  lblBandEnd: "Opaska przy \u015Bcianie przeciwleg\u0142ej"
};
var MSG_EN = {
  minOf: (label, lo) => `${label}: at least ${lo}`,
  maxOf: (label, hi) => `${label}: at most ${hi}`,
  shiftLabel: (i) => `shift of R${i}`,
  niche: "niche",
  recessW: "recess: width",
  recessL: "recess: length",
  builtInW: "built-in: width (must reach past the ridge axis)",
  builtInD: "built-in: depth",
  windowGap: "window: gap",
  bedroomW: "bedroom width (must reach past the ridge axis)",
  capH: "flat ceiling height",
  bathW: "bathroom width",
  bandBelowRoom: "band (lower than the room)",
  boardLeft: "Left side: roof + wall",
  boardRightRecess: "Right side, at the recess",
  boardRightWall: (x) => `Right side, wall x=${x}`,
  boardRightBuiltIn: "Right side, at the built-in",
  boardBuiltInWall: (x) => `Built-in cut-out wall x=${x}`,
  boardRightSlope: "Right side: roof + wall",
  partition: (x) => `Partition wall x=${x}`,
  gableTitle: (t) => `Gable wall ${t}`,
  wallZ0: (win, always) => "wall z=0" + (win || always ? " (window)" : ""),
  wallRecess: (z) => `wall z=${z} (recess)`,
  wallBuiltIn: (z) => `wall z=${z} (built-in)`,
  wallEnd: (z, cut) => `wall z=${z}` + (cut !== null ? ` (from ${cut} cm)` : ""),
  refWhereTop: (z) => `top edge of the wall, joint line z=${z}`,
  refWhereRidge: (z) => `top of the board at the ridge, joint line z=${z}`,
  refWherePartition: (z) => `top of the board at the partition, joint line z=${z}`,
  refWhereStrip: (x) => `bottom of the strip on the joint line x=${x}`,
  ceilingBoards: "Ceiling + wrap onto two walls",
  ceilingRef: "Ceiling: board grid",
  ceilingWhere: (dz, zr) => `top edge of the board at the wall, joint line ${dz ? "x" : "z"}=${zr}`,
  ceilingCoord: (dz, zr) => `${dz ? "x" : "z"}=${zr} from wall ${dz ? "x=0" : "z=0"}`,
  bandWall: (n) => `Band: ${n}`,
  bandBoards: (n) => `${n} (vertical boards)`,
  bandWhere: (dz, zr) => `top of the strip, joint line ${dz ? "z" : "x"}=${zr}`,
  bandCoord: (dz, zr) => `${dz ? "z" : "x"}=${zr} from the corner`,
  coordRidge: (h, z) => `x=0, h=${h}, z=${z}`,
  coordTop: (x, h, z) => `x=${x}, h=${h}, z=${z}`,
  coordStrip: (x, h, z) => `x=${x}, h=${h}, wall z=${z}`,
  wallAt: (z) => `wall z=${z}`,
  lblRoof: "Roof",
  lblLeft: "Left slope",
  lblRecess: "Right slope at the recess",
  lblRightWall: "Right slope",
  lblRightSlope: "Right slope",
  lblBuiltIn: "Right slope at the corner cut-out",
  lblBuiltInWall: "Corner cut-out wall",
  lblPartition: "Partition wall",
  lblWallStart: "Front gable",
  lblWallWin: "Front gable",
  lblWallRecess: "Gable at the recess",
  lblWallBuiltIn: "Gable at the corner cut-out",
  lblWallEnd: "Rear gable",
  detailCutFrom: (cm2) => `cut-out from ${cm2} cm`,
  lblCeiling: "Ceiling and wrap onto two walls",
  lblBandStart: "Band at the start wall",
  lblBandEnd: "Band at the opposite wall"
};
var MSG = { pl: MSG_PL, en: MSG_EN };

// packages/core/src/plate.ts
var DEFAULT_PLATE = { L: 500, W: 125, tongue: 1, profile: "all" };
function deriveTg(e, mode) {
  if (!e || mode === "none") return void 0;
  const tg = {};
  if (e.w0 === "joint") tg.w0 = "T";
  if (e.w1 === "joint") tg.w1 = "G";
  if (mode === "all") {
    if (e.l0 === "joint") tg.l0 = "G";
    if (e.l1 === "joint") tg.l1 = "T";
  }
  return tg.l0 || tg.l1 || tg.w0 || tg.w1 ? tg : void 0;
}

// packages/core/src/nest.ts
var tan1 = Math.tan(Math.PI / 180);
function splitPositions(L, max, minPart = 10) {
  if (L <= max + 1e-6 || max <= 0) return [];
  const n = Math.ceil(L / max - 1e-9);
  const at = [];
  for (let i = 1; i < n; i++) at.push(i * max);
  if (L - at[at.length - 1] < minPart && max > 2 * minPart) at[at.length - 1] = L - minPart;
  return at;
}

// packages/core/src/openings.ts
var import_polygon_clipping = __toESM(require_polygon_clipping_cjs(), 1);

// packages/core/src/attic.ts
var cm = "cm";
var fd = (group, key, label, unit = cm) => ({ group, key, label, unit });
var zeros = { o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 };
var baseShift = ["lewa po\u0142a\u0107", "prawa przy wn\u0119ce", "prawa po\u0142a\u0107", "prawa przy wyci\u0119ciu naro\u017Cnym", "\u015Bciana wyci\u0119cia naro\u017Cnego", "szczyt z=0", "szczyt przy wn\u0119ce", "szczyt przy wyci\u0119ciu naro\u017Cnym", "szczyt z ko\u0144ca"];
var SALON = {
  id: "salon",
  roomKey: "S",
  name: "Salon",
  defaults: { W: 548, L: 980, ang: 40, HL: 107, niche: 17, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 1, cutH: 56, winOn: 1, winD: 50, PL: 499, PW: 125, ZO: 415, XO: 0, ...zeros },
  fields: [
    fd("Bry\u0142a", "W", "Szeroko\u015B\u0107 wn\u0119trza"),
    fd("Bry\u0142a", "L", "D\u0142ugo\u015B\u0107 salonu"),
    fd("Bry\u0142a", "ang", "K\u0105t dachu", "\xB0"),
    fd("Bry\u0142a", "HL", "Wysoko\u015B\u0107 pasa pod skosem (lewa)"),
    fd("Bry\u0142a", "niche", "Odsuni\u0119cie \u015Bciany (prawa)"),
    fd("Wyci\u0119cia", "dA", "Wn\u0119ka: szeroko\u015B\u0107"),
    fd("Wyci\u0119cia", "ZA", "Wn\u0119ka: d\u0142ugo\u015B\u0107"),
    fd("Wyci\u0119cia", "wB", "Wyci\u0119cie naro\u017Cne: szeroko\u015B\u0107"),
    fd("Wyci\u0119cia", "dB", "Wyci\u0119cie naro\u017Cne: g\u0142\u0119boko\u015B\u0107"),
    fd("Wyci\u0119cia", "cutOn", "Wyci\u0119cie w \u015Bcianie z ko\u0144ca", "chk"),
    fd("Wyci\u0119cia", "cutH", "Wysoko\u015B\u0107 tego wyci\u0119cia"),
    fd("Okno", "winOn", "Okno w \u015Bcianie z=0", "chk"),
    fd("Okno", "winD", "Odst\u0119p okna od dachu, \u015Bciany i pod\u0142ogi"),
    fd("P\u0142yty", "PL", "D\u0142ugo\u015B\u0107 p\u0142yty"),
    fd("P\u0142yty", "PW", "Szeroko\u015B\u0107 p\u0142yty"),
    fd("Start monta\u017Cu", "ZO", "Start domy\u015Blny na dachu (z)"),
    fd("Start monta\u017Cu", "XO", "Start domy\u015Blny na szczytach (x)")
  ],
  limits: { W: [200, 1200], L: [200, 3e3], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1e3], PW: [20, 300], ZO: [0, 3e3], XO: [-1e3, 1e3] },
  shiftNames: baseShift,
  endWord: "salonu"
};
var SYPIALNIA = {
  id: "sypialnia",
  roomKey: "Sy",
  name: "Sypialnia",
  defaults: { W: 548, Wb: 396, L: 330, ang: 40, HL: 107, niche: 0, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 0, cutH: 56, capOn: 1, capH: 300, winOn: 0, winD: 50, PL: 499, PW: 125, ZO: 0, XO: 0, cA: 0, cB: 0, ...zeros },
  fields: [
    fd("Bry\u0142a", "W", "Szeroko\u015B\u0107 dachu (domu)"),
    fd("Bry\u0142a", "Wb", "Szeroko\u015B\u0107 sypialni od lewej \u015Bciany"),
    fd("Bry\u0142a", "L", "D\u0142ugo\u015B\u0107 sypialni (wzd\u0142u\u017C kalenicy)"),
    fd("Bry\u0142a", "ang", "K\u0105t dachu", "\xB0"),
    fd("Bry\u0142a", "HL", "Wysoko\u015B\u0107 pasa pod skosem (lewa)"),
    fd("Bry\u0142a", "capOn", "P\u0142aski sufit u g\xF3ry", "chk"),
    fd("Bry\u0142a", "capH", "Wysoko\u015B\u0107 p\u0142askiego sufitu"),
    fd("P\u0142yty", "PL", "D\u0142ugo\u015B\u0107 p\u0142yty"),
    fd("P\u0142yty", "PW", "Szeroko\u015B\u0107 p\u0142yty"),
    fd("Start monta\u017Cu", "ZO", "Start domy\u015Blny na dachu (z)"),
    fd("Start monta\u017Cu", "XO", "Start domy\u015Blny na szczytach (x)")
  ],
  limits: { W: [200, 1200], Wb: [100, 1200], L: [200, 3e3], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1e3], PW: [20, 300], ZO: [0, 3e3], XO: [-1e3, 1e3] },
  shiftNames: baseShift,
  endWord: "salonu"
};
var LAZIENKA1 = {
  id: "lazienka-1",
  roomKey: "\u01411",
  name: "\u0141azienka 1",
  defaults: { W: 548, Wb: 396, bw: 200, L: 274, ang: 40, HL: 107, niche: 0, dA: 140, ZA: 415, wB: 349, dB: 60, cutOn: 0, cutH: 56, capOn: 0, capH: 300, winOn: 0, winD: 50, PL: 499, PW: 125, ZO: 0, XO: 0, cA: 0, cB: 0, ...zeros },
  fields: [
    fd("Bry\u0142a", "W", "Szeroko\u015B\u0107 dachu (domu)"),
    fd("Bry\u0142a", "bw", "Szeroko\u015B\u0107 \u0142azienki od prawej \u015Bciany"),
    fd("Bry\u0142a", "L", "D\u0142ugo\u015B\u0107 \u0142azienki (wzd\u0142u\u017C kalenicy)"),
    fd("Bry\u0142a", "ang", "K\u0105t dachu", "\xB0"),
    fd("Bry\u0142a", "HL", "Wysoko\u015B\u0107 pasa pod skosem (lewa)"),
    fd("P\u0142yty", "PL", "D\u0142ugo\u015B\u0107 p\u0142yty"),
    fd("P\u0142yty", "PW", "Szeroko\u015B\u0107 p\u0142yty"),
    fd("Start monta\u017Cu", "ZO", "Start domy\u015Blny na dachu (z)"),
    fd("Start monta\u017Cu", "XO", "Start domy\u015Blny na szczytach (cm od \u015Bcianki)")
  ],
  limits: { W: [200, 1200], Wb: [100, 1200], L: [200, 3e3], ang: [10, 70], HL: [0, 300], niche: [0, 100], dA: [10, 400], ZA: [10, 2900], wB: [1, 1200], dB: [10, 400], cutH: [0, 250], winD: [10, 200], PL: [100, 1e3], PW: [20, 300], ZO: [0, 3e3], XO: [-1e3, 1e3] },
  shiftNames: baseShift.map((s, i) => i === 4 ? "\u015Bcianka dzia\u0142owa" : s),
  endWord: "\u0142azienki"
};
var ATTIC_PRESETS = { salon: SALON, sypialnia: SYPIALNIA, "lazienka-1": LAZIENKA1 };
function trimOf(pin) {
  const v = Number(pin ? pin.trim : 0);
  return isFinite(v) && v > 0 ? Math.min(v, 10) : 0;
}
function profileOf(pin) {
  const v = Number(pin ? pin.pf : 0);
  return v >= 2 ? 2 : v >= 1 ? 1 : 0;
}
var PF_MODE = ["none", "long", "all"];
function trimLOf(pin, fallback) {
  if (!pin || pin.trimL === void 0) return fallback;
  const v = Number(pin.trimL);
  return isFinite(v) && v > 0 ? Math.min(v, 10) : 0;
}
function normAttic(preset, pin, lang = "pl") {
  const msg = MSG[lang];
  const DEF = preset.defaults;
  const p = {};
  let w = [];
  for (const k of Object.keys(DEF)) {
    const raw = pin ? pin[k] : void 0;
    const v = Number(raw);
    p[k] = isFinite(v) && pin && raw !== "" && raw !== null && raw !== void 0 ? v : DEF[k];
  }
  const cl = (key, lo, hi, label) => {
    if (p[key] < lo) {
      p[key] = lo;
      w.push(msg.minOf(label, lo));
    } else if (p[key] > hi) {
      p[key] = hi;
      w.push(msg.maxOf(label, hi));
    }
  };
  const skip = preset.id === "salon" ? ["dA", "wB", "ZA", "dB", "winD", "niche"] : ["Wb", "dA", "wB", "ZA", "dB", "winD", "niche"];
  for (const k of Object.keys(preset.limits)) {
    if (skip.includes(k)) continue;
    cl(k, preset.limits[k][0], preset.limits[k][1], k);
  }
  for (let oi = 1; oi <= 9; oi++) cl("o" + oi, -1e3, 1e3, msg.shiftLabel(oi));
  p.trim = trimOf(pin);
  if (profileOf(pin)) p.pf = profileOf(pin);
  if (pin && pin.trimL !== void 0) p.trimL = trimLOf(pin, p.trim);
  const hw = p.W / 2;
  const flag = (k) => pin && pin[k] !== void 0 ? pin[k] ? 1 : 0 : DEF[k];
  if (preset.id === "salon") {
    const has = (k) => pin && pin[k] !== void 0 ? pin[k] ? 1 : 0 : 1;
    const cA = has("cA"), cB = has("cB");
    cl("niche", 0, Math.min(100, hw - 30), msg.niche);
    const XR2 = hw - p.niche;
    if (cA) {
      cl("dA", 10, XR2 - 10, msg.recessW);
      cl("ZA", 10, p.L - 30, msg.recessL);
    }
    if (cB) {
      cl("wB", hw + 1, p.W - p.niche - 1, msg.builtInW);
      cl("dB", 10, Math.max(10, p.L - (cA ? p.ZA : 0) - 10), msg.builtInD);
    }
    cl("winD", 10, hw - 10, msg.windowGap);
    const c = pin ? pin.cutOn : void 0;
    p.cutOn = c === 0 || c === false ? 0 : c !== void 0 ? c ? 1 : 0 : DEF.cutOn;
    p.winOn = flag("winOn");
    p.cA = cA;
    p.cB = cB;
    return { p, w };
  }
  if (preset.id === "sypialnia") {
    cl("Wb", hw + 20, p.W - 1, msg.bedroomW);
    p.niche = p.W - p.Wb;
    p.capOn = flag("capOn");
    if (p.capOn) {
      const lo = p.HL + 10;
      cl("capH", Math.ceil(lo), Math.max(Math.ceil(lo), 3e3), msg.capH);
      p.capMin = Math.ceil(lo);
    }
  } else {
    cl("bw", 50, hw - 10, msg.bathW);
    p.niche = 0;
    p.capOn = 0;
  }
  const XR = hw - p.niche;
  p.cA = flag("cA");
  p.cB = flag("cB");
  if (p.cA) {
    cl("dA", 10, XR - 10, msg.recessW);
    cl("ZA", 10, p.L - 30, msg.recessL);
  }
  if (p.cB) {
    cl("wB", hw + 1, p.W - p.niche - 1, msg.builtInW);
    cl("dB", 10, Math.max(10, p.L - (p.cA ? p.ZA : 0) - 10), msg.builtInD);
  }
  cl("winD", 10, hw - 10, msg.windowGap);
  p.winOn = 0;
  p.cutOn = 0;
  p.cA = 0;
  p.cB = 0;
  if (w.length) w = w.map(stripDecimals);
  return { p, w };
}
function atticModel(preset, pin, lang = "pl") {
  const msg = MSG[lang];
  const n = normAttic(preset, pin, lang);
  const p = n.p;
  const isL1 = preset.id === "lazienka-1", isSalon = preset.id === "salon";
  const A = Math.tan(p.ang * Math.PI / 180), C = Math.cos(p.ang * Math.PI / 180);
  const hw = p.W / 2, XR = hw - p.niche;
  const XA = p.cA ? XR - p.dA : XR, XB = p.cB ? -hw + p.wB : -hw, ZB = p.cB ? p.L - p.dB : p.L, ZA = p.cA ? p.ZA : 0;
  const L = p.L, RID = p.HL + hw * A, BW = p.PW - 2 * p.trim, ZO = p.ZO, XO = p.XO;
  const XT = isL1 ? XR - p.bw : void 0;
  const capEff = !isL1 && !!(p.capOn && p.capH < RID - 1);
  const CAPH = isL1 ? RID - XT * A : capEff ? p.capH : RID;
  const xc = capEff ? (RID - CAPH) / A : 0;
  const y = (x) => capEff ? x < -xc ? RID + x * A : CAPH : RID - Math.abs(x) * A;
  const rl = (x) => x <= xc ? x : xc + (x - xc) / C;
  const bp = capEff ? [-xc] : [0];
  const rr = (x) => capEff ? x : x / C;
  const profile = (a, b) => {
    const o = [[a, y(a)]];
    bp.forEach((q) => {
      if (q > a + 1e-6 && q < b - 1e-6) o.push([q, y(q)]);
    });
    o.push([b, y(b)]);
    return o;
  };
  const HR = y(XR);
  const cols = (z0, z1, zo) => {
    const o = [];
    for (let k = Math.floor((z0 - zo) / BW + 1e-9); zo + k * BW < z1 - 1e-9; k++) {
      const s = Math.max(z0, zo + k * BW), e = Math.min(z1, zo + (k + 1) * BW);
      if (e - s > 1) o.push([s, e]);
    }
    return o;
  };
  const strips = (a, b, xo) => {
    const o = [];
    let x = a;
    while (x < b - 1e-6) {
      let xe = xo + (Math.floor((x - xo) / BW + 1e-9) + 1) * BW;
      if (xe <= x + 1e-6) xe += BW;
      xe = Math.min(b, xe);
      if (xe - x > 0.5) o.push([x, xe]);
      x = xe;
    }
    return o;
  };
  let id = 0;
  const surfs = [];
  const refs = [];
  let area = 0, fields = 0;
  const a2 = ZO + p.o3, zj = a2 + Math.floor((ZB - a2) / BW) * BW, ZJ = p.cB && zj > ZA + 1 && ZB - zj < 10 ? zj : ZB;
  const nearest2 = (cand, anchor) => cand.reduce((b, c) => Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b, cand[0]);
  function addBoard(title, u, z0, z1, cut, notch2, desc, lastTop, anchor, rid) {
    const cs = cols(z0, z1, anchor).map((c) => ({ id: ++id, a: c[0], b: c[1] }));
    if (!cs.length) return;
    const cand = [z0, z1];
    cs.forEach((c) => cand.push(c.a, c.b));
    const zr = nearest2(cand, anchor);
    const s = {
      flat: capEff && rid < 5 ? rid === 1 ? xc : cut ?? 0 : 0,
      key: rid,
      anchor,
      kind: "board",
      title,
      u,
      z0,
      z1,
      cut,
      notch: notch2,
      cols: cs,
      zr,
      ur: 0,
      ref: "",
      desc,
      top: lastTop
    };
    s.ref = "R" + (isSalon ? refs.length + 1 : rid);
    s.ur = notch2 && zr > notch2[0] ? notch2[1] : 0;
    surfs.push(s);
    area += (z1 - z0) * u - (notch2 ? (z1 - notch2[0]) * notch2[1] : 0);
    fields += cs.length;
    const first = cs[0], last = cs[cs.length - 1];
    refs.push({
      id: s.ref,
      name: title,
      fields: first.id === last.id ? String(first.id) : first.id + "\u2013" + last.id,
      where: lastTop ? msg.refWhereTop(f(zr)) : isL1 ? msg.refWherePartition(f(zr)) : msg.refWhereRidge(f(zr)),
      coord: lastTop ? msg.coordTop(f(lastTop.x), f(lastTop.h), f(zr)) : isL1 ? msg.coordTop(f(XT), f(CAPH), f(zr)) : msg.coordRidge(f(CAPH), f(zr))
    });
  }
  if (isL1) {
    addBoard(msg.boardRightSlope, rr(XR - XT) + HR, 0, L, rr(XR - XT), null, void 0, void 0, ZO + p.o3, 3);
    addBoard(msg.partition(f(XT)), CAPH, 0, L, null, null, "", { x: XT, h: CAPH }, ZO + p.o5, 5);
  } else {
    addBoard(msg.boardLeft, rl(hw) + p.HL, 0, ZB, rl(hw), null, void 0, void 0, ZO + p.o1, 1);
    addBoard(msg.boardRightRecess, rr(XA) + y(XA), 0, ZA, rr(XA), null, void 0, void 0, ZO + p.o2, 2);
    addBoard(msg.boardRightWall(f(XR)), rr(XR) + HR, ZA, ZJ, rr(XR), null, void 0, void 0, ZO + p.o3, 3);
    addBoard(msg.boardRightBuiltIn, rr(XR) + HR, ZJ, L, rr(XR), [ZB, rl(XB)], void 0, void 0, ZO + p.o4, 4);
    addBoard(msg.boardBuiltInWall(f(XB)), y(XB), ZB, L, null, null, "", { x: XB, h: y(XB) }, ZO + p.o5, 5);
  }
  const cutOn = !!(p.cutOn && p.cB);
  const x0a = isL1 ? XT : -hw;
  let walls = [
    { on: 1, z: 0, x0: x0a, x1: XA, bs: 0, title: msg.wallZ0(!!p.winOn, isSalon) },
    { on: p.cA, z: ZA, x0: XA, x1: XR, bs: 0, title: msg.wallRecess(f(ZA)) },
    { on: p.cB, z: ZB, x0: -hw, x1: XB, bs: 0, title: msg.wallBuiltIn(f(ZB)) },
    { on: 1, z: L, x0: isL1 ? XT : p.cB ? XB : -hw, x1: XR, bs: cutOn ? p.cutH : 0, title: msg.wallEnd(f(L), cutOn ? f(p.cutH) : null) }
  ].map((w) => ({ ...w, anchor: 0, rid: 0, strips: [], xr: 0, ref: "" }));
  const stripArea = (a, b, bs) => {
    const pr = profile(a, b);
    let t = 0;
    for (let i = 0; i < pr.length - 1; i++) t += (pr[i][1] - bs + (pr[i + 1][1] - bs)) / 2 * (pr[i + 1][0] - pr[i][0]);
    return t;
  };
  walls.forEach((w, wi) => {
    if (!w.on) return;
    const an = (isL1 ? XT : 0) + XO + p["o" + (6 + wi)];
    w.anchor = an;
    w.rid = 6 + wi;
    w.strips = strips(w.x0, w.x1, an).map((s) => ({ id: ++id, a: s[0], b: s[1] }));
    const cand = [w.x0, w.x1];
    w.strips.forEach((s) => cand.push(s.a, s.b));
    w.xr = nearest2(cand, an);
    w.ref = "R" + (isSalon ? refs.length + 1 : 6 + wi);
    w.strips.forEach((s) => {
      area += stripArea(s.a, s.b, w.bs);
    });
    fields += w.strips.length;
    const firstS = w.strips[0], lastS = w.strips[w.strips.length - 1];
    refs.push({
      id: w.ref,
      name: msg.gableTitle(w.title),
      fields: firstS && lastS ? firstS.id + "\u2013" + lastS.id : "",
      where: msg.refWhereStrip(f(w.xr)),
      coord: msg.coordStrip(f(w.xr), f(w.bs), f(w.z))
    });
  });
  walls = walls.filter((w) => w.on && w.strips.length);
  const winOnWall = !!p.winOn || isSalon;
  surfs.forEach((q) => {
    const k = q.key;
    q.label = k === 1 ? msg.lblLeft : k === 2 ? msg.lblRecess : k === 3 ? isL1 ? msg.lblRightSlope : msg.lblRightWall : k === 4 ? msg.lblBuiltIn : isL1 ? msg.lblPartition : msg.lblBuiltInWall;
    q.detail = k === 3 && !isL1 ? `x=${f(XR)}` : k === 5 ? `x=${f(isL1 ? XT : XB)}` : "";
  });
  walls.forEach((w) => {
    const wi = w.rid - 6;
    w.label = wi === 0 ? winOnWall ? msg.lblWallWin : msg.lblWallStart : wi === 1 ? msg.lblWallRecess : wi === 2 ? msg.lblWallBuiltIn : msg.lblWallEnd;
    w.detail = `z=${f(w.z)}` + (wi === 3 && cutOn ? ", " + msg.detailCutFrom(f(p.cutH)) : "");
  });
  const present = {};
  surfs.forEach((q) => {
    present[q.key] = 1;
  });
  walls.forEach((w) => {
    present[w.rid] = 1;
  });
  if (!isSalon) refs.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  let win = null;
  if (p.winOn) {
    const wx = -hw + p.winD;
    if (wx < -1) {
      win = [[wx, p.winD], [0, p.winD], [0, CAPH - (capEff ? p.winD : p.winD / C)], [wx, y(wx) - p.winD / C]];
      let s2 = 0;
      for (let i = 0; i < 4; i++) {
        const a = win[i], b = win[(i + 1) % 4];
        s2 += a[0] * b[1] - b[0] * a[1];
      }
      area -= Math.abs(s2) / 2;
    }
  }
  const plate = p.PL * p.PW;
  return {
    preset: preset.id,
    XT,
    p,
    warn: n.w,
    A,
    C,
    hw,
    XR,
    XA,
    XB,
    ZB,
    ZA,
    L,
    RID,
    TOPH: CAPH,
    cap: capEff,
    xc,
    bp,
    profile,
    HR,
    HL: p.HL,
    y,
    surfs,
    walls,
    present,
    refs,
    win,
    areaCm2: area,
    areaM2: area / 1e4,
    fields,
    plate,
    ZO,
    XO,
    minPlates: Math.ceil(area / plate),
    plates80: Math.ceil(area / plate / 0.8)
  };
}

// packages/core/src/flat.ts
var fd2 = (group, key, label, unit = "cm") => ({ group, key, label, unit });
var LAZIENKA2 = {
  id: "lazienka-2",
  roomKey: "\u01412",
  name: "\u0141azienka 2",
  defaults: { bx: 149, bz: 278, H: 250, hb: 66, dz: 0, PL: 499, PW: 125, ZO: 0, o1: 0, o2: 0, o3: 0, o4: 0, o5: 0, o6: 0, o7: 0, o8: 0, o9: 0 },
  fields: [
    fd2("Pomieszczenie", "bx", "Szeroko\u015B\u0107 (x)"),
    fd2("Pomieszczenie", "bz", "D\u0142ugo\u015B\u0107 (z)"),
    fd2("Pomieszczenie", "hb", "Wysoko\u015B\u0107 opaski na \u015Bcianach"),
    fd2("Pomieszczenie", "H", "Wysoko\u015B\u0107 pomieszczenia (tylko model 3D)"),
    fd2("Uk\u0142ad desek", "dz", "Deski biegn\u0105 wzd\u0142u\u017C d\u0142ugo\u015Bci (z)", "chk"),
    fd2("P\u0142yty", "PL", "D\u0142ugo\u015B\u0107 p\u0142yty"),
    fd2("P\u0142yty", "PW", "Szeroko\u015B\u0107 p\u0142yty"),
    fd2("Start monta\u017Cu", "ZO", "Start siatki desek (cm od \u015Bciany)")
  ],
  limits: { bx: [50, 1200], bz: [50, 1200], H: [100, 500], hb: [10, 200], PL: [100, 1e3], PW: [20, 300], ZO: [0, 3e3] },
  shiftNames: ["sufit: siatka desek", "opaska: pierwsza \u015Bciana", "opaska: druga \u015Bciana", "", "", "", "", "", ""]
};
function normFlat(pin, lang = "pl") {
  const msg = MSG[lang];
  const DEF = LAZIENKA2.defaults;
  const p = {};
  let w = [];
  for (const k of Object.keys(DEF)) {
    const raw = pin ? pin[k] : void 0;
    const v = Number(raw);
    p[k] = isFinite(v) && pin && raw !== "" && raw !== null && raw !== void 0 ? v : DEF[k];
  }
  const cl = (key, lo, hi, label) => {
    if (p[key] < lo) {
      p[key] = lo;
      w.push(msg.minOf(label, lo));
    } else if (p[key] > hi) {
      p[key] = hi;
      w.push(msg.maxOf(label, hi));
    }
  };
  for (const k of Object.keys(LAZIENKA2.limits)) cl(k, LAZIENKA2.limits[k][0], LAZIENKA2.limits[k][1], k);
  for (let oi = 1; oi <= 9; oi++) cl("o" + oi, -1e3, 1e3, msg.shiftLabel(oi));
  cl("hb", 10, Math.max(10, p.H - 10), msg.bandBelowRoom);
  p.trim = trimOf(pin);
  if (profileOf(pin)) p.pf = profileOf(pin);
  if (pin && pin.trimL !== void 0) p.trimL = trimLOf(pin, p.trim);
  p.dz = p.dz ? 1 : 0;
  if (w.length) w = w.map(stripDecimals);
  return { p, w };
}
function gridCols(len, anchor, BW, idRef) {
  const cs = [];
  for (let k = Math.floor((0 - anchor) / BW + 1e-9); anchor + k * BW < len - 1e-9; k++) {
    const a = Math.max(0, anchor + k * BW), b = Math.min(len, anchor + (k + 1) * BW);
    if (b - a > 1) cs.push({ id: ++idRef.n, a, b });
  }
  return cs;
}
var nearest = (cand, anchor) => cand.reduce((b, c) => Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b, cand[0]);
function flatModel(pin, lang = "pl") {
  const msg = MSG[lang];
  const n = normFlat(pin, lang), p = n.p;
  const BW = p.PW - 2 * p.trim, hb = p.hb, dz = p.dz;
  const Lc = dz ? p.bz : p.bx, Wc = dz ? p.bx : p.bz, U = hb + Lc + hb, anchor = p.ZO + p.o1;
  const idRef = { n: 0 };
  const surfs = [];
  const refs = [];
  let area = 0, fields = 0;
  const cs = gridCols(Wc, anchor, BW, idRef);
  const cand = [0, Wc];
  cs.forEach((c) => cand.push(c.a, c.b));
  const zr = nearest(cand, anchor);
  surfs.push({ key: 1, kind: "board", title: msg.ceilingBoards, u: U, z0: 0, z1: Wc, cuts: [hb, hb + Lc], cols: cs, anchor, zr, ur: 0, ref: "R1", lab: "wys." });
  area += Wc * U;
  fields += cs.length;
  refs.push({
    id: "R1",
    name: msg.ceilingRef,
    fields: cs[0].id + "\u2013" + cs[cs.length - 1].id,
    where: msg.ceilingWhere(!!dz, f(zr)),
    coord: msg.ceilingCoord(!!dz, f(zr))
  });
  const names = [msg.wallAt(0), msg.wallAt(f(dz ? Lc : Wc))];
  for (let q = 0; q < 2; q++) {
    const anc = p.ZO + p["o" + (2 + q)];
    const c2 = gridCols(Lc, anc, BW, idRef);
    const cd2 = [0, Lc];
    c2.forEach((c) => cd2.push(c.a, c.b));
    const zr2 = nearest(cd2, anc);
    const ref = "R" + (2 + q);
    surfs.push({ key: 2 + q, kind: "board", title: msg.bandBoards(msg.bandWall(names[q])), u: hb, z0: 0, z1: Lc, cuts: [], cols: c2, anchor: anc, zr: zr2, ur: 0, ref, lab: "wys." });
    area += Lc * hb;
    fields += c2.length;
    refs.push({ id: ref, name: msg.bandWall(names[q]), fields: c2[0].id + "\u2013" + c2[c2.length - 1].id, where: msg.bandWhere(!!dz, f(zr2)), coord: msg.bandCoord(!!dz, f(zr2)) });
  }
  surfs[0].label = msg.lblCeiling;
  surfs[1].label = msg.lblBandStart;
  surfs[1].detail = `${dz ? "x" : "z"}=0`;
  surfs[2].label = msg.lblBandEnd;
  surfs[2].detail = `${dz ? "x" : "z"}=${f(dz ? Lc : Wc)}`;
  const plate = p.PL * p.PW;
  return {
    p,
    warn: n.w,
    Lc,
    Wc,
    U,
    hb,
    dz,
    surfs,
    refs,
    present: { 1: 1, 2: 1, 3: 1 },
    areaCm2: area,
    areaM2: area / 1e4,
    fields,
    plate,
    TOPH: p.H,
    minPlates: Math.ceil(area / plate),
    names: names.map((s) => msg.bandWall(s))
  };
}

// packages/core/src/rooms.ts
var ROOM_IDS = ["salon", "sypialnia", "lazienka-1", "lazienka-2"];
var isRoomType = (v) => typeof v === "string" && ROOM_IDS.includes(v);
var EXTRA_KEYS = { salon: ["cA", "cB"] };
var ROOF_KEYS = ["W", "ang", "HL"];
var ROOMS = {
  salon: { id: "salon", template: "attic-gable", key: "S", name: "Salon", defaults: ATTIC_PRESETS.salon.defaults, fields: ATTIC_PRESETS.salon.fields, shiftNames: ATTIC_PRESETS.salon.shiftNames },
  sypialnia: { id: "sypialnia", template: "attic-gable", key: "Sy", name: "Sypialnia", defaults: ATTIC_PRESETS.sypialnia.defaults, fields: ATTIC_PRESETS.sypialnia.fields, shiftNames: ATTIC_PRESETS.sypialnia.shiftNames },
  "lazienka-1": { id: "lazienka-1", template: "attic-gable", key: "\u01411", name: "\u0141azienka 1", defaults: ATTIC_PRESETS["lazienka-1"].defaults, fields: ATTIC_PRESETS["lazienka-1"].fields, shiftNames: ATTIC_PRESETS["lazienka-1"].shiftNames },
  "lazienka-2": { id: "lazienka-2", template: "flat-ceiling", key: "\u01412", name: "\u0141azienka 2", defaults: LAZIENKA2.defaults, fields: LAZIENKA2.fields, shiftNames: LAZIENKA2.shiftNames }
};
var isAttic = (m) => "walls" in m;
function buildModel(id, pin, lang = "pl") {
  return id === "lazienka-2" ? flatModel(pin, lang) : atticModel(ATTIC_PRESETS[id], pin, lang);
}
function defaultOpenings(id, params) {
  if (id !== "salon") return [];
  const m = buildModel(id, params);
  if (!isAttic(m) || !m.win) return [];
  const wall = m.walls.find((w) => w.z === 0);
  return wall ? [{ id: "window", kind: "window", surface: wall.rid, pts: m.win.map((q) => [q[0], q[1]]) }] : [];
}

// packages/core/src/face.ts
var import_polygon_clipping2 = __toESM(require_polygon_clipping_cjs(), 1);
var WOOD = { kind: "wood" };

// packages/core/src/sheet.ts
var SPLIT_IDS = ["eaveL", "cap", "ridge", "wallfold", "eaveR"];
var EPS = 1e-6;
var splitDefault = (id, splitAtBends) => id === "ridge" ? true : id === "cap" ? false : splitAtBends;
function splitChoice(sp, k, id, splitAtBends) {
  const e = sp?.strips?.[String(k)]?.s?.[id];
  if (typeof e === "boolean") return { on: e, explicit: true };
  const l = sp?.line?.[id];
  return { on: typeof l === "boolean" ? l : splitDefault(id, splitAtBends), explicit: false };
}
var ends = (c, u) => Math.abs(u - c.uL) < 0.5 || Math.abs(u - c.uR) < 0.5;
function geo(m) {
  const { xc, C, cap } = m;
  return { rl: (x) => x <= xc ? x : xc + (x - xc) / C, rr: (x) => cap ? x : x / C };
}
function makeBands(m) {
  const { rl, rr } = geo(m);
  const isL1 = m.XT !== void 0, p = m.p;
  const hasA = !isL1 && !!p.cA && m.ZA > 1;
  const hasB = !isL1 && !!p.cB && m.ZB < m.L - 1;
  const zs = [0];
  if (hasA) zs.push(m.ZA);
  if (hasB) zs.push(m.ZB);
  zs.push(m.L);
  const bands = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], mid = (z0 + z1) / 2;
    let uL, uR, origin;
    const folds = [];
    if (isL1) {
      const eave = rr(m.XR - m.XT);
      uL = -m.TOPH;
      uR = eave + m.HR;
      origin = 0;
      folds.push({ id: "wallfold", u: 0 }, { id: "eaveR", u: eave });
    } else if (hasB && mid > m.ZB) {
      const F = rl(m.XB), eave = rr(m.XR);
      uL = F - m.y(m.XB);
      uR = eave + m.HR;
      origin = F;
      folds.push({ id: "wallfold", u: F }, { id: "eaveR", u: eave });
    } else {
      const recess = hasA && mid < m.ZA;
      const eaveL = rl(m.hw), eaveR = recess ? rr(m.XA) : rr(m.XR);
      uL = -(eaveL + m.HL);
      uR = eaveR + (recess ? m.y(m.XA) : m.HR);
      origin = 0;
      folds.push({ id: "eaveL", u: -eaveL });
      if (m.cap && m.xc > EPS) folds.push({ id: "cap", u: -m.xc });
      folds.push({ id: "ridge", u: 0 }, { id: "eaveR", u: eaveR });
    }
    bands.push({ z0, z1, uL, uR, origin, folds: folds.filter((f2) => f2.id === "ridge" || f2.id === "wallfold" || f2.u - uL > 0.5 && uR - f2.u > 0.5) });
  }
  return bands;
}
function spansOf(uL, uR, cuts) {
  const b = [uL, ...cuts.filter((c) => c > uL + 0.5 && c < uR - 0.5).sort((x, y) => x - y), uR];
  const out = [];
  for (let i = 0; i < b.length - 1; i++) out.push([b[i], b[i + 1]]);
  return out;
}
function activeCuts(band, uL, uR, strip, on) {
  const fold = band.folds.filter((f2) => on(f2.id) && f2.u - uL > 0.5 && uR - f2.u > 0.5);
  const free = (strip?.c ?? []).filter((c) => c - uL > 0.5 && uR - c > 0.5 && !fold.some((f2) => Math.abs(f2.u - c) < 0.5));
  return { fold, free };
}
function roofSheet(m, cfg) {
  const p = m.p;
  const PL = p.PL - 2 * (p.trimL ?? p.trim), BW = p.PW - 2 * p.trim;
  const mode = PF_MODE[p.pf ?? 0];
  const anchor = m.ZO + (p.o1 ?? 0);
  const bands = makeBands(m);
  const sp = cfg.splits;
  const strips = [];
  let id = 0;
  for (let k = Math.floor((0 - anchor) / BW + 1e-9); anchor + k * BW < m.L - 1e-9; k++) {
    const a = Math.max(0, anchor + k * BW), b = Math.min(m.L, anchor + (k + 1) * BW);
    if (b - a <= 1) continue;
    const cells = [];
    bands.forEach((bd, bi) => {
      const z0 = Math.max(a, bd.z0), z1 = Math.min(b, bd.z1);
      if (z1 - z0 <= 0.5) return;
      cells.push({ band: bi, z0, z1, uL: bd.uL, uR: bd.uR, w0: z0 > bd.z0 + 0.5 ? "joint" : "wall", w1: z1 < bd.z1 - 0.5 ? "joint" : "wall" });
    });
    if (cells.length) strips.push({ k, id: ++id, a, b, cells });
  }
  const lines = [], cuts = [], notes = [], pieces = [];
  const presentSet = /* @__PURE__ */ new Set();
  strips.forEach((st) => {
    const choice = sp.strips?.[String(st.k)];
    const on = (sid) => splitChoice(sp, st.k, sid, cfg.splitAtBends).on;
    const letters = [];
    const recs = [];
    st.cells.forEach((c, ci) => {
      const band = bands[c.band];
      band.folds.forEach((f2) => {
        presentSet.add(f2.id);
        const ch = splitChoice(sp, st.k, f2.id, cfg.splitAtBends);
        lines.push({ strip: st.k, id: f2.id, cell: ci, u: f2.u, z0: c.z0, z1: c.z1, on: ch.on, explicit: ch.explicit });
      });
      const act = activeCuts(band, c.uL, c.uR, choice, on);
      const hard = [...act.fold.map((f2) => f2.u), ...act.free].sort((x, y) => x - y);
      let spans = spansOf(c.uL, c.uR, hard);
      const autoAt = [];
      const all = [];
      spans.forEach(([lo, hi]) => {
        const len = hi - lo;
        if (len <= PL + EPS) {
          all.push([lo, hi]);
          return;
        }
        const fromHi = band.origin >= hi - EPS || Math.abs(hi - band.origin) < Math.abs(lo - band.origin) - EPS;
        const at = splitPositions(len, PL).map((d) => fromHi ? hi - d : lo + d);
        at.forEach((u) => autoAt.push(u));
        const b = [lo, ...at.slice().sort((x, y) => x - y), hi];
        for (let i = 0; i < b.length - 1; i++) all.push([b[i], b[i + 1]]);
      });
      spans = all;
      autoAt.forEach((u) => cuts.push({ strip: st.k, cell: ci, u, z0: c.z0, z1: c.z1, auto: true }));
      act.free.forEach((u) => cuts.push({ strip: st.k, cell: ci, u, z0: c.z0, z1: c.z1, auto: false }));
      const hardSpans = spansOf(c.uL, c.uR, hard);
      hardSpans.forEach(([lo, hi]) => {
        if (hi - lo > PL + EPS && !notes.some((n) => n.strip === st.k)) notes.push({ strip: st.k, id: st.id, kind: "joined-long", len: hi - lo, max: PL });
      });
      spans.forEach(([lo, hi]) => {
        const l = hi - lo;
        const dir = band.origin >= hi - EPS ? -1 : band.origin <= lo + EPS ? 1 : Math.abs(hi - band.origin) < Math.abs(lo - band.origin) ? -1 : 1;
        const u0 = dir === 1 ? lo : hi;
        const edgeAt = (u) => {
          if (ends(c, u)) return "wall";
          const f2 = act.fold.find((q) => Math.abs(q.u - u) < 0.5);
          if (f2) return f2.id === "eaveL" || f2.id === "eaveR" || f2.id === "cap" ? "bend" : "wall";
          return "joint";
        };
        const e0 = edgeAt(u0), e1 = edgeAt(dir === 1 ? hi : lo);
        const bends = band.folds.filter((f2) => !act.fold.some((q) => q.id === f2.id) && f2.id !== "ridge" && f2.id !== "wallfold" && f2.u > lo + 0.5 && f2.u < hi - 0.5).map((f2) => dir * (f2.u - u0)).sort((x, y) => x - y);
        const left2 = hi <= 0.5 && band.origin === 0;
        const zEdge = (first) => {
          const atBand = first ? c.z0 <= band.z0 + 0.5 : c.z1 >= band.z1 - 0.5;
          if (!atBand) return "joint";
          if (first ? c.z0 <= 0.5 : c.z1 >= m.L - 0.5) return "wall";
          if (!left2) return "wall";
          const nb = bands[c.band + (first ? -1 : 1)];
          return nb && nb.origin === 0 && Math.abs(nb.uL - band.uL) < 0.5 ? "joint" : "wall";
        };
        recs.push({ lo, hi, l, dir, u0, e0, e1, bends, c, w0: zEdge(true), w1: zEdge(false) });
      });
    });
    const merged = [];
    recs.forEach((r) => {
      const q = r.hi > 0.5 ? void 0 : merged.find((x) => Math.abs(x.lo - r.lo) < 0.5 && Math.abs(x.hi - r.hi) < 0.5 && x.e0 === r.e0 && x.e1 === r.e1 && Math.abs(x.c.z1 - r.c.z0) < 1e-6);
      if (q) {
        q.c = { ...q.c, z1: r.c.z1 };
        q.w1 = r.w1;
      } else merged.push({ ...r });
    });
    merged.forEach((r) => {
      const piece = {
        kind: "rect",
        l: r.l,
        w: r.c.z1 - r.c.z0,
        ids: [st.id],
        cut: r.bends[0] ?? null,
        edges: { l0: r.e0, l1: r.e1, w0: r.w0, w1: r.w1 },
        src: { kind: "board", surf: 1, u0: r.u0, z0: r.c.z0, dir: r.dir },
        ...r.bends.length > 1 ? { cuts: r.bends } : {}
      };
      if (r.bends.length) piece.noSplit = true;
      const g = deriveTg(piece.edges, mode);
      if (g) piece.tg = g;
      letters.push(piece);
    });
    if (letters.length > 1) letters.forEach((q, i) => {
      q.seg = String.fromCharCode(97 + i % 26);
    });
    pieces.push(...letters);
  });
  const left = [], right = [];
  bands.forEach((b) => {
    left.push([b.uL, b.z0], [b.uL, b.z1]);
    right.push([b.uR, b.z0], [b.uR, b.z1]);
  });
  const outline = [...left, ...right.reverse()].filter((q, i, a) => i === 0 || Math.abs(q[0] - a[i - 1][0]) > EPS || Math.abs(q[1] - a[i - 1][1]) > EPS);
  const cand = [0, m.L];
  strips.forEach((s) => cand.push(s.a, s.b));
  const zr = cand.reduce((b, c) => Math.abs(c - anchor) < Math.abs(b - anchor) ? c : b, cand[0]);
  const bandAt = bands.find((b) => zr >= b.z0 - EPS && zr <= b.z1 + EPS && zr < b.z1 - EPS) ?? bands[bands.length - 1];
  const wf = bands.find((b) => b.folds.some((f2) => f2.id === "wallfold"));
  const wallFold = wf ? wf.folds.find((f2) => f2.id === "wallfold").u : null;
  return {
    key: 1,
    ref: "R1",
    PL,
    BW,
    L: m.L,
    anchor,
    zr,
    ur: bandAt.origin,
    uMin: Math.min(...bands.map((b) => b.uL)),
    uMax: Math.max(...bands.map((b) => b.uR)),
    bands,
    strips,
    outline,
    lines,
    cuts,
    notes,
    pieces,
    wallFold,
    present: SPLIT_IDS.filter((x) => presentSet.has(x)),
    cap: m.cap
  };
}
var round1 = (v) => Math.round(v * 10) / 10;
function sanitizeSplits(raw) {
  if (!raw || typeof raw !== "object") return {};
  const r = raw;
  const ids = new Set(SPLIT_IDS);
  const out = {};
  if (r.line && typeof r.line === "object") {
    const line = {};
    for (const [k, v] of Object.entries(r.line)) if (ids.has(k) && typeof v === "boolean") line[k] = v;
    if (Object.keys(line).length) out.line = line;
  }
  if (r.strips && typeof r.strips === "object") {
    const strips = {};
    for (const [k, v] of Object.entries(r.strips).slice(0, 200)) {
      if (!/^-?\d{1,4}$/.test(k) || !v || typeof v !== "object") continue;
      const q = v;
      const s = {};
      if (q.s && typeof q.s === "object") {
        for (const [a, b] of Object.entries(q.s)) if (ids.has(a) && typeof b === "boolean") s[a] = b;
      }
      const c = Array.isArray(q.c) ? q.c.filter((x) => typeof x === "number" && isFinite(x) && Math.abs(x) < 5e3).slice(0, 20).map(round1) : [];
      if (Object.keys(s).length || c.length) strips[k] = { ...Object.keys(s).length ? { s } : {}, ...c.length ? { c } : {} };
    }
    if (Object.keys(strips).length) out.strips = strips;
  }
  return out;
}
function legacyOpeningToSheet(sheet, o) {
  if (o.surface < 1 || o.surface > 5) return o;
  const F = sheet.wallFold;
  const map = (q) => o.surface === 1 ? [-q[0], q[1]] : o.surface === 5 && F !== null ? [F - q[0], q[1]] : q;
  return { ...o, surface: 1, pts: o.pts.map(map) };
}

// packages/core/src/spec.ts
var NOTCH_KINDS = ["corner", "recess", "offset"];
var START_KEYS = ["ZO", "XO", "o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9"];
var underRoofSpec = (s) => s.ceiling.kind === "roof";
function typeOf(s) {
  if (s.ceiling.kind === "flat") return "lazienka-2";
  return s.pos === "left" ? "sypialnia" : s.pos === "right" ? "lazienka-1" : "salon";
}
var notch = (s, k) => s.notches.find((n) => n.kind === k);
var finishOf = (s, key) => s.surf[String(key)]?.finish ?? WOOD;
var dirOf = (s, key) => s.surf[String(key)]?.dir;
var base = () => ({ w: 548, l: 400, notches: [], pos: "full", ceiling: { kind: "roof", cap: 0 }, join: false, surf: {}, starts: { ZO: 0, XO: 0 } });
var startsOf = (p, zo = 0) => {
  const o = { ZO: p.ZO ?? zo, XO: p.XO ?? 0 };
  for (let i = 1; i <= 9; i++) if (p["o" + i]) o["o" + i] = p["o" + i];
  return o;
};
var emptySpec = () => base();
function specFromLegacy(type, params) {
  const d = ROOMS[type].defaults;
  const p = { ...d, ...params };
  const s = base();
  s.l = p.L ?? p.bz ?? 400;
  s.starts = startsOf(p, d.ZO ?? 0);
  if (type === "lazienka-2") {
    const H = Math.min(500, Math.max(100, p.H));
    const hb = Math.min(Math.max(10, H - 10), Math.min(200, Math.max(10, p.hb)));
    s.w = p.bx;
    s.l = p.bz;
    s.ceiling = { kind: "flat", h: H };
    s.join = true;
    s.pos = "full";
    const at = Math.max(0, H - hb);
    const fin2 = { kind: "split", at, wood: "above" };
    s.surf = { ...p.dz ? { "1": { dir: "ridge" } } : {}, "2": { finish: fin2 }, "3": { finish: fin2 }, "4": { finish: fin2 }, "5": { finish: fin2 } };
    return s;
  }
  if (type === "salon") {
    s.pos = "full";
    s.w = p.W;
    if ((params.cA ?? 1) && p.dA !== void 0) s.notches.push({ kind: "recess", a: p.dA, b: p.ZA });
    if ((params.cB ?? 1) && p.wB !== void 0) s.notches.push({ kind: "corner", a: p.wB, b: p.dB });
    if ((p.niche ?? 0) > 0) s.notches.push({ kind: "offset", a: p.niche, b: 0 });
    if (p.cutOn && (params.cB ?? 1)) s.surf["9"] = { finish: { kind: "split", at: p.cutH, wood: "above" } };
    s.starts.ZO = params.ZO ?? d.ZO ?? 415;
    return s;
  }
  if (type === "sypialnia") {
    s.pos = "left";
    s.w = p.Wb;
    s.ceiling = { kind: "roof", cap: p.capOn ? p.capH : 0 };
    return s;
  }
  s.pos = "right";
  s.w = p.bw;
  return s;
}
function endCutOf(s) {
  const f2 = s.surf["9"]?.finish;
  return f2 && f2.kind === "split" && f2.wood === "above" && notch(s, "corner") ? f2.at : null;
}
function engineInput(s, roof) {
  const type = typeOf(s);
  const p = { ...ROOMS[type].defaults };
  for (const k of Object.keys(s.starts)) p[k] = s.starts[k];
  if (type === "lazienka-2") {
    const c = s.ceiling.kind === "flat" ? s.ceiling.h : 250;
    p.bx = s.w;
    p.bz = s.l;
    p.H = c;
    p.dz = s.surf["1"]?.dir === "ridge" ? 1 : 0;
    p.hb = flatBand(s) ?? 66;
    return { type, params: p };
  }
  p.W = roof.W;
  p.ang = roof.ang;
  p.HL = roof.HL;
  p.L = s.l;
  if (type === "salon") {
    const r = notch(s, "recess"), c = notch(s, "corner"), o = notch(s, "offset");
    p.niche = o ? o.a : 0;
    p.cA = r ? 1 : 0;
    p.cB = c ? 1 : 0;
    if (r) {
      p.dA = r.a;
      p.ZA = r.b;
    }
    if (c) {
      p.wB = c.a;
      p.dB = c.b;
    }
    const cut = endCutOf(s);
    p.cutOn = cut !== null ? 1 : 0;
    if (cut !== null) p.cutH = cut;
  } else if (type === "sypialnia") {
    p.Wb = s.w;
    const cap = s.ceiling.kind === "roof" ? s.ceiling.cap : 0;
    p.capOn = cap > 0 ? 1 : 0;
    if (cap > 0) p.capH = cap;
  } else p.bw = s.w;
  return { type, params: p };
}
function flatBand(s) {
  if (s.ceiling.kind !== "flat") return null;
  const H = s.ceiling.h;
  const keys = flatJoinKeys(s);
  const hs = keys.map((k) => {
    const f2 = finishOf(s, k);
    if (dirOf(s, k) === "horizontal") return null;
    if (f2.kind === "wood") return H;
    return f2.kind === "split" && f2.wood === "above" ? H - f2.at : null;
  });
  return hs[0] !== null && hs[0] === hs[1] && hs[0] >= 10 ? hs[0] : null;
}
var flatJoinKeys = (_s) => [4, 5];
var fin = (v) => typeof v === "number" && Number.isFinite(v);
var num = (v, d, lo = -1e5, hi = 1e5) => fin(v) ? Math.min(hi, Math.max(lo, v)) : d;
var DIRS = ["vertical", "horizontal", "slope", "ridge"];
function sanitizeFinish(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const r = raw;
  const label = typeof r.label === "string" && r.label.trim() ? { label: r.label.trim().slice(0, 40) } : {};
  if (r.kind === "wood") return { kind: "wood" };
  if (r.kind === "other") return { kind: "other", ...label };
  if (r.kind === "split" && fin(r.at)) return { kind: "split", at: num(r.at, 0, 0, 2e3), wood: r.wood === "below" ? "below" : "above", ...label };
  return void 0;
}
function sanitizeSpec(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const s = emptySpec();
  s.w = num(r.w, s.w, 0, 5e3);
  s.l = num(r.l, s.l, 0, 5e3);
  s.pos = r.pos === "left" || r.pos === "right" ? r.pos : "full";
  const c = r.ceiling;
  s.ceiling = c && c.kind === "flat" ? { kind: "flat", h: num(c.h, 250, 0, 2e3) } : { kind: "roof", cap: c ? num(c.cap, 0, 0, 3e3) : 0 };
  s.join = !!r.join && s.ceiling.kind === "flat";
  if (Array.isArray(r.notches)) {
    for (const n of r.notches.slice(0, 6)) {
      const q = n;
      if (!q || !NOTCH_KINDS.includes(q.kind) || s.notches.some((x) => x.kind === q.kind)) continue;
      s.notches.push({ kind: q.kind, a: num(q.a, 0, 0, 5e3), b: num(q.b, 0, 0, 5e3) });
    }
  }
  if (r.surf && typeof r.surf === "object") {
    for (const [k, v] of Object.entries(r.surf).slice(0, 12)) {
      if (!/^[1-9]$/.test(k) || !v || typeof v !== "object") continue;
      const q = v;
      const cfg = {};
      if (DIRS.includes(q.dir)) cfg.dir = q.dir;
      const f2 = sanitizeFinish(q.finish);
      if (f2) cfg.finish = f2;
      if (cfg.dir || cfg.finish) s.surf[k] = cfg;
    }
  }
  if (r.starts && typeof r.starts === "object") {
    for (const k of START_KEYS) {
      const v = r.starts[k];
      if (fin(v)) s.starts[k] = Math.min(5e3, Math.max(-5e3, v));
    }
  }
  return s;
}

// packages/web/src/state/names.ts
var FEATURE_KEYS = ["recess", "builtIn", "niche", "endCut"];
var emptyNames = () => ({ rooms: {}, surfaces: {}, features: {} });
var houseNames = () => ({ rooms: { salon: "Salon", sypialnia: "Sypialnia", "lazienka-1": "\u0141azienka 1", "lazienka-2": "\u0141azienka 2" }, surfaces: {}, features: {} });
var clean = (v) => typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null;
function sanitizeNames(raw, ids) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const out = emptyNames();
  const rooms = r.rooms ?? {};
  const surfaces = r.surfaces ?? {};
  const features = r.features ?? {};
  for (const id of ids) {
    const n = clean(rooms[id]);
    if (n) out.rooms[id] = n;
    const sf = surfaces[id];
    if (sf && typeof sf === "object") {
      const m = {};
      for (const k of Object.keys(sf)) {
        const v = clean(sf[k]);
        if (v && /^\d{1,2}$/.test(k)) m[k] = v;
      }
      if (Object.keys(m).length) out.surfaces[id] = m;
    }
    const ft = features[id];
    if (ft && typeof ft === "object") {
      const m = {};
      for (const k of FEATURE_KEYS) {
        const v = clean(ft[k]);
        if (v) m[k] = v;
      }
      if (Object.keys(m).length) out.features[id] = m;
    }
  }
  return out;
}

// packages/web/src/state/project.ts
var DEFAULT_BAND = { on: true, len: 1648, h: 65, min: 124, max: 124, use: 1 };
var FILE_VERSION = 3;
var MAX_ROOMS = 40;
var ID_OK = (id) => /^[A-Za-z0-9_-]{1,20}$/.test(id) && id !== "przeglad" && !id.startsWith("band-");
var DEFAULT_ROOF = { W: ROOMS.salon.defaults.W, ang: ROOMS.salon.defaults.ang, HL: ROOMS.salon.defaults.HL };
var roomRoof = (p, id) => ({ ...p.roof, ...p.rooms[id]?.roof });
var roomEngine = (p, id) => engineInput(p.rooms[id].spec, roomRoof(p, id));
var DEFAULT_SETTINGS = {
  kerfMm: 3,
  trimMm: 0,
  minOffcutCm: 10,
  minStripCm: 10,
  guillotine: false,
  allowances: { enabled: false, wall: 10, bend: 5, opening: -3, gap: -5, angleTolerance: false },
  plate: DEFAULT_PLATE,
  platePrice: 147.6,
  splitAtBends: true
};
var freshId = () => Math.random().toString(36).slice(2, 10);
function blankProject(name = "Ok\u0142adzina domu") {
  return { version: FILE_VERSION, id: freshId(), name, updatedAt: Date.now(), settings: structuredClone(DEFAULT_SETTINGS), roof: { ...DEFAULT_ROOF }, roomOrder: [], rooms: {}, openings: {}, bands: [], names: emptyNames(), splits: {} };
}
var num2 = (v, d) => typeof v === "number" && isFinite(v) ? v : d;
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function sanitizeProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const v1 = r.version === 1, v2 = r.version === 2;
  if (!v1 && !v2 && r.version !== FILE_VERSION || !r.rooms || typeof r.rooms !== "object") return null;
  const base2 = blankProject(typeof r.name === "string" ? r.name.slice(0, 120) : void 0);
  if (typeof r.id === "string") base2.id = r.id.slice(0, 40);
  base2.updatedAt = num2(r.updatedAt, Date.now());
  const rooms = r.rooms;
  const old = v1 || v2;
  let ids;
  if (v1) ids = [...ROOM_IDS];
  else {
    const listed = Array.isArray(r.roomOrder) ? r.roomOrder.filter((x) => typeof x === "string") : [];
    const valid = (id) => rooms[id] && typeof rooms[id] === "object" && (v2 ? isRoomType(rooms[id].type) : !!sanitizeSpec(rooms[id].spec));
    ids = [.../* @__PURE__ */ new Set([...listed, ...Object.keys(rooms)])].filter((id) => ID_OK(id) && valid(id)).slice(0, MAX_ROOMS);
  }
  const rawRoof = r.roof;
  const legacyType = {};
  const legacyParams = {};
  for (const id of ids) {
    const src = rooms[id];
    let room;
    if (old) {
      const type = v1 ? id : src?.type;
      const params = { ...ROOMS[type].defaults };
      for (const k of [...Object.keys(ROOMS[type].defaults), ...EXTRA_KEYS[type] ?? []]) {
        const v = src?.params?.[k];
        if (typeof v === "number" && isFinite(v)) params[k] = v;
      }
      legacyType[id] = type;
      legacyParams[id] = params;
      room = { on: src ? src.on !== false : true, spec: specFromLegacy(type, params) };
      if (!v1 && typeof src?.tpl === "string" && ["under-roof", "sloped", "flat"].includes(src.tpl)) room.tpl = src.tpl === "flat" ? "bath" : src.tpl;
    } else {
      room = { on: src.on !== false, spec: sanitizeSpec(src.spec) };
      const t = src.tpl;
      if (typeof t === "string" && ["under-roof", "sloped", "bath", "flat", "empty"].includes(t)) room.tpl = t;
      const rr = src.roof;
      if (rr && typeof rr === "object" && underRoofSpec(room.spec)) {
        const o = {};
        for (const k of ROOF_KEYS) if (typeof rr[k] === "number" && isFinite(rr[k])) o[k] = rr[k];
        if (Object.keys(o).length) room.roof = o;
      }
    }
    base2.rooms[id] = room;
    base2.roomOrder.push(id);
  }
  const firstRoof = base2.roomOrder.find((id) => underRoofSpec(base2.rooms[id].spec));
  const roofOf = (id, k) => id && old ? legacyParams[id][k] : void 0;
  for (const k of ROOF_KEYS) base2.roof[k] = num2(rawRoof?.[k], roofOf(firstRoof, k) ?? DEFAULT_ROOF[k]);
  if (old) for (const id of base2.roomOrder) {
    const room = base2.rooms[id];
    if (!underRoofSpec(room.spec)) continue;
    const listed = v2 ? Array.isArray(rooms[id]?.over) ? rooms[id].over : [] : null;
    const o = {};
    for (const k of ROOF_KEYS) {
      const v = legacyParams[id][k];
      if (listed ? listed.includes(k) : v !== base2.roof[k]) o[k] = v;
    }
    if (Object.keys(o).length) room.roof = o;
  }
  const ro = r.openings;
  for (const id of base2.roomOrder) {
    const list = ro && Array.isArray(ro[id]) ? ro[id] : null;
    base2.openings[id] = list ? list.flatMap((o) => {
      const q = o;
      const ok = q && typeof q.id === "string" && (q.kind === "window" || q.kind === "door" || q.kind === "cutout") && typeof q.surface === "number" && Array.isArray(q.pts) && q.pts.length >= 3 && q.pts.length <= 40 && q.pts.every((v) => Array.isArray(v) && isFinite(v[0]) && isFinite(v[1]));
      return ok ? [{ id: q.id.slice(0, 20), kind: q.kind, surface: q.surface, pts: q.pts.map((v) => [v[0], v[1]]), ...typeof q.name === "string" && q.name.trim() ? { name: q.name.trim().slice(0, 60) } : {} }] : [];
    }).slice(0, 6) : v1 ? defaultOpenings(legacyType[id], legacyParams[id]) : [];
  }
  const st = r.settings;
  const oldPl = Object.values(rooms).map((q) => q.params?.PL).find((v) => typeof v === "number"), oldPw = Object.values(rooms).map((q) => q.params?.PW).find((v) => typeof v === "number");
  if (typeof oldPl === "number" && typeof oldPw === "number" && !(oldPl === 499 && oldPw === 125)) base2.settings.plate = { L: oldPl, W: oldPw, tongue: 0, profile: "none" };
  const pl = st?.plate;
  if (pl && typeof pl === "object") {
    const mode = pl.profile === "long" || pl.profile === "none" ? pl.profile : "all";
    base2.settings.plate = { L: clamp(num2(pl.L, 500), 100, 1e3), W: clamp(num2(pl.W, 125), 20, 300), tongue: clamp(num2(pl.tongue, 1), 0, 5), profile: mode };
  }
  if (st) {
    base2.settings.kerfMm = Math.max(0, num2(st.kerfMm, base2.settings.kerfMm));
    base2.settings.trimMm = Math.max(0, num2(st.trimMm, base2.settings.trimMm));
    base2.settings.minOffcutCm = Math.max(0, num2(st.minOffcutCm, base2.settings.minOffcutCm));
    base2.settings.minStripCm = Math.max(0, num2(st.minStripCm, base2.settings.minStripCm));
    base2.settings.guillotine = !!st.guillotine;
    const a = st.allowances;
    if (a) base2.settings.allowances = { enabled: !!a.enabled, wall: num2(a.wall, 0), bend: num2(a.bend, 0), opening: num2(a.opening, 0), gap: num2(a.gap, 0), angleTolerance: !!a.angleTolerance };
  }
  const sh = r.shared;
  base2.settings.platePrice = Math.max(0, num2(st?.platePrice, num2(sh?.price, base2.settings.platePrice)));
  base2.settings.splitAtBends = typeof st?.splitAtBends === "boolean" ? st.splitAtBends : sh?.split !== false;
  const rawBands = Array.isArray(r.bands) ? r.bands : sh?.band ? [{ ...sh.band, id: "b1", on: true }] : null;
  if (rawBands) {
    const seen = /* @__PURE__ */ new Set();
    base2.bands = rawBands.slice(0, 8).flatMap((x, i) => {
      if (!x || typeof x !== "object") return [];
      const b = x;
      let id = typeof b.id === "string" && b.id ? b.id.slice(0, 20) : "b" + (i + 1);
      while (seen.has(id)) id += "x";
      seen.add(id);
      return [{ id, on: b.on !== false, len: Math.max(0, num2(b.len, 0)), h: num2(b.h, 65), min: num2(b.min, 124), max: num2(b.max, 124), use: b.use ? 1 : 0, ...typeof b.name === "string" && b.name.trim() ? { name: b.name.trim().slice(0, 60) } : {} }];
    });
  } else if (v1) base2.bands = [{ id: "b1", ...DEFAULT_BAND }];
  base2.names = sanitizeNames(r.names, base2.roomOrder) ?? (v1 ? houseNames() : emptyNames());
  const rs = r.splits;
  if (rs && typeof rs === "object") {
    for (const id of base2.roomOrder) base2.splits[id] = sanitizeSplits(rs[id]);
    const mg = r.migration;
    if (mg && typeof mg === "object" && Array.isArray(mg.dropped)) {
      const dropped = mg.dropped.flatMap((d) => {
        const q = d;
        return q && typeof q.room === "string" && base2.rooms[q.room] && typeof q.name === "string" && typeof q.cm === "number" && isFinite(q.cm) ? [{ room: q.room, name: q.name.slice(0, 80), cm: q.cm }] : [];
      }).slice(0, 20);
      const renamed = typeof mg.renamed === "number" && isFinite(mg.renamed) ? Math.max(0, Math.min(20, Math.round(mg.renamed))) : 0;
      if (dropped.length || renamed) base2.migration = { dropped, renamed };
    }
  } else {
    const dropped = [];
    let renamed = 0;
    for (const id of base2.roomOrder) {
      base2.splits[id] = {};
      const room = base2.rooms[id];
      if (!underRoofSpec(room.spec)) continue;
      const type = typeOf(room.spec), starts = room.spec.starts;
      for (let i = 2; i <= 5; i++) {
        const v = starts["o" + i] ?? 0;
        if (v) dropped.push({ room: id, name: ROOMS[type].shiftNames[i - 1] ?? "R" + i, cm: v });
        delete starts["o" + i];
      }
      if (base2.names.surfaces[id]) {
        for (const k of ["1", "2", "3", "4", "5"]) if (base2.names.surfaces[id][k]) {
          delete base2.names.surfaces[id][k];
          renamed++;
        }
      }
      if (base2.openings[id].some((o) => o.surface >= 1 && o.surface <= 5)) {
        const eng = roomEngine(base2, id).params, o1 = eng.o1 ?? 0;
        const m = buildModel(type, { ...eng, o2: o1, o3: o1, o4: o1, o5: o1 });
        if (isAttic(m)) {
          const sheet = roofSheet(m, { splits: {}, splitAtBends: base2.settings.splitAtBends });
          base2.openings[id] = base2.openings[id].map((o) => legacyOpeningToSheet(sheet, o));
        }
      }
    }
    if (dropped.length || renamed) base2.migration = { dropped, renamed };
  }
  return base2;
}

// server/projects-api.ts
var MAX_BYTES = 2 * 1024 * 1024;
var ID_RE = /^[A-Za-z0-9_-]{22,64}$/;
var HEADERS = { "cache-control": "no-store", "x-slabs-api": "1" };
var json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, "content-type": "application/json; charset=utf-8", ...extra } });
var err = (status, error) => json(status, { error });
var projectResponse = (status, project, m) => json(status, project, { "x-revision": String(m.revision), "x-updated-at": String(m.updatedAt) });
function newId() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function readProject(req) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return err(413, "too_large");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BYTES) return err(413, "too_large");
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return err(400, "invalid_json");
  }
  const p = sanitizeProject(raw);
  return p ?? err(400, "invalid_project");
}
var metaOf = (m) => ({ revision: Number(m.revision) || 1, updatedAt: Number(m.updatedAt) || 0 });
async function handle(req, store, now = Date.now) {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  const m = /^\/api\/projects(?:\/([^/]+))?$/.exec(path);
  if (!m) return err(404, "not_found");
  const id = m[1];
  if (!id) {
    if (req.method !== "POST") return err(405, "method_not_allowed");
    const p = await readProject(req);
    if (p instanceof Response) return p;
    const newKey = newId();
    const meta = { revision: 1, updatedAt: now() };
    const r = await store.setJSON(newKey, p, { metadata: { ...meta }, onlyIfNew: true });
    if (!r.modified) return err(500, "id_collision");
    return json(201, { id: newKey, ...meta }, { "x-revision": "1" });
  }
  if (!ID_RE.test(id)) return err(404, "not_found");
  if (req.method === "GET") {
    const cur = await store.getWithMetadata(id, { type: "json" });
    if (!cur) return err(404, "not_found");
    return projectResponse(200, cur.data, metaOf(cur.metadata));
  }
  if (req.method === "PUT") {
    const base2 = Number(req.headers.get("x-base-revision"));
    if (!Number.isInteger(base2) || base2 < 1) return err(400, "missing_base_revision");
    const p = await readProject(req);
    if (p instanceof Response) return p;
    const cur = await store.getWithMetadata(id, { type: "json" });
    if (!cur) return err(404, "not_found");
    const curMeta = metaOf(cur.metadata);
    if (curMeta.revision !== base2) return projectResponse(409, cur.data, curMeta);
    const meta = { revision: base2 + 1, updatedAt: now() };
    const r = await store.setJSON(id, p, { metadata: { ...meta }, ...cur.etag ? { onlyIfMatch: cur.etag } : {} });
    if (!r.modified) {
      const again = await store.getWithMetadata(id, { type: "json" });
      if (!again) return err(404, "not_found");
      return projectResponse(409, again.data, metaOf(again.metadata));
    }
    return json(200, meta, { "x-revision": String(meta.revision) });
  }
  return err(405, "method_not_allowed");
}

// netlify/src/projects.ts
var projects_default = async (req) => {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/.netlify/functions/projects")) {
    url.pathname = url.pathname.replace("/.netlify/functions/projects", "/api/projects");
    req = new Request(url, req);
  }
  return handle(req, getStore({ name: "projects", consistency: "strong" }));
};
export {
  projects_default as default
};
/*! Bundled license information:

splaytree/dist/splaytree.umd.cjs:
  (**
   * splaytree v3.2.4
   * Fast Splay tree for Node and browser
   *
   * @author Alexander Milevski <alex@milevski.co>
   * @license MIT
   * @preserve
   *)
*/
export const config = { path: ["/api/projects", "/api/projects/*"] };
