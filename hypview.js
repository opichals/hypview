"use strict";

/*
// Capture the output of this into a variable, if you want
(function(Module, args) {
  Module = Module || {};
  Module.arguments = args || [];
*/

///*
// Runs much faster, for some reason
if (!this['Module']) {
  this['Module'] = {};
}
// nodejs
if (typeof process !== 'undefined') {
    if (typeof global !== 'undefined') global.Module = this['Module'];
    var scriptArgs = process.argv.slice(2);
}
// define global for the browser as all functions are there
if (typeof global === 'undefined') this['global'] = this;

if (!Module.arguments) {
  try {
    Module.arguments = scriptArgs;
  } catch(e) {
    try {
      Module.arguments = arguments;
    } catch(e) {
      Module.arguments = [];
    }
  }
}
//*/

  // === Auto-generated preamble library stuff ===

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  forceAlign: function (target, quantum) {
    quantum = quantum || 4;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target/quantum)*quantum;
    } else {
      return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
    }
  },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  },
  isPointerType: function isPointerType(type) {
  return pointingLevels(type) > 0;
},
  isStructType: function isStructType(type) {
  if (isPointerType(type)) return false;
  if (new RegExp(/^\[\d+\ x\ (.*)\]/g).test(type)) return true; // [15 x ?] blocks. Like structs
  // See comment in isStructPointerType()
  return !Runtime.isNumberType(type) && type[0] == '%';
},
  INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
  FLOAT_TYPES: {"float":0,"double":0},
  or64: function (x, y) {
    var l = (x | 0) | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  and64: function (x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  xor64: function (x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  getNativeFieldSize: function getNativeFieldSize(type) {
  return Math.max(Runtime.getNativeTypeSize(type), 4);
},
  getNativeTypeSize: function getNativeTypeSize(type) {
  if (4 == 1) return 1;
  var size = {
    '_i1': 1,
    '_i8': 1,
    '_i16': 2,
    '_i32': 4,
    '_i64': 8,
    "_float": 4,
    "_double": 8
  }['_'+type]; // add '_' since float&double confuse Closure compiler as keys.
  if (!size && type[type.length-1] == '*') {
    size = 4; // A pointer
  }
  return size;
},
  dedup: function dedup(items, ident) {
  var seen = {};
  if (ident) {
    return items.filter(function(item) {
      if (seen[item[ident]]) return false;
      seen[item[ident]] = true;
      return true;
    });
  } else {
    return items.filter(function(item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }
},
  set: function set() {
  var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
  var ret = {};
  for (var i = 0; i < args.length; i++) {
    ret[args[i]] = 0;
  }
  return ret;
},
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    type.flatIndexes = type.fields.map(function(field) {
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
        alignSize = size;
      } else if (Runtime.isStructType(field)) {
        size = Types.types[field].flatSize;
        alignSize = Types.types[field].alignSize;
      } else {
        dprint('Unclear type in struct: ' + field + ', in ' + type.name_);
        assert(0);
      }
      alignSize = type.packed ? 1 : Math.min(alignSize, 4);
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr-prev);
      }
      prev = curr;
      return curr;
    });
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = (type.flatFactor != 1);
    return type.flatIndexes;
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = typeof Types === 'undefined' ? Runtime.typeInfo[typeName] : Types.types[typeName];
      if (!type) return null;
      if (!struct) struct = Types.structMetadata[typeName.replace(/.*\./, '')];
      if (!struct) return null;
      assert(type.fields.length === struct.length, 'Number of named fields must match the type for ' + typeName);
      alignment = type.flatIndexes;
    } else {
      var type = { fields: struct.map(function(item) { return item[0] }) };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach(function(item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset;
        } else {
          // embedded struct
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      });
    } else {
      struct.forEach(function(item, i) {
        ret[item[1]] = alignment[i];
      });
    }
    return ret;
  },
  stackAlloc: function stackAlloc(size) { var ret = STACKTOP; assert(size > 0, "Trying to allocate 0"); _memset(STACKTOP, 0, size); STACKTOP += size;STACKTOP = Math.ceil((STACKTOP)/4)*4;; assert(STACKTOP < STACK_ROOT + STACK_MAX, "Ran out of stack"); return ret; },
  staticAlloc: function staticAlloc(size) { var ret = STATICTOP; assert(size > 0, "Trying to allocate 0"); STATICTOP += size;STATICTOP = Math.ceil((STATICTOP)/4)*4;; return ret; },
  alignMemory: function alignMemory(size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 4))*(quantum ? quantum : 4);; return ret; },
  __dummy__: 0
}



var CorrectionsMonitor = {
  MAX_ALLOWED: 0, // XXX
  corrections: 0,
  sigs: {},

  note: function(type, succeed, sig) {
    if (!succeed) {
      this.corrections++;
      if (this.corrections >= this.MAX_ALLOWED) abort('\n\nToo many corrections!');
    }
  },

  print: function() {
    var items = [];
    for (var sig in this.sigs) {
      items.push({
        sig: sig,
        fails: this.sigs[sig][0],
        succeeds: this.sigs[sig][1],
        total: this.sigs[sig][0] + this.sigs[sig][1]
      });
    }
    items.sort(function(x, y) { return y.total - x.total; });
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      print(item.sig + ' : ' + item.total + ' hits, %' + (Math.floor(100*item.fails/item.total)) + ' failures');
    }
  }
};


global.cRound = function cRound(x) {
  return x >= 0 ? Math.floor(x) : Math.ceil(x);
}




//========================================
// Runtime essentials
//========================================

var __globalConstructor__ = function globalConstructor() {
};

var __THREW__ = false; // Used in checking for thrown exceptions.

var __ATEXIT__ = [];

var ABORT = false;

var undef = 0;


global.abort = function abort(text) {
  print(text + ':\n' + (new Error).stack);
  ABORT = true;
  throw "Assertion: " + text;
}


global.assert = function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.


global.setValue = function setValue(ptr, value, type) {
  if (type[type.length-1] === '*') type = 'i32'; // pointers are 32-bit
  switch(type) {
    case 'i1':  HEAP[ptr] = (value)&0xff;; break;
    case 'i8':  HEAP[ptr] = (value)&0xff;; break;
    case 'i16':  HEAP[ptr+1] = (value>>8)&0xff; HEAP[ptr] = (value)&0xff;; break;
    case 'i32':  HEAP[ptr+3] = (value>>24)&0xff; HEAP[ptr+2] = (value>>16)&0xff; HEAP[ptr+1] = (value>>8)&0xff; HEAP[ptr] = (value)&0xff;; break;
    case 'i64':  HEAP[ptr+7] = (value>>56)&0xff; HEAP[ptr+6] = (value>>48)&0xff; HEAP[ptr+5] = (value>>40)&0xff; HEAP[ptr+4] = (value>>32)&0xff; HEAP[ptr+3] = (value>>24)&0xff; HEAP[ptr+2] = (value>>16)&0xff; HEAP[ptr+1] = (value>>8)&0xff; HEAP[ptr] = (value)&0xff;; break;
    case 'float':  HEAP[ptr+3] = (value>>24)&0xff; HEAP[ptr+2] = (value>>16)&0xff; HEAP[ptr+1] = (value>>8)&0xff; HEAP[ptr] = (value)&0xff;; break;
    case 'double':  HEAP[ptr+7] = (value>>56)&0xff; HEAP[ptr+6] = (value>>48)&0xff; HEAP[ptr+5] = (value>>40)&0xff; HEAP[ptr+4] = (value>>32)&0xff; HEAP[ptr+3] = (value>>24)&0xff; HEAP[ptr+2] = (value>>16)&0xff; HEAP[ptr+1] = (value>>8)&0xff; HEAP[ptr] = (value)&0xff;; break;
    default: abort('invalid type for setValue: ' + type);
  }
}

// Parallel to setValue.


global.getValue = function getValue(ptr, type) {
  if (type[type.length-1] === '*') type = 'i32'; // pointers are 32-bit
  switch(type) {
    case 'i1': return (HEAP[ptr]);
    case 'i8': return (HEAP[ptr]);
    case 'i16': return (HEAP[ptr+1]<<8)|(HEAP[ptr]);
    case 'i32': return (HEAP[ptr+3]<<24)|(HEAP[ptr+2]<<16)|(HEAP[ptr+1]<<8)|(HEAP[ptr]);
    case 'i64': return (HEAP[ptr+7]<<56)|(HEAP[ptr+6]<<48)|(HEAP[ptr+5]<<40)|(HEAP[ptr+4]<<32)|(HEAP[ptr+3]<<24)|(HEAP[ptr+2]<<16)|(HEAP[ptr+1]<<8)|(HEAP[ptr]);
    case 'float': return (HEAP[ptr+3]<<24)|(HEAP[ptr+2]<<16)|(HEAP[ptr+1]<<8)|(HEAP[ptr]);
    case 'double': return (HEAP[ptr+7]<<56)|(HEAP[ptr+6]<<48)|(HEAP[ptr+5]<<40)|(HEAP[ptr+4]<<32)|(HEAP[ptr+3]<<24)|(HEAP[ptr+2]<<16)|(HEAP[ptr+1]<<8)|(HEAP[ptr]);
    default: abort('invalid type for setValue: ' + type);
  }
  return null;
}

// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function

global.intArrayFromString = function intArrayFromString(stringy, dontAddNull) {
  var ret = [];
  var t;
  var i = 0;
  while (i < stringy.length) {
    var chr = stringy.charCodeAt(i);
    if (chr > 0xFF) {
        assert(false, 'Character code ' + chr + ' (' + stringy[i] + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(chr);
    i = i + 1;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;


global.intArrayToString = function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}

// Allocates memory for some data and initializes it properly.

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed


global.allocate = function allocate(slab, types, allocator) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;
    assert(singleType, 'Not a single type?');


  var ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size * Runtime.getNativeTypeSize(singleType), 1));

  var i = 0, ri = 0, type;
  while (i < size) {
    var curr = zeroinit ? 0 : slab[i];
    type = singleType || types[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
      type = 'i32'; // function pointers are 4 bytes
    }

    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    setValue(ret+ri, curr, type);
    ri += Runtime.getNativeTypeSize(type);
    i++;
  }

  return ret;
}
Module['allocate'] = allocate;


global.Pointer_stringify = function Pointer_stringify(ptr) {
  var ret = "";
  var i = 0;
  var t;
  while (1) {
    t = String.fromCharCode((HEAP[ptr+i]));
    if (t == "\0") { break; } else {}
    ret += t;
    i += 1;
  }
  return ret;
}


global.Array_stringify = function Array_stringify(array) {
  var ret = "";
  for (var i = 0; i < array.length; i++) {
    ret += String.fromCharCode(array[i]);
  }
  return ret;
}

// Memory management

var PAGE_SIZE = 4096;

global.alignMemoryPage = function alignMemoryPage(x) {
  return Math.ceil(x/PAGE_SIZE)*PAGE_SIZE;
}

var HEAP;

var STACK_ROOT, STACKTOP, STACK_MAX;
var STATICTOP;

var HAS_TYPED_ARRAYS = false;
var TOTAL_MEMORY = 50*1024*1024;

// Initialize the runtime's memory
{
  // Without this optimization, Chrome is slow. Sadly, the constant here needs to be tweaked depending on the code being run...
  var FAST_MEMORY = TOTAL_MEMORY/32;
  HEAP = new Array(FAST_MEMORY);
  for (var i = 0; i < FAST_MEMORY; i++) {
    HEAP[i] = 0; // XXX We do *not* use {{| makeSetValue(0, 'i', 0, 'null') |}} here, since this is done just to optimize runtime speed
  }
}

var base = intArrayFromString('(null)'); // So printing %s of NULL gives '(null)'
                                         // Also this ensures we leave 0 as an invalid address, 'NULL'
for (var i = 0; i < base.length; i++) {
   HEAP[i] = (base[i])&0xff;
}

Module['HEAP'] = HEAP;

STACK_ROOT = STACKTOP = alignMemoryPage(10);
var TOTAL_STACK = 1024*1024; // XXX: Changing this value can lead to bad perf on v8!
STACK_MAX = STACK_ROOT + TOTAL_STACK;

STATICTOP = alignMemoryPage(STACK_MAX);


global.__shutdownRuntime__ = function __shutdownRuntime__() {
  while(__ATEXIT__.length > 0) {
    var atexit = __ATEXIT__.pop();
    var func = atexit.func;
    if (typeof func === 'number') {
      func = FUNCTION_TABLE[func];
    }
    func(atexit.arg === undefined ? null : atexit.arg);
  }

  // allow browser to GC, set heaps to null?

  // Print summary of correction activity
  CorrectionsMonitor.print();
}


// Copies a list of num items on the HEAP into a
// a normal JavaScript array of numbers

global.Array_copy = function Array_copy(ptr, num) {
  // TODO: In the SAFE_HEAP case, do some reading here, for debugging purposes - currently this is an 'unnoticed read'.
  return HEAP.slice(ptr, ptr+num);
}


global.String_len = function String_len(ptr) {
  var i = 0;
  while ((HEAP[ptr+i])) i++; // Note: should be |!= 0|, technically. But this helps catch bugs with undefineds
  return i;
}

// Copies a C-style string, terminated by a zero, from the HEAP into
// a normal JavaScript array of numbers

global.String_copy = function String_copy(ptr, addZero) {
  var len = String_len(ptr);
  if (addZero) len++;
  var ret = Array_copy(ptr, len);
  if (addZero) ret[len-1] = 0;
  return ret;
}

// Tools

if (typeof print === 'undefined') {
  var print = console.log; // we are on the web
  if (typeof global !== 'undefined') global.print = print; // nodejs
}

function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
  // TODO: clean up previous line
}
function reSign(value, bits, ignore, sig) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half) {
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// === Body ===


var $struct_FILE___SIZE = 88; // %struct.FILE
  var $struct_FILE___FLATTENER = [0,4,8,12,14,16,24,28,32,36,40,44,48,56,60,64,67,68,76,80];var $struct_HYP___SIZE = 60; // %struct.HYP
  var $struct_HYP___FLATTENER = [0,4,16,20];var $struct_HYP_BOX___SIZE = 24; // %struct.HYP_BOX
  var $struct_HYP_BOX___FLATTENER = [0,12,14,16,18,19,20];var $struct_HYP_EFFECTS___SIZE = 16; // %struct.HYP_EFFECTS
  var $struct_HYP_FHYPEHENTRY___SIZE = 4; // %struct.HYP_FHYPEHENTRY
  var $struct_HYP_HDOC_HEADER___SIZE = 12; // %struct.HYP_HDOC_HEADER
  var $struct_HYP_HDOC_HEADER___FLATTENER = [0,4,8,10,11];var $struct_HYP_HDOC_IDXITEM___SIZE = 24; // %struct.HYP_HDOC_IDXITEM
  var $struct_HYP_HDOC_IDXITEM___FLATTENER = [0,4,8,12,14,16,20];var $struct_HYP_IMAGE___SIZE = 20; // %struct.HYP_IMAGE
  var $struct_HYP_IMAGE___FLATTENER = [0,12,13,14,16,18];var $struct_HYP_IMAGE_DATA___SIZE = 16; // %struct.HYP_IMAGE_DATA
  var $struct_HYP_IMAGE_DATA___FLATTENER = [0,2,4,8,12];var $struct_HYP_ITEM___SIZE = 12; // %struct.HYP_ITEM
  var $struct_HYP_LINE___SIZE = 20; // %struct.HYP_LINE
  var $struct_HYP_LINE___FLATTENER = [0,12,14,16,17,18,19];var $struct_HYP_LINK___SIZE = 20; // %struct.HYP_LINK
  var $struct_HYP_LINK___FLATTENER = [0,12,14,16];var $struct_HYP_NODE___SIZE = 12; // %struct.HYP_NODE
  var $struct_HYP_TEXT___SIZE = 16; // %struct.HYP_TEXT
  var $struct_LINKABLE___SIZE = 8; // %struct.LINKABLE
  var $struct_LIST___SIZE = 16; // %struct.LIST
  var $struct___sFILEX___SIZE = 0; // %struct.__sFILEX
  var $struct___sFILEX___FLATTENER = [];var $struct___sbuf___SIZE = 8; // %struct.__sbuf
  var $struct_anon___SIZE = 40; // %struct.anon
  var ___stdoutp;var __str;var __str1;var __str2;var __str3;var __str4;var __str5;var __str6;var __str7;var __str8;var __str9;var __str10;var __str11;var __str12;var __str13;var __str14;var __str15;var __str16;var __str17;var __str18;var __str19;var __str20;var __str21;var __str22;var _len;var _depth;var _blen;var _c;var _codeword;var _bit;var _tblsiz;var _tbl;var _n;var _maxdepth;var _avail;var _left;var _right;var _crctable;var _reading_size;var _crc;var _bitcount;var _bitbuf;var _subbitbuf;var _compsize;var _infileptr;var _getc_euc_cache;var _pt_len;var _pt_table;var _c_len;var _c_table;var _blocksize;var _outfileptr;var _dicbit;var _origsize;var _prev_char;var _dicsiz;var _text;var _count;var _loc;var _c_freq;var _c_code;var _p_freq;var _pt_code;var _t_freq;var _unpackable;var _maxmatch;var __str23;var __str124;var __str225;
  var _fileno=function _fileno (stream) {
      // int fileno(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fileno.html
      // We use file descriptor numbers and FILE* streams interchangeably.
      return stream;
    };var ___01_fdopen$UNIX2003_; // stub for ___01_fdopen$UNIX2003_
  
  
  
  var ERRNO_CODES={"E2BIG":7,"EACCES":13,"EADDRINUSE":98,"EADDRNOTAVAIL":99,"EAFNOSUPPORT":97,"EAGAIN":11,"EALREADY":114,"EBADF":9,"EBADMSG":74,"EBUSY":16,"ECANCELED":125,"ECHILD":10,"ECONNABORTED":103,"ECONNREFUSED":111,"ECONNRESET":104,"EDEADLK":35,"EDESTADDRREQ":89,"EDOM":33,"EDQUOT":122,"EEXIST":17,"EFAULT":14,"EFBIG":27,"EHOSTUNREACH":113,"EIDRM":43,"EILSEQ":84,"EINPROGRESS":115,"EINTR":4,"EINVAL":22,"EIO":5,"EISCONN":106,"EISDIR":21,"ELOOP":40,"EMFILE":24,"EMLINK":31,"EMSGSIZE":90,"EMULTIHOP":72,"ENAMETOOLONG":36,"ENETDOWN":100,"ENETRESET":102,"ENETUNREACH":101,"ENFILE":23,"ENOBUFS":105,"ENODATA":61,"ENODEV":19,"ENOENT":2,"ENOEXEC":8,"ENOLCK":37,"ENOLINK":67,"ENOMEM":12,"ENOMSG":42,"ENOPROTOOPT":92,"ENOSPC":28,"ENOSR":63,"ENOSTR":60,"ENOSYS":38,"ENOTCONN":107,"ENOTDIR":20,"ENOTEMPTY":39,"ENOTRECOVERABLE":131,"ENOTSOCK":88,"ENOTSUP":95,"ENOTTY":25,"ENXIO":6,"EOVERFLOW":75,"EOWNERDEAD":130,"EPERM":1,"EPIPE":32,"EPROTO":71,"EPROTONOSUPPORT":93,"EPROTOTYPE":91,"ERANGE":34,"EROFS":30,"ESPIPE":29,"ESRCH":3,"ESTALE":116,"ETIME":62,"ETIMEDOUT":110,"ETXTBSY":26,"EWOULDBLOCK":11,"EXDEV":18};
  
  var ___setErrNo=function ___setErrNo (value) {
      // For convenient setting and returning of errno.
      var me = ___setErrNo;
      if (!me.ptr) me.ptr = allocate([0], 'i32', ALLOC_STATIC);
       HEAP[me.ptr+3] = (value>>24)&0xff; HEAP[me.ptr+2] = (value>>16)&0xff; HEAP[me.ptr+1] = (value>>8)&0xff; HEAP[me.ptr] = (value)&0xff;
      return value;
    };
  
  var _stdin=0;
  
  var _stdout=0;
  
  var _stderr=0;var FS={"root":{"read":true,"write":false,"isFolder":true,"isDevice":false,"timestamp":"2011-08-05T18:10:01.150Z","inodeNumber":1,"contents":{}},"currentPath":"/","nextInode":2,"cmask":511,"streams":[null],"ignorePermissions":true, absolutePath: function (relative, base) {
        if (typeof relative !== 'string') return null;
        if (base === undefined) base = FS.currentPath;
        if (relative && relative[0] == '/') base = '';
        var full = base + '/' + relative;
        var parts = full.split('/').reverse();
        var absolute = [''];
        while (parts.length) {
          var part = parts.pop();
          if (part == '' || part == '.') {
            // Nothing.
          } else if (part == '..') {
            if (absolute.length > 1) absolute.pop();
          } else {
            absolute.push(part);
          }
        }
        return absolute.length == 1 ? '/' : absolute.join('/');
      }, analyzePath: function (path, dontResolveLastLink, linksVisited) {
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null
        };
        path = FS.absolutePath(path);
        if (path == '/') {
          ret.isRoot = true;
          ret.exists = ret.parentExists = true;
          ret.name = '/';
          ret.path = ret.parentPath = '/';
          ret.object = ret.parentObject = FS.root;
        } else if (path !== null) {
          linksVisited = linksVisited || 0;
          path = path.slice(1).split('/');
          var current = FS.root;
          var traversed = [''];
          while (path.length) {
            if (path.length == 1 && current.isFolder) {
              ret.parentExists = true;
              ret.parentPath = traversed.length == 1 ? '/' : traversed.join('/');
              ret.parentObject = current;
              ret.name = path[0];
            }
            var target = path.shift();
            if (!current.isFolder) {
              ret.error = ERRNO_CODES.ENOTDIR;
              break;
            } else if (!current.read) {
              ret.error = ERRNO_CODES.EACCES;
              break;
            } else if (!current.contents.hasOwnProperty(target)) {
              ret.error = ERRNO_CODES.ENOENT;
              break;
            }
            current = current.contents[target];
            if (current.link && !(dontResolveLastLink && path.length == 0)) {
              if (linksVisited > 40) { // Usual Linux SYMLOOP_MAX.
                ret.error = ERRNO_CODES.ELOOP;
                break;
              }
              var link = FS.absolutePath(current.link, traversed.join('/'));
              return FS.analyzePath([link].concat(path).join('/'),
                                    dontResolveLastLink, linksVisited + 1);
            }
            traversed.push(target);
            if (path.length == 0) {
              ret.exists = true;
              ret.path = traversed.join('/');
              ret.object = current;
            }
          }
          return ret;
        }
        return ret;
      }, findObject: function (path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
          return ret.object;
        } else {
          ___setErrNo(ret.error);
          return null;
        }
      }, createObject: function (parent, name, properties, canRead, canWrite) {
        if (!parent) parent = '/';
        if (typeof parent === 'string') parent = FS.findObject(parent);
  
        if (!parent) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent path must exist.');
        }
        if (!parent.isFolder) {
          ___setErrNo(ERRNO_CODES.ENOTDIR);
          throw new Error('Parent must be a folder.');
        }
        if (!parent.write && !FS.ignorePermissions) {
          ___setErrNo(ERRNO_CODES.EACCES);
          throw new Error('Parent folder must be writeable.');
        }
        if (!name || name == '.' || name == '..') {
          ___setErrNo(ERRNO_CODES.ENOENT);
          throw new Error('Name must not be empty.');
        }
        if (parent.contents.hasOwnProperty(name)) {
          ___setErrNo(ERRNO_CODES.EEXIST);
          throw new Error("Can't overwrite object.");
        }
  
        parent.contents[name] = {
          read: canRead === undefined ? true : canRead,
          write: canWrite === undefined ? false : canWrite,
          timestamp: new Date(),
          inodeNumber: FS.nextInode++
        };
        for (var key in properties) {
          if (properties.hasOwnProperty(key)) {
            parent.contents[name][key] = properties[key];
          }
        }
  
        return parent.contents[name];
      }, createFolder: function (parent, name, canRead, canWrite) {
        var properties = {isFolder: true, isDevice: false, contents: {}};
        return FS.createObject(parent, name, properties, canRead, canWrite);
      }, createPath: function (parent, path, canRead, canWrite) {
        var current = FS.findObject(parent);
        if (current === null) throw new Error('Invalid parent.');
        path = path.split('/').reverse();
        while (path.length) {
          var part = path.pop();
          if (!part) continue;
          if (!current.contents.hasOwnProperty(part)) {
            FS.createFolder(current, part, canRead, canWrite);
          }
          current = current.contents[part];
        }
        return current;
      }, createFile: function (parent, name, properties, canRead, canWrite) {
        properties.isFolder = false;
        return FS.createObject(parent, name, properties, canRead, canWrite);
      }, createDataFile: function (parent, name, data, canRead, canWrite) {
        if (typeof data === 'string') {
          var dataArray = [];
          for (var i = 0; i < data.length; i++) dataArray.push(data.charCodeAt(i));
          data = dataArray;
        }
        var properties = {isDevice: false, contents: data};
        return FS.createFile(parent, name, properties, canRead, canWrite);
      }, createLazyFile: function (parent, name, url, canRead, canWrite) {
        var properties = {isDevice: false, url: url};
        return FS.createFile(parent, name, properties, canRead, canWrite);
      }, createLink: function (parent, name, target, canRead, canWrite) {
        var properties = {isDevice: false, link: target};
        return FS.createFile(parent, name, properties, canRead, canWrite);
      }, createDevice: function (parent, name, input, output) {
        if (!(input || output)) {
          throw new Error('A device must have at least one callback defined.');
        }
        var ops = {isDevice: true, input: input, output: output};
        return FS.createFile(parent, name, ops, Boolean(input), Boolean(output));
      }, forceLoadFile: function (obj) {
        if (obj.isDevice || obj.isFolder || obj.link ||
            'contents' in obj) return true;
        var success = true;
        if (typeof XMLHttpRequest !== 'undefined') {
          // Browser.
          // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
          var xhr = new XMLHttpRequest();
          xhr.open('GET', obj.url, false);
          xhr.responseType = 'arraybuffer'; // hint to the browser that we want binary data
          xhr.overrideMimeType('text/plain; charset=x-user-defined');  // another hint
          xhr.send(null);
          if (xhr.status != 200 && xhr.status != 0) success = false;
          if (xhr.response) {
            obj.contents = new Uint8Array(xhr.response);
          } else {
            obj.contents = intArrayFromString(xhr.responseText || '', true);
          }
        } else if (typeof read !== 'undefined') {
          // Command-line.
          try {
            obj.contents = intArrayFromString(read(obj.url), true);
          } catch (e) {
            success = false;
          }
        } else {
          throw new Error('Cannot load without read() or XMLHttpRequest.');
        }
        if (!success) ___setErrNo(ERRNO_CODES.EIO);
        return success;
      }, init: function (input, output, error) {
        // Make sure we initialize only once.
        if (FS.init.initialized) return;
        else FS.init.initialized = true;
  
        // Default handlers.
        if (!input) input = function() {
          if (!input.cache) {
            var result;
            if (window && typeof window.prompt == 'function') {
              // Browser.
              result = window.prompt('Input: ');
            } else if (typeof readline == 'function') {
              // Command line.
              result = readline();
            }
            if (!result) return null;
            input.cache = intArrayFromString(result + '\n', true);
          }
          return input.cache.shift();
        };
        if (!output) output = function(val) {
          if (!output.printer) {
            if (typeof print == 'function') {
              // Either console or custom print function defined.
              output.printer = print;
            } else if (console && typeof console.log == 'function') {
              // Browser-like environment with a console.
              output.printer = console.log;
            } else {
              // Fallback to a harmless no-op.
              output.printer = function() {};
            }
          }
          if (!output.buffer) output.buffer = [];
          if (val === null || val === '\n'.charCodeAt(0)) {
            output.printer(output.buffer.join(''));
            output.buffer = [];
          } else {
            output.buffer.push(String.fromCharCode(val));
          }
        };
        if (!error) error = output;
  
        // Create the temporary folder.
        FS.createFolder('/', 'tmp', true, true);
  
        // Create the I/O devices.
        var devFolder = FS.createFolder('/', 'dev', true, false);
        var stdin = FS.createDevice(devFolder, 'stdin', input);
        var stdout = FS.createDevice(devFolder, 'stdout', null, output);
        var stderr = FS.createDevice(devFolder, 'stderr', null, error);
        FS.createDevice(devFolder, 'tty', input, output);
  
        // Create default streams.
        FS.streams[1] = {
          path: '/dev/stdin',
          object: stdin,
          position: 0,
          isRead: true,
          isWrite: false,
          isAppend: false,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[2] = {
          path: '/dev/stdout',
          object: stdout,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          error: false,
          eof: false,
          ungotten: []
        };
        FS.streams[3] = {
          path: '/dev/stderr',
          object: stderr,
          position: 0,
          isRead: false,
          isWrite: true,
          isAppend: false,
          error: false,
          eof: false,
          ungotten: []
        };
        _stdin = allocate([1], 'void*', ALLOC_STATIC);
        _stdout = allocate([2], 'void*', ALLOC_STATIC);
        _stderr = allocate([3], 'void*', ALLOC_STATIC);
  
        // Once initialized, permissions start having effect.
        FS.ignorePermissions = false;
      } };
  
  var _close=function _close (fildes) {
      // int close(int fildes);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/close.html
      if (FS.streams[fildes]) {
        if (FS.streams[fildes].currentEntry) {
          _free(FS.streams[fildes].currentEntry);
        }
        delete FS.streams[fildes];
        return 0;
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    };
  
  
  
  var _fsync=function _fsync (fildes) {
      // int fsync(int fildes);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fsync.html
      if (FS.streams[fildes]) {
        // We write directly to the file system, so there's nothing to do here.
        return 0;
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    };var _fclose=function _fclose (stream) {
      // int fclose(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fclose.html
      _fsync(stream);
      return _close(stream);
    };
  
  
  
  
  
  
  
  
  
  
  var _pwrite=function _pwrite (fildes, buf, nbyte, offset) {
      // ssize_t pwrite(int fildes, const void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var contents = stream.object.contents;
        while (contents.length < offset) contents.push(0);
        for (var i = 0; i < nbyte; i++) {
          contents[offset + i] = (HEAP[buf+i]);
        }
        stream.object.timestamp = new Date();
        return i;
      }
    };var _write=function _write (fildes, buf, nbyte) {
      // ssize_t write(int fildes, const void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/write.html
      var stream = FS.streams[fildes];
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isWrite) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        if (stream.object.isDevice) {
          if (stream.object.output) {
            for (var i = 0; i < nbyte; i++) {
              try {
                stream.object.output((HEAP[buf+i]));
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
            }
            stream.object.timestamp = new Date();
            return i;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var bytesWritten = _pwrite(fildes, buf, nbyte, stream.position);
          if (bytesWritten != -1) stream.position += bytesWritten;
          return bytesWritten;
        }
      }
    };var _fwrite=function _fwrite (ptr, size, nitems, stream) {
      // size_t fwrite(const void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fwrite.html
      var bytesToWrite = nitems * size;
      if (bytesToWrite == 0) return 0;
      var bytesWritten = _write(stream, ptr, bytesToWrite);
      if (bytesWritten == -1) {
        if (FS.streams[stream]) FS.streams[stream].error = true;
        return -1;
      } else {
        return Math.floor(bytesWritten / size);
      }
    };
  
  var __formatString=function __formatString (isVarArgs, format/*, ...*/) {
      var textIndex = format;
      var argIndex = 0;
      var getNextArg;
      if (isVarArgs) {
        var varArgStart = arguments[2];
        getNextArg = function(type) {
          var ret;
          if (type === 'double') {
            ret = (HEAP[varArgStart+argIndex+7]<<56)|(HEAP[varArgStart+argIndex+6]<<48)|(HEAP[varArgStart+argIndex+5]<<40)|(HEAP[varArgStart+argIndex+4]<<32)|(HEAP[varArgStart+argIndex+3]<<24)|(HEAP[varArgStart+argIndex+2]<<16)|(HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else if (type === 'float') {
            ret = (HEAP[varArgStart+argIndex+3]<<24)|(HEAP[varArgStart+argIndex+2]<<16)|(HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else if (type === 'i64') {
            ret = (HEAP[varArgStart+argIndex+7]<<56)|(HEAP[varArgStart+argIndex+6]<<48)|(HEAP[varArgStart+argIndex+5]<<40)|(HEAP[varArgStart+argIndex+4]<<32)|(HEAP[varArgStart+argIndex+3]<<24)|(HEAP[varArgStart+argIndex+2]<<16)|(HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else if (type === 'i32') {
            ret = (HEAP[varArgStart+argIndex+3]<<24)|(HEAP[varArgStart+argIndex+2]<<16)|(HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else if (type === 'i16') {
            ret = (HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else if (type === 'i8') {
            ret = (HEAP[varArgStart+argIndex]);
          } else if (type[type.length - 1] === '*') {
            ret = (HEAP[varArgStart+argIndex+3]<<24)|(HEAP[varArgStart+argIndex+2]<<16)|(HEAP[varArgStart+argIndex+1]<<8)|(HEAP[varArgStart+argIndex]);
          } else {
            throw new Error('Unknown formatString argument type: ' + type);
          }
          argIndex += Runtime.getNativeFieldSize(type);
          return Number(ret);
        };
      } else {
        var args = arguments;
        getNextArg = function() {
          return Number(args[2 + argIndex++]);
        };
      }
  
      var ret = [];
      var curr, next, currArg;
      while(1) {
        var startTextIndex = textIndex;
        curr = (HEAP[textIndex]);
        if (curr === 0) break;
        next = (HEAP[textIndex+1]);
        if (curr == '%'.charCodeAt(0)) {
          // Handle flags.
          var flagAlwaysSigned = false;
          var flagLeftAlign = false;
          var flagAlternative = false;
          var flagZeroPad = false;
          flagsLoop: while (1) {
            switch (next) {
              case '+'.charCodeAt(0):
                flagAlwaysSigned = true;
                break;
              case '-'.charCodeAt(0):
                flagLeftAlign = true;
                break;
              case '#'.charCodeAt(0):
                flagAlternative = true;
                break;
              case '0'.charCodeAt(0):
                if (flagZeroPad) {
                  break flagsLoop;
                } else {
                  flagZeroPad = true;
                  break;
                }
              default:
                break flagsLoop;
            }
            textIndex++;
            next = (HEAP[textIndex+1]);
          }
  
          // Handle width.
          var width = 0;
          if (next == '*'.charCodeAt(0)) {
            width = getNextArg('i32');
            textIndex++;
            next = (HEAP[textIndex+1]);
          } else {
            while (next >= '0'.charCodeAt(0) && next <= '9'.charCodeAt(0)) {
              width = width * 10 + (next - '0'.charCodeAt(0));
              textIndex++;
              next = (HEAP[textIndex+1]);
            }
          }
  
          // Handle precision.
          var precisionSet = false;
          if (next == '.'.charCodeAt(0)) {
            var precision = 0;
            precisionSet = true;
            textIndex++;
            next = (HEAP[textIndex+1]);
            if (next == '*'.charCodeAt(0)) {
              precision = getNextArg('i32');
              textIndex++;
            } else {
              while(1) {
                var precisionChr = (HEAP[textIndex+1]);
                if (precisionChr < '0'.charCodeAt(0) ||
                    precisionChr > '9'.charCodeAt(0)) break;
                precision = precision * 10 + (precisionChr - '0'.charCodeAt(0));
                textIndex++;
              }
            }
            next = (HEAP[textIndex+1]);
          } else {
            var precision = 6; // Standard default.
          }
  
          // Handle integer sizes. WARNING: These assume a 32-bit architecture!
          var argSize;
          switch (String.fromCharCode(next)) {
            case 'h':
              var nextNext = (HEAP[textIndex+2]);
              if (nextNext == 'h'.charCodeAt(0)) {
                textIndex++;
                argSize = 1; // char
              } else {
                argSize = 2; // short
              }
              break;
            case 'l':
              var nextNext = (HEAP[textIndex+2]);
              if (nextNext == 'l'.charCodeAt(0)) {
                textIndex++;
                argSize = 8; // long long
              } else {
                argSize = 4; // long
              }
              break;
            case 'L': // long long
            case 'q': // int64_t
            case 'j': // intmax_t
              argSize = 8;
              break;
            case 'z': // size_t
            case 't': // ptrdiff_t
            case 'I': // signed ptrdiff_t or unsigned size_t
              argSize = 4;
              break;
            default:
              argSize = undefined;
          }
          if (argSize !== undefined) textIndex++;
          next = (HEAP[textIndex+1]);
  
          // Handle type specifier.
          if (['d', 'i', 'u', 'o', 'x', 'X', 'p'].indexOf(String.fromCharCode(next)) != -1) {
            // Integer.
            var signed = next == 'd'.charCodeAt(0) || next == 'i'.charCodeAt(0);
            argSize = argSize || 4;
            var currArg = getNextArg('i' + (argSize * 8));
            // Truncate to requested size.
            if (argSize <= 4) {
              var limit = Math.pow(256, argSize) - 1;
              currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8);
            }
            // Format the number.
            var currAbsArg = Math.abs(currArg);
            var argText;
            var prefix = '';
            if (next == 'd'.charCodeAt(0) || next == 'i'.charCodeAt(0)) {
              argText = currAbsArg.toString(10);
            } else if (next == 'u'.charCodeAt(0)) {
              argText = unSign(currArg, 8 * argSize).toString(10);
              currArg = Math.abs(currArg);
            } else if (next == 'o'.charCodeAt(0)) {
              argText = (flagAlternative ? '0' : '') + currAbsArg.toString(8);
            } else if (next == 'x'.charCodeAt(0) || next == 'X'.charCodeAt(0)) {
              prefix = flagAlternative ? '0x' : '';
              if (currArg < 0) {
                // Represent negative numbers in hex as 2's complement.
                currArg = -currArg;
                argText = (currAbsArg - 1).toString(16);
                var buffer = [];
                for (var i = 0; i < argText.length; i++) {
                  buffer.push((0xF - parseInt(argText[i], 16)).toString(16));
                }
                argText = buffer.join('');
                while (argText.length < argSize * 2) argText = 'f' + argText;
              } else {
                argText = currAbsArg.toString(16);
              }
              if (next == 'X'.charCodeAt(0)) {
                prefix = prefix.toUpperCase();
                argText = argText.toUpperCase();
              }
            } else if (next == 'p'.charCodeAt(0)) {
              if (currAbsArg === 0) {
                argText = '(nil)';
              } else {
                prefix = '0x';
                argText = currAbsArg.toString(16);
              }
            }
            if (precisionSet) {
              while (argText.length < precision) {
                argText = '0' + argText;
              }
            }
  
            // Add sign.
            if (currArg < 0) {
              prefix = '-' + prefix;
            } else if (flagAlwaysSigned) {
              prefix = '+' + prefix;
            }
  
            // Add padding.
            while (prefix.length + argText.length < width) {
              if (flagLeftAlign) {
                argText += ' ';
              } else {
                if (flagZeroPad) {
                  argText = '0' + argText;
                } else {
                  prefix = ' ' + prefix;
                }
              }
            }
  
            // Insert the result into the buffer.
            argText = prefix + argText;
            argText.split('').forEach(function(chr) {
              ret.push(chr.charCodeAt(0));
            });
          } else if (['f', 'F', 'e', 'E', 'g', 'G'].indexOf(String.fromCharCode(next)) != -1) {
            // Float.
            var currArg = getNextArg(argSize === 4 ? 'float' : 'double');
            var argText;
  
            if (isNaN(currArg)) {
              argText = 'nan';
              flagZeroPad = false;
            } else if (!isFinite(currArg)) {
              argText = (currArg < 0 ? '-' : '') + 'inf';
              flagZeroPad = false;
            } else {
              var isGeneral = false;
              var effectivePrecision = Math.min(precision, 20);
  
              // Convert g/G to f/F or e/E, as per:
              // http://pubs.opengroup.org/onlinepubs/9699919799/functions/printf.html
              if (next == 'g'.charCodeAt(0) || next == 'G'.charCodeAt(0)) {
                isGeneral = true;
                precision = precision || 1;
                var exponent = parseInt(currArg.toExponential(effectivePrecision).split('e')[1], 10);
                if (precision > exponent && exponent >= -4) {
                  next = ((next == 'g'.charCodeAt(0)) ? 'f' : 'F').charCodeAt(0);
                  precision -= exponent + 1;
                } else {
                  next = ((next == 'g'.charCodeAt(0)) ? 'e' : 'E').charCodeAt(0);
                  precision--;
                }
                effectivePrecision = Math.min(precision, 20);
              }
  
              if (next == 'e'.charCodeAt(0) || next == 'E'.charCodeAt(0)) {
                argText = currArg.toExponential(effectivePrecision);
                // Make sure the exponent has at least 2 digits.
                if (/[eE][-+]\d$/.test(argText)) {
                  argText = argText.slice(0, -1) + '0' + argText.slice(-1);
                }
              } else if (next == 'f'.charCodeAt(0) || next == 'F'.charCodeAt(0)) {
                argText = currArg.toFixed(effectivePrecision);
              }
  
              var parts = argText.split('e');
              if (isGeneral && !flagAlternative) {
                // Discard trailing zeros and periods.
                while (parts[0].length > 1 && parts[0].indexOf('.') != -1 &&
                       (parts[0].slice(-1) == '0' || parts[0].slice(-1) == '.')) {
                  parts[0] = parts[0].slice(0, -1);
                }
              } else {
                // Make sure we have a period in alternative mode.
                if (flagAlternative && argText.indexOf('.') == -1) parts[0] += '.';
                // Zero pad until required precision.
                while (precision > effectivePrecision++) parts[0] += '0';
              }
              argText = parts[0] + (parts.length > 1 ? 'e' + parts[1] : '');
  
              // Capitalize 'E' if needed.
              if (next == 'E'.charCodeAt(0)) argText = argText.toUpperCase();
  
              // Add sign.
              if (flagAlwaysSigned && currArg >= 0) {
                argText = '+' + argText;
              }
            }
  
            // Add padding.
            while (argText.length < width) {
              if (flagLeftAlign) {
                argText += ' ';
              } else {
                if (flagZeroPad && (argText[0] == '-' || argText[0] == '+')) {
                  argText = argText[0] + '0' + argText.slice(1);
                } else {
                  argText = (flagZeroPad ? '0' : ' ') + argText;
                }
              }
            }
  
            // Adjust case.
            if (next < 'a'.charCodeAt(0)) argText = argText.toUpperCase();
  
            // Insert the result into the buffer.
            argText.split('').forEach(function(chr) {
              ret.push(chr.charCodeAt(0));
            });
          } else if (next == 's'.charCodeAt(0)) {
            // String.
            var arg = getNextArg('i8*');
            var copiedString;
            if (arg) {
              copiedString = String_copy(arg);
              if (precisionSet && copiedString.length > precision) {
                copiedString = copiedString.slice(0, precision);
              }
            } else {
              copiedString = intArrayFromString('(null)', true);
            }
            if (!flagLeftAlign) {
              while (copiedString.length < width--) {
                ret.push(' '.charCodeAt(0));
              }
            }
            ret = ret.concat(copiedString);
            if (flagLeftAlign) {
              while (copiedString.length < width--) {
                ret.push(' '.charCodeAt(0));
              }
            }
          } else if (next == 'c'.charCodeAt(0)) {
            // Character.
            if (flagLeftAlign) ret.push(getNextArg('i8'));
            while (--width > 0) {
              ret.push(' '.charCodeAt(0));
            }
            if (!flagLeftAlign) ret.push(getNextArg('i8'));
          } else if (next == 'n'.charCodeAt(0)) {
            // Write the length written so far to the next parameter.
            var ptr = getNextArg('i32*');
             HEAP[ptr+3] = (ret.length>>24)&0xff; HEAP[ptr+2] = (ret.length>>16)&0xff; HEAP[ptr+1] = (ret.length>>8)&0xff; HEAP[ptr] = (ret.length)&0xff;
          } else if (next == '%'.charCodeAt(0)) {
            // Literal percent sign.
            ret.push(curr);
          } else {
            // Unknown specifiers remain untouched.
            for (var i = startTextIndex; i < textIndex + 2; i++) {
              ret.push((HEAP[i]));
            }
          }
          textIndex += 2;
          // TODO: Support a/A (hex float) and m (last error) specifiers.
          // TODO: Support %1${specifier} for arg selection.
        } else {
          ret.push(curr);
          textIndex += 1;
        }
      }
      return ret;
    };var _fprintf=function _fprintf (stream, format/*, ... */) {
      // int fprintf(FILE *restrict stream, const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var args = Array.prototype.slice.call(arguments, 1);
      args.unshift(false);
      var result = __formatString.apply(null, args);
      var buffer = allocate(result, 'i8', ALLOC_NORMAL);
      var ret = _fwrite(buffer, 1, result.length, stream);
      _free(buffer);
      return ret;
    };var _printf=function _printf (format/*, ... */) {
      // int printf(const char *restrict format, ...);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/printf.html
      var args = Array.prototype.slice.call(arguments, 0);
      args.unshift((HEAP[_stdout+3]<<24)|(HEAP[_stdout+2]<<16)|(HEAP[_stdout+1]<<8)|(HEAP[_stdout]));
      return _fprintf.apply(null, args);
    };
  var _strpbrk=function _strpbrk (ptr1, ptr2) {
      var searchSet = Runtime.set.apply(null, String_copy(ptr2));
      while ((HEAP[ptr1])) {
        if ((HEAP[ptr1]) in searchSet) return ptr1;
        ptr1++;
      }
      return 0;
    };
  
  
  
  var _strlen=function _strlen (ptr) {
      return String_len(ptr);
    };var _fputs=function _fputs (s, stream) {
      // int fputs(const char *restrict s, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputs.html
      return _write(stream, s, _strlen(s));
    };
  
  var _fputc=function _fputc (c, stream) {
      // int fputc(int c, FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fputc.html
      if (!_fputc.buffer) _fputc.buffer = _malloc(1);
      var chr = unSign(c & 0xFF);
       HEAP[_fputc.buffer] = (chr)&0xff;
      var ret = _write(stream, _fputc.buffer, 1);
      if (ret == -1) {
        if (stream in FS.streams) FS.streams[stream].error = true;
        return -1;
      } else {
        return chr;
      }
    };
  var _puts=function _puts (s) {
      // int puts(const char *s);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/puts.html
      // NOTE: puts() always writes an extra newline.
      var stdout = (HEAP[_stdout+3]<<24)|(HEAP[_stdout+2]<<16)|(HEAP[_stdout+1]<<8)|(HEAP[_stdout]);
      var ret = _fputs(s, stdout);
      if (ret < 0) {
        return ret;
      } else {
        var newlineRet = _fputc('\n'.charCodeAt(0), stdout);
        return (newlineRet < 0) ? -1 : ret + 1;
      }
    };
  var _atol=function _atol (ascii) {
      return parseInt(Pointer_stringify(ascii), 10);
    };
  var _strncmp=function _strncmp (px, py, n) {
      var i = 0;
      while (i < n) {
        var x = (HEAP[px+i]);
        var y = (HEAP[py+i]);
        if (x == y && x == 0) return 0;
        if (x == 0) return -1;
        if (y == 0) return 1;
        if (x == y) {
          i ++;
          continue;
        } else {
          return x > y ? 1 : -1;
        }
      }
      return 0;
    };
  var _strcmp=function _strcmp (px, py) {
      return _strncmp(px, py, TOTAL_MEMORY);
    };
  var _llvm_objectsize_i32=function _llvm_objectsize_i32 (obj, type) {
      return -1;
    };
  
  var _memcpy=function _memcpy (dest, src, num, idunno) {
      assert(num % 1 === 0, 'memcpy given ' + num + ' bytes to copy. Problem with 4=1 corrections perhaps?');
      // || 0, since memcpy sometimes copies uninitialized areas XXX: Investigate why initializing alloc'ed memory does not fix that too
      for (var $mcpi$ = 0; $mcpi$ < num; $mcpi$++) {
  HEAP[dest+$mcpi$]=HEAP[src+$mcpi$]; 
  };
    };var ___memcpy_chk=_memcpy;
  var _malloc=function staticAlloc(size) { var ret = STATICTOP; assert(size > 0, "Trying to allocate 0"); STATICTOP += size;STATICTOP = Math.ceil((STATICTOP)/4)*4;; return ret; };
  
  var _memset=function _memset (ptr, value, num) {
      for (var $mspi$ = 0; $mspi$ < num; $mspi$++) {
  ;
  }
    };var ___memset_chk=_memset;
  var _free=function _free (){};
  
  
  
  
  
  
  
  
  
  var ___dirent_struct_layout=null;var _open=function _open (path, oflag, mode) {
      // int open(const char *path, int oflag, ...);
      // http://pubs.opengroup.org/onlinepubs/009695399/functions/open.html
      // NOTE: This implementation tries to mimic glibc rather that strictly
      // following the POSIX standard.
  
      // Simplify flags.
      var accessMode = oflag & 0x3;  // O_ACCMODE.
      var isWrite = accessMode != 0x0;  // O_RDONLY.
      var isRead = accessMode != 0x1;  // O_WRONLY.
      var isCreate = Boolean(oflag & 0x40);  // O_CREAT.
      var isExistCheck = Boolean(oflag & 0x80);  // O_EXCL.
      var isTruncate = Boolean(oflag & 0x200);  // O_TRUNC.
      var isAppend = Boolean(oflag & 0x400);  // O_APPEND.
  
      // Verify path.
      var origPath = path;
      path = FS.analyzePath(Pointer_stringify(path));
      if (!path.parentExists) {
        ___setErrNo(path.error);
        return -1;
      }
      var target = path.object || null;
  
      // Verify the file exists, create if needed and allowed.
      if (target) {
        if (isCreate && isExistCheck) {
          ___setErrNo(ERRNO_CODES.EEXIST);
          return -1;
        }
        if ((isWrite || isCreate || isTruncate) && target.isFolder) {
          ___setErrNo(ERRNO_CODES.EISDIR);
          return -1;
        }
        if (isRead && !target.read || isWrite && !target.write) {
          ___setErrNo(ERRNO_CODES.EACCES);
          return -1;
        }
        if (isTruncate && !target.isDevice) {
          target.contents = [];
        } else {
          if (!FS.forceLoadFile(target)) {
            ___setErrNo(ERRNO_CODES.EIO);
            return -1;
          }
        }
      } else {
        if (!isCreate) {
          ___setErrNo(ERRNO_CODES.ENOENT);
          return -1;
        }
        if (!path.parentObject.write) {
          ___setErrNo(ERRNO_CODES.EACCES);
          return -1;
        }
        target = FS.createDataFile(path.parentObject, path.name, [],
                                   mode & 0x100, mode & 0x80);  // S_IRUSR, S_IWUSR.
      }
      // Actually create an open stream.
      var id = FS.streams.length;
      if (target.isFolder) {
        var entryBuffer = 0;
        if (___dirent_struct_layout) {
          entryBuffer = _malloc(___dirent_struct_layout.__size__);
        }
        var contents = [];
        for (var key in target.contents) contents.push(key);
        FS.streams[id] = {
          path: path.path,
          object: target,
          // An index into contents. Special values: -2 is ".", -1 is "..".
          position: -2,
          isRead: true,
          isWrite: false,
          isAppend: false,
          error: false,
          eof: false,
          ungotten: [],
          // Folder-specific properties:
          // Remember the contents at the time of opening in an array, so we can
          // seek between them relying on a single order.
          contents: contents,
          // Each stream has its own area for readdir() returns.
          currentEntry: entryBuffer
        };
      } else {
        FS.streams[id] = {
          path: path.path,
          object: target,
          position: 0,
          isRead: isRead,
          isWrite: isWrite,
          isAppend: isAppend,
          error: false,
          eof: false,
          ungotten: []
        };
      }
      return id;
    };var _fopen=function _fopen (filename, mode) {
      // FILE *fopen(const char *restrict filename, const char *restrict mode);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fopen.html
      var flags;
      mode = Pointer_stringify(mode);
      if (mode[0] == 'r') {
        if (mode.indexOf('+') != -1) {
          flags = 0x2;  // O_RDWR
        } else {
          flags = 0x0;  // O_RDONLY
        }
      } else if (mode[0] == 'w') {
        if (mode.indexOf('+') != -1) {
          flags = 0x2;  // O_RDWR
        } else {
          flags = 0x1;  // O_WRONLY
        }
        flags |= 0x40;  // O_CREAT
        flags |= 0x200;  // O_TRUNC
      } else if (mode[0] == 'a') {
        if (mode.indexOf('+') != -1) {
          flags = 0x2;  // O_RDWR
        } else {
          flags = 0x1;  // O_WRONLY
        }
        flags |= 0x40;  // O_CREAT
        flags |= 0x400;  // O_APPEND
      } else {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return 0;
      }
      var ret = _open(filename, flags, 0x1FF);  // All creation permissions.
      return (ret == -1) ? 0 : ret;
    };
  
  
  
  var ___01_fopen$UNIX2003_=_fopen;
  
  
  
  
  var _lseek=function _lseek (fildes, offset, whence) {
      // off_t lseek(int fildes, off_t offset, int whence);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/lseek.html
      if (FS.streams[fildes] && !FS.streams[fildes].isDevice) {
        var stream = FS.streams[fildes];
        var position = offset;
        if (whence === 1) {  // SEEK_CUR.
          position += stream.position;
        } else if (whence === 2) {  // SEEK_END.
          position += stream.object.contents.length;
        }
        if (position < 0) {
          ___setErrNo(ERRNO_CODES.EINVAL);
          return -1;
        } else {
          stream.ungotten = [];
          stream.position = position;
          return position;
        }
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    };var _fseek=function _fseek (stream, offset, whence) {
      // int fseek(FILE *stream, long offset, int whence);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fseek.html
      var ret = _lseek(stream, offset, whence);
      if (ret == -1) {
        return -1;
      } else {
        FS.streams[stream].eof = false;
        return 0;
      }
    };
  
  
  
  
  
  
  
  
  var _pread=function _pread (fildes, buf, nbyte, offset) {
      // ssize_t pread(int fildes, void *buf, size_t nbyte, off_t offset);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (!stream || stream.object.isDevice) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (stream.object.isFolder) {
        ___setErrNo(ERRNO_CODES.EISDIR);
        return -1;
      } else if (nbyte < 0 || offset < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead = 0;
        while (stream.ungotten.length && nbyte > 0) {
           HEAP[buf++] = (stream.ungotten.pop())&0xff;
          nbyte--;
          bytesRead++;
        }
        var contents = stream.object.contents;
        var size = Math.min(contents.length - offset, nbyte);
        for (var i = 0; i < size; i++) {
           HEAP[buf+i] = (contents[offset + i])&0xff;
          bytesRead++;
        }
        return bytesRead;
      }
    };var _read=function _read (fildes, buf, nbyte) {
      // ssize_t read(int fildes, void *buf, size_t nbyte);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/read.html
      var stream = FS.streams[fildes];
      if (!stream) {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      } else if (!stream.isRead) {
        ___setErrNo(ERRNO_CODES.EACCES);
        return -1;
      } else if (nbyte < 0) {
        ___setErrNo(ERRNO_CODES.EINVAL);
        return -1;
      } else {
        var bytesRead;
        if (stream.object.isDevice) {
          if (stream.object.input) {
            bytesRead = 0;
            while (stream.ungotten.length && nbyte > 0) {
               HEAP[buf++] = (stream.ungotten.pop())&0xff;
              nbyte--;
              bytesRead++;
            }
            for (var i = 0; i < nbyte; i++) {
              try {
                var result = stream.object.input();
              } catch (e) {
                ___setErrNo(ERRNO_CODES.EIO);
                return -1;
              }
              if (result === null || result === undefined) break;
              bytesRead++;
               HEAP[buf+i] = (result)&0xff;
            }
            return bytesRead;
          } else {
            ___setErrNo(ERRNO_CODES.ENXIO);
            return -1;
          }
        } else {
          var ungotSize = stream.ungotten.length;
          bytesRead = _pread(fildes, buf, nbyte, stream.position);
          if (bytesRead != -1) {
            stream.position += (stream.ungotten.length - ungotSize) + bytesRead;
          }
          return bytesRead;
        }
      }
    };var _fread=function _fread (ptr, size, nitems, stream) {
      // size_t fread(void *restrict ptr, size_t size, size_t nitems, FILE *restrict stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/fread.html
      var bytesToRead = nitems * size;
      if (bytesToRead == 0) return 0;
      var bytesRead = _read(stream, ptr, bytesToRead);
      var streamObj = FS.streams[stream];
      if (bytesRead == -1) {
        if (streamObj) streamObj.error = true;
        return -1;
      } else {
        if (bytesRead < bytesToRead) streamObj.eof = true;
        return Math.floor(bytesRead / size);
      }
    };
  var _strdup=function _strdup (ptr) {
      return allocate(String_copy(ptr, true), 'i8', ALLOC_NORMAL);
    };
  
  var _strncpy=function _strncpy (pdest, psrc, num) {
      var padding = false, curr;
      for (var i = 0; i < num; i++) {
        curr = padding ? 0 : (HEAP[psrc+i]);
         HEAP[pdest+i] = (curr)&0xff;
        padding = padding || (HEAP[psrc+i]) == 0;
      }
      return pdest;
    };var ___strncpy_chk=_strncpy;
  
  var _strcpy=function _strcpy (pdest, psrc) {
      var i = 0;
      do {
        for (var $mcpi$ = 0; $mcpi$ < 1; $mcpi$++) {
   HEAP[pdest+i+$mcpi$] = ((HEAP[psrc+i+$mcpi$]))&0xff;
  }
        i ++;
      } while ((HEAP[psrc+i-1]) != 0);
      return pdest;
    };var ___strcpy_chk=_strcpy;
  
  
  var _ftell=function _ftell (stream) {
      // long ftell(FILE *stream);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/ftell.html
      if (stream in FS.streams) {
        stream = FS.streams[stream];
        if (stream.object.isDevice) {
          ___setErrNo(ERRNO_CODES.ESPIPE);
          return -1;
        } else {
          return stream.position;
        }
      } else {
        ___setErrNo(ERRNO_CODES.EBADF);
        return -1;
      }
    };
  var _llvm_bswap_i32=function _llvm_bswap_i32 (x) {
      x = unSign(x, 32);
      var bytes = [];
      for (var i = 0; i < 4; i++) {
        bytes[i] = x & 255;
        x >>= 8;
      }
      var ret = 0;
      for (i = 0; i < 4; i++) {
        ret <<= 8;
        ret += bytes[i];
      }
      return ret;
    };
  function _emit_image($hyp, $index) {
    var __stackBase__  = STACKTOP; STACKTOP += 28; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 28);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $index_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $0=__stackBase__+12;
        var $img=__stackBase__+16;
        var $fp=__stackBase__+20;
        var $res=__stackBase__+24;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$index_addr+3] = ($index>>24)&0xff; HEAP[$index_addr+2] = ($index>>16)&0xff; HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
        var $1=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $2=((($1)) & 65535);
        var $3=unSign(($2), 16, 0);
        var $4=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $5=((($3)) & 65535);
        var $6=_hyp_parse_image_data($4, $5);
         HEAP[$img+3] = ($6>>24)&0xff; HEAP[$img+2] = ($6>>16)&0xff; HEAP[$img+1] = ($6>>8)&0xff; HEAP[$img] = ($6)&0xff;
        var $7=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $8=($7)!=0;
        if ($8) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $9=(HEAP[___stdoutp+3]<<24)|(HEAP[___stdoutp+2]<<16)|(HEAP[___stdoutp+1]<<8)|(HEAP[___stdoutp]);
        var $10=_fileno($9);
        var $11=___01_fdopen$UNIX2003_($10, ((__str)&4294967295));
         HEAP[$fp+3] = ($11>>24)&0xff; HEAP[$fp+2] = ($11>>16)&0xff; HEAP[$fp+1] = ($11>>8)&0xff; HEAP[$fp] = ($11)&0xff;
         HEAP[$res+3] = (0>>24)&0xff; HEAP[$res+2] = (0>>16)&0xff; HEAP[$res+1] = (0>>8)&0xff; HEAP[$res] = (0)&0xff;
        var $12=(HEAP[$fp+3]<<24)|(HEAP[$fp+2]<<16)|(HEAP[$fp+1]<<8)|(HEAP[$fp]);
        var $13=_fclose($12);
        var $14=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        _hyp_free_image_data($14);
        var $15=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        _hyp_free($15);
        var $16=(HEAP[$res+3]<<24)|(HEAP[$res+2]<<16)|(HEAP[$res+1]<<8)|(HEAP[$res]);
         HEAP[$0+3] = ($16>>24)&0xff; HEAP[$0+2] = ($16>>16)&0xff; HEAP[$0+1] = ($16>>8)&0xff; HEAP[$0] = ($16)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
         HEAP[$0+3] = (10>>24)&0xff; HEAP[$0+2] = (10>>16)&0xff; HEAP[$0+1] = (10>>8)&0xff; HEAP[$0] = (10)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $17=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($17>>24)&0xff; HEAP[$retval+2] = ($17>>16)&0xff; HEAP[$retval+1] = ($17>>8)&0xff; HEAP[$retval] = ($17)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _emit_quoted($s) {
    var __stackBase__  = STACKTOP; STACKTOP += 9; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 9);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $s_addr=__stackBase__;
        var $t=__stackBase__+4;
        var $c=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$s_addr+3] = ($s>>24)&0xff; HEAP[$s_addr+2] = ($s>>16)&0xff; HEAP[$s_addr+1] = ($s>>8)&0xff; HEAP[$s_addr] = ($s)&0xff;
        __label__ = 8; break;
      case 1: // $bb
        var $0=(HEAP[$t+3]<<24)|(HEAP[$t+2]<<16)|(HEAP[$t+1]<<8)|(HEAP[$t]);
        var $1=(HEAP[$0]);
         HEAP[$c] = ($1)&0xff;
        var $2=(HEAP[$t+3]<<24)|(HEAP[$t+2]<<16)|(HEAP[$t+1]<<8)|(HEAP[$t]);
         HEAP[$2] = (0)&0xff;
        var $3=(HEAP[$s_addr+3]<<24)|(HEAP[$s_addr+2]<<16)|(HEAP[$s_addr+1]<<8)|(HEAP[$s_addr]);
        var $4=_printf(((__str1)&4294967295), $3);
        var $5=(HEAP[$c]);
        var $6=reSign(($5), 8, 0);
        if ($6 == 34) {
          __label__ = 6; break;
        }
        else if ($6 == 38) {
          __label__ = 4; break;
        }
        else if ($6 == 39) {
          __label__ = 5; break;
        }
        else if ($6 == 60) {
          __label__ = 2; break;
        }
        else if ($6 == 62) {
          __label__ = 3; break;
        }
        else {
        __label__ = 7; break;
        }
        
      case 2: // $bb1
        var $7=_printf(((__str2)&4294967295));
        __label__ = 7; break;
      case 3: // $bb2
        var $8=_printf(((__str3)&4294967295));
        __label__ = 7; break;
      case 4: // $bb3
        var $9=_printf(((__str4)&4294967295));
        __label__ = 7; break;
      case 5: // $bb4
        var $10=_printf(((__str5)&4294967295));
        __label__ = 7; break;
      case 6: // $bb5
        var $11=_printf(((__str6)&4294967295));
        __label__ = 7; break;
      case 7: // $bb6
        var $12=(HEAP[$t+3]<<24)|(HEAP[$t+2]<<16)|(HEAP[$t+1]<<8)|(HEAP[$t]);
        var $13=(HEAP[$c]);
         HEAP[$12] = ($13)&0xff;
        var $14=(HEAP[$t+3]<<24)|(HEAP[$t+2]<<16)|(HEAP[$t+1]<<8)|(HEAP[$t]);
        var $15=(($14+1)&4294967295);
         HEAP[$s_addr+3] = ($15>>24)&0xff; HEAP[$s_addr+2] = ($15>>16)&0xff; HEAP[$s_addr+1] = ($15>>8)&0xff; HEAP[$s_addr] = ($15)&0xff;
        __label__ = 8; break;
      case 8: // $bb7
        var $16=(HEAP[$s_addr+3]<<24)|(HEAP[$s_addr+2]<<16)|(HEAP[$s_addr+1]<<8)|(HEAP[$s_addr]);
        var $17=_strpbrk($16, ((__str7)&4294967295));
         HEAP[$t+3] = ($17>>24)&0xff; HEAP[$t+2] = ($17>>16)&0xff; HEAP[$t+1] = ($17>>8)&0xff; HEAP[$t] = ($17)&0xff;
        var $18=(HEAP[$t+3]<<24)|(HEAP[$t+2]<<16)|(HEAP[$t+1]<<8)|(HEAP[$t]);
        var $19=($18)!=0;
        if ($19) { __label__ = 1; break; } else { __label__ = 9; break; }
      case 9: // $bb8
        var $20=(HEAP[$s_addr+3]<<24)|(HEAP[$s_addr+2]<<16)|(HEAP[$s_addr+1]<<8)|(HEAP[$s_addr]);
        var $21=_printf(((__str1)&4294967295), $20);
        __label__ = 10; break;
      case 10: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _emit_node($hyp, $index) {
    var __stackBase__  = STACKTOP; STACKTOP += 48; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 48);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $index_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $0=__stackBase__+12;
        var $iftmp_23=__stackBase__+16;
        var $iftmp_1=__stackBase__+20;
        var $node=__stackBase__+24;
        var $first=__stackBase__+28;
        var $ie=__stackBase__+32;
        var $item=__stackBase__+36;
        var $extnode=__stackBase__+40;
        var $img=__stackBase__+44;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$index_addr+3] = ($index>>24)&0xff; HEAP[$index_addr+2] = ($index>>16)&0xff; HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
        var $1=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $2=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $3=_hyp_parse_node($1, $2);
         HEAP[$node+3] = ($3>>24)&0xff; HEAP[$node+2] = ($3>>16)&0xff; HEAP[$node+1] = ($3>>8)&0xff; HEAP[$node] = ($3)&0xff;
        var $4=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $5=($4)!=0;
        if ($5) { __label__ = 1; break; } else { __label__ = 31; break; }
      case 1: // $bb
         HEAP[$first+3] = (1>>24)&0xff; HEAP[$first+2] = (1>>16)&0xff; HEAP[$first+1] = (1>>8)&0xff; HEAP[$first] = (1)&0xff;
        var $6=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $7=(($6+16)&4294967295);
        var $8=(HEAP[$7+3]<<24)|(HEAP[$7+2]<<16)|(HEAP[$7+1]<<8)|(HEAP[$7]);
        var $9=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $10=(($8+24*$9)&4294967295);
         HEAP[$ie+3] = ($10>>24)&0xff; HEAP[$ie+2] = ($10>>16)&0xff; HEAP[$ie+1] = ($10>>8)&0xff; HEAP[$ie] = ($10)&0xff;
        var $11=_printf(((__str8)&4294967295));
        var $12=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $13=(($12+4)&4294967295);
        var $14=(HEAP[$13+3]<<24)|(HEAP[$13+2]<<16)|(HEAP[$13+1]<<8)|(HEAP[$13]);
        var $15=($14)!=0;
        if ($15) { __label__ = 2; break; } else { __label__ = 3; break; }
      case 2: // $bb1
        var $16=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $17=(($16+4)&4294967295);
        var $18=(HEAP[$17+3]<<24)|(HEAP[$17+2]<<16)|(HEAP[$17+1]<<8)|(HEAP[$17]);
         HEAP[$iftmp_1+3] = ($18>>24)&0xff; HEAP[$iftmp_1+2] = ($18>>16)&0xff; HEAP[$iftmp_1+1] = ($18>>8)&0xff; HEAP[$iftmp_1] = ($18)&0xff;
        __label__ = 4; break;
      case 3: // $bb2
        var $19=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $20=(($19)&4294967295);
        var $21=(HEAP[$20+3]<<24)|(HEAP[$20+2]<<16)|(HEAP[$20+1]<<8)|(HEAP[$20]);
         HEAP[$iftmp_1+3] = ($21>>24)&0xff; HEAP[$iftmp_1+2] = ($21>>16)&0xff; HEAP[$iftmp_1+1] = ($21>>8)&0xff; HEAP[$iftmp_1] = ($21)&0xff;
        __label__ = 4; break;
      case 4: // $bb3
        var $22=(HEAP[$iftmp_1+3]<<24)|(HEAP[$iftmp_1+2]<<16)|(HEAP[$iftmp_1+1]<<8)|(HEAP[$iftmp_1]);
        _emit_quoted($22);
        var $23=_puts(((__str9)&4294967295));
        var $24=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $25=(($24+20)&4294967295);
        var $26=(($25+36)&4294967295);
        var $27=(HEAP[$26+3]<<24)|(HEAP[$26+2]<<16)|(HEAP[$26+1]<<8)|(HEAP[$26]);
        var $28=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $29=(($28+16)&4294967295);
        var $30=(HEAP[$29+1]<<8)|(HEAP[$29]);
        var $31=unSign(($30), 16, 0);
        var $32=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $33=(($32+12)&4294967295);
        var $34=(HEAP[$33+1]<<8)|(HEAP[$33]);
        var $35=unSign(($34), 16, 0);
        var $36=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $37=(($36+14)&4294967295);
        var $38=(HEAP[$37+1]<<8)|(HEAP[$37]);
        var $39=unSign(($38), 16, 0);
        var $40=_printf(((__str10)&4294967295), $39, $35, $31, $27);
        var $41=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $42=_hyp_node_item_first($41);
         HEAP[$item+3] = ($42>>24)&0xff; HEAP[$item+2] = ($42>>16)&0xff; HEAP[$item+1] = ($42>>8)&0xff; HEAP[$item] = ($42)&0xff;
        __label__ = 28; break;
      case 5: // $bb4
        var $43=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $44=(($43+8)&4294967295);
        var $45=(HEAP[$44+1]<<8)|(HEAP[$44]);
        var $46=reSign(($45), 16, 0);
        if ($46 == 1) {
          __label__ = 6; break;
        }
        else if ($46 == 2) {
          __label__ = 17; break;
        }
        else if ($46 == 3) {
          __label__ = 9; break;
        }
        else if ($46 == 4) {
          __label__ = 20; break;
        }
        else if ($46 == 5) {
          __label__ = 21; break;
        }
        else if ($46 == 6) {
          __label__ = 22; break;
        }
        else {
        __label__ = 27; break;
        }
        
      case 6: // $bb5
        var $47=(HEAP[$first+3]<<24)|(HEAP[$first+2]<<16)|(HEAP[$first+1]<<8)|(HEAP[$first]);
        var $48=((($47))|0)!=0;
        if ($48) { __label__ = 7; break; } else { __label__ = 8; break; }
      case 7: // $bb6
        var $49=_puts(((__str11)&4294967295));
         HEAP[$first+3] = (0>>24)&0xff; HEAP[$first+2] = (0>>16)&0xff; HEAP[$first+1] = (0>>8)&0xff; HEAP[$first] = (0)&0xff;
        __label__ = 8; break;
      case 8: // $bb7
        var $50=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $51=$50;
        var $52=(($51+12)&4294967295);
        var $53=(HEAP[$52+3]<<24)|(HEAP[$52+2]<<16)|(HEAP[$52+1]<<8)|(HEAP[$52]);
        _emit_quoted($53);
        __label__ = 27; break;
      case 9: // $bb8
        var $54=(HEAP[$first+3]<<24)|(HEAP[$first+2]<<16)|(HEAP[$first+1]<<8)|(HEAP[$first]);
        var $55=((($54))|0)!=0;
        if ($55) { __label__ = 10; break; } else { __label__ = 11; break; }
      case 10: // $bb9
        var $56=_puts(((__str11)&4294967295));
         HEAP[$first+3] = (0>>24)&0xff; HEAP[$first+2] = (0>>16)&0xff; HEAP[$first+1] = (0>>8)&0xff; HEAP[$first] = (0)&0xff;
        __label__ = 11; break;
      case 11: // $bb10
        var $57=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $58=(($57+16)&4294967295);
        var $59=(HEAP[$58+3]<<24)|(HEAP[$58+2]<<16)|(HEAP[$58+1]<<8)|(HEAP[$58]);
        var $60=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $61=$60;
        var $62=(($61+12)&4294967295);
        var $63=(HEAP[$62+1]<<8)|(HEAP[$62]);
        var $64=unSign(($63), 16, 0);
        var $65=(($59+24*$64)&4294967295);
        var $66=(($65)&4294967295);
        var $67=(HEAP[$66]);
        var $68=reSign(($67), 8, 0)==2;
        if ($68) { __label__ = 12; break; } else { __label__ = 15; break; }
      case 12: // $bb11
        var $69=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $70=$69;
        var $71=(($70+12)&4294967295);
        var $72=(HEAP[$71+1]<<8)|(HEAP[$71]);
        var $73=unSign(($72), 16, 0);
        var $74=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $75=_hyp_parse_node($74, $73);
         HEAP[$extnode+3] = ($75>>24)&0xff; HEAP[$extnode+2] = ($75>>16)&0xff; HEAP[$extnode+1] = ($75>>8)&0xff; HEAP[$extnode] = ($75)&0xff;
        var $76=(HEAP[$extnode+3]<<24)|(HEAP[$extnode+2]<<16)|(HEAP[$extnode+1]<<8)|(HEAP[$extnode]);
        var $77=($76)==0;
        if ($77) { __label__ = 13; break; } else { __label__ = 14; break; }
      case 13: // $bb12
        var $78=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $79=$78;
        var $80=(($79+16)&4294967295);
        var $81=(HEAP[$80+3]<<24)|(HEAP[$80+2]<<16)|(HEAP[$80+1]<<8)|(HEAP[$80]);
        _emit_quoted($81);
        __label__ = 27; break;
      case 14: // $bb13
        var $82=(HEAP[$extnode+3]<<24)|(HEAP[$extnode+2]<<16)|(HEAP[$extnode+1]<<8)|(HEAP[$extnode]);
        var $83=(($82)&4294967295);
        var $84=(HEAP[$83+3]<<24)|(HEAP[$83+2]<<16)|(HEAP[$83+1]<<8)|(HEAP[$83]);
        var $85=_printf(((__str12)&4294967295), $84);
        var $86=(HEAP[$extnode+3]<<24)|(HEAP[$extnode+2]<<16)|(HEAP[$extnode+1]<<8)|(HEAP[$extnode]);
        _hyp_free_node($86);
        __label__ = 16; break;
      case 15: // $bb14
        var $87=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $88=$87;
        var $89=(($88+14)&4294967295);
        var $90=(HEAP[$89+1]<<8)|(HEAP[$89]);
        var $91=unSign(($90), 16, 0);
        var $92=((($91) + 1)&4294967295);
        var $93=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $94=$93;
        var $95=(($94+12)&4294967295);
        var $96=(HEAP[$95+1]<<8)|(HEAP[$95]);
        var $97=unSign(($96), 16, 0);
        var $98=_printf(((__str13)&4294967295), $97, $92);
        __label__ = 16; break;
      case 16: // $bb15
        var $99=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $100=$99;
        var $101=(($100+16)&4294967295);
        var $102=(HEAP[$101+3]<<24)|(HEAP[$101+2]<<16)|(HEAP[$101+1]<<8)|(HEAP[$101]);
        _emit_quoted($102);
        var $103=_printf(((__str14)&4294967295));
        __label__ = 27; break;
      case 17: // $bb16
        var $104=(HEAP[$first+3]<<24)|(HEAP[$first+2]<<16)|(HEAP[$first+1]<<8)|(HEAP[$first]);
        var $105=((($104))|0)!=0;
        if ($105) { __label__ = 18; break; } else { __label__ = 19; break; }
      case 18: // $bb17
        var $106=_puts(((__str11)&4294967295));
         HEAP[$first+3] = (0>>24)&0xff; HEAP[$first+2] = (0>>16)&0xff; HEAP[$first+1] = (0>>8)&0xff; HEAP[$first] = (0)&0xff;
        __label__ = 19; break;
      case 19: // $bb18
        var $107=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $108=$107;
        var $109=(($108+12)&4294967295);
        var $110=(HEAP[$109]);
        var $111=unSign(($110), 8, 0);
        var $112=_printf(((__str15)&4294967295), $111);
        __label__ = 27; break;
      case 20: // $bb19
        var $113=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $114=$113;
        var $115=(($114+19)&4294967295);
        var $116=(HEAP[$115]);
        var $117=reSign(($116), 8, 0);
        var $118=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $119=$118;
        var $120=(($119+18)&4294967295);
        var $121=(HEAP[$120]);
        var $122=reSign(($121), 8, 0);
        var $123=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $124=$123;
        var $125=(($124+17)&4294967295);
        var $126=(HEAP[$125]);
        var $127=unSign(($126), 8, 0);
        var $128=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $129=$128;
        var $130=(($129+16)&4294967295);
        var $131=(HEAP[$130]);
        var $132=reSign(($131), 8, 0);
        var $133=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $134=$133;
        var $135=(($134+14)&4294967295);
        var $136=(HEAP[$135+1]<<8)|(HEAP[$135]);
        var $137=unSign(($136), 16, 0);
        var $138=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $139=$138;
        var $140=(($139+12)&4294967295);
        var $141=(HEAP[$140]);
        var $142=unSign(($141), 8, 0);
        var $143=_printf(((__str16)&4294967295), $142, $137, $132, $127, $122, $117);
        __label__ = 27; break;
      case 21: // $bb20
        var $144=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $145=$144;
        var $146=(($145+20)&4294967295);
        var $147=(HEAP[$146]);
        var $148=reSign(($147), 8, 0);
        var $149=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $150=$149;
        var $151=(($150+19)&4294967295);
        var $152=(HEAP[$151]);
        var $153=unSign(($152), 8, 0);
        var $154=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $155=$154;
        var $156=(($155+18)&4294967295);
        var $157=(HEAP[$156]);
        var $158=unSign(($157), 8, 0);
        var $159=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $160=$159;
        var $161=(($160+16)&4294967295);
        var $162=(HEAP[$161+1]<<8)|(HEAP[$161]);
        var $163=unSign(($162), 16, 0);
        var $164=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $165=$164;
        var $166=(($165+14)&4294967295);
        var $167=(HEAP[$166]);
        var $168=unSign(($167), 8, 0);
        var $169=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $170=$169;
        var $171=(($170+12)&4294967295);
        var $172=(HEAP[$171+1]<<8)|(HEAP[$171]);
        var $173=reSign(($172), 16, 0)!=0;
        var $174=unSign(($173), 1, 0);
        var $175=_printf(((__str17)&4294967295), $174, $168, $163, $158, $153, $148);
        __label__ = 27; break;
      case 22: // $bb21
        var $176=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $177=$176;
        var $178=(($177+18)&4294967295);
        var $179=(HEAP[$178+1]<<8)|(HEAP[$178]);
        var $180=unSign(($179), 16, 0);
        var $181=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $182=((($180)) & 65535);
        var $183=_hyp_parse_image_data($181, $182);
         HEAP[$img+3] = ($183>>24)&0xff; HEAP[$img+2] = ($183>>16)&0xff; HEAP[$img+1] = ($183>>8)&0xff; HEAP[$img] = ($183)&0xff;
        var $184=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $185=($184)!=0;
        if ($185) { __label__ = 23; break; } else { __label__ = 27; break; }
      case 23: // $bb22
        var $186=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $187=(($186+2)&4294967295);
        var $188=(HEAP[$187+1]<<8)|(HEAP[$187]);
        var $189=reSign(($188), 16, 0);
        var $190=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $191=(($190)&4294967295);
        var $192=(HEAP[$191+1]<<8)|(HEAP[$191]);
        var $193=reSign(($192), 16, 0);
        var $194=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $195=$194;
        var $196=(($195+12)&4294967295);
        var $197=(HEAP[$196]);
        var $198=reSign(($197), 8, 0)!=0;
        if ($198) { __label__ = 24; break; } else { __label__ = 25; break; }
      case 24: // $bb23
         HEAP[$iftmp_23+3] = (((__str18)&4294967295)>>24)&0xff; HEAP[$iftmp_23+2] = (((__str18)&4294967295)>>16)&0xff; HEAP[$iftmp_23+1] = (((__str18)&4294967295)>>8)&0xff; HEAP[$iftmp_23] = (((__str18)&4294967295))&0xff;
        __label__ = 26; break;
      case 25: // $bb24
         HEAP[$iftmp_23+3] = (((__str19)&4294967295)>>24)&0xff; HEAP[$iftmp_23+2] = (((__str19)&4294967295)>>16)&0xff; HEAP[$iftmp_23+1] = (((__str19)&4294967295)>>8)&0xff; HEAP[$iftmp_23] = (((__str19)&4294967295))&0xff;
        __label__ = 26; break;
      case 26: // $bb25
        var $199=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $200=$199;
        var $201=(($200+14)&4294967295);
        var $202=(HEAP[$201+1]<<8)|(HEAP[$201]);
        var $203=unSign(($202), 16, 0);
        var $204=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $205=$204;
        var $206=(($205+13)&4294967295);
        var $207=(HEAP[$206]);
        var $208=unSign(($207), 8, 0);
        var $209=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $210=$209;
        var $211=(($210+18)&4294967295);
        var $212=(HEAP[$211+1]<<8)|(HEAP[$211]);
        var $213=unSign(($212), 16, 0);
        var $214=(HEAP[$iftmp_23+3]<<24)|(HEAP[$iftmp_23+2]<<16)|(HEAP[$iftmp_23+1]<<8)|(HEAP[$iftmp_23]);
        var $215=_printf(((__str20)&4294967295), $213, $208, $203, $214, $193, $189);
        var $216=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        _hyp_free_image_data($216);
        __label__ = 27; break;
      case 27: // $bb26
        var $217=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $218=_hyp_node_item_next($217);
         HEAP[$item+3] = ($218>>24)&0xff; HEAP[$item+2] = ($218>>16)&0xff; HEAP[$item+1] = ($218>>8)&0xff; HEAP[$item] = ($218)&0xff;
        __label__ = 28; break;
      case 28: // $bb27
        var $219=(HEAP[$item+3]<<24)|(HEAP[$item+2]<<16)|(HEAP[$item+1]<<8)|(HEAP[$item]);
        var $220=($219)!=0;
        if ($220) { __label__ = 5; break; } else { __label__ = 29; break; }
      case 29: // $bb28
        var $221=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        _hyp_free_node($221);
        var $222=(HEAP[$first+3]<<24)|(HEAP[$first+2]<<16)|(HEAP[$first+1]<<8)|(HEAP[$first]);
        var $223=((($222))|0)==0;
        if ($223) { __label__ = 30; break; } else { __label__ = 31; break; }
      case 30: // $bb29
        var $224=_puts(((__str21)&4294967295));
        __label__ = 31; break;
      case 31: // $bb30
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        var $225=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($225>>24)&0xff; HEAP[$retval+2] = ($225>>16)&0xff; HEAP[$retval+1] = ($225>>8)&0xff; HEAP[$retval] = ($225)&0xff;
        __label__ = 32; break;
      case 32: // $return
        var $retval31=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval31;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _main($argc, $argv) {
    var __stackBase__  = STACKTOP; STACKTOP += 32; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 32);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $argc_addr=__stackBase__;
        var $argv_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $iftmp_28=__stackBase__+12;
        var $0=__stackBase__+16;
        var $hyp=__stackBase__+20;
        var $index=__stackBase__+24;
        var $res=__stackBase__+28;
        var $_alloca_point_=0;
         HEAP[$argc_addr+3] = ($argc>>24)&0xff; HEAP[$argc_addr+2] = ($argc>>16)&0xff; HEAP[$argc_addr+1] = ($argc>>8)&0xff; HEAP[$argc_addr] = ($argc)&0xff;
         HEAP[$argv_addr+3] = ($argv>>24)&0xff; HEAP[$argv_addr+2] = ($argv>>16)&0xff; HEAP[$argv_addr+1] = ($argv>>8)&0xff; HEAP[$argv_addr] = ($argv)&0xff;
        var $1=(HEAP[$argc_addr+3]<<24)|(HEAP[$argc_addr+2]<<16)|(HEAP[$argc_addr+1]<<8)|(HEAP[$argc_addr]);
        var $2=((($1))|0) <= 1;
        if ($2) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (1>>24)&0xff; HEAP[$0+2] = (1>>16)&0xff; HEAP[$0+1] = (1>>8)&0xff; HEAP[$0] = (1)&0xff;
        __label__ = 21; break;
      case 2: // $bb1
        var $3=(HEAP[$argv_addr+3]<<24)|(HEAP[$argv_addr+2]<<16)|(HEAP[$argv_addr+1]<<8)|(HEAP[$argv_addr]);
        var $4=(($3+4)&4294967295);
        var $5=(HEAP[$4+3]<<24)|(HEAP[$4+2]<<16)|(HEAP[$4+1]<<8)|(HEAP[$4]);
        var $6=_hyp_load($5);
         HEAP[$hyp+3] = ($6>>24)&0xff; HEAP[$hyp+2] = ($6>>16)&0xff; HEAP[$hyp+1] = ($6>>8)&0xff; HEAP[$hyp] = ($6)&0xff;
        var $7=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $8=($7)!=0;
        if ($8) { __label__ = 3; break; } else { __label__ = 20; break; }
      case 3: // $bb2
        var $9=(HEAP[$argc_addr+3]<<24)|(HEAP[$argc_addr+2]<<16)|(HEAP[$argc_addr+1]<<8)|(HEAP[$argc_addr]);
        var $10=((($9))|0) > 2;
        if ($10) { __label__ = 4; break; } else { __label__ = 5; break; }
      case 4: // $bb3
        var $11=(HEAP[$argv_addr+3]<<24)|(HEAP[$argv_addr+2]<<16)|(HEAP[$argv_addr+1]<<8)|(HEAP[$argv_addr]);
        var $12=(($11+8)&4294967295);
        var $13=(HEAP[$12+3]<<24)|(HEAP[$12+2]<<16)|(HEAP[$12+1]<<8)|(HEAP[$12]);
        var $14=_atol($13);
         HEAP[$iftmp_28+3] = ($14>>24)&0xff; HEAP[$iftmp_28+2] = ($14>>16)&0xff; HEAP[$iftmp_28+1] = ($14>>8)&0xff; HEAP[$iftmp_28] = ($14)&0xff;
        __label__ = 6; break;
      case 5: // $bb4
         HEAP[$iftmp_28+3] = (0>>24)&0xff; HEAP[$iftmp_28+2] = (0>>16)&0xff; HEAP[$iftmp_28+1] = (0>>8)&0xff; HEAP[$iftmp_28] = (0)&0xff;
        __label__ = 6; break;
      case 6: // $bb5
        var $15=(HEAP[$iftmp_28+3]<<24)|(HEAP[$iftmp_28+2]<<16)|(HEAP[$iftmp_28+1]<<8)|(HEAP[$iftmp_28]);
         HEAP[$index+3] = ($15>>24)&0xff; HEAP[$index+2] = ($15>>16)&0xff; HEAP[$index+1] = ($15>>8)&0xff; HEAP[$index] = ($15)&0xff;
        var $16=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $17=((($16))|0)==0;
        if ($17) { __label__ = 7; break; } else { __label__ = 14; break; }
      case 7: // $bb6
        var $18=(HEAP[$argc_addr+3]<<24)|(HEAP[$argc_addr+2]<<16)|(HEAP[$argc_addr+1]<<8)|(HEAP[$argc_addr]);
        var $19=((($18))|0) > 2;
        if ($19) { __label__ = 8; break; } else { __label__ = 14; break; }
      case 8: // $bb7
        var $20=(HEAP[$argv_addr+3]<<24)|(HEAP[$argv_addr+2]<<16)|(HEAP[$argv_addr+1]<<8)|(HEAP[$argv_addr]);
        var $21=(($20+8)&4294967295);
        var $22=(HEAP[$21+3]<<24)|(HEAP[$21+2]<<16)|(HEAP[$21+1]<<8)|(HEAP[$21]);
        var $23=_strncmp($22, ((__str22)&4294967295), 5);
        var $24=((($23))|0)==0;
        if ($24) { __label__ = 9; break; } else { __label__ = 14; break; }
      case 9: // $bb8
        var $25=(HEAP[$argv_addr+3]<<24)|(HEAP[$argv_addr+2]<<16)|(HEAP[$argv_addr+1]<<8)|(HEAP[$argv_addr]);
        var $26=(($25+8)&4294967295);
        var $27=(HEAP[$26+3]<<24)|(HEAP[$26+2]<<16)|(HEAP[$26+1]<<8)|(HEAP[$26]);
        var $28=(($27+5)&4294967295);
        var $29=(HEAP[$28]);
        var $30=reSign(($29), 8, 0)!=0;
        if ($30) { __label__ = 10; break; } else { __label__ = 14; break; }
      case 10: // $bb9
         HEAP[$index+3] = (0>>24)&0xff; HEAP[$index+2] = (0>>16)&0xff; HEAP[$index+1] = (0>>8)&0xff; HEAP[$index] = (0)&0xff;
        __label__ = 13; break;
      case 11: // $bb10
        var $31=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $32=(($31+16)&4294967295);
        var $33=(HEAP[$32+3]<<24)|(HEAP[$32+2]<<16)|(HEAP[$32+1]<<8)|(HEAP[$32]);
        var $34=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $35=(($33+24*$34)&4294967295);
        var $36=(($35+20)&4294967295);
        var $37=(HEAP[$36+3]<<24)|(HEAP[$36+2]<<16)|(HEAP[$36+1]<<8)|(HEAP[$36]);
        var $38=(HEAP[$argv_addr+3]<<24)|(HEAP[$argv_addr+2]<<16)|(HEAP[$argv_addr+1]<<8)|(HEAP[$argv_addr]);
        var $39=(($38+8)&4294967295);
        var $40=(HEAP[$39+3]<<24)|(HEAP[$39+2]<<16)|(HEAP[$39+1]<<8)|(HEAP[$39]);
        var $41=(($40+5)&4294967295);
        var $42=_strcmp($41, $37);
        var $43=((($42))|0)==0;
        if ($43) { __label__ = 14; break; } else { __label__ = 12; break; }
      case 12: // $bb11
        var $44=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $45=((($44) + 1)&4294967295);
         HEAP[$index+3] = ($45>>24)&0xff; HEAP[$index+2] = ($45>>16)&0xff; HEAP[$index+1] = ($45>>8)&0xff; HEAP[$index] = ($45)&0xff;
        __label__ = 13; break;
      case 13: // $bb12
        var $46=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $47=(($46+4)&4294967295);
        var $48=(($47+8)&4294967295);
        var $49=(HEAP[$48+1]<<8)|(HEAP[$48]);
        var $50=unSign(($49), 16, 0);
        var $51=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $52=((($50))>>>0) > ((($51))>>>0);
        if ($52) { __label__ = 11; break; } else { __label__ = 14; break; }
      case 14: // $bb13
        var $53=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $54=(($53+4)&4294967295);
        var $55=(($54+8)&4294967295);
        var $56=(HEAP[$55+1]<<8)|(HEAP[$55]);
        var $57=unSign(($56), 16, 0);
        var $58=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $59=((($57))>>>0) <= ((($58))>>>0);
        if ($59) { __label__ = 15; break; } else { __label__ = 16; break; }
      case 15: // $bb14
         HEAP[$index+3] = (0>>24)&0xff; HEAP[$index+2] = (0>>16)&0xff; HEAP[$index+1] = (0>>8)&0xff; HEAP[$index] = (0)&0xff;
        __label__ = 16; break;
      case 16: // $bb15
        var $60=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $61=(($60+16)&4294967295);
        var $62=(HEAP[$61+3]<<24)|(HEAP[$61+2]<<16)|(HEAP[$61+1]<<8)|(HEAP[$61]);
        var $63=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $64=(($62+24*$63)&4294967295);
        var $65=(($64)&4294967295);
        var $66=(HEAP[$65]);
        var $67=unSign(($66), 8, 0);
        if ($67 == 3) {
          __label__ = 17; break;
        }
        else {
        __label__ = 18; break;
        }
        
      case 17: // $bb16
        var $68=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $69=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $70=_emit_image($69, $68);
         HEAP[$res+3] = ($70>>24)&0xff; HEAP[$res+2] = ($70>>16)&0xff; HEAP[$res+1] = ($70>>8)&0xff; HEAP[$res] = ($70)&0xff;
        __label__ = 19; break;
      case 18: // $bb17
        var $71=(HEAP[$index+3]<<24)|(HEAP[$index+2]<<16)|(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $72=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $73=_emit_node($72, $71);
         HEAP[$res+3] = ($73>>24)&0xff; HEAP[$res+2] = ($73>>16)&0xff; HEAP[$res+1] = ($73>>8)&0xff; HEAP[$res] = ($73)&0xff;
        __label__ = 19; break;
      case 19: // $bb18
        var $74=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        _hyp_free($74);
        var $75=(HEAP[$res+3]<<24)|(HEAP[$res+2]<<16)|(HEAP[$res+1]<<8)|(HEAP[$res]);
         HEAP[$0+3] = ($75>>24)&0xff; HEAP[$0+2] = ($75>>16)&0xff; HEAP[$0+1] = ($75>>8)&0xff; HEAP[$0] = ($75)&0xff;
        __label__ = 21; break;
      case 20: // $bb19
         HEAP[$0+3] = (1>>24)&0xff; HEAP[$0+2] = (1>>16)&0xff; HEAP[$0+1] = (1>>8)&0xff; HEAP[$0] = (1)&0xff;
        __label__ = 21; break;
      case 21: // $bb20
        var $76=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($76>>24)&0xff; HEAP[$retval+2] = ($76>>16)&0xff; HEAP[$retval+1] = ($76>>8)&0xff; HEAP[$retval] = ($76)&0xff;
        __label__ = 22; break;
      case 22: // $return
        var $retval21=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval21;
      default: assert(0, "bad label: " + __label__);
    }
  }
  Module["_main"] = _main;
  function _mktbl() {
    var __stackBase__  = STACKTOP; STACKTOP += 10; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 10);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $retval=__stackBase__;
        var $0=__stackBase__+4;
        var $i=__stackBase__+8;
        var $_alloca_point_=0;
        var $1=(HEAP[_len+1]<<8)|(HEAP[_len]);
        var $2=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $3=reSign(($1), 16, 0)==reSign(($2), 16, 0);
        if ($3) { __label__ = 1; break; } else { __label__ = 9; break; }
      case 1: // $bb
        __label__ = 7; break;
      case 2: // $bb1
        var $4=(HEAP[_blen+3]<<24)|(HEAP[_blen+2]<<16)|(HEAP[_blen+1]<<8)|(HEAP[_blen]);
        var $5=(HEAP[_c+1]<<8)|(HEAP[_c]);
        var $6=reSign(($5), 16, 0);
        var $7=(($4+$6)&4294967295);
        var $8=(HEAP[$7]);
        var $9=unSign(($8), 8, 0);
        var $10=(HEAP[_len+1]<<8)|(HEAP[_len]);
        var $11=reSign(($10), 16, 0);
        var $12=((($9))|0)==((($11))|0);
        if ($12) { __label__ = 3; break; } else { __label__ = 7; break; }
      case 3: // $bb2
        var $13=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
         HEAP[$i+1] = ($13>>8)&0xff; HEAP[$i] = ($13)&0xff;
        var $14=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $15=(HEAP[_bit+1]<<8)|(HEAP[_bit]);
        var $16=((($14) + ($15))&65535);
         HEAP[_codeword+1] = ($16>>8)&0xff; HEAP[_codeword] = ($16)&0xff;
        var $17=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $18=unSign(($17), 16, 0);
        var $19=(HEAP[_tblsiz+1]<<8)|(HEAP[_tblsiz]);
        var $20=reSign(($19), 16, 0);
        __label__ = 5; break;
      case 4: // $bb3
        var $21=(HEAP[_tbl+3]<<24)|(HEAP[_tbl+2]<<16)|(HEAP[_tbl+1]<<8)|(HEAP[_tbl]);
        var $22=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $23=reSign(($22), 16, 0);
        var $24=(HEAP[_c+1]<<8)|(HEAP[_c]);
        var $25=(($21+2*$23)&4294967295);
         HEAP[$25+1] = ($24>>8)&0xff; HEAP[$25] = ($24)&0xff;
        var $26=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $27=((($26) + 1)&65535);
         HEAP[$i+1] = ($27>>8)&0xff; HEAP[$i] = ($27)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        var $28=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $29=reSign(($28), 16, 0);
        var $30=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $31=unSign(($30), 16, 0);
        var $32=((($29))|0) < ((($31))|0);
        if ($32) { __label__ = 4; break; } else { __label__ = 6; break; }
      case 6: // $bb5
        var $33=(HEAP[_c+1]<<8)|(HEAP[_c]);
        var $34=reSign(($33), 16, 0);
         HEAP[$0+3] = ($34>>24)&0xff; HEAP[$0+2] = ($34>>16)&0xff; HEAP[$0+1] = ($34>>8)&0xff; HEAP[$0] = ($34)&0xff;
        __label__ = 15; break;
      case 7: // $bb6
        var $35=(HEAP[_c+1]<<8)|(HEAP[_c]);
        var $36=((($35) + 1)&65535);
         HEAP[_c+1] = ($36>>8)&0xff; HEAP[_c] = ($36)&0xff;
        var $37=(HEAP[_c+1]<<8)|(HEAP[_c]);
        var $38=(HEAP[_n+1]<<8)|(HEAP[_n]);
        var $39=reSign(($37), 16, 0) < reSign(($38), 16, 0);
        if ($39) { __label__ = 2; break; } else { __label__ = 8; break; }
      case 8: // $bb7
         HEAP[_c+1] = (-1>>8)&0xff; HEAP[_c] = (-1)&0xff;
        var $40=(HEAP[_len+1]<<8)|(HEAP[_len]);
        var $41=((($40) + 1)&65535);
         HEAP[_len+1] = ($41>>8)&0xff; HEAP[_len] = ($41)&0xff;
        var $42=(HEAP[_bit+1]<<8)|(HEAP[_bit]);
        var $43=unSign(($42), 16, 0) >>> 1;
         HEAP[_bit+1] = ($43>>8)&0xff; HEAP[_bit] = ($43)&0xff;
        __label__ = 9; break;
      case 9: // $bb8
        var $44=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $45=((($44) + 1)&65535);
         HEAP[_depth+1] = ($45>>8)&0xff; HEAP[_depth] = ($45)&0xff;
        var $46=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $47=(HEAP[_maxdepth+1]<<8)|(HEAP[_maxdepth]);
        var $48=reSign(($46), 16, 0) < reSign(($47), 16, 0);
        if ($48) { __label__ = 10; break; } else { __label__ = 11; break; }
      case 10: // $bb9
        var $49=_mktbl();
        var $50=_mktbl();
        __label__ = 14; break;
      case 11: // $bb10
        var $51=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $52=reSign(($51), 16, 0) <= 16;
        if ($52) { __label__ = 12; break; } else { __label__ = 14; break; }
      case 12: // $bb11
        var $53=(HEAP[_avail+1]<<8)|(HEAP[_avail]);
         HEAP[$i+1] = ($53>>8)&0xff; HEAP[$i] = ($53)&0xff;
        var $54=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $55=reSign(($54), 16, 0);
        var $56=(HEAP[_n+1]<<8)|(HEAP[_n]);
        var $57=reSign(($56), 16, 0);
        var $58=((($57) * 2)&4294967295);
        var $59=((($58) - 1)&4294967295);
        var $60=((($55))|0) >= ((($59))|0);
        var $61=unSign(($60), 1, 0);
        var $62=((($53) + 1)&65535);
         HEAP[_avail+1] = ($62>>8)&0xff; HEAP[_avail] = ($62)&0xff;
        var $63=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $64=reSign(($63), 16, 0);
        var $65=_mktbl();
        var $66=((_left+$64*2)&4294967295);
         HEAP[$66+1] = ($65>>8)&0xff; HEAP[$66] = ($65)&0xff;
        var $67=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $68=reSign(($67), 16, 0);
        var $69=_mktbl();
        var $70=((_right+$68*2)&4294967295);
         HEAP[$70+1] = ($69>>8)&0xff; HEAP[$70] = ($69)&0xff;
        var $71=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $72=unSign(($71), 16, 0);
        var $73=(HEAP[_tblsiz+1]<<8)|(HEAP[_tblsiz]);
        var $74=reSign(($73), 16, 0);
        var $75=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $76=(HEAP[_maxdepth+1]<<8)|(HEAP[_maxdepth]);
        var $77=reSign(($75), 16, 0)==reSign(($76), 16, 0);
        if ($77) { __label__ = 13; break; } else { __label__ = 14; break; }
      case 13: // $bb12
        var $78=(HEAP[_tbl+3]<<24)|(HEAP[_tbl+2]<<16)|(HEAP[_tbl+1]<<8)|(HEAP[_tbl]);
        var $79=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $80=unSign(($79), 16, 0);
        var $81=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $82=(($78+2*$80)&4294967295);
         HEAP[$82+1] = ($81>>8)&0xff; HEAP[$82] = ($81)&0xff;
        var $83=((($79) + 1)&65535);
         HEAP[_codeword+1] = ($83>>8)&0xff; HEAP[_codeword] = ($83)&0xff;
        __label__ = 14; break;
      case 14: // $bb13
        var $84=(HEAP[_depth+1]<<8)|(HEAP[_depth]);
        var $85=((($84) - 1)&65535);
         HEAP[_depth+1] = ($85>>8)&0xff; HEAP[_depth] = ($85)&0xff;
        var $86=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $87=reSign(($86), 16, 0);
         HEAP[$0+3] = ($87>>24)&0xff; HEAP[$0+2] = ($87>>16)&0xff; HEAP[$0+1] = ($87>>8)&0xff; HEAP[$0] = ($87)&0xff;
        __label__ = 15; break;
      case 15: // $bb14
        var $88=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($88>>24)&0xff; HEAP[$retval+2] = ($88>>16)&0xff; HEAP[$retval+1] = ($88>>8)&0xff; HEAP[$retval] = ($88)&0xff;
        __label__ = 16; break;
      case 16: // $return
        var $retval15=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval1516=((($retval15)) & 65535);
        STACKTOP = __stackBase__;
        return $retval1516;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _make_table($nchar, $bitlen, $tablebits, $table) {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $nchar_addr=__stackBase__;
        var $bitlen_addr=__stackBase__+2;
        var $tablebits_addr=__stackBase__+6;
        var $table_addr=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$nchar_addr+1] = ($nchar>>8)&0xff; HEAP[$nchar_addr] = ($nchar)&0xff;
         HEAP[$bitlen_addr+3] = ($bitlen>>24)&0xff; HEAP[$bitlen_addr+2] = ($bitlen>>16)&0xff; HEAP[$bitlen_addr+1] = ($bitlen>>8)&0xff; HEAP[$bitlen_addr] = ($bitlen)&0xff;
         HEAP[$tablebits_addr+1] = ($tablebits>>8)&0xff; HEAP[$tablebits_addr] = ($tablebits)&0xff;
         HEAP[$table_addr+3] = ($table>>24)&0xff; HEAP[$table_addr+2] = ($table>>16)&0xff; HEAP[$table_addr+1] = ($table>>8)&0xff; HEAP[$table_addr] = ($table)&0xff;
        var $0=(HEAP[$nchar_addr+1]<<8)|(HEAP[$nchar_addr]);
         HEAP[_avail+1] = ($0>>8)&0xff; HEAP[_avail] = ($0)&0xff;
        var $1=(HEAP[_avail+1]<<8)|(HEAP[_avail]);
         HEAP[_n+1] = ($1>>8)&0xff; HEAP[_n] = ($1)&0xff;
        var $2=(HEAP[$bitlen_addr+3]<<24)|(HEAP[$bitlen_addr+2]<<16)|(HEAP[$bitlen_addr+1]<<8)|(HEAP[$bitlen_addr]);
         HEAP[_blen+3] = ($2>>24)&0xff; HEAP[_blen+2] = ($2>>16)&0xff; HEAP[_blen+1] = ($2>>8)&0xff; HEAP[_blen] = ($2)&0xff;
        var $3=(HEAP[$table_addr+3]<<24)|(HEAP[$table_addr+2]<<16)|(HEAP[$table_addr+1]<<8)|(HEAP[$table_addr]);
         HEAP[_tbl+3] = ($3>>24)&0xff; HEAP[_tbl+2] = ($3>>16)&0xff; HEAP[_tbl+1] = ($3>>8)&0xff; HEAP[_tbl] = ($3)&0xff;
        var $4=(HEAP[$tablebits_addr+1]<<8)|(HEAP[$tablebits_addr]);
        var $5=reSign(($4), 16, 0);
        var $6=1 << ($5);
        var $7=((($6)) & 65535);
         HEAP[_tblsiz+1] = ($7>>8)&0xff; HEAP[_tblsiz] = ($7)&0xff;
        var $8=(HEAP[_tblsiz+1]<<8)|(HEAP[_tblsiz]);
        var $9=((reSign(($8), 16, 0)/2)|0);
         HEAP[_bit+1] = ($9>>8)&0xff; HEAP[_bit] = ($9)&0xff;
        var $10=(HEAP[$tablebits_addr+1]<<8)|(HEAP[$tablebits_addr]);
        var $11=((($10) + 1)&65535);
         HEAP[_maxdepth+1] = ($11>>8)&0xff; HEAP[_maxdepth] = ($11)&0xff;
         HEAP[_len+1] = (1>>8)&0xff; HEAP[_len] = (1)&0xff;
        var $12=(HEAP[_len+1]<<8)|(HEAP[_len]);
         HEAP[_depth+1] = ($12>>8)&0xff; HEAP[_depth] = ($12)&0xff;
         HEAP[_c+1] = (-1>>8)&0xff; HEAP[_c] = (-1)&0xff;
         HEAP[_codeword+1] = (0>>8)&0xff; HEAP[_codeword] = (0)&0xff;
        var $13=_mktbl();
        var $14=_mktbl();
        var $15=(HEAP[_codeword+1]<<8)|(HEAP[_codeword]);
        var $16=unSign(($15), 16, 0);
        var $17=(HEAP[_tblsiz+1]<<8)|(HEAP[_tblsiz]);
        var $18=reSign(($17), 16, 0);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _make_crctable() {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $i=__stackBase__;
        var $j=__stackBase__+4;
        var $r=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$i+3] = (0>>24)&0xff; HEAP[$i+2] = (0>>16)&0xff; HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 8; break;
      case 1: // $bb
        var $0=(HEAP[$i+3]<<24)|(HEAP[$i+2]<<16)|(HEAP[$i+1]<<8)|(HEAP[$i]);
         HEAP[$r+3] = ($0>>24)&0xff; HEAP[$r+2] = ($0>>16)&0xff; HEAP[$r+1] = ($0>>8)&0xff; HEAP[$r] = ($0)&0xff;
         HEAP[$j+3] = (0>>24)&0xff; HEAP[$j+2] = (0>>16)&0xff; HEAP[$j+1] = (0>>8)&0xff; HEAP[$j] = (0)&0xff;
        __label__ = 6; break;
      case 2: // $bb1
        var $1=(HEAP[$r+3]<<24)|(HEAP[$r+2]<<16)|(HEAP[$r+1]<<8)|(HEAP[$r]);
        var $2=($1) & 1;
        var $3=((($2)) & 255);
        var $toBool=reSign(($3), 8, 0)!=0;
        if ($toBool) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
        var $4=(HEAP[$r+3]<<24)|(HEAP[$r+2]<<16)|(HEAP[$r+1]<<8)|(HEAP[$r]);
        var $5=((($4))>>>0) >>> 1;
        var $6=($5) ^ 40961;
         HEAP[$r+3] = ($6>>24)&0xff; HEAP[$r+2] = ($6>>16)&0xff; HEAP[$r+1] = ($6>>8)&0xff; HEAP[$r] = ($6)&0xff;
        __label__ = 5; break;
      case 4: // $bb3
        var $7=(HEAP[$r+3]<<24)|(HEAP[$r+2]<<16)|(HEAP[$r+1]<<8)|(HEAP[$r]);
        var $8=((($7))>>>0) >>> 1;
         HEAP[$r+3] = ($8>>24)&0xff; HEAP[$r+2] = ($8>>16)&0xff; HEAP[$r+1] = ($8>>8)&0xff; HEAP[$r] = ($8)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        var $9=(HEAP[$j+3]<<24)|(HEAP[$j+2]<<16)|(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $10=((($9) + 1)&4294967295);
         HEAP[$j+3] = ($10>>24)&0xff; HEAP[$j+2] = ($10>>16)&0xff; HEAP[$j+1] = ($10>>8)&0xff; HEAP[$j] = ($10)&0xff;
        __label__ = 6; break;
      case 6: // $bb5
        var $11=(HEAP[$j+3]<<24)|(HEAP[$j+2]<<16)|(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $12=((($11))>>>0) <= 7;
        if ($12) { __label__ = 2; break; } else { __label__ = 7; break; }
      case 7: // $bb6
        var $13=(HEAP[$i+3]<<24)|(HEAP[$i+2]<<16)|(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $14=(HEAP[$r+3]<<24)|(HEAP[$r+2]<<16)|(HEAP[$r+1]<<8)|(HEAP[$r]);
        var $15=((($14)) & 65535);
        var $16=((_crctable+$13*2)&4294967295);
         HEAP[$16+1] = ($15>>8)&0xff; HEAP[$16] = ($15)&0xff;
        var $17=(HEAP[$i+3]<<24)|(HEAP[$i+2]<<16)|(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $18=((($17) + 1)&4294967295);
         HEAP[$i+3] = ($18>>24)&0xff; HEAP[$i+2] = ($18>>16)&0xff; HEAP[$i+1] = ($18>>8)&0xff; HEAP[$i] = ($18)&0xff;
        __label__ = 8; break;
      case 8: // $bb7
        var $19=(HEAP[$i+3]<<24)|(HEAP[$i+2]<<16)|(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $20=((($19))>>>0) <= 255;
        if ($20) { __label__ = 1; break; } else { __label__ = 9; break; }
      case 9: // $bb8
        __label__ = 10; break;
      case 10: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _calccrc($p, $n) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $p_addr=__stackBase__;
        var $n_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $0=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$p_addr+3] = ($p>>24)&0xff; HEAP[$p_addr+2] = ($p>>16)&0xff; HEAP[$p_addr+1] = ($p>>8)&0xff; HEAP[$p_addr] = ($p)&0xff;
         HEAP[$n_addr+3] = ($n>>24)&0xff; HEAP[$n_addr+2] = ($n>>16)&0xff; HEAP[$n_addr+1] = ($n>>8)&0xff; HEAP[$n_addr] = ($n)&0xff;
        var $1=(HEAP[_reading_size+3]<<24)|(HEAP[_reading_size+2]<<16)|(HEAP[_reading_size+1]<<8)|(HEAP[_reading_size]);
        var $2=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $3=((($1) + ($2))&4294967295);
         HEAP[_reading_size+3] = ($3>>24)&0xff; HEAP[_reading_size+2] = ($3>>16)&0xff; HEAP[_reading_size+1] = ($3>>8)&0xff; HEAP[_reading_size] = ($3)&0xff;
        __label__ = 2; break;
      case 1: // $bb
        var $4=(HEAP[_crc+1]<<8)|(HEAP[_crc]);
        var $5=unSign(($4), 16, 0);
        var $6=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $7=(HEAP[$6]);
        var $8=unSign(($7), 8, 0);
        var $9=($5) ^ ($8);
        var $10=($9) & 255;
        var $11=((_crctable+$10*2)&4294967295);
        var $12=(HEAP[$11+1]<<8)|(HEAP[$11]);
        var $13=(HEAP[_crc+1]<<8)|(HEAP[_crc]);
        var $14=unSign(($13), 16, 0) >>> 8;
        var $15=($12) ^ ($14);
         HEAP[_crc+1] = ($15>>8)&0xff; HEAP[_crc] = ($15)&0xff;
        var $16=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $17=(($16+1)&4294967295);
         HEAP[$p_addr+3] = ($17>>24)&0xff; HEAP[$p_addr+2] = ($17>>16)&0xff; HEAP[$p_addr+1] = ($17>>8)&0xff; HEAP[$p_addr] = ($17)&0xff;
        __label__ = 2; break;
      case 2: // $bb1
        var $18=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $19=((($18) - 1)&4294967295);
         HEAP[$n_addr+3] = ($19>>24)&0xff; HEAP[$n_addr+2] = ($19>>16)&0xff; HEAP[$n_addr+1] = ($19>>8)&0xff; HEAP[$n_addr] = ($19)&0xff;
        var $20=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $21=((($20))|0)!=-1;
        if ($21) { __label__ = 1; break; } else { __label__ = 3; break; }
      case 3: // $bb2
        var $22=(HEAP[_crc+1]<<8)|(HEAP[_crc]);
        var $23=unSign(($22), 16, 0);
         HEAP[$0+3] = ($23>>24)&0xff; HEAP[$0+2] = ($23>>16)&0xff; HEAP[$0+1] = ($23>>8)&0xff; HEAP[$0] = ($23)&0xff;
        var $24=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($24>>24)&0xff; HEAP[$retval+2] = ($24>>16)&0xff; HEAP[$retval+1] = ($24>>8)&0xff; HEAP[$retval] = ($24)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval34=((($retval3)) & 65535);
        STACKTOP = __stackBase__;
        return $retval34;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _fillbuf($n) {
    var __stackBase__  = STACKTOP; STACKTOP += 1; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 1);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $n_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$n_addr] = ($n)&0xff;
        __label__ = 5; break;
      case 1: // $bb
        var $0=(HEAP[_bitcount]);
        var $1=(HEAP[$n_addr]);
        var $2=((($1) - ($0))&255);
         HEAP[$n_addr] = ($2)&0xff;
        var $3=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $4=unSign(($3), 16, 0);
        var $5=(HEAP[_bitcount]);
        var $6=unSign(($5), 8, 0);
        var $7=($4) << ($6);
        var $8=((($7)) & 65535);
        var $9=(HEAP[_subbitbuf]);
        var $10=unSign(($9), 8, 0);
        var $11=(HEAP[_bitcount]);
        var $12=unSign(($11), 8, 0);
        var $13=((8 - ($12))&4294967295);
        var $14=((($10))|0) >> ((($13))|0);
        var $15=((($14)) & 65535);
        var $16=((($8) + ($15))&65535);
         HEAP[_bitbuf+1] = ($16>>8)&0xff; HEAP[_bitbuf] = ($16)&0xff;
        var $17=(HEAP[_compsize+3]<<24)|(HEAP[_compsize+2]<<16)|(HEAP[_compsize+1]<<8)|(HEAP[_compsize]);
        var $18=((($17))|0)!=0;
        if ($18) { __label__ = 2; break; } else { __label__ = 3; break; }
      case 2: // $bb1
        var $19=(HEAP[_compsize+3]<<24)|(HEAP[_compsize+2]<<16)|(HEAP[_compsize+1]<<8)|(HEAP[_compsize]);
        var $20=((($19) - 1)&4294967295);
         HEAP[_compsize+3] = ($20>>24)&0xff; HEAP[_compsize+2] = ($20>>16)&0xff; HEAP[_compsize+1] = ($20>>8)&0xff; HEAP[_compsize] = ($20)&0xff;
        var $21=(HEAP[_infileptr+3]<<24)|(HEAP[_infileptr+2]<<16)|(HEAP[_infileptr+1]<<8)|(HEAP[_infileptr]);
        var $22=(HEAP[$21]);
         HEAP[_subbitbuf] = ($22)&0xff;
        var $23=(($21+1)&4294967295);
         HEAP[_infileptr+3] = ($23>>24)&0xff; HEAP[_infileptr+2] = ($23>>16)&0xff; HEAP[_infileptr+1] = ($23>>8)&0xff; HEAP[_infileptr] = ($23)&0xff;
        __label__ = 4; break;
      case 3: // $bb2
         HEAP[_subbitbuf] = (0)&0xff;
        __label__ = 4; break;
      case 4: // $bb3
         HEAP[_bitcount] = (8)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        var $24=(HEAP[_bitcount]);
        var $25=(HEAP[$n_addr]);
        var $26=unSign(($25), 8, 0) > unSign(($24), 8, 0);
        if ($26) { __label__ = 1; break; } else { __label__ = 6; break; }
      case 6: // $bb5
        var $27=(HEAP[_bitcount]);
        var $28=(HEAP[$n_addr]);
        var $29=((($27) - ($28))&255);
         HEAP[_bitcount] = ($29)&0xff;
        var $30=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $31=unSign(($30), 16, 0);
        var $32=(HEAP[$n_addr]);
        var $33=unSign(($32), 8, 0);
        var $34=($31) << ($33);
        var $35=((($34)) & 65535);
        var $36=(HEAP[_subbitbuf]);
        var $37=unSign(($36), 8, 0);
        var $38=(HEAP[$n_addr]);
        var $39=unSign(($38), 8, 0);
        var $40=((8 - ($39))&4294967295);
        var $41=((($37))|0) >> ((($40))|0);
        var $42=((($41)) & 65535);
        var $43=((($35) + ($42))&65535);
         HEAP[_bitbuf+1] = ($43>>8)&0xff; HEAP[_bitbuf] = ($43)&0xff;
        var $44=(HEAP[_subbitbuf]);
        var $45=unSign(($44), 8, 0);
        var $46=(HEAP[$n_addr]);
        var $47=unSign(($46), 8, 0);
        var $48=($45) << ($47);
        var $49=((($48)) & 255);
         HEAP[_subbitbuf] = ($49)&0xff;
        __label__ = 7; break;
      case 7: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _getbits($n) {
    var __stackBase__  = STACKTOP; STACKTOP += 11; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 11);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $n_addr=__stackBase__;
        var $retval=__stackBase__+1;
        var $0=__stackBase__+5;
        var $x=__stackBase__+9;
        var $_alloca_point_=0;
         HEAP[$n_addr] = ($n)&0xff;
        var $1=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $2=unSign(($1), 16, 0);
        var $3=(HEAP[$n_addr]);
        var $4=unSign(($3), 8, 0);
        var $5=((16 - ($4))&4294967295);
        var $6=((($2))|0) >> ((($5))|0);
        var $7=((($6)) & 65535);
         HEAP[$x+1] = ($7>>8)&0xff; HEAP[$x] = ($7)&0xff;
        var $8=(HEAP[$n_addr]);
        var $9=unSign(($8), 8, 0);
        var $10=((($9)) & 255);
        _fillbuf($10);
        var $11=(HEAP[$x+1]<<8)|(HEAP[$x]);
        var $12=unSign(($11), 16, 0);
         HEAP[$0+3] = ($12>>24)&0xff; HEAP[$0+2] = ($12>>16)&0xff; HEAP[$0+1] = ($12>>8)&0xff; HEAP[$0] = ($12)&0xff;
        var $13=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($13>>24)&0xff; HEAP[$retval+2] = ($13>>16)&0xff; HEAP[$retval+1] = ($13>>8)&0xff; HEAP[$retval] = ($13)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval12=((($retval1)) & 65535);
        STACKTOP = __stackBase__;
        return $retval12;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _fwrite_crc($p, $n, $fp) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $p_addr=__stackBase__;
        var $n_addr=__stackBase__+4;
        var $fp_addr=__stackBase__+8;
        var $iftmp_62=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$p_addr+3] = ($p>>24)&0xff; HEAP[$p_addr+2] = ($p>>16)&0xff; HEAP[$p_addr+1] = ($p>>8)&0xff; HEAP[$p_addr] = ($p)&0xff;
         HEAP[$n_addr+3] = ($n>>24)&0xff; HEAP[$n_addr+2] = ($n>>16)&0xff; HEAP[$n_addr+1] = ($n>>8)&0xff; HEAP[$n_addr] = ($n)&0xff;
         HEAP[$fp_addr+3] = ($fp>>24)&0xff; HEAP[$fp_addr+2] = ($fp>>16)&0xff; HEAP[$fp_addr+1] = ($fp>>8)&0xff; HEAP[$fp_addr] = ($fp)&0xff;
        var $0=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $1=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $2=_calccrc($1, $0);
        var $3=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $4=($3)!=0;
        if ($4) { __label__ = 1; break; } else { __label__ = 5; break; }
      case 1: // $bb
        var $5=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $6=(HEAP[$5+3]<<24)|(HEAP[$5+2]<<16)|(HEAP[$5+1]<<8)|(HEAP[$5]);
        var $7=_llvm_objectsize_i32($6, 0);
        var $8=((($7))|0)!=-1;
        if ($8) { __label__ = 2; break; } else { __label__ = 3; break; }
      case 2: // $bb1
        var $9=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $10=(HEAP[$9+3]<<24)|(HEAP[$9+2]<<16)|(HEAP[$9+1]<<8)|(HEAP[$9]);
        var $11=_llvm_objectsize_i32($10, 0);
        var $12=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $13=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $14=(HEAP[$13+3]<<24)|(HEAP[$13+2]<<16)|(HEAP[$13+1]<<8)|(HEAP[$13]);
        var $15=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $16=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $17=___memcpy_chk($14, $16, $12, $11);
         HEAP[$iftmp_62+3] = ($17>>24)&0xff; HEAP[$iftmp_62+2] = ($17>>16)&0xff; HEAP[$iftmp_62+1] = ($17>>8)&0xff; HEAP[$iftmp_62] = ($17)&0xff;
        __label__ = 4; break;
      case 3: // $bb2
        var $18=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $19=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $20=(HEAP[$19+3]<<24)|(HEAP[$19+2]<<16)|(HEAP[$19+1]<<8)|(HEAP[$19]);
        var $21=(HEAP[$p_addr+3]<<24)|(HEAP[$p_addr+2]<<16)|(HEAP[$p_addr+1]<<8)|(HEAP[$p_addr]);
        var $22=___inline_memcpy_chk($20, $21, $18);
         HEAP[$iftmp_62+3] = ($22>>24)&0xff; HEAP[$iftmp_62+2] = ($22>>16)&0xff; HEAP[$iftmp_62+1] = ($22>>8)&0xff; HEAP[$iftmp_62] = ($22)&0xff;
        __label__ = 4; break;
      case 4: // $bb3
        var $23=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
        var $24=(HEAP[$23+3]<<24)|(HEAP[$23+2]<<16)|(HEAP[$23+1]<<8)|(HEAP[$23]);
        var $25=(HEAP[$n_addr+3]<<24)|(HEAP[$n_addr+2]<<16)|(HEAP[$n_addr+1]<<8)|(HEAP[$n_addr]);
        var $26=(($24+$25)&4294967295);
        var $27=(HEAP[$fp_addr+3]<<24)|(HEAP[$fp_addr+2]<<16)|(HEAP[$fp_addr+1]<<8)|(HEAP[$fp_addr]);
         HEAP[$27+3] = ($26>>24)&0xff; HEAP[$27+2] = ($26>>16)&0xff; HEAP[$27+1] = ($26>>8)&0xff; HEAP[$27] = ($26)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        __label__ = 6; break;
      case 6: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_memcpy_chk($__dest, $__src, $__len) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__src_addr=__stackBase__+4;
        var $__len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__src_addr+3] = ($__src>>24)&0xff; HEAP[$__src_addr+2] = ($__src>>16)&0xff; HEAP[$__src_addr+1] = ($__src>>8)&0xff; HEAP[$__src_addr] = ($__src)&0xff;
         HEAP[$__len_addr+3] = ($__len>>24)&0xff; HEAP[$__len_addr+2] = ($__len>>16)&0xff; HEAP[$__len_addr+1] = ($__len>>8)&0xff; HEAP[$__len_addr] = ($__len)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $5=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $6=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $7=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $8=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $9=___memcpy_chk($6, $7, $8, $2);
         HEAP[$0+3] = ($9>>24)&0xff; HEAP[$0+2] = ($9>>16)&0xff; HEAP[$0+1] = ($9>>8)&0xff; HEAP[$0] = ($9)&0xff;
        var $10=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($10>>24)&0xff; HEAP[$retval+2] = ($10>>16)&0xff; HEAP[$retval+1] = ($10>>8)&0xff; HEAP[$retval] = ($10)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _init_code_cache() {
    ;
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
         HEAP[_getc_euc_cache+3] = (-1>>24)&0xff; HEAP[_getc_euc_cache+2] = (-1>>16)&0xff; HEAP[_getc_euc_cache+1] = (-1>>8)&0xff; HEAP[_getc_euc_cache] = (-1)&0xff;
        __label__ = 1; break;
      case 1: // $return
        ;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _init_getbits() {
    ;
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
         HEAP[_bitbuf+1] = (0>>8)&0xff; HEAP[_bitbuf] = (0)&0xff;
         HEAP[_subbitbuf] = (0)&0xff;
         HEAP[_bitcount] = (0)&0xff;
        _fillbuf(16);
        __label__ = 1; break;
      case 1: // $return
        ;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _init_putbits() {
    ;
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
         HEAP[_bitcount] = (8)&0xff;
         HEAP[_subbitbuf] = (0)&0xff;
         HEAP[_getc_euc_cache+3] = (-1>>24)&0xff; HEAP[_getc_euc_cache+2] = (-1>>16)&0xff; HEAP[_getc_euc_cache+1] = (-1>>8)&0xff; HEAP[_getc_euc_cache] = (-1)&0xff;
        __label__ = 1; break;
      case 1: // $return
        ;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _read_pt_len($nn, $nbit, $i_special) {
    var __stackBase__  = STACKTOP; STACKTOP += 18; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 18);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $nn_addr=__stackBase__;
        var $nbit_addr=__stackBase__+2;
        var $i_special_addr=__stackBase__+4;
        var $iftmp_68=__stackBase__+6;
        var $i=__stackBase__+10;
        var $c=__stackBase__+12;
        var $n=__stackBase__+14;
        var $mask=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$nn_addr+1] = ($nn>>8)&0xff; HEAP[$nn_addr] = ($nn)&0xff;
         HEAP[$nbit_addr+1] = ($nbit>>8)&0xff; HEAP[$nbit_addr] = ($nbit)&0xff;
         HEAP[$i_special_addr+1] = ($i_special>>8)&0xff; HEAP[$i_special_addr] = ($i_special)&0xff;
        var $0=(HEAP[$nbit_addr+1]<<8)|(HEAP[$nbit_addr]);
        var $1=((($0)) & 255);
        var $2=unSign(($1), 8, 0);
        var $3=((($2)) & 255);
        var $4=_getbits($3);
         HEAP[$n+1] = ($4>>8)&0xff; HEAP[$n] = ($4)&0xff;
        var $5=(HEAP[$n+1]<<8)|(HEAP[$n]);
        var $6=reSign(($5), 16, 0)==0;
        if ($6) { __label__ = 1; break; } else { __label__ = 8; break; }
      case 1: // $bb
        var $7=(HEAP[$nbit_addr+1]<<8)|(HEAP[$nbit_addr]);
        var $8=((($7)) & 255);
        var $9=unSign(($8), 8, 0);
        var $10=((($9)) & 255);
        var $11=_getbits($10);
         HEAP[$c+1] = ($11>>8)&0xff; HEAP[$c] = ($11)&0xff;
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
        var $12=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $13=reSign(($12), 16, 0);
        var $14=((_pt_len+$13)&4294967295);
         HEAP[$14] = (0)&0xff;
        var $15=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $16=((($15) + 1)&65535);
         HEAP[$i+1] = ($16>>8)&0xff; HEAP[$i] = ($16)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $17=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $18=(HEAP[$nn_addr+1]<<8)|(HEAP[$nn_addr]);
        var $19=reSign(($17), 16, 0) < reSign(($18), 16, 0);
        if ($19) { __label__ = 2; break; } else { __label__ = 4; break; }
      case 4: // $bb3
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 6; break;
      case 5: // $bb4
        var $20=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $21=reSign(($20), 16, 0);
        var $22=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $23=((_pt_table+$21*2)&4294967295);
         HEAP[$23+1] = ($22>>8)&0xff; HEAP[$23] = ($22)&0xff;
        var $24=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $25=((($24) + 1)&65535);
         HEAP[$i+1] = ($25>>8)&0xff; HEAP[$i] = ($25)&0xff;
        __label__ = 6; break;
      case 6: // $bb5
        var $26=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $27=reSign(($26), 16, 0) <= 255;
        if ($27) { __label__ = 5; break; } else { __label__ = 7; break; }
      case 7: // $bb6
        __label__ = 25; break;
      case 8: // $bb7
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 20; break;
      case 9: // $bb8
        var $28=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $29=unSign(($28), 16, 0) >>> 13;
         HEAP[$c+1] = ($29>>8)&0xff; HEAP[$c] = ($29)&0xff;
        var $30=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $31=reSign(($30), 16, 0)==7;
        if ($31) { __label__ = 10; break; } else { __label__ = 13; break; }
      case 10: // $bb9
         HEAP[$mask+1] = (4096>>8)&0xff; HEAP[$mask] = (4096)&0xff;
        __label__ = 12; break;
      case 11: // $bb10
        var $32=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $33=unSign(($32), 16, 0) >>> 1;
         HEAP[$mask+1] = ($33>>8)&0xff; HEAP[$mask] = ($33)&0xff;
        var $34=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $35=((($34) + 1)&65535);
         HEAP[$c+1] = ($35>>8)&0xff; HEAP[$c] = ($35)&0xff;
        __label__ = 12; break;
      case 12: // $bb11
        var $36=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $37=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $38=($37) & ($36);
        var $39=reSign(($38), 16, 0)!=0;
        if ($39) { __label__ = 11; break; } else { __label__ = 13; break; }
      case 13: // $bb12
        var $40=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $41=reSign(($40), 16, 0) > 6;
        if ($41) { __label__ = 14; break; } else { __label__ = 15; break; }
      case 14: // $bb13
        var $42=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $43=((($42)) & 255);
        var $44=((($43) - 3)&255);
        var $45=unSign(($44), 8, 0);
         HEAP[$iftmp_68+3] = ($45>>24)&0xff; HEAP[$iftmp_68+2] = ($45>>16)&0xff; HEAP[$iftmp_68+1] = ($45>>8)&0xff; HEAP[$iftmp_68] = ($45)&0xff;
        __label__ = 16; break;
      case 15: // $bb14
         HEAP[$iftmp_68+3] = (3>>24)&0xff; HEAP[$iftmp_68+2] = (3>>16)&0xff; HEAP[$iftmp_68+1] = (3>>8)&0xff; HEAP[$iftmp_68] = (3)&0xff;
        __label__ = 16; break;
      case 16: // $bb15
        var $46=(HEAP[$iftmp_68+3]<<24)|(HEAP[$iftmp_68+2]<<16)|(HEAP[$iftmp_68+1]<<8)|(HEAP[$iftmp_68]);
        var $47=((($46)) & 255);
        _fillbuf($47);
        var $48=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $49=reSign(($48), 16, 0);
        var $50=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $51=((($50)) & 255);
        var $52=((_pt_len+$49)&4294967295);
         HEAP[$52] = ($51)&0xff;
        var $53=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $54=((($53) + 1)&65535);
         HEAP[$i+1] = ($54>>8)&0xff; HEAP[$i] = ($54)&0xff;
        var $55=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $56=(HEAP[$i_special_addr+1]<<8)|(HEAP[$i_special_addr]);
        var $57=reSign(($55), 16, 0)==reSign(($56), 16, 0);
        if ($57) { __label__ = 17; break; } else { __label__ = 20; break; }
      case 17: // $bb16
        var $58=_getbits(2);
         HEAP[$c+1] = ($58>>8)&0xff; HEAP[$c] = ($58)&0xff;
        __label__ = 19; break;
      case 18: // $bb17
        var $59=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $60=reSign(($59), 16, 0);
        var $61=((_pt_len+$60)&4294967295);
         HEAP[$61] = (0)&0xff;
        var $62=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $63=((($62) + 1)&65535);
         HEAP[$i+1] = ($63>>8)&0xff; HEAP[$i] = ($63)&0xff;
        __label__ = 19; break;
      case 19: // $bb18
        var $64=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $65=((($64) - 1)&65535);
         HEAP[$c+1] = ($65>>8)&0xff; HEAP[$c] = ($65)&0xff;
        var $66=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $67=reSign(($66), 16, 0) >= 0;
        if ($67) { __label__ = 18; break; } else { __label__ = 20; break; }
      case 20: // $bb19
        var $68=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $69=(HEAP[$n+1]<<8)|(HEAP[$n]);
        var $70=reSign(($68), 16, 0) < reSign(($69), 16, 0);
        if ($70) { __label__ = 9; break; } else { __label__ = 21; break; }
      case 21: // $bb20
        __label__ = 23; break;
      case 22: // $bb21
        var $71=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $72=reSign(($71), 16, 0);
        var $73=((_pt_len+$72)&4294967295);
         HEAP[$73] = (0)&0xff;
        var $74=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $75=((($74) + 1)&65535);
         HEAP[$i+1] = ($75>>8)&0xff; HEAP[$i] = ($75)&0xff;
        __label__ = 23; break;
      case 23: // $bb22
        var $76=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $77=(HEAP[$nn_addr+1]<<8)|(HEAP[$nn_addr]);
        var $78=reSign(($76), 16, 0) < reSign(($77), 16, 0);
        if ($78) { __label__ = 22; break; } else { __label__ = 24; break; }
      case 24: // $bb23
        var $79=(HEAP[$nn_addr+1]<<8)|(HEAP[$nn_addr]);
        var $80=reSign(($79), 16, 0);
        var $81=((($80)) & 65535);
        _make_table($81, ((_pt_len)&4294967295), 8, ((_pt_table)&4294967295));
        __label__ = 25; break;
      case 25: // $bb24
        __label__ = 26; break;
      case 26: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _read_c_len() {
    var __stackBase__  = STACKTOP; STACKTOP += 8; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 8);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $i=__stackBase__;
        var $c=__stackBase__+2;
        var $n=__stackBase__+4;
        var $mask=__stackBase__+6;
        var $_alloca_point_=0;
        var $0=_getbits(9);
         HEAP[$n+1] = ($0>>8)&0xff; HEAP[$n] = ($0)&0xff;
        var $1=(HEAP[$n+1]<<8)|(HEAP[$n]);
        var $2=reSign(($1), 16, 0)==0;
        if ($2) { __label__ = 1; break; } else { __label__ = 8; break; }
      case 1: // $bb
        var $3=_getbits(9);
         HEAP[$c+1] = ($3>>8)&0xff; HEAP[$c] = ($3)&0xff;
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
        var $4=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $5=reSign(($4), 16, 0);
        var $6=((_c_len+$5)&4294967295);
         HEAP[$6] = (0)&0xff;
        var $7=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $8=((($7) + 1)&65535);
         HEAP[$i+1] = ($8>>8)&0xff; HEAP[$i] = ($8)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $9=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $10=reSign(($9), 16, 0) <= 509;
        if ($10) { __label__ = 2; break; } else { __label__ = 4; break; }
      case 4: // $bb3
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 6; break;
      case 5: // $bb4
        var $11=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $12=reSign(($11), 16, 0);
        var $13=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $14=((_c_table+$12*2)&4294967295);
         HEAP[$14+1] = ($13>>8)&0xff; HEAP[$14] = ($13)&0xff;
        var $15=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $16=((($15) + 1)&65535);
         HEAP[$i+1] = ($16>>8)&0xff; HEAP[$i] = ($16)&0xff;
        __label__ = 6; break;
      case 6: // $bb5
        var $17=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $18=reSign(($17), 16, 0) <= 4095;
        if ($18) { __label__ = 5; break; } else { __label__ = 7; break; }
      case 7: // $bb6
        __label__ = 31; break;
      case 8: // $bb7
         HEAP[$i+1] = (0>>8)&0xff; HEAP[$i] = (0)&0xff;
        __label__ = 26; break;
      case 9: // $bb8
        var $19=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $20=unSign(($19), 16, 0) >>> 8;
        var $21=unSign(($20), 16, 0);
        var $22=((_pt_table+$21*2)&4294967295);
        var $23=(HEAP[$22+1]<<8)|(HEAP[$22]);
         HEAP[$c+1] = ($23>>8)&0xff; HEAP[$c] = ($23)&0xff;
        var $24=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $25=reSign(($24), 16, 0) > 18;
        if ($25) { __label__ = 10; break; } else { __label__ = 15; break; }
      case 10: // $bb9
         HEAP[$mask+1] = (128>>8)&0xff; HEAP[$mask] = (128)&0xff;
        __label__ = 11; break;
      case 11: // $bb10
        var $26=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $27=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $28=($26) & ($27);
        var $29=reSign(($28), 16, 0)!=0;
        if ($29) { __label__ = 12; break; } else { __label__ = 13; break; }
      case 12: // $bb11
        var $30=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $31=reSign(($30), 16, 0);
        var $32=((_right+$31*2)&4294967295);
        var $33=(HEAP[$32+1]<<8)|(HEAP[$32]);
         HEAP[$c+1] = ($33>>8)&0xff; HEAP[$c] = ($33)&0xff;
        __label__ = 14; break;
      case 13: // $bb12
        var $34=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $35=reSign(($34), 16, 0);
        var $36=((_left+$35*2)&4294967295);
        var $37=(HEAP[$36+1]<<8)|(HEAP[$36]);
         HEAP[$c+1] = ($37>>8)&0xff; HEAP[$c] = ($37)&0xff;
        __label__ = 14; break;
      case 14: // $bb13
        var $38=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $39=unSign(($38), 16, 0) >>> 1;
         HEAP[$mask+1] = ($39>>8)&0xff; HEAP[$mask] = ($39)&0xff;
        var $40=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $41=reSign(($40), 16, 0) > 18;
        if ($41) { __label__ = 11; break; } else { __label__ = 15; break; }
      case 15: // $bb14
        var $42=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $43=reSign(($42), 16, 0);
        var $44=((_pt_len+$43)&4294967295);
        var $45=(HEAP[$44]);
        var $46=unSign(($45), 8, 0);
        var $47=((($46)) & 255);
        _fillbuf($47);
        var $48=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $49=reSign(($48), 16, 0) <= 2;
        if ($49) { __label__ = 16; break; } else { __label__ = 25; break; }
      case 16: // $bb15
        var $50=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $51=reSign(($50), 16, 0)==0;
        if ($51) { __label__ = 17; break; } else { __label__ = 18; break; }
      case 17: // $bb16
         HEAP[$c+1] = (1>>8)&0xff; HEAP[$c] = (1)&0xff;
        __label__ = 21; break;
      case 18: // $bb17
        var $52=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $53=reSign(($52), 16, 0)==1;
        if ($53) { __label__ = 19; break; } else { __label__ = 20; break; }
      case 19: // $bb18
        var $54=_getbits(4);
        var $55=((($54) + 3)&65535);
         HEAP[$c+1] = ($55>>8)&0xff; HEAP[$c] = ($55)&0xff;
        __label__ = 21; break;
      case 20: // $bb19
        var $56=_getbits(9);
        var $57=((($56) + 20)&65535);
         HEAP[$c+1] = ($57>>8)&0xff; HEAP[$c] = ($57)&0xff;
        __label__ = 21; break;
      case 21: // $bb20
        __label__ = 23; break;
      case 22: // $bb21
        var $58=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $59=reSign(($58), 16, 0);
        var $60=((_c_len+$59)&4294967295);
         HEAP[$60] = (0)&0xff;
        var $61=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $62=((($61) + 1)&65535);
         HEAP[$i+1] = ($62>>8)&0xff; HEAP[$i] = ($62)&0xff;
        __label__ = 23; break;
      case 23: // $bb22
        var $63=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $64=((($63) - 1)&65535);
         HEAP[$c+1] = ($64>>8)&0xff; HEAP[$c] = ($64)&0xff;
        var $65=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $66=reSign(($65), 16, 0) >= 0;
        if ($66) { __label__ = 22; break; } else { __label__ = 24; break; }
      case 24: // $bb23
        __label__ = 26; break;
      case 25: // $bb24
        var $67=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $68=reSign(($67), 16, 0);
        var $69=(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $70=((($69)) & 255);
        var $71=((($70) - 2)&255);
        var $72=((_c_len+$68)&4294967295);
         HEAP[$72] = ($71)&0xff;
        var $73=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $74=((($73) + 1)&65535);
         HEAP[$i+1] = ($74>>8)&0xff; HEAP[$i] = ($74)&0xff;
        __label__ = 26; break;
      case 26: // $bb25
        var $75=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $76=(HEAP[$n+1]<<8)|(HEAP[$n]);
        var $77=reSign(($75), 16, 0) < reSign(($76), 16, 0);
        if ($77) { __label__ = 9; break; } else { __label__ = 27; break; }
      case 27: // $bb26
        __label__ = 29; break;
      case 28: // $bb27
        var $78=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $79=reSign(($78), 16, 0);
        var $80=((_c_len+$79)&4294967295);
         HEAP[$80] = (0)&0xff;
        var $81=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $82=((($81) + 1)&65535);
         HEAP[$i+1] = ($82>>8)&0xff; HEAP[$i] = ($82)&0xff;
        __label__ = 29; break;
      case 29: // $bb28
        var $83=(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $84=reSign(($83), 16, 0) <= 509;
        if ($84) { __label__ = 28; break; } else { __label__ = 30; break; }
      case 30: // $bb29
        _make_table(510, ((_c_len)&4294967295), 12, ((_c_table)&4294967295));
        __label__ = 31; break;
      case 31: // $bb30
        __label__ = 32; break;
      case 32: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _decode_c_st1() {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $retval=__stackBase__;
        var $0=__stackBase__+4;
        var $j=__stackBase__+8;
        var $mask=__stackBase__+10;
        var $_alloca_point_=0;
        var $1=(HEAP[_blocksize+1]<<8)|(HEAP[_blocksize]);
        var $2=reSign(($1), 16, 0)==0;
        if ($2) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $3=_getbits(16);
         HEAP[_blocksize+1] = ($3>>8)&0xff; HEAP[_blocksize] = ($3)&0xff;
        _read_pt_len(19, 5, 3);
        _read_c_len();
        _read_pt_len(14, 4, -1);
        __label__ = 2; break;
      case 2: // $bb1
        var $4=(HEAP[_blocksize+1]<<8)|(HEAP[_blocksize]);
        var $5=((($4) - 1)&65535);
         HEAP[_blocksize+1] = ($5>>8)&0xff; HEAP[_blocksize] = ($5)&0xff;
        var $6=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $7=unSign(($6), 16, 0) >>> 4;
        var $8=unSign(($7), 16, 0);
        var $9=((_c_table+$8*2)&4294967295);
        var $10=(HEAP[$9+1]<<8)|(HEAP[$9]);
         HEAP[$j+1] = ($10>>8)&0xff; HEAP[$j] = ($10)&0xff;
        var $11=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $12=unSign(($11), 16, 0) <= 509;
        if ($12) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
        var $13=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $14=unSign(($13), 16, 0);
        var $15=((_c_len+$14)&4294967295);
        var $16=(HEAP[$15]);
        var $17=unSign(($16), 8, 0);
        var $18=((($17)) & 255);
        _fillbuf($18);
        __label__ = 10; break;
      case 4: // $bb3
        _fillbuf(12);
         HEAP[$mask+1] = (-32768>>8)&0xff; HEAP[$mask] = (-32768)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        var $19=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $20=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $21=($19) & ($20);
        var $22=reSign(($21), 16, 0)!=0;
        if ($22) { __label__ = 6; break; } else { __label__ = 7; break; }
      case 6: // $bb5
        var $23=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $24=unSign(($23), 16, 0);
        var $25=((_right+$24*2)&4294967295);
        var $26=(HEAP[$25+1]<<8)|(HEAP[$25]);
         HEAP[$j+1] = ($26>>8)&0xff; HEAP[$j] = ($26)&0xff;
        __label__ = 8; break;
      case 7: // $bb6
        var $27=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $28=unSign(($27), 16, 0);
        var $29=((_left+$28*2)&4294967295);
        var $30=(HEAP[$29+1]<<8)|(HEAP[$29]);
         HEAP[$j+1] = ($30>>8)&0xff; HEAP[$j] = ($30)&0xff;
        __label__ = 8; break;
      case 8: // $bb7
        var $31=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $32=unSign(($31), 16, 0) >>> 1;
         HEAP[$mask+1] = ($32>>8)&0xff; HEAP[$mask] = ($32)&0xff;
        var $33=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $34=unSign(($33), 16, 0) > 509;
        if ($34) { __label__ = 5; break; } else { __label__ = 9; break; }
      case 9: // $bb8
        var $35=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $36=unSign(($35), 16, 0);
        var $37=((_c_len+$36)&4294967295);
        var $38=(HEAP[$37]);
        var $39=((($38) - 12)&255);
        var $40=unSign(($39), 8, 0);
        var $41=((($40)) & 255);
        _fillbuf($41);
        __label__ = 10; break;
      case 10: // $bb9
        var $42=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $43=unSign(($42), 16, 0);
         HEAP[$0+3] = ($43>>24)&0xff; HEAP[$0+2] = ($43>>16)&0xff; HEAP[$0+1] = ($43>>8)&0xff; HEAP[$0] = ($43)&0xff;
        var $44=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($44>>24)&0xff; HEAP[$retval+2] = ($44>>16)&0xff; HEAP[$retval+1] = ($44>>8)&0xff; HEAP[$retval] = ($44)&0xff;
        __label__ = 11; break;
      case 11: // $return
        var $retval10=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval1011=((($retval10)) & 65535);
        STACKTOP = __stackBase__;
        return $retval1011;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _decode_p_st1() {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $retval=__stackBase__;
        var $0=__stackBase__+4;
        var $j=__stackBase__+8;
        var $mask=__stackBase__+10;
        var $_alloca_point_=0;
        var $1=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $2=unSign(($1), 16, 0) >>> 8;
        var $3=unSign(($2), 16, 0);
        var $4=((_pt_table+$3*2)&4294967295);
        var $5=(HEAP[$4+1]<<8)|(HEAP[$4]);
         HEAP[$j+1] = ($5>>8)&0xff; HEAP[$j] = ($5)&0xff;
        var $6=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $7=unSign(($6), 16, 0) <= 13;
        if ($7) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $8=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $9=unSign(($8), 16, 0);
        var $10=((_pt_len+$9)&4294967295);
        var $11=(HEAP[$10]);
        var $12=unSign(($11), 8, 0);
        var $13=((($12)) & 255);
        _fillbuf($13);
        __label__ = 8; break;
      case 2: // $bb1
        _fillbuf(8);
         HEAP[$mask+1] = (-32768>>8)&0xff; HEAP[$mask] = (-32768)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $14=(HEAP[_bitbuf+1]<<8)|(HEAP[_bitbuf]);
        var $15=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $16=($14) & ($15);
        var $17=reSign(($16), 16, 0)!=0;
        if ($17) { __label__ = 4; break; } else { __label__ = 5; break; }
      case 4: // $bb3
        var $18=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $19=unSign(($18), 16, 0);
        var $20=((_right+$19*2)&4294967295);
        var $21=(HEAP[$20+1]<<8)|(HEAP[$20]);
         HEAP[$j+1] = ($21>>8)&0xff; HEAP[$j] = ($21)&0xff;
        __label__ = 6; break;
      case 5: // $bb4
        var $22=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $23=unSign(($22), 16, 0);
        var $24=((_left+$23*2)&4294967295);
        var $25=(HEAP[$24+1]<<8)|(HEAP[$24]);
         HEAP[$j+1] = ($25>>8)&0xff; HEAP[$j] = ($25)&0xff;
        __label__ = 6; break;
      case 6: // $bb5
        var $26=(HEAP[$mask+1]<<8)|(HEAP[$mask]);
        var $27=unSign(($26), 16, 0) >>> 1;
         HEAP[$mask+1] = ($27>>8)&0xff; HEAP[$mask] = ($27)&0xff;
        var $28=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $29=unSign(($28), 16, 0) > 13;
        if ($29) { __label__ = 3; break; } else { __label__ = 7; break; }
      case 7: // $bb6
        var $30=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $31=unSign(($30), 16, 0);
        var $32=((_pt_len+$31)&4294967295);
        var $33=(HEAP[$32]);
        var $34=((($33) - 8)&255);
        var $35=unSign(($34), 8, 0);
        var $36=((($35)) & 255);
        _fillbuf($36);
        __label__ = 8; break;
      case 8: // $bb7
        var $37=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $38=reSign(($37), 16, 0)!=0;
        if ($38) { __label__ = 9; break; } else { __label__ = 10; break; }
      case 9: // $bb8
        var $39=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $40=unSign(($39), 16, 0);
        var $41=((($40) - 1)&4294967295);
        var $42=1 << ($41);
        var $43=((($42)) & 65535);
        var $44=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $45=((($44)) & 255);
        var $46=((($45) - 1)&255);
        var $47=unSign(($46), 8, 0);
        var $48=((($47)) & 255);
        var $49=_getbits($48);
        var $50=((($43) + ($49))&65535);
         HEAP[$j+1] = ($50>>8)&0xff; HEAP[$j] = ($50)&0xff;
        __label__ = 10; break;
      case 10: // $bb9
        var $51=(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $52=unSign(($51), 16, 0);
         HEAP[$0+3] = ($52>>24)&0xff; HEAP[$0+2] = ($52>>16)&0xff; HEAP[$0+1] = ($52>>8)&0xff; HEAP[$0] = ($52)&0xff;
        var $53=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($53>>24)&0xff; HEAP[$retval+2] = ($53>>16)&0xff; HEAP[$retval+1] = ($53>>8)&0xff; HEAP[$retval] = ($53)&0xff;
        __label__ = 11; break;
      case 11: // $return
        var $retval10=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval1011=((($retval10)) & 65535);
        STACKTOP = __stackBase__;
        return $retval1011;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _decode_start_st1() {
    ;
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        _init_getbits();
         HEAP[_blocksize+1] = (0>>8)&0xff; HEAP[_blocksize] = (0)&0xff;
        __label__ = 1; break;
      case 1: // $return
        ;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _decode_lh5($infp, $outfp, $original_size, $packed_size) {
    var __stackBase__  = STACKTOP; STACKTOP += 52; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 52);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $infp_addr=__stackBase__;
        var $outfp_addr=__stackBase__+4;
        var $original_size_addr=__stackBase__+8;
        var $packed_size_addr=__stackBase__+12;
        var $retval=__stackBase__+16;
        var $iftmp_85=__stackBase__+20;
        var $0=__stackBase__+24;
        var $i=__stackBase__+28;
        var $j=__stackBase__+32;
        var $k=__stackBase__+36;
        var $c=__stackBase__+40;
        var $dicsiz1=__stackBase__+44;
        var $offset=__stackBase__+48;
        var $_alloca_point_=0;
         HEAP[$infp_addr+3] = ($infp>>24)&0xff; HEAP[$infp_addr+2] = ($infp>>16)&0xff; HEAP[$infp_addr+1] = ($infp>>8)&0xff; HEAP[$infp_addr] = ($infp)&0xff;
         HEAP[$outfp_addr+3] = ($outfp>>24)&0xff; HEAP[$outfp_addr+2] = ($outfp>>16)&0xff; HEAP[$outfp_addr+1] = ($outfp>>8)&0xff; HEAP[$outfp_addr] = ($outfp)&0xff;
         HEAP[$original_size_addr+3] = ($original_size>>24)&0xff; HEAP[$original_size_addr+2] = ($original_size>>16)&0xff; HEAP[$original_size_addr+1] = ($original_size>>8)&0xff; HEAP[$original_size_addr] = ($original_size)&0xff;
         HEAP[$packed_size_addr+3] = ($packed_size>>24)&0xff; HEAP[$packed_size_addr+2] = ($packed_size>>16)&0xff; HEAP[$packed_size_addr+1] = ($packed_size>>8)&0xff; HEAP[$packed_size_addr] = ($packed_size)&0xff;
        var $1=(HEAP[$infp_addr+3]<<24)|(HEAP[$infp_addr+2]<<16)|(HEAP[$infp_addr+1]<<8)|(HEAP[$infp_addr]);
         HEAP[_infileptr+3] = ($1>>24)&0xff; HEAP[_infileptr+2] = ($1>>16)&0xff; HEAP[_infileptr+1] = ($1>>8)&0xff; HEAP[_infileptr] = ($1)&0xff;
        var $2=(HEAP[$outfp_addr+3]<<24)|(HEAP[$outfp_addr+2]<<16)|(HEAP[$outfp_addr+1]<<8)|(HEAP[$outfp_addr]);
         HEAP[_outfileptr+3] = ($2>>24)&0xff; HEAP[_outfileptr+2] = ($2>>16)&0xff; HEAP[_outfileptr+1] = ($2>>8)&0xff; HEAP[_outfileptr] = ($2)&0xff;
         HEAP[_dicbit+1] = (13>>8)&0xff; HEAP[_dicbit] = (13)&0xff;
        var $3=(HEAP[$original_size_addr+3]<<24)|(HEAP[$original_size_addr+2]<<16)|(HEAP[$original_size_addr+1]<<8)|(HEAP[$original_size_addr]);
         HEAP[_origsize+3] = ($3>>24)&0xff; HEAP[_origsize+2] = ($3>>16)&0xff; HEAP[_origsize+1] = ($3>>8)&0xff; HEAP[_origsize] = ($3)&0xff;
        var $4=(HEAP[$packed_size_addr+3]<<24)|(HEAP[$packed_size_addr+2]<<16)|(HEAP[$packed_size_addr+1]<<8)|(HEAP[$packed_size_addr]);
         HEAP[_compsize+3] = ($4>>24)&0xff; HEAP[_compsize+2] = ($4>>16)&0xff; HEAP[_compsize+1] = ($4>>8)&0xff; HEAP[_compsize] = ($4)&0xff;
         HEAP[_crc+1] = (0>>8)&0xff; HEAP[_crc] = (0)&0xff;
         HEAP[_prev_char+3] = (-1>>24)&0xff; HEAP[_prev_char+2] = (-1>>16)&0xff; HEAP[_prev_char+1] = (-1>>8)&0xff; HEAP[_prev_char] = (-1)&0xff;
        var $5=(HEAP[_dicbit+1]<<8)|(HEAP[_dicbit]);
        var $6=unSign(($5), 16, 0);
        var $7=1 << ($6);
        var $8=((($7)) & 65535);
         HEAP[_dicsiz+1] = ($8>>8)&0xff; HEAP[_dicsiz] = ($8)&0xff;
        var $9=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $10=unSign(($9), 16, 0);
        var $11=_malloc($10);
         HEAP[_text+3] = ($11>>24)&0xff; HEAP[_text+2] = ($11>>16)&0xff; HEAP[_text+1] = ($11>>8)&0xff; HEAP[_text] = ($11)&0xff;
        var $12=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $13=($12)==0;
        if ($13) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 19; break;
      case 2: // $bb1
        var $14=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $15=_llvm_objectsize_i32($14, 0);
        var $16=((($15))|0)!=-1;
        if ($16) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
        var $17=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $18=_llvm_objectsize_i32($17, 0);
        var $19=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $20=unSign(($19), 16, 0);
        var $21=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $22=___memset_chk($21, 32, $20, $18);
         HEAP[$iftmp_85+3] = ($22>>24)&0xff; HEAP[$iftmp_85+2] = ($22>>16)&0xff; HEAP[$iftmp_85+1] = ($22>>8)&0xff; HEAP[$iftmp_85] = ($22)&0xff;
        __label__ = 5; break;
      case 4: // $bb3
        var $23=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $24=unSign(($23), 16, 0);
        var $25=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $26=___inline_memset_chk($25, 32, $24);
         HEAP[$iftmp_85+3] = ($26>>24)&0xff; HEAP[$iftmp_85+2] = ($26>>16)&0xff; HEAP[$iftmp_85+1] = ($26>>8)&0xff; HEAP[$iftmp_85] = ($26)&0xff;
        __label__ = 5; break;
      case 5: // $bb4
        _decode_start_st1();
        var $27=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $28=unSign(($27), 16, 0);
        var $29=((($28) - 1)&4294967295);
         HEAP[$dicsiz1+3] = ($29>>24)&0xff; HEAP[$dicsiz1+2] = ($29>>16)&0xff; HEAP[$dicsiz1+1] = ($29>>8)&0xff; HEAP[$dicsiz1] = ($29)&0xff;
         HEAP[$offset+3] = (253>>24)&0xff; HEAP[$offset+2] = (253>>16)&0xff; HEAP[$offset+1] = (253>>8)&0xff; HEAP[$offset] = (253)&0xff;
         HEAP[_count+3] = (0>>24)&0xff; HEAP[_count+2] = (0>>16)&0xff; HEAP[_count+1] = (0>>8)&0xff; HEAP[_count] = (0)&0xff;
         HEAP[_loc+1] = (0>>8)&0xff; HEAP[_loc] = (0)&0xff;
        __label__ = 15; break;
      case 6: // $bb5
        var $30=_decode_c_st1();
        var $31=unSign(($30), 16, 0);
         HEAP[$c+3] = ($31>>24)&0xff; HEAP[$c+2] = ($31>>16)&0xff; HEAP[$c+1] = ($31>>8)&0xff; HEAP[$c] = ($31)&0xff;
        var $32=(HEAP[$c+3]<<24)|(HEAP[$c+2]<<16)|(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $33=((($32))|0) <= 255;
        if ($33) { __label__ = 7; break; } else { __label__ = 10; break; }
      case 7: // $bb6
        var $34=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $35=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $36=unSign(($35), 16, 0);
        var $37=(HEAP[$c+3]<<24)|(HEAP[$c+2]<<16)|(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $38=((($37)) & 255);
        var $39=(($34+$36)&4294967295);
         HEAP[$39] = ($38)&0xff;
        var $40=((($35) + 1)&65535);
         HEAP[_loc+1] = ($40>>8)&0xff; HEAP[_loc] = ($40)&0xff;
        var $41=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $42=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $43=reSign(($41), 16, 0)==reSign(($42), 16, 0);
        if ($43) { __label__ = 8; break; } else { __label__ = 9; break; }
      case 8: // $bb7
        var $44=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $45=unSign(($44), 16, 0);
        var $46=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        _fwrite_crc($46, $45, _outfileptr);
         HEAP[_loc+1] = (0>>8)&0xff; HEAP[_loc] = (0)&0xff;
        __label__ = 9; break;
      case 9: // $bb8
        var $47=(HEAP[_count+3]<<24)|(HEAP[_count+2]<<16)|(HEAP[_count+1]<<8)|(HEAP[_count]);
        var $48=((($47) + 1)&4294967295);
         HEAP[_count+3] = ($48>>24)&0xff; HEAP[_count+2] = ($48>>16)&0xff; HEAP[_count+1] = ($48>>8)&0xff; HEAP[_count] = ($48)&0xff;
        __label__ = 15; break;
      case 10: // $bb9
        var $49=(HEAP[$c+3]<<24)|(HEAP[$c+2]<<16)|(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $50=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $51=((($49) - ($50))&4294967295);
         HEAP[$j+3] = ($51>>24)&0xff; HEAP[$j+2] = ($51>>16)&0xff; HEAP[$j+1] = ($51>>8)&0xff; HEAP[$j] = ($51)&0xff;
        var $52=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $53=unSign(($52), 16, 0);
        var $54=_decode_p_st1();
        var $55=unSign(($54), 16, 0);
        var $56=((($53) - ($55))&4294967295);
        var $57=((($56) - 1)&4294967295);
        var $58=(HEAP[$dicsiz1+3]<<24)|(HEAP[$dicsiz1+2]<<16)|(HEAP[$dicsiz1+1]<<8)|(HEAP[$dicsiz1]);
        var $59=($57) & ($58);
         HEAP[$i+3] = ($59>>24)&0xff; HEAP[$i+2] = ($59>>16)&0xff; HEAP[$i+1] = ($59>>8)&0xff; HEAP[$i] = ($59)&0xff;
        var $60=(HEAP[_count+3]<<24)|(HEAP[_count+2]<<16)|(HEAP[_count+1]<<8)|(HEAP[_count]);
        var $61=(HEAP[$j+3]<<24)|(HEAP[$j+2]<<16)|(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $62=((($60) + ($61))&4294967295);
         HEAP[_count+3] = ($62>>24)&0xff; HEAP[_count+2] = ($62>>16)&0xff; HEAP[_count+1] = ($62>>8)&0xff; HEAP[_count] = ($62)&0xff;
         HEAP[$k+3] = (0>>24)&0xff; HEAP[$k+2] = (0>>16)&0xff; HEAP[$k+1] = (0>>8)&0xff; HEAP[$k] = (0)&0xff;
        __label__ = 14; break;
      case 11: // $bb10
        var $63=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $64=(HEAP[$i+3]<<24)|(HEAP[$i+2]<<16)|(HEAP[$i+1]<<8)|(HEAP[$i]);
        var $65=(HEAP[$k+3]<<24)|(HEAP[$k+2]<<16)|(HEAP[$k+1]<<8)|(HEAP[$k]);
        var $66=((($64) + ($65))&4294967295);
        var $67=(HEAP[$dicsiz1+3]<<24)|(HEAP[$dicsiz1+2]<<16)|(HEAP[$dicsiz1+1]<<8)|(HEAP[$dicsiz1]);
        var $68=($66) & ($67);
        var $69=(($63+$68)&4294967295);
        var $70=(HEAP[$69]);
        var $71=unSign(($70), 8, 0);
         HEAP[$c+3] = ($71>>24)&0xff; HEAP[$c+2] = ($71>>16)&0xff; HEAP[$c+1] = ($71>>8)&0xff; HEAP[$c] = ($71)&0xff;
        var $72=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        var $73=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $74=unSign(($73), 16, 0);
        var $75=(HEAP[$c+3]<<24)|(HEAP[$c+2]<<16)|(HEAP[$c+1]<<8)|(HEAP[$c]);
        var $76=((($75)) & 255);
        var $77=(($72+$74)&4294967295);
         HEAP[$77] = ($76)&0xff;
        var $78=((($73) + 1)&65535);
         HEAP[_loc+1] = ($78>>8)&0xff; HEAP[_loc] = ($78)&0xff;
        var $79=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $80=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $81=reSign(($79), 16, 0)==reSign(($80), 16, 0);
        if ($81) { __label__ = 12; break; } else { __label__ = 13; break; }
      case 12: // $bb11
        var $82=(HEAP[_dicsiz+1]<<8)|(HEAP[_dicsiz]);
        var $83=unSign(($82), 16, 0);
        var $84=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        _fwrite_crc($84, $83, _outfileptr);
         HEAP[_loc+1] = (0>>8)&0xff; HEAP[_loc] = (0)&0xff;
        __label__ = 13; break;
      case 13: // $bb12
        var $85=(HEAP[$k+3]<<24)|(HEAP[$k+2]<<16)|(HEAP[$k+1]<<8)|(HEAP[$k]);
        var $86=((($85) + 1)&4294967295);
         HEAP[$k+3] = ($86>>24)&0xff; HEAP[$k+2] = ($86>>16)&0xff; HEAP[$k+1] = ($86>>8)&0xff; HEAP[$k] = ($86)&0xff;
        __label__ = 14; break;
      case 14: // $bb13
        var $87=(HEAP[$k+3]<<24)|(HEAP[$k+2]<<16)|(HEAP[$k+1]<<8)|(HEAP[$k]);
        var $88=(HEAP[$j+3]<<24)|(HEAP[$j+2]<<16)|(HEAP[$j+1]<<8)|(HEAP[$j]);
        var $89=((($87))|0) < ((($88))|0);
        if ($89) { __label__ = 11; break; } else { __label__ = 15; break; }
      case 15: // $bb14
        var $90=(HEAP[_count+3]<<24)|(HEAP[_count+2]<<16)|(HEAP[_count+1]<<8)|(HEAP[_count]);
        var $91=(HEAP[_origsize+3]<<24)|(HEAP[_origsize+2]<<16)|(HEAP[_origsize+1]<<8)|(HEAP[_origsize]);
        var $92=((($90))>>>0) < ((($91))>>>0);
        if ($92) { __label__ = 6; break; } else { __label__ = 16; break; }
      case 16: // $bb15
        var $93=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $94=reSign(($93), 16, 0)!=0;
        if ($94) { __label__ = 17; break; } else { __label__ = 18; break; }
      case 17: // $bb16
        var $95=(HEAP[_loc+1]<<8)|(HEAP[_loc]);
        var $96=unSign(($95), 16, 0);
        var $97=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        _fwrite_crc($97, $96, _outfileptr);
        __label__ = 18; break;
      case 18: // $bb17
        var $98=(HEAP[_text+3]<<24)|(HEAP[_text+2]<<16)|(HEAP[_text+1]<<8)|(HEAP[_text]);
        _free($98);
        var $99=(HEAP[_crc+1]<<8)|(HEAP[_crc]);
        var $100=unSign(($99), 16, 0);
         HEAP[$0+3] = ($100>>24)&0xff; HEAP[$0+2] = ($100>>16)&0xff; HEAP[$0+1] = ($100>>8)&0xff; HEAP[$0] = ($100)&0xff;
        __label__ = 19; break;
      case 19: // $bb18
        var $101=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($101>>24)&0xff; HEAP[$retval+2] = ($101>>16)&0xff; HEAP[$retval+1] = ($101>>8)&0xff; HEAP[$retval] = ($101)&0xff;
        __label__ = 20; break;
      case 20: // $return
        var $retval19=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval19;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_memset_chk($__dest, $__val, $__len) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__val_addr=__stackBase__+4;
        var $__len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__val_addr+3] = ($__val>>24)&0xff; HEAP[$__val_addr+2] = ($__val>>16)&0xff; HEAP[$__val_addr+1] = ($__val>>8)&0xff; HEAP[$__val_addr] = ($__val)&0xff;
         HEAP[$__len_addr+3] = ($__len>>24)&0xff; HEAP[$__len_addr+2] = ($__len>>16)&0xff; HEAP[$__len_addr+1] = ($__len>>8)&0xff; HEAP[$__len_addr] = ($__len)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__val_addr+3]<<24)|(HEAP[$__val_addr+2]<<16)|(HEAP[$__val_addr+1]<<8)|(HEAP[$__val_addr]);
        var $5=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $6=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $7=(HEAP[$__val_addr+3]<<24)|(HEAP[$__val_addr+2]<<16)|(HEAP[$__val_addr+1]<<8)|(HEAP[$__val_addr]);
        var $8=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $9=___memset_chk($6, $7, $8, $2);
         HEAP[$0+3] = ($9>>24)&0xff; HEAP[$0+2] = ($9>>16)&0xff; HEAP[$0+1] = ($9>>8)&0xff; HEAP[$0] = ($9)&0xff;
        var $10=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($10>>24)&0xff; HEAP[$retval+2] = ($10>>16)&0xff; HEAP[$retval+1] = ($10>>8)&0xff; HEAP[$retval] = ($10)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _listSplice($list, $first, $pastLast) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $list_addr=__stackBase__;
        var $first_addr=__stackBase__+4;
        var $pastLast_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$list_addr+3] = ($list>>24)&0xff; HEAP[$list_addr+2] = ($list>>16)&0xff; HEAP[$list_addr+1] = ($list>>8)&0xff; HEAP[$list_addr] = ($list)&0xff;
         HEAP[$first_addr+3] = ($first>>24)&0xff; HEAP[$first_addr+2] = ($first>>16)&0xff; HEAP[$first_addr+1] = ($first>>8)&0xff; HEAP[$first_addr] = ($first)&0xff;
         HEAP[$pastLast_addr+3] = ($pastLast>>24)&0xff; HEAP[$pastLast_addr+2] = ($pastLast>>16)&0xff; HEAP[$pastLast_addr+1] = ($pastLast>>8)&0xff; HEAP[$pastLast_addr] = ($pastLast)&0xff;
        var $1=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        _listInit($1);
        var $2=(HEAP[$first_addr+3]<<24)|(HEAP[$first_addr+2]<<16)|(HEAP[$first_addr+1]<<8)|(HEAP[$first_addr]);
        var $3=(HEAP[$pastLast_addr+3]<<24)|(HEAP[$pastLast_addr+2]<<16)|(HEAP[$pastLast_addr+1]<<8)|(HEAP[$pastLast_addr]);
        var $4=($2)==($3);
        if ($4) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $5=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
         HEAP[$0+3] = ($5>>24)&0xff; HEAP[$0+2] = ($5>>16)&0xff; HEAP[$0+1] = ($5>>8)&0xff; HEAP[$0] = ($5)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
        var $6=(HEAP[$first_addr+3]<<24)|(HEAP[$first_addr+2]<<16)|(HEAP[$first_addr+1]<<8)|(HEAP[$first_addr]);
        var $7=(($6+4)&4294967295);
        var $8=(HEAP[$7+3]<<24)|(HEAP[$7+2]<<16)|(HEAP[$7+1]<<8)|(HEAP[$7]);
        var $9=(($8)&4294967295);
        var $10=(HEAP[$pastLast_addr+3]<<24)|(HEAP[$pastLast_addr+2]<<16)|(HEAP[$pastLast_addr+1]<<8)|(HEAP[$pastLast_addr]);
         HEAP[$9+3] = ($10>>24)&0xff; HEAP[$9+2] = ($10>>16)&0xff; HEAP[$9+1] = ($10>>8)&0xff; HEAP[$9] = ($10)&0xff;
        var $11=(HEAP[$pastLast_addr+3]<<24)|(HEAP[$pastLast_addr+2]<<16)|(HEAP[$pastLast_addr+1]<<8)|(HEAP[$pastLast_addr]);
        var $12=(($11+4)&4294967295);
        var $13=(HEAP[$12+3]<<24)|(HEAP[$12+2]<<16)|(HEAP[$12+1]<<8)|(HEAP[$12]);
        var $14=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $15=(($14+8)&4294967295);
        var $16=(($13)&4294967295);
         HEAP[$16+3] = ($15>>24)&0xff; HEAP[$16+2] = ($15>>16)&0xff; HEAP[$16+1] = ($15>>8)&0xff; HEAP[$16] = ($15)&0xff;
        var $17=(HEAP[$pastLast_addr+3]<<24)|(HEAP[$pastLast_addr+2]<<16)|(HEAP[$pastLast_addr+1]<<8)|(HEAP[$pastLast_addr]);
        var $18=(($17+4)&4294967295);
        var $19=(HEAP[$18+3]<<24)|(HEAP[$18+2]<<16)|(HEAP[$18+1]<<8)|(HEAP[$18]);
        var $20=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $21=(($20+8)&4294967295);
        var $22=(($21+4)&4294967295);
         HEAP[$22+3] = ($19>>24)&0xff; HEAP[$22+2] = ($19>>16)&0xff; HEAP[$22+1] = ($19>>8)&0xff; HEAP[$22] = ($19)&0xff;
        var $23=(HEAP[$first_addr+3]<<24)|(HEAP[$first_addr+2]<<16)|(HEAP[$first_addr+1]<<8)|(HEAP[$first_addr]);
        var $24=(($23+4)&4294967295);
        var $25=(HEAP[$24+3]<<24)|(HEAP[$24+2]<<16)|(HEAP[$24+1]<<8)|(HEAP[$24]);
        var $26=(HEAP[$pastLast_addr+3]<<24)|(HEAP[$pastLast_addr+2]<<16)|(HEAP[$pastLast_addr+1]<<8)|(HEAP[$pastLast_addr]);
        var $27=(($26+4)&4294967295);
         HEAP[$27+3] = ($25>>24)&0xff; HEAP[$27+2] = ($25>>16)&0xff; HEAP[$27+1] = ($25>>8)&0xff; HEAP[$27] = ($25)&0xff;
        var $28=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $29=(($28)&4294967295);
        var $30=(HEAP[$first_addr+3]<<24)|(HEAP[$first_addr+2]<<16)|(HEAP[$first_addr+1]<<8)|(HEAP[$first_addr]);
        var $31=(($30+4)&4294967295);
         HEAP[$31+3] = ($29>>24)&0xff; HEAP[$31+2] = ($29>>16)&0xff; HEAP[$31+1] = ($29>>8)&0xff; HEAP[$31] = ($29)&0xff;
        var $32=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $33=(($32)&4294967295);
        var $34=(($33)&4294967295);
        var $35=(HEAP[$first_addr+3]<<24)|(HEAP[$first_addr+2]<<16)|(HEAP[$first_addr+1]<<8)|(HEAP[$first_addr]);
         HEAP[$34+3] = ($35>>24)&0xff; HEAP[$34+2] = ($35>>16)&0xff; HEAP[$34+1] = ($35>>8)&0xff; HEAP[$34] = ($35)&0xff;
        var $36=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
         HEAP[$0+3] = ($36>>24)&0xff; HEAP[$0+2] = ($36>>16)&0xff; HEAP[$0+1] = ($36>>8)&0xff; HEAP[$0] = ($36)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $37=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($37>>24)&0xff; HEAP[$retval+2] = ($37>>16)&0xff; HEAP[$retval+1] = ($37>>8)&0xff; HEAP[$retval] = ($37)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _listInit($list) {
    var __stackBase__  = STACKTOP; STACKTOP += 4; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 4);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $list_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$list_addr+3] = ($list>>24)&0xff; HEAP[$list_addr+2] = ($list>>16)&0xff; HEAP[$list_addr+1] = ($list>>8)&0xff; HEAP[$list_addr] = ($list)&0xff;
        var $0=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $1=(($0+8)&4294967295);
        var $2=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $3=(($2)&4294967295);
        var $4=(($3)&4294967295);
         HEAP[$4+3] = ($1>>24)&0xff; HEAP[$4+2] = ($1>>16)&0xff; HEAP[$4+1] = ($1>>8)&0xff; HEAP[$4] = ($1)&0xff;
        var $5=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $6=(($5)&4294967295);
        var $7=(($6+4)&4294967295);
         HEAP[$7+3] = (0>>24)&0xff; HEAP[$7+2] = (0>>16)&0xff; HEAP[$7+1] = (0>>8)&0xff; HEAP[$7] = (0)&0xff;
        var $8=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $9=(($8+8)&4294967295);
        var $10=(($9)&4294967295);
         HEAP[$10+3] = (0>>24)&0xff; HEAP[$10+2] = (0>>16)&0xff; HEAP[$10+1] = (0>>8)&0xff; HEAP[$10] = (0)&0xff;
        var $11=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $12=(($11)&4294967295);
        var $13=(HEAP[$list_addr+3]<<24)|(HEAP[$list_addr+2]<<16)|(HEAP[$list_addr+1]<<8)|(HEAP[$list_addr]);
        var $14=(($13+8)&4294967295);
        var $15=(($14+4)&4294967295);
         HEAP[$15+3] = ($12>>24)&0xff; HEAP[$15+2] = ($12>>16)&0xff; HEAP[$15+1] = ($12>>8)&0xff; HEAP[$15] = ($12)&0xff;
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _createList() {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $retval=__stackBase__;
        var $0=__stackBase__+4;
        var $result=__stackBase__+8;
        var $_alloca_point_=0;
        var $1=_malloc(16);
        var $2=$1;
         HEAP[$result+3] = ($2>>24)&0xff; HEAP[$result+2] = ($2>>16)&0xff; HEAP[$result+1] = ($2>>8)&0xff; HEAP[$result] = ($2)&0xff;
        var $3=(HEAP[$result+3]<<24)|(HEAP[$result+2]<<16)|(HEAP[$result+1]<<8)|(HEAP[$result]);
        var $4=($3)==0;
        if ($4) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
        var $5=(HEAP[$result+3]<<24)|(HEAP[$result+2]<<16)|(HEAP[$result+1]<<8)|(HEAP[$result]);
        _listInit($5);
        var $6=(HEAP[$result+3]<<24)|(HEAP[$result+2]<<16)|(HEAP[$result+1]<<8)|(HEAP[$result]);
         HEAP[$0+3] = ($6>>24)&0xff; HEAP[$0+2] = ($6>>16)&0xff; HEAP[$0+1] = ($6>>8)&0xff; HEAP[$0] = ($6)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $7=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($7>>24)&0xff; HEAP[$retval+2] = ($7>>16)&0xff; HEAP[$retval+1] = ($7>>8)&0xff; HEAP[$retval] = ($7)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_read_index_data($hyp, $index, $len) {
    var __stackBase__  = STACKTOP; STACKTOP += 52; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 52);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $index_addr=__stackBase__+4;
        var $len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $tmpbuff_9=__stackBase__+16;
        var $0=__stackBase__+20;
        var $buff=__stackBase__+24;
        var $complete_len=__stackBase__+28;
        var $ie=__stackBase__+32;
        var $fh=__stackBase__+36;
        var $cbuff=__stackBase__+40;
        var $tmp_length=__stackBase__+44;
        var $tmpbuff=__stackBase__+48;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$index_addr+3] = ($index>>24)&0xff; HEAP[$index_addr+2] = ($index>>16)&0xff; HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
         HEAP[$len_addr+3] = ($len>>24)&0xff; HEAP[$len_addr+2] = ($len>>16)&0xff; HEAP[$len_addr+1] = ($len>>8)&0xff; HEAP[$len_addr] = ($len)&0xff;
        var $1=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $2=(($1+16)&4294967295);
        var $3=(HEAP[$2+3]<<24)|(HEAP[$2+2]<<16)|(HEAP[$2+1]<<8)|(HEAP[$2]);
        var $4=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $5=(($3+24*$4)&4294967295);
         HEAP[$ie+3] = ($5>>24)&0xff; HEAP[$ie+2] = ($5>>16)&0xff; HEAP[$ie+1] = ($5>>8)&0xff; HEAP[$ie] = ($5)&0xff;
        var $6=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $7=(($6)&4294967295);
        var $8=(HEAP[$7+3]<<24)|(HEAP[$7+2]<<16)|(HEAP[$7+1]<<8)|(HEAP[$7]);
        var $9=___01_fopen$UNIX2003_($8, ((__str23)&4294967295));
         HEAP[$fh+3] = ($9>>24)&0xff; HEAP[$fh+2] = ($9>>16)&0xff; HEAP[$fh+1] = ($9>>8)&0xff; HEAP[$fh] = ($9)&0xff;
        var $10=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $11=($10)==0;
        if ($11) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $12=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
         HEAP[$12+3] = (0>>24)&0xff; HEAP[$12+2] = (0>>16)&0xff; HEAP[$12+1] = (0>>8)&0xff; HEAP[$12] = (0)&0xff;
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 15; break;
      case 2: // $bb1
        var $13=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $14=(($13+16)&4294967295);
        var $15=(HEAP[$14+3]<<24)|(HEAP[$14+2]<<16)|(HEAP[$14+1]<<8)|(HEAP[$14]);
        var $16=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $17=((($16) + 1)&4294967295);
        var $18=(($15+24*$17)&4294967295);
        var $19=(($18+4)&4294967295);
        var $20=(HEAP[$19+3]<<24)|(HEAP[$19+2]<<16)|(HEAP[$19+1]<<8)|(HEAP[$19]);
        var $21=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $22=(($21+4)&4294967295);
        var $23=(HEAP[$22+3]<<24)|(HEAP[$22+2]<<16)|(HEAP[$22+1]<<8)|(HEAP[$22]);
        var $24=((($20) - ($23))&4294967295);
        var $25=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
         HEAP[$25+3] = ($24>>24)&0xff; HEAP[$25+2] = ($24>>16)&0xff; HEAP[$25+1] = ($24>>8)&0xff; HEAP[$25] = ($24)&0xff;
        var $26=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $27=(($26+8)&4294967295);
        var $28=(HEAP[$27+3]<<24)|(HEAP[$27+2]<<16)|(HEAP[$27+1]<<8)|(HEAP[$27]);
        var $29=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $30=(HEAP[$29+3]<<24)|(HEAP[$29+2]<<16)|(HEAP[$29+1]<<8)|(HEAP[$29]);
        var $31=((($28) + ($30))&4294967295);
         HEAP[$complete_len+3] = ($31>>24)&0xff; HEAP[$complete_len+2] = ($31>>16)&0xff; HEAP[$complete_len+1] = ($31>>8)&0xff; HEAP[$complete_len] = ($31)&0xff;
        var $32=(HEAP[$complete_len+3]<<24)|(HEAP[$complete_len+2]<<16)|(HEAP[$complete_len+1]<<8)|(HEAP[$complete_len]);
        var $33=((($32))|0)==0;
        if ($33) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
        var $34=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $35=_fclose($34);
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 15; break;
      case 4: // $bb3
        var $36=(HEAP[$complete_len+3]<<24)|(HEAP[$complete_len+2]<<16)|(HEAP[$complete_len+1]<<8)|(HEAP[$complete_len]);
        var $37=_malloc($36);
         HEAP[$buff+3] = ($37>>24)&0xff; HEAP[$buff+2] = ($37>>16)&0xff; HEAP[$buff+1] = ($37>>8)&0xff; HEAP[$buff] = ($37)&0xff;
        var $38=(HEAP[$buff+3]<<24)|(HEAP[$buff+2]<<16)|(HEAP[$buff+1]<<8)|(HEAP[$buff]);
        var $39=($38)==0;
        if ($39) { __label__ = 5; break; } else { __label__ = 6; break; }
      case 5: // $bb4
        var $40=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $41=_fclose($40);
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 15; break;
      case 6: // $bb5
        var $42=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $43=(($42+4)&4294967295);
        var $44=(HEAP[$43+3]<<24)|(HEAP[$43+2]<<16)|(HEAP[$43+1]<<8)|(HEAP[$43]);
        var $45=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $46=_fseek($45, $44, 0);
        var $47=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $48=(($47+8)&4294967295);
        var $49=(HEAP[$48+3]<<24)|(HEAP[$48+2]<<16)|(HEAP[$48+1]<<8)|(HEAP[$48]);
        var $50=((($49))|0)!=0;
        if ($50) { __label__ = 7; break; } else { __label__ = 8; break; }
      case 7: // $bb6
        var $51=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $52=(HEAP[$51+3]<<24)|(HEAP[$51+2]<<16)|(HEAP[$51+1]<<8)|(HEAP[$51]);
        var $53=_malloc($52);
         HEAP[$cbuff+3] = ($53>>24)&0xff; HEAP[$cbuff+2] = ($53>>16)&0xff; HEAP[$cbuff+1] = ($53>>8)&0xff; HEAP[$cbuff] = ($53)&0xff;
        var $54=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $55=(HEAP[$54+3]<<24)|(HEAP[$54+2]<<16)|(HEAP[$54+1]<<8)|(HEAP[$54]);
        var $56=(HEAP[$cbuff+3]<<24)|(HEAP[$cbuff+2]<<16)|(HEAP[$cbuff+1]<<8)|(HEAP[$cbuff]);
        var $57=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $58=_fread($56, $55, 1, $57);
        var $59=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $60=_fclose($59);
        var $61=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $62=(HEAP[$61+3]<<24)|(HEAP[$61+2]<<16)|(HEAP[$61+1]<<8)|(HEAP[$61]);
        var $63=(HEAP[$complete_len+3]<<24)|(HEAP[$complete_len+2]<<16)|(HEAP[$complete_len+1]<<8)|(HEAP[$complete_len]);
        var $64=(HEAP[$buff+3]<<24)|(HEAP[$buff+2]<<16)|(HEAP[$buff+1]<<8)|(HEAP[$buff]);
        var $65=(HEAP[$cbuff+3]<<24)|(HEAP[$cbuff+2]<<16)|(HEAP[$cbuff+1]<<8)|(HEAP[$cbuff]);
        var $66=_decode_lh5($65, $64, $63, $62);
        var $67=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $68=(HEAP[$67+3]<<24)|(HEAP[$67+2]<<16)|(HEAP[$67+1]<<8)|(HEAP[$67]);
        var $69=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $70=(($69+8)&4294967295);
        var $71=(HEAP[$70+3]<<24)|(HEAP[$70+2]<<16)|(HEAP[$70+1]<<8)|(HEAP[$70]);
        var $72=((($68) + ($71))&4294967295);
        var $73=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
         HEAP[$73+3] = ($72>>24)&0xff; HEAP[$73+2] = ($72>>16)&0xff; HEAP[$73+1] = ($72>>8)&0xff; HEAP[$73] = ($72)&0xff;
        var $74=(HEAP[$cbuff+3]<<24)|(HEAP[$cbuff+2]<<16)|(HEAP[$cbuff+1]<<8)|(HEAP[$cbuff]);
        _free($74);
        __label__ = 9; break;
      case 8: // $bb7
        var $75=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $76=(HEAP[$75+3]<<24)|(HEAP[$75+2]<<16)|(HEAP[$75+1]<<8)|(HEAP[$75]);
        var $77=(HEAP[$buff+3]<<24)|(HEAP[$buff+2]<<16)|(HEAP[$buff+1]<<8)|(HEAP[$buff]);
        var $78=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $79=_fread($77, $76, 1, $78);
        var $80=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $81=_fclose($80);
        __label__ = 9; break;
      case 9: // $bb8
        var $82=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $83=(($82+20)&4294967295);
        var $84=(($83+28)&4294967295);
        var $85=(HEAP[$84+3]<<24)|(HEAP[$84+2]<<16)|(HEAP[$84+1]<<8)|(HEAP[$84]);
        var $86=($85)!=0;
        if ($86) { __label__ = 10; break; } else { __label__ = 14; break; }
      case 10: // $bb9
        var $87=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $88=(($87+20)&4294967295);
        var $89=(($88+28)&4294967295);
        var $90=(HEAP[$89+3]<<24)|(HEAP[$89+2]<<16)|(HEAP[$89+1]<<8)|(HEAP[$89]);
        var $91=(HEAP[$90]);
        var $92=reSign(($91), 8, 0);
        var $93=($92) & 2;
        var $94=((($93))|0)!=0;
        if ($94) { __label__ = 11; break; } else { __label__ = 14; break; }
      case 11: // $bb10
        var $95=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $96=(HEAP[$95+3]<<24)|(HEAP[$95+2]<<16)|(HEAP[$95+1]<<8)|(HEAP[$95]);
         HEAP[$tmp_length+3] = ($96>>24)&0xff; HEAP[$tmp_length+2] = ($96>>16)&0xff; HEAP[$tmp_length+1] = ($96>>8)&0xff; HEAP[$tmp_length] = ($96)&0xff;
        var $97=(HEAP[$buff+3]<<24)|(HEAP[$buff+2]<<16)|(HEAP[$buff+1]<<8)|(HEAP[$buff]);
         HEAP[$tmpbuff+3] = ($97>>24)&0xff; HEAP[$tmpbuff+2] = ($97>>16)&0xff; HEAP[$tmpbuff+1] = ($97>>8)&0xff; HEAP[$tmpbuff] = ($97)&0xff;
        __label__ = 13; break;
      case 12: // $bb11
        var $98=(HEAP[$tmpbuff+3]<<24)|(HEAP[$tmpbuff+2]<<16)|(HEAP[$tmpbuff+1]<<8)|(HEAP[$tmpbuff]);
         HEAP[$tmpbuff_9+3] = ($98>>24)&0xff; HEAP[$tmpbuff_9+2] = ($98>>16)&0xff; HEAP[$tmpbuff_9+1] = ($98>>8)&0xff; HEAP[$tmpbuff_9] = ($98)&0xff;
        var $99=(HEAP[$tmpbuff_9+3]<<24)|(HEAP[$tmpbuff_9+2]<<16)|(HEAP[$tmpbuff_9+1]<<8)|(HEAP[$tmpbuff_9]);
        var $100=(HEAP[$99]);
        var $101=($100) ^ 127;
        var $102=(HEAP[$tmpbuff_9+3]<<24)|(HEAP[$tmpbuff_9+2]<<16)|(HEAP[$tmpbuff_9+1]<<8)|(HEAP[$tmpbuff_9]);
         HEAP[$102] = ($101)&0xff;
        var $103=(HEAP[$tmpbuff+3]<<24)|(HEAP[$tmpbuff+2]<<16)|(HEAP[$tmpbuff+1]<<8)|(HEAP[$tmpbuff]);
        var $104=(($103+1)&4294967295);
         HEAP[$tmpbuff+3] = ($104>>24)&0xff; HEAP[$tmpbuff+2] = ($104>>16)&0xff; HEAP[$tmpbuff+1] = ($104>>8)&0xff; HEAP[$tmpbuff] = ($104)&0xff;
        __label__ = 13; break;
      case 13: // $bb12
        var $105=(HEAP[$tmp_length+3]<<24)|(HEAP[$tmp_length+2]<<16)|(HEAP[$tmp_length+1]<<8)|(HEAP[$tmp_length]);
        var $106=((($105) - 1)&4294967295);
         HEAP[$tmp_length+3] = ($106>>24)&0xff; HEAP[$tmp_length+2] = ($106>>16)&0xff; HEAP[$tmp_length+1] = ($106>>8)&0xff; HEAP[$tmp_length] = ($106)&0xff;
        var $107=(HEAP[$tmp_length+3]<<24)|(HEAP[$tmp_length+2]<<16)|(HEAP[$tmp_length+1]<<8)|(HEAP[$tmp_length]);
        var $108=((($107))|0)!=-1;
        if ($108) { __label__ = 12; break; } else { __label__ = 14; break; }
      case 14: // $bb13
        var $109=(HEAP[$buff+3]<<24)|(HEAP[$buff+2]<<16)|(HEAP[$buff+1]<<8)|(HEAP[$buff]);
         HEAP[$0+3] = ($109>>24)&0xff; HEAP[$0+2] = ($109>>16)&0xff; HEAP[$0+1] = ($109>>8)&0xff; HEAP[$0] = ($109)&0xff;
        __label__ = 15; break;
      case 15: // $bb14
        var $110=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($110>>24)&0xff; HEAP[$retval+2] = ($110>>16)&0xff; HEAP[$retval+1] = ($110>>8)&0xff; HEAP[$retval] = ($110)&0xff;
        __label__ = 16; break;
      case 16: // $return
        var $retval15=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval15;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_parse_image_data($hyp, $index) {
    var __stackBase__  = STACKTOP; STACKTOP += 52; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 52);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $index_addr=__stackBase__+4;
        var $retval=__stackBase__+6;
        var $iftmp_11=__stackBase__+10;
        var $iftmp_10=__stackBase__+14;
        var $0=__stackBase__+18;
        var $size=__stackBase__+22;
        var $data=__stackBase__+26;
        var $plane_size=__stackBase__+30;
        var $img=__stackBase__+34;
        var $offset=__stackBase__+38;
        var $plane_onoff_mask=__stackBase__+42;
        var $src_data=__stackBase__+43;
        var $offset13=__stackBase__+47;
        var $plane_data_mask=__stackBase__+51;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
        var $1=(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $2=unSign(($1), 16, 0);
        var $3=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $4=_hyp_read_index_data($3, $2, $size);
         HEAP[$data+3] = ($4>>24)&0xff; HEAP[$data+2] = ($4>>16)&0xff; HEAP[$data+1] = ($4>>8)&0xff; HEAP[$data] = ($4)&0xff;
        var $5=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $6=($5)==0;
        if ($6) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 22; break;
      case 2: // $bb1
        var $7=_malloc(16);
        var $8=$7;
         HEAP[$img+3] = ($8>>24)&0xff; HEAP[$img+2] = ($8>>16)&0xff; HEAP[$img+1] = ($8>>8)&0xff; HEAP[$img] = ($8)&0xff;
        var $9=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $10=($9)==0;
        if ($10) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 22; break;
      case 4: // $bb3
        var $11=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $12=(($11)&4294967295);
        var $13=(HEAP[$12]);
        var $14=unSign(($13), 8, 0);
        var $15=($14) << 8;
        var $16=((($15)) & 65535);
        var $17=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $18=(($17+1)&4294967295);
        var $19=(HEAP[$18]);
        var $20=unSign(($19), 8, 0);
        var $21=($16) | ($20);
        var $22=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $23=(($22)&4294967295);
         HEAP[$23+1] = ($21>>8)&0xff; HEAP[$23] = ($21)&0xff;
        var $24=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $25=(($24+2)&4294967295);
        var $26=(HEAP[$25]);
        var $27=unSign(($26), 8, 0);
        var $28=($27) << 8;
        var $29=((($28)) & 65535);
        var $30=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $31=(($30+3)&4294967295);
        var $32=(HEAP[$31]);
        var $33=unSign(($32), 8, 0);
        var $34=($29) | ($33);
        var $35=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $36=(($35+2)&4294967295);
         HEAP[$36+1] = ($34>>8)&0xff; HEAP[$36] = ($34)&0xff;
        var $37=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $38=(($37)&4294967295);
        var $39=(HEAP[$38+1]<<8)|(HEAP[$38]);
        var $40=reSign(($39), 16, 0);
        var $41=((($40) + 15)&4294967295);
        var $42=((($41))|0) >> 4;
        var $43=($42) << 1;
        var $44=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $45=(($44+4)&4294967295);
         HEAP[$45+3] = ($43>>24)&0xff; HEAP[$45+2] = ($43>>16)&0xff; HEAP[$45+1] = ($43>>8)&0xff; HEAP[$45] = ($43)&0xff;
        var $46=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $47=(($46+4)&4294967295);
        var $48=(HEAP[$47]);
        var $49=unSign(($48), 8, 0);
        var $50=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $51=(($50+8)&4294967295);
         HEAP[$51+1] = ($49>>8)&0xff; HEAP[$51] = ($49)&0xff;
        var $52=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $53=(($52+4)&4294967295);
        var $54=(HEAP[$53+3]<<24)|(HEAP[$53+2]<<16)|(HEAP[$53+1]<<8)|(HEAP[$53]);
        var $55=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $56=(($55+2)&4294967295);
        var $57=(HEAP[$56+1]<<8)|(HEAP[$56]);
        var $58=reSign(($57), 16, 0);
        var $59=((($54) * ($58))&4294967295);
         HEAP[$plane_size+3] = ($59>>24)&0xff; HEAP[$plane_size+2] = ($59>>16)&0xff; HEAP[$plane_size+1] = ($59>>8)&0xff; HEAP[$plane_size] = ($59)&0xff;
        var $60=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $61=(($60+8)&4294967295);
        var $62=(HEAP[$61+1]<<8)|(HEAP[$61]);
        var $63=reSign(($62), 16, 0);
        var $64=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $65=((($63) * ($64))&4294967295);
        var $66=_malloc($65);
        var $67=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $68=(($67+12)&4294967295);
         HEAP[$68+3] = ($66>>24)&0xff; HEAP[$68+2] = ($66>>16)&0xff; HEAP[$68+1] = ($66>>8)&0xff; HEAP[$68] = ($66)&0xff;
        var $69=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $70=(($69+12)&4294967295);
        var $71=(HEAP[$70+3]<<24)|(HEAP[$70+2]<<16)|(HEAP[$70+1]<<8)|(HEAP[$70]);
        var $72=($71)==0;
        if ($72) { __label__ = 5; break; } else { __label__ = 6; break; }
      case 5: // $bb4
        var $73=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $74=$73;
        _free($74);
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 22; break;
      case 6: // $bb5
         HEAP[$offset+3] = (0>>24)&0xff; HEAP[$offset+2] = (0>>16)&0xff; HEAP[$offset+1] = (0>>8)&0xff; HEAP[$offset] = (0)&0xff;
        var $75=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $76=(($75+6)&4294967295);
        var $77=(HEAP[$76]);
         HEAP[$plane_onoff_mask] = ($77)&0xff;
        __label__ = 12; break;
      case 7: // $bb6
        var $78=(HEAP[$plane_onoff_mask]);
        var $79=unSign(($78), 8, 0);
        var $80=($79) & 1;
        var $81=((($80)) & 255);
        var $toBool=reSign(($81), 8, 0)!=0;
        if ($toBool) { __label__ = 8; break; } else { __label__ = 11; break; }
      case 8: // $bb7
        var $82=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $83=(($82+12)&4294967295);
        var $84=(HEAP[$83+3]<<24)|(HEAP[$83+2]<<16)|(HEAP[$83+1]<<8)|(HEAP[$83]);
        var $85=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $86=(($84+$85)&4294967295);
        var $87=_llvm_objectsize_i32($86, 0);
        var $88=((($87))|0)!=-1;
        if ($88) { __label__ = 9; break; } else { __label__ = 10; break; }
      case 9: // $bb8
        var $89=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $90=(($89+12)&4294967295);
        var $91=(HEAP[$90+3]<<24)|(HEAP[$90+2]<<16)|(HEAP[$90+1]<<8)|(HEAP[$90]);
        var $92=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $93=(($91+$92)&4294967295);
        var $94=_llvm_objectsize_i32($93, 0);
        var $95=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $96=(($95+12)&4294967295);
        var $97=(HEAP[$96+3]<<24)|(HEAP[$96+2]<<16)|(HEAP[$96+1]<<8)|(HEAP[$96]);
        var $98=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $99=(($97+$98)&4294967295);
        var $100=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $101=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $102=___memset_chk($99, 255, $101, $94);
         HEAP[$iftmp_10+3] = ($102>>24)&0xff; HEAP[$iftmp_10+2] = ($102>>16)&0xff; HEAP[$iftmp_10+1] = ($102>>8)&0xff; HEAP[$iftmp_10] = ($102)&0xff;
        __label__ = 11; break;
      case 10: // $bb9
        var $103=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $104=(($103+12)&4294967295);
        var $105=(HEAP[$104+3]<<24)|(HEAP[$104+2]<<16)|(HEAP[$104+1]<<8)|(HEAP[$104]);
        var $106=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $107=(($105+$106)&4294967295);
        var $108=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $109=___inline_memset_chk27($107, 255, $108);
         HEAP[$iftmp_10+3] = ($109>>24)&0xff; HEAP[$iftmp_10+2] = ($109>>16)&0xff; HEAP[$iftmp_10+1] = ($109>>8)&0xff; HEAP[$iftmp_10] = ($109)&0xff;
        __label__ = 11; break;
      case 11: // $bb10
        var $110=(HEAP[$offset+3]<<24)|(HEAP[$offset+2]<<16)|(HEAP[$offset+1]<<8)|(HEAP[$offset]);
        var $111=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $112=((($110) + ($111))&4294967295);
         HEAP[$offset+3] = ($112>>24)&0xff; HEAP[$offset+2] = ($112>>16)&0xff; HEAP[$offset+1] = ($112>>8)&0xff; HEAP[$offset] = ($112)&0xff;
        var $113=(HEAP[$plane_onoff_mask]);
        var $114=unSign(($113), 8, 0) >>> 1;
         HEAP[$plane_onoff_mask] = ($114)&0xff;
        __label__ = 12; break;
      case 12: // $bb11
        var $115=(HEAP[$plane_onoff_mask]);
        var $116=reSign(($115), 8, 0)!=0;
        if ($116) { __label__ = 7; break; } else { __label__ = 13; break; }
      case 13: // $bb12
        var $117=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $118=(($117+8)&4294967295);
         HEAP[$src_data+3] = ($118>>24)&0xff; HEAP[$src_data+2] = ($118>>16)&0xff; HEAP[$src_data+1] = ($118>>8)&0xff; HEAP[$src_data] = ($118)&0xff;
         HEAP[$offset13+3] = (0>>24)&0xff; HEAP[$offset13+2] = (0>>16)&0xff; HEAP[$offset13+1] = (0>>8)&0xff; HEAP[$offset13] = (0)&0xff;
        var $119=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        var $120=(($119+5)&4294967295);
        var $121=(HEAP[$120]);
        var $122=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $123=(($122+8)&4294967295);
        var $124=(HEAP[$123+1]<<8)|(HEAP[$123]);
        var $125=reSign(($124), 16, 0);
        var $126=1 << ($125);
        var $127=((($126)) & 255);
        var $128=((($127) - 1)&255);
        var $129=($121) & ($128);
         HEAP[$plane_data_mask] = ($129)&0xff;
        __label__ = 20; break;
      case 14: // $bb14
        var $130=(HEAP[$plane_data_mask]);
        var $131=unSign(($130), 8, 0);
        var $132=($131) & 1;
        var $133=((($132)) & 255);
        var $toBool15=reSign(($133), 8, 0)!=0;
        if ($toBool15) { __label__ = 15; break; } else { __label__ = 19; break; }
      case 15: // $bb16
        var $134=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $135=(($134+12)&4294967295);
        var $136=(HEAP[$135+3]<<24)|(HEAP[$135+2]<<16)|(HEAP[$135+1]<<8)|(HEAP[$135]);
        var $137=(HEAP[$offset13+3]<<24)|(HEAP[$offset13+2]<<16)|(HEAP[$offset13+1]<<8)|(HEAP[$offset13]);
        var $138=(($136+$137)&4294967295);
        var $139=_llvm_objectsize_i32($138, 0);
        var $140=((($139))|0)!=-1;
        if ($140) { __label__ = 16; break; } else { __label__ = 17; break; }
      case 16: // $bb17
        var $141=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $142=(($141+12)&4294967295);
        var $143=(HEAP[$142+3]<<24)|(HEAP[$142+2]<<16)|(HEAP[$142+1]<<8)|(HEAP[$142]);
        var $144=(HEAP[$offset13+3]<<24)|(HEAP[$offset13+2]<<16)|(HEAP[$offset13+1]<<8)|(HEAP[$offset13]);
        var $145=(($143+$144)&4294967295);
        var $146=_llvm_objectsize_i32($145, 0);
        var $147=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $148=(($147+12)&4294967295);
        var $149=(HEAP[$148+3]<<24)|(HEAP[$148+2]<<16)|(HEAP[$148+1]<<8)|(HEAP[$148]);
        var $150=(HEAP[$offset13+3]<<24)|(HEAP[$offset13+2]<<16)|(HEAP[$offset13+1]<<8)|(HEAP[$offset13]);
        var $151=(($149+$150)&4294967295);
        var $152=(HEAP[$src_data+3]<<24)|(HEAP[$src_data+2]<<16)|(HEAP[$src_data+1]<<8)|(HEAP[$src_data]);
        var $153=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $154=(HEAP[$src_data+3]<<24)|(HEAP[$src_data+2]<<16)|(HEAP[$src_data+1]<<8)|(HEAP[$src_data]);
        var $155=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $156=___memcpy_chk($151, $154, $155, $146);
         HEAP[$iftmp_11+3] = ($156>>24)&0xff; HEAP[$iftmp_11+2] = ($156>>16)&0xff; HEAP[$iftmp_11+1] = ($156>>8)&0xff; HEAP[$iftmp_11] = ($156)&0xff;
        __label__ = 18; break;
      case 17: // $bb18
        var $157=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $158=(($157+12)&4294967295);
        var $159=(HEAP[$158+3]<<24)|(HEAP[$158+2]<<16)|(HEAP[$158+1]<<8)|(HEAP[$158]);
        var $160=(HEAP[$offset13+3]<<24)|(HEAP[$offset13+2]<<16)|(HEAP[$offset13+1]<<8)|(HEAP[$offset13]);
        var $161=(($159+$160)&4294967295);
        var $162=(HEAP[$src_data+3]<<24)|(HEAP[$src_data+2]<<16)|(HEAP[$src_data+1]<<8)|(HEAP[$src_data]);
        var $163=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $164=___inline_memcpy_chk28($161, $162, $163);
         HEAP[$iftmp_11+3] = ($164>>24)&0xff; HEAP[$iftmp_11+2] = ($164>>16)&0xff; HEAP[$iftmp_11+1] = ($164>>8)&0xff; HEAP[$iftmp_11] = ($164)&0xff;
        __label__ = 18; break;
      case 18: // $bb19
        var $165=(HEAP[$src_data+3]<<24)|(HEAP[$src_data+2]<<16)|(HEAP[$src_data+1]<<8)|(HEAP[$src_data]);
        var $166=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $167=(($165+$166)&4294967295);
         HEAP[$src_data+3] = ($167>>24)&0xff; HEAP[$src_data+2] = ($167>>16)&0xff; HEAP[$src_data+1] = ($167>>8)&0xff; HEAP[$src_data] = ($167)&0xff;
        __label__ = 19; break;
      case 19: // $bb20
        var $168=(HEAP[$offset13+3]<<24)|(HEAP[$offset13+2]<<16)|(HEAP[$offset13+1]<<8)|(HEAP[$offset13]);
        var $169=(HEAP[$plane_size+3]<<24)|(HEAP[$plane_size+2]<<16)|(HEAP[$plane_size+1]<<8)|(HEAP[$plane_size]);
        var $170=((($168) + ($169))&4294967295);
         HEAP[$offset13+3] = ($170>>24)&0xff; HEAP[$offset13+2] = ($170>>16)&0xff; HEAP[$offset13+1] = ($170>>8)&0xff; HEAP[$offset13] = ($170)&0xff;
        var $171=(HEAP[$plane_data_mask]);
        var $172=unSign(($171), 8, 0) >>> 1;
         HEAP[$plane_data_mask] = ($172)&0xff;
        __label__ = 20; break;
      case 20: // $bb21
        var $173=(HEAP[$plane_data_mask]);
        var $174=reSign(($173), 8, 0)!=0;
        if ($174) { __label__ = 14; break; } else { __label__ = 21; break; }
      case 21: // $bb22
        var $175=(HEAP[$data+3]<<24)|(HEAP[$data+2]<<16)|(HEAP[$data+1]<<8)|(HEAP[$data]);
        _free($175);
        var $176=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
         HEAP[$0+3] = ($176>>24)&0xff; HEAP[$0+2] = ($176>>16)&0xff; HEAP[$0+1] = ($176>>8)&0xff; HEAP[$0] = ($176)&0xff;
        __label__ = 22; break;
      case 22: // $bb23
        var $177=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($177>>24)&0xff; HEAP[$retval+2] = ($177>>16)&0xff; HEAP[$retval+1] = ($177>>8)&0xff; HEAP[$retval] = ($177)&0xff;
        __label__ = 23; break;
      case 23: // $return
        var $retval24=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval24;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_memset_chk27($__dest, $__val, $__len) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__val_addr=__stackBase__+4;
        var $__len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__val_addr+3] = ($__val>>24)&0xff; HEAP[$__val_addr+2] = ($__val>>16)&0xff; HEAP[$__val_addr+1] = ($__val>>8)&0xff; HEAP[$__val_addr] = ($__val)&0xff;
         HEAP[$__len_addr+3] = ($__len>>24)&0xff; HEAP[$__len_addr+2] = ($__len>>16)&0xff; HEAP[$__len_addr+1] = ($__len>>8)&0xff; HEAP[$__len_addr] = ($__len)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__val_addr+3]<<24)|(HEAP[$__val_addr+2]<<16)|(HEAP[$__val_addr+1]<<8)|(HEAP[$__val_addr]);
        var $5=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $6=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $7=(HEAP[$__val_addr+3]<<24)|(HEAP[$__val_addr+2]<<16)|(HEAP[$__val_addr+1]<<8)|(HEAP[$__val_addr]);
        var $8=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $9=___memset_chk($6, $7, $8, $2);
         HEAP[$0+3] = ($9>>24)&0xff; HEAP[$0+2] = ($9>>16)&0xff; HEAP[$0+1] = ($9>>8)&0xff; HEAP[$0] = ($9)&0xff;
        var $10=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($10>>24)&0xff; HEAP[$retval+2] = ($10>>16)&0xff; HEAP[$retval+1] = ($10>>8)&0xff; HEAP[$retval] = ($10)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_memcpy_chk28($__dest, $__src, $__len) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__src_addr=__stackBase__+4;
        var $__len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__src_addr+3] = ($__src>>24)&0xff; HEAP[$__src_addr+2] = ($__src>>16)&0xff; HEAP[$__src_addr+1] = ($__src>>8)&0xff; HEAP[$__src_addr] = ($__src)&0xff;
         HEAP[$__len_addr+3] = ($__len>>24)&0xff; HEAP[$__len_addr+2] = ($__len>>16)&0xff; HEAP[$__len_addr+1] = ($__len>>8)&0xff; HEAP[$__len_addr] = ($__len)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $5=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $6=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $7=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $8=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $9=___memcpy_chk($6, $7, $8, $2);
         HEAP[$0+3] = ($9>>24)&0xff; HEAP[$0+2] = ($9>>16)&0xff; HEAP[$0+1] = ($9>>8)&0xff; HEAP[$0] = ($9)&0xff;
        var $10=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($10>>24)&0xff; HEAP[$retval+2] = ($10>>16)&0xff; HEAP[$retval+1] = ($10>>8)&0xff; HEAP[$retval] = ($10)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_free_image_data($img) {
    var __stackBase__  = STACKTOP; STACKTOP += 4; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 4);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $img_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$img_addr+3] = ($img>>24)&0xff; HEAP[$img_addr+2] = ($img>>16)&0xff; HEAP[$img_addr+1] = ($img>>8)&0xff; HEAP[$img_addr] = ($img)&0xff;
        var $0=(HEAP[$img_addr+3]<<24)|(HEAP[$img_addr+2]<<16)|(HEAP[$img_addr+1]<<8)|(HEAP[$img_addr]);
        var $1=(($0+12)&4294967295);
        var $2=(HEAP[$1+3]<<24)|(HEAP[$1+2]<<16)|(HEAP[$1+1]<<8)|(HEAP[$1]);
        _free($2);
        var $3=(HEAP[$img_addr+3]<<24)|(HEAP[$img_addr+2]<<16)|(HEAP[$img_addr+1]<<8)|(HEAP[$img_addr]);
        var $4=$3;
        _free($4);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_add_graphics($node, $item, $lineno) {
    var __stackBase__  = STACKTOP; STACKTOP += 10; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 10);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $item_addr=__stackBase__+4;
        var $lineno_addr=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
         HEAP[$item_addr+3] = ($item>>24)&0xff; HEAP[$item_addr+2] = ($item>>16)&0xff; HEAP[$item_addr+1] = ($item>>8)&0xff; HEAP[$item_addr] = ($item)&0xff;
         HEAP[$lineno_addr+1] = ($lineno>>8)&0xff; HEAP[$lineno_addr] = ($lineno)&0xff;
        var $0=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $1=$0;
        var $2=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $3=(($2+8)&4294967295);
        var $4=(HEAP[$3+3]<<24)|(HEAP[$3+2]<<16)|(HEAP[$3+1]<<8)|(HEAP[$3]);
        var $5=$4;
        var $6=(($5+8)&4294967295);
        _listInsert($6, $1);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _listInsert($iter, $entry1) {
    var __stackBase__  = STACKTOP; STACKTOP += 8; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 8);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $iter_addr=__stackBase__;
        var $entry_addr=__stackBase__+4;
        var $_alloca_point_=0;
         HEAP[$iter_addr+3] = ($iter>>24)&0xff; HEAP[$iter_addr+2] = ($iter>>16)&0xff; HEAP[$iter_addr+1] = ($iter>>8)&0xff; HEAP[$iter_addr] = ($iter)&0xff;
         HEAP[$entry_addr+3] = ($entry1>>24)&0xff; HEAP[$entry_addr+2] = ($entry1>>16)&0xff; HEAP[$entry_addr+1] = ($entry1>>8)&0xff; HEAP[$entry_addr] = ($entry1)&0xff;
        var $0=(HEAP[$entry_addr+3]<<24)|(HEAP[$entry_addr+2]<<16)|(HEAP[$entry_addr+1]<<8)|(HEAP[$entry_addr]);
        var $1=(($0)&4294967295);
        var $2=(HEAP[$iter_addr+3]<<24)|(HEAP[$iter_addr+2]<<16)|(HEAP[$iter_addr+1]<<8)|(HEAP[$iter_addr]);
         HEAP[$1+3] = ($2>>24)&0xff; HEAP[$1+2] = ($2>>16)&0xff; HEAP[$1+1] = ($2>>8)&0xff; HEAP[$1] = ($2)&0xff;
        var $3=(HEAP[$iter_addr+3]<<24)|(HEAP[$iter_addr+2]<<16)|(HEAP[$iter_addr+1]<<8)|(HEAP[$iter_addr]);
        var $4=(($3+4)&4294967295);
        var $5=(HEAP[$4+3]<<24)|(HEAP[$4+2]<<16)|(HEAP[$4+1]<<8)|(HEAP[$4]);
        var $6=(HEAP[$entry_addr+3]<<24)|(HEAP[$entry_addr+2]<<16)|(HEAP[$entry_addr+1]<<8)|(HEAP[$entry_addr]);
        var $7=(($6+4)&4294967295);
         HEAP[$7+3] = ($5>>24)&0xff; HEAP[$7+2] = ($5>>16)&0xff; HEAP[$7+1] = ($5>>8)&0xff; HEAP[$7] = ($5)&0xff;
        var $8=(HEAP[$iter_addr+3]<<24)|(HEAP[$iter_addr+2]<<16)|(HEAP[$iter_addr+1]<<8)|(HEAP[$iter_addr]);
        var $9=(($8+4)&4294967295);
        var $10=(HEAP[$9+3]<<24)|(HEAP[$9+2]<<16)|(HEAP[$9+1]<<8)|(HEAP[$9]);
        var $11=(($10)&4294967295);
        var $12=(HEAP[$entry_addr+3]<<24)|(HEAP[$entry_addr+2]<<16)|(HEAP[$entry_addr+1]<<8)|(HEAP[$entry_addr]);
         HEAP[$11+3] = ($12>>24)&0xff; HEAP[$11+2] = ($12>>16)&0xff; HEAP[$11+1] = ($12>>8)&0xff; HEAP[$11] = ($12)&0xff;
        var $13=(HEAP[$iter_addr+3]<<24)|(HEAP[$iter_addr+2]<<16)|(HEAP[$iter_addr+1]<<8)|(HEAP[$iter_addr]);
        var $14=(($13+4)&4294967295);
        var $15=(HEAP[$entry_addr+3]<<24)|(HEAP[$entry_addr+2]<<16)|(HEAP[$entry_addr+1]<<8)|(HEAP[$entry_addr]);
         HEAP[$14+3] = ($15>>24)&0xff; HEAP[$14+2] = ($15>>16)&0xff; HEAP[$14+1] = ($15>>8)&0xff; HEAP[$14] = ($15)&0xff;
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_add_effects($node, $e) {
    var __stackBase__  = STACKTOP; STACKTOP += 9; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 9);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $e_addr=__stackBase__+4;
        var $eff=__stackBase__+5;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
         HEAP[$e_addr] = ($e)&0xff;
        var $0=_malloc(16);
        var $1=$0;
         HEAP[$eff+3] = ($1>>24)&0xff; HEAP[$eff+2] = ($1>>16)&0xff; HEAP[$eff+1] = ($1>>8)&0xff; HEAP[$eff] = ($1)&0xff;
        var $2=(HEAP[$eff+3]<<24)|(HEAP[$eff+2]<<16)|(HEAP[$eff+1]<<8)|(HEAP[$eff]);
        var $3=(($2)&4294967295);
        var $4=(($3+8)&4294967295);
         HEAP[$4+1] = (2>>8)&0xff; HEAP[$4] = (2)&0xff;
        var $5=(HEAP[$eff+3]<<24)|(HEAP[$eff+2]<<16)|(HEAP[$eff+1]<<8)|(HEAP[$eff]);
        var $6=(($5+12)&4294967295);
        var $7=(HEAP[$e_addr]);
         HEAP[$6] = ($7)&0xff;
        var $8=(HEAP[$eff+3]<<24)|(HEAP[$eff+2]<<16)|(HEAP[$eff+1]<<8)|(HEAP[$eff]);
        var $9=$8;
        var $10=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $11=(($10+8)&4294967295);
        var $12=(HEAP[$11+3]<<24)|(HEAP[$11+2]<<16)|(HEAP[$11+1]<<8)|(HEAP[$11]);
        var $13=$12;
        var $14=(($13+8)&4294967295);
        _listInsert($14, $9);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_add_string($node, $s) {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $s_addr=__stackBase__+4;
        var $txt=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
         HEAP[$s_addr+3] = ($s>>24)&0xff; HEAP[$s_addr+2] = ($s>>16)&0xff; HEAP[$s_addr+1] = ($s>>8)&0xff; HEAP[$s_addr] = ($s)&0xff;
        var $0=_malloc(16);
        var $1=$0;
         HEAP[$txt+3] = ($1>>24)&0xff; HEAP[$txt+2] = ($1>>16)&0xff; HEAP[$txt+1] = ($1>>8)&0xff; HEAP[$txt] = ($1)&0xff;
        var $2=(HEAP[$txt+3]<<24)|(HEAP[$txt+2]<<16)|(HEAP[$txt+1]<<8)|(HEAP[$txt]);
        var $3=(($2)&4294967295);
        var $4=(($3+8)&4294967295);
         HEAP[$4+1] = (1>>8)&0xff; HEAP[$4] = (1)&0xff;
        var $5=(HEAP[$s_addr+3]<<24)|(HEAP[$s_addr+2]<<16)|(HEAP[$s_addr+1]<<8)|(HEAP[$s_addr]);
        var $6=_strdup($5);
        var $7=(HEAP[$txt+3]<<24)|(HEAP[$txt+2]<<16)|(HEAP[$txt+1]<<8)|(HEAP[$txt]);
        var $8=(($7+12)&4294967295);
         HEAP[$8+3] = ($6>>24)&0xff; HEAP[$8+2] = ($6>>16)&0xff; HEAP[$8+1] = ($6>>8)&0xff; HEAP[$8] = ($6)&0xff;
        var $9=(HEAP[$txt+3]<<24)|(HEAP[$txt+2]<<16)|(HEAP[$txt+1]<<8)|(HEAP[$txt]);
        var $10=$9;
        var $11=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $12=(($11+8)&4294967295);
        var $13=(HEAP[$12+3]<<24)|(HEAP[$12+2]<<16)|(HEAP[$12+1]<<8)|(HEAP[$12]);
        var $14=$13;
        var $15=(($14+8)&4294967295);
        _listInsert($15, $10);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_add_link($node, $d, $index, $line) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $d_addr=__stackBase__+4;
        var $index_addr=__stackBase__+8;
        var $line_addr=__stackBase__+10;
        var $lnk=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
         HEAP[$d_addr+3] = ($d>>24)&0xff; HEAP[$d_addr+2] = ($d>>16)&0xff; HEAP[$d_addr+1] = ($d>>8)&0xff; HEAP[$d_addr] = ($d)&0xff;
         HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
         HEAP[$line_addr+1] = ($line>>8)&0xff; HEAP[$line_addr] = ($line)&0xff;
        var $0=_malloc(20);
        var $1=$0;
         HEAP[$lnk+3] = ($1>>24)&0xff; HEAP[$lnk+2] = ($1>>16)&0xff; HEAP[$lnk+1] = ($1>>8)&0xff; HEAP[$lnk] = ($1)&0xff;
        var $2=(HEAP[$lnk+3]<<24)|(HEAP[$lnk+2]<<16)|(HEAP[$lnk+1]<<8)|(HEAP[$lnk]);
        var $3=(($2)&4294967295);
        var $4=(($3+8)&4294967295);
         HEAP[$4+1] = (3>>8)&0xff; HEAP[$4] = (3)&0xff;
        var $5=(HEAP[$lnk+3]<<24)|(HEAP[$lnk+2]<<16)|(HEAP[$lnk+1]<<8)|(HEAP[$lnk]);
        var $6=(($5+12)&4294967295);
        var $7=(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
         HEAP[$6+1] = ($7>>8)&0xff; HEAP[$6] = ($7)&0xff;
        var $8=(HEAP[$lnk+3]<<24)|(HEAP[$lnk+2]<<16)|(HEAP[$lnk+1]<<8)|(HEAP[$lnk]);
        var $9=(($8+14)&4294967295);
        var $10=(HEAP[$line_addr+1]<<8)|(HEAP[$line_addr]);
         HEAP[$9+1] = ($10>>8)&0xff; HEAP[$9] = ($10)&0xff;
        var $11=(HEAP[$d_addr+3]<<24)|(HEAP[$d_addr+2]<<16)|(HEAP[$d_addr+1]<<8)|(HEAP[$d_addr]);
        var $12=_strdup($11);
        var $13=(HEAP[$lnk+3]<<24)|(HEAP[$lnk+2]<<16)|(HEAP[$lnk+1]<<8)|(HEAP[$lnk]);
        var $14=(($13+16)&4294967295);
         HEAP[$14+3] = ($12>>24)&0xff; HEAP[$14+2] = ($12>>16)&0xff; HEAP[$14+1] = ($12>>8)&0xff; HEAP[$14] = ($12)&0xff;
        var $15=(HEAP[$lnk+3]<<24)|(HEAP[$lnk+2]<<16)|(HEAP[$lnk+1]<<8)|(HEAP[$lnk]);
        var $16=$15;
        var $17=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $18=(($17+8)&4294967295);
        var $19=(HEAP[$18+3]<<24)|(HEAP[$18+2]<<16)|(HEAP[$18+1]<<8)|(HEAP[$18]);
        var $20=$19;
        var $21=(($20+8)&4294967295);
        _listInsert($21, $16);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_parse_node_data($hyp, $buff, $len) {
    var __stackBase__  = STACKTOP; STACKTOP += 330; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 330);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $buff_addr=__stackBase__+4;
        var $len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $iftmp_52=__stackBase__+16;
        var $iftmp_45=__stackBase__+20;
        var $iftmp_24=__stackBase__+24;
        var $0=__stackBase__+28;
        var $line=__stackBase__+32;
        var $node=__stackBase__+288;
        var $eod=__stackBase__+292;
        var $dest=__stackBase__+296;
        var $comm=__stackBase__+300;
        var $line_number=__stackBase__+301;
        var $prev_line_number=__stackBase__+303;
        var $img=__stackBase__+305;
        var $ln=__stackBase__+309;
        var $box=__stackBase__+313;
        var $ie=__stackBase__+317;
        var $index=__stackBase__+321;
        var $lineno=__stackBase__+323;
        var $len24=__stackBase__+325;
        var $effects=__stackBase__+329;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$buff_addr+3] = ($buff>>24)&0xff; HEAP[$buff_addr+2] = ($buff>>16)&0xff; HEAP[$buff_addr+1] = ($buff>>8)&0xff; HEAP[$buff_addr] = ($buff)&0xff;
         HEAP[$len_addr+3] = ($len>>24)&0xff; HEAP[$len_addr+2] = ($len>>16)&0xff; HEAP[$len_addr+1] = ($len>>8)&0xff; HEAP[$len_addr] = ($len)&0xff;
        var $1=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $2=(HEAP[$len_addr+3]<<24)|(HEAP[$len_addr+2]<<16)|(HEAP[$len_addr+1]<<8)|(HEAP[$len_addr]);
        var $3=(($1+$2)&4294967295);
         HEAP[$eod+3] = ($3>>24)&0xff; HEAP[$eod+2] = ($3>>16)&0xff; HEAP[$eod+1] = ($3>>8)&0xff; HEAP[$eod] = ($3)&0xff;
        var $line1=$line;
         HEAP[$dest+3] = ($line1>>24)&0xff; HEAP[$dest+2] = ($line1>>16)&0xff; HEAP[$dest+1] = ($line1>>8)&0xff; HEAP[$dest] = ($line1)&0xff;
         HEAP[$prev_line_number+1] = (-1>>8)&0xff; HEAP[$prev_line_number] = (-1)&0xff;
        var $4=_malloc(12);
        var $5=$4;
         HEAP[$node+3] = ($5>>24)&0xff; HEAP[$node+2] = ($5>>16)&0xff; HEAP[$node+1] = ($5>>8)&0xff; HEAP[$node] = ($5)&0xff;
        var $6=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $7=($6)==0;
        if ($7) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 43; break;
      case 2: // $bb2
        var $8=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $9=(($8)&4294967295);
         HEAP[$9+3] = (0>>24)&0xff; HEAP[$9+2] = (0>>16)&0xff; HEAP[$9+1] = (0>>8)&0xff; HEAP[$9] = (0)&0xff;
        var $10=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $11=(($10+4)&4294967295);
         HEAP[$11+3] = (0>>24)&0xff; HEAP[$11+2] = (0>>16)&0xff; HEAP[$11+1] = (0>>8)&0xff; HEAP[$11] = (0)&0xff;
        var $12=_createList();
        var $13=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $14=(($13+8)&4294967295);
        var $15=$12;
         HEAP[$14+3] = ($15>>24)&0xff; HEAP[$14+2] = ($15>>16)&0xff; HEAP[$14+1] = ($15>>8)&0xff; HEAP[$14] = ($15)&0xff;
        __label__ = 41; break;
      case 3: // $bb3
        var $16=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $17=(HEAP[$16]);
        var $18=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$18] = ($17)&0xff;
        var $19=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $20=(($19+1)&4294967295);
         HEAP[$buff_addr+3] = ($20>>24)&0xff; HEAP[$buff_addr+2] = ($20>>16)&0xff; HEAP[$buff_addr+1] = ($20>>8)&0xff; HEAP[$buff_addr] = ($20)&0xff;
        var $21=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $22=(HEAP[$21]);
        var $23=reSign(($22), 8, 0)==0;
        if ($23) { __label__ = 4; break; } else { __label__ = 5; break; }
      case 4: // $bb4
        var $24=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$24] = (10)&0xff;
        var $25=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $26=(($25+1)&4294967295);
         HEAP[$dest+3] = ($26>>24)&0xff; HEAP[$dest+2] = ($26>>16)&0xff; HEAP[$dest+1] = ($26>>8)&0xff; HEAP[$dest] = ($26)&0xff;
        var $27=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$27] = (0)&0xff;
        var $line5=$line;
         HEAP[$dest+3] = ($line5>>24)&0xff; HEAP[$dest+2] = ($line5>>16)&0xff; HEAP[$dest+1] = ($line5>>8)&0xff; HEAP[$dest] = ($line5)&0xff;
        var $28=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $line6=$line;
        _hyp_node_add_string($28, $line6);
        __label__ = 41; break;
      case 5: // $bb7
        var $29=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $30=(HEAP[$29]);
        var $31=reSign(($30), 8, 0)!=27;
        if ($31) { __label__ = 6; break; } else { __label__ = 7; break; }
      case 6: // $bb8
        var $32=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $33=(($32+1)&4294967295);
         HEAP[$dest+3] = ($33>>24)&0xff; HEAP[$dest+2] = ($33>>16)&0xff; HEAP[$dest+1] = ($33>>8)&0xff; HEAP[$dest] = ($33)&0xff;
        __label__ = 41; break;
      case 7: // $bb9
        var $34=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $35=(HEAP[$34]);
         HEAP[$comm] = ($35)&0xff;
        var $36=(HEAP[$comm]);
        var $37=unSign(($36), 8, 0);
        var $38=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $39=(($38+1)&4294967295);
         HEAP[$buff_addr+3] = ($39>>24)&0xff; HEAP[$buff_addr+2] = ($39>>16)&0xff; HEAP[$buff_addr+1] = ($39>>8)&0xff; HEAP[$buff_addr] = ($39)&0xff;
        if ($37 == 27) {
          __label__ = 8; break;
        }
        else if ($37 == 35) {
          __label__ = 19; break;
        }
        else if ($37 == 36) {
          __label__ = 21; break;
        }
        else if ($37 == 37) {
          __label__ = 21; break;
        }
        else if ($37 == 38) {
          __label__ = 21; break;
        }
        else if ($37 == 39) {
          __label__ = 21; break;
        }
        else if ($37 == 40) {
          __label__ = 17; break;
        }
        else if ($37 == 47) {
          __label__ = 18; break;
        }
        else if ($37 == 48) {
          __label__ = 16; break;
        }
        else if ($37 == 49) {
          __label__ = 20; break;
        }
        else if ($37 == 50) {
          __label__ = 9; break;
        }
        else if ($37 == 51) {
          __label__ = 14; break;
        }
        else if ($37 == 52) {
          __label__ = 15; break;
        }
        else if ($37 == 53) {
          __label__ = 15; break;
        }
        else {
        __label__ = 37; break;
        }
        
      case 8: // $bb10
        var $40=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $41=(($40+1)&4294967295);
         HEAP[$dest+3] = ($41>>24)&0xff; HEAP[$dest+2] = ($41>>16)&0xff; HEAP[$dest+1] = ($41>>8)&0xff; HEAP[$dest] = ($41)&0xff;
        __label__ = 41; break;
      case 9: // $bb11
        var $42=_malloc(20);
        var $43=$42;
         HEAP[$img+3] = ($43>>24)&0xff; HEAP[$img+2] = ($43>>16)&0xff; HEAP[$img+1] = ($43>>8)&0xff; HEAP[$img] = ($43)&0xff;
        var $44=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $45=(($44)&4294967295);
        var $46=(($45+8)&4294967295);
         HEAP[$46+1] = (6>>8)&0xff; HEAP[$46] = (6)&0xff;
        var $47=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $48=(($47+1)&4294967295);
        var $49=(HEAP[$48]);
        var $50=reSign(($49), 8, 0);
        var $51=((($50) - 1)&65535);
        var $52=unSign(($51), 16, 0);
        var $53=($52) << 8;
        var $54=((($53)) & 65535);
        var $55=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $56=(HEAP[$55]);
        var $57=reSign(($56), 8, 0);
        var $58=((($57) - 1)&65535);
        var $59=($58) & 255;
        var $60=($54) | ($59);
        var $61=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $62=(($61+1)&4294967295);
        var $63=(HEAP[$62]);
        var $64=reSign(($63), 8, 0);
        var $65=((($64) - 1)&65535);
        var $66=($65) & 255;
        var $67=((($60) - ($66))&65535);
        var $68=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $69=(($68+18)&4294967295);
         HEAP[$69+1] = ($67>>8)&0xff; HEAP[$69] = ($67)&0xff;
        var $70=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $71=(($70+2)&4294967295);
         HEAP[$buff_addr+3] = ($71>>24)&0xff; HEAP[$buff_addr+2] = ($71>>16)&0xff; HEAP[$buff_addr+1] = ($71>>8)&0xff; HEAP[$buff_addr] = ($71)&0xff;
        var $72=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $73=(HEAP[$72]);
        var $74=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $75=(($74+13)&4294967295);
         HEAP[$75] = ($73)&0xff;
        var $76=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $77=(($76+1)&4294967295);
         HEAP[$buff_addr+3] = ($77>>24)&0xff; HEAP[$buff_addr+2] = ($77>>16)&0xff; HEAP[$buff_addr+1] = ($77>>8)&0xff; HEAP[$buff_addr] = ($77)&0xff;
        var $78=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $79=(($78+1)&4294967295);
        var $80=(HEAP[$79]);
        var $81=reSign(($80), 8, 0);
        var $82=((($81) - 1)&65535);
        var $83=unSign(($82), 16, 0);
        var $84=($83) << 8;
        var $85=((($84)) & 65535);
        var $86=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $87=(HEAP[$86]);
        var $88=reSign(($87), 8, 0);
        var $89=((($88) - 1)&65535);
        var $90=($89) & 255;
        var $91=($85) | ($90);
        var $92=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $93=(($92+1)&4294967295);
        var $94=(HEAP[$93]);
        var $95=reSign(($94), 8, 0);
        var $96=((($95) - 1)&65535);
        var $97=($96) & 255;
        var $98=((($91) - ($97))&65535);
         HEAP[$line_number+1] = ($98>>8)&0xff; HEAP[$line_number] = ($98)&0xff;
        var $99=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $100=(($99+2)&4294967295);
         HEAP[$buff_addr+3] = ($100>>24)&0xff; HEAP[$buff_addr+2] = ($100>>16)&0xff; HEAP[$buff_addr+1] = ($100>>8)&0xff; HEAP[$buff_addr] = ($100)&0xff;
        var $101=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $102=(($101+14)&4294967295);
        var $103=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
         HEAP[$102+1] = ($103>>8)&0xff; HEAP[$102] = ($103)&0xff;
        var $104=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $105=(HEAP[$104]);
        var $106=reSign(($105), 8, 0)==0;
        if ($106) { __label__ = 12; break; } else { __label__ = 10; break; }
      case 10: // $bb12
        var $107=(HEAP[$prev_line_number+1]<<8)|(HEAP[$prev_line_number]);
        var $108=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
        var $109=reSign(($107), 16, 0)==reSign(($108), 16, 0);
        if ($109) { __label__ = 12; break; } else { __label__ = 11; break; }
      case 11: // $bb13
         HEAP[$iftmp_24+3] = (1>>24)&0xff; HEAP[$iftmp_24+2] = (1>>16)&0xff; HEAP[$iftmp_24+1] = (1>>8)&0xff; HEAP[$iftmp_24] = (1)&0xff;
        __label__ = 13; break;
      case 12: // $bb14
         HEAP[$iftmp_24+3] = (0>>24)&0xff; HEAP[$iftmp_24+2] = (0>>16)&0xff; HEAP[$iftmp_24+1] = (0>>8)&0xff; HEAP[$iftmp_24] = (0)&0xff;
        __label__ = 13; break;
      case 13: // $bb15
        var $110=(HEAP[$iftmp_24+3]<<24)|(HEAP[$iftmp_24+2]<<16)|(HEAP[$iftmp_24+1]<<8)|(HEAP[$iftmp_24]);
        var $111=((($110)) & 255);
        var $112=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $113=(($112+12)&4294967295);
         HEAP[$113] = ($111)&0xff;
        var $114=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
         HEAP[$prev_line_number+1] = ($114>>8)&0xff; HEAP[$prev_line_number] = ($114)&0xff;
        var $115=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $116=(($115+2)&4294967295);
         HEAP[$buff_addr+3] = ($116>>24)&0xff; HEAP[$buff_addr+2] = ($116>>16)&0xff; HEAP[$buff_addr+1] = ($116>>8)&0xff; HEAP[$buff_addr] = ($116)&0xff;
        var $117=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
        var $118=reSign(($117), 16, 0);
        var $119=(HEAP[$img+3]<<24)|(HEAP[$img+2]<<16)|(HEAP[$img+1]<<8)|(HEAP[$img]);
        var $120=$119;
        var $121=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $122=((($118)) & 65535);
        _hyp_node_add_graphics($121, $120, $122);
        __label__ = 41; break;
      case 14: // $bb16
        var $123=_malloc(20);
        var $124=$123;
         HEAP[$ln+3] = ($124>>24)&0xff; HEAP[$ln+2] = ($124>>16)&0xff; HEAP[$ln+1] = ($124>>8)&0xff; HEAP[$ln] = ($124)&0xff;
        var $125=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $126=(($125)&4294967295);
        var $127=(($126+8)&4294967295);
         HEAP[$127+1] = (4>>8)&0xff; HEAP[$127] = (4)&0xff;
        var $128=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $129=(HEAP[$128]);
        var $130=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $131=(($130+12)&4294967295);
         HEAP[$131] = ($129)&0xff;
        var $132=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $133=(($132+1)&4294967295);
         HEAP[$buff_addr+3] = ($133>>24)&0xff; HEAP[$buff_addr+2] = ($133>>16)&0xff; HEAP[$buff_addr+1] = ($133>>8)&0xff; HEAP[$buff_addr] = ($133)&0xff;
        var $134=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $135=(($134+1)&4294967295);
        var $136=(HEAP[$135]);
        var $137=reSign(($136), 8, 0);
        var $138=((($137) - 1)&65535);
        var $139=unSign(($138), 16, 0);
        var $140=($139) << 8;
        var $141=((($140)) & 65535);
        var $142=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $143=(HEAP[$142]);
        var $144=reSign(($143), 8, 0);
        var $145=((($144) - 1)&65535);
        var $146=($145) & 255;
        var $147=($141) | ($146);
        var $148=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $149=(($148+1)&4294967295);
        var $150=(HEAP[$149]);
        var $151=reSign(($150), 8, 0);
        var $152=((($151) - 1)&65535);
        var $153=($152) & 255;
        var $154=((($147) - ($153))&65535);
         HEAP[$line_number+1] = ($154>>8)&0xff; HEAP[$line_number] = ($154)&0xff;
        var $155=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $156=(($155+2)&4294967295);
         HEAP[$buff_addr+3] = ($156>>24)&0xff; HEAP[$buff_addr+2] = ($156>>16)&0xff; HEAP[$buff_addr+1] = ($156>>8)&0xff; HEAP[$buff_addr] = ($156)&0xff;
        var $157=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $158=(($157+14)&4294967295);
        var $159=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
         HEAP[$158+1] = ($159>>8)&0xff; HEAP[$158] = ($159)&0xff;
        var $160=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $161=(HEAP[$160]);
        var $162=((($161) - -128)&255);
        var $163=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $164=(($163+16)&4294967295);
         HEAP[$164] = ($162)&0xff;
        var $165=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $166=(($165+1)&4294967295);
         HEAP[$buff_addr+3] = ($166>>24)&0xff; HEAP[$buff_addr+2] = ($166>>16)&0xff; HEAP[$buff_addr+1] = ($166>>8)&0xff; HEAP[$buff_addr] = ($166)&0xff;
        var $167=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $168=(HEAP[$167]);
        var $169=((($168) - 1)&255);
        var $170=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $171=(($170+17)&4294967295);
         HEAP[$171] = ($169)&0xff;
        var $172=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $173=(($172+1)&4294967295);
         HEAP[$buff_addr+3] = ($173>>24)&0xff; HEAP[$buff_addr+2] = ($173>>16)&0xff; HEAP[$buff_addr+1] = ($173>>8)&0xff; HEAP[$buff_addr] = ($173)&0xff;
        var $174=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $175=(HEAP[$174]);
        var $176=((($175) - 1)&255);
        var $177=($176) & 3;
        var $178=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $179=(($178+18)&4294967295);
         HEAP[$179] = ($177)&0xff;
        var $180=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $181=(HEAP[$180]);
        var $182=unSign(($181), 8, 0);
        var $183=((($182) - 1)&4294967295);
        var $184=((($183))|0) >> 3;
        var $185=((($184)) & 255);
        var $186=((($185) + 1)&255);
        var $187=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $188=(($187+19)&4294967295);
         HEAP[$188] = ($186)&0xff;
        var $189=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $190=(($189+1)&4294967295);
         HEAP[$buff_addr+3] = ($190>>24)&0xff; HEAP[$buff_addr+2] = ($190>>16)&0xff; HEAP[$buff_addr+1] = ($190>>8)&0xff; HEAP[$buff_addr] = ($190)&0xff;
        var $191=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
        var $192=reSign(($191), 16, 0);
        var $193=(HEAP[$ln+3]<<24)|(HEAP[$ln+2]<<16)|(HEAP[$ln+1]<<8)|(HEAP[$ln]);
        var $194=$193;
        var $195=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $196=((($192)) & 65535);
        _hyp_node_add_graphics($195, $194, $196);
        __label__ = 41; break;
      case 15: // $bb17
        var $197=_malloc(24);
        var $198=$197;
         HEAP[$box+3] = ($198>>24)&0xff; HEAP[$box+2] = ($198>>16)&0xff; HEAP[$box+1] = ($198>>8)&0xff; HEAP[$box] = ($198)&0xff;
        var $199=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $200=(($199)&4294967295);
        var $201=(($200+8)&4294967295);
         HEAP[$201+1] = (5>>8)&0xff; HEAP[$201] = (5)&0xff;
        var $202=(HEAP[$comm]);
        var $203=reSign(($202), 8, 0)==53;
        var $204=unSign(($203), 1, 0);
        var $205=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $206=(($205+12)&4294967295);
         HEAP[$206+1] = ($204>>8)&0xff; HEAP[$206] = ($204)&0xff;
        var $207=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $208=(HEAP[$207]);
        var $209=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $210=(($209+14)&4294967295);
         HEAP[$210] = ($208)&0xff;
        var $211=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $212=(($211+1)&4294967295);
         HEAP[$buff_addr+3] = ($212>>24)&0xff; HEAP[$buff_addr+2] = ($212>>16)&0xff; HEAP[$buff_addr+1] = ($212>>8)&0xff; HEAP[$buff_addr] = ($212)&0xff;
        var $213=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $214=(($213+1)&4294967295);
        var $215=(HEAP[$214]);
        var $216=reSign(($215), 8, 0);
        var $217=((($216) - 1)&65535);
        var $218=unSign(($217), 16, 0);
        var $219=($218) << 8;
        var $220=((($219)) & 65535);
        var $221=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $222=(HEAP[$221]);
        var $223=reSign(($222), 8, 0);
        var $224=((($223) - 1)&65535);
        var $225=($224) & 255;
        var $226=($220) | ($225);
        var $227=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $228=(($227+1)&4294967295);
        var $229=(HEAP[$228]);
        var $230=reSign(($229), 8, 0);
        var $231=((($230) - 1)&65535);
        var $232=($231) & 255;
        var $233=((($226) - ($232))&65535);
         HEAP[$line_number+1] = ($233>>8)&0xff; HEAP[$line_number] = ($233)&0xff;
        var $234=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $235=(($234+2)&4294967295);
         HEAP[$buff_addr+3] = ($235>>24)&0xff; HEAP[$buff_addr+2] = ($235>>16)&0xff; HEAP[$buff_addr+1] = ($235>>8)&0xff; HEAP[$buff_addr] = ($235)&0xff;
        var $236=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $237=(($236+16)&4294967295);
        var $238=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
         HEAP[$237+1] = ($238>>8)&0xff; HEAP[$237] = ($238)&0xff;
        var $239=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $240=(HEAP[$239]);
        var $241=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $242=(($241+18)&4294967295);
         HEAP[$242] = ($240)&0xff;
        var $243=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $244=(($243+1)&4294967295);
         HEAP[$buff_addr+3] = ($244>>24)&0xff; HEAP[$buff_addr+2] = ($244>>16)&0xff; HEAP[$buff_addr+1] = ($244>>8)&0xff; HEAP[$buff_addr] = ($244)&0xff;
        var $245=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $246=(HEAP[$245]);
        var $247=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $248=(($247+19)&4294967295);
         HEAP[$248] = ($246)&0xff;
        var $249=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $250=(($249+1)&4294967295);
         HEAP[$buff_addr+3] = ($250>>24)&0xff; HEAP[$buff_addr+2] = ($250>>16)&0xff; HEAP[$buff_addr+1] = ($250>>8)&0xff; HEAP[$buff_addr] = ($250)&0xff;
        var $251=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $252=(HEAP[$251]);
        var $253=((($252) - 1)&255);
        var $254=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $255=(($254+20)&4294967295);
         HEAP[$255] = ($253)&0xff;
        var $256=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $257=(($256+1)&4294967295);
         HEAP[$buff_addr+3] = ($257>>24)&0xff; HEAP[$buff_addr+2] = ($257>>16)&0xff; HEAP[$buff_addr+1] = ($257>>8)&0xff; HEAP[$buff_addr] = ($257)&0xff;
        var $258=(HEAP[$line_number+1]<<8)|(HEAP[$line_number]);
        var $259=reSign(($258), 16, 0);
        var $260=(HEAP[$box+3]<<24)|(HEAP[$box+2]<<16)|(HEAP[$box+1]<<8)|(HEAP[$box]);
        var $261=$260;
        var $262=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $263=((($259)) & 65535);
        _hyp_node_add_graphics($262, $261, $263);
        __label__ = 41; break;
      case 16: // $bb18
        var $264=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $265=(HEAP[$264]);
        var $266=unSign(($265), 8, 0);
        var $267=((($266) - 2)&4294967295);
        var $268=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $269=(($268+$267)&4294967295);
         HEAP[$buff_addr+3] = ($269>>24)&0xff; HEAP[$buff_addr+2] = ($269>>16)&0xff; HEAP[$buff_addr+1] = ($269>>8)&0xff; HEAP[$buff_addr] = ($269)&0xff;
        __label__ = 41; break;
      case 17: // $bb19
        var $270=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $271=(HEAP[$270]);
        var $272=unSign(($271), 8, 0);
        var $273=((($272) - 2)&4294967295);
        var $274=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $275=(($274+$273)&4294967295);
         HEAP[$buff_addr+3] = ($275>>24)&0xff; HEAP[$buff_addr+2] = ($275>>16)&0xff; HEAP[$buff_addr+1] = ($275>>8)&0xff; HEAP[$buff_addr] = ($275)&0xff;
        __label__ = 41; break;
      case 18: // $bb20
        var $276=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $277=(HEAP[$276]);
        var $278=unSign(($277), 8, 0);
        var $279=((($278) - 2)&4294967295);
        var $280=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $281=(($280+$279)&4294967295);
         HEAP[$buff_addr+3] = ($281>>24)&0xff; HEAP[$buff_addr+2] = ($281>>16)&0xff; HEAP[$buff_addr+1] = ($281>>8)&0xff; HEAP[$buff_addr] = ($281)&0xff;
        __label__ = 41; break;
      case 19: // $bb21
        var $282=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $283=_strdup($282);
        var $284=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $285=(($284+4)&4294967295);
         HEAP[$285+3] = ($283>>24)&0xff; HEAP[$285+2] = ($283>>16)&0xff; HEAP[$285+1] = ($283>>8)&0xff; HEAP[$285] = ($283)&0xff;
        var $286=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $287=_strlen($286);
        var $288=((($287) + 1)&4294967295);
        var $289=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $290=(($289+$288)&4294967295);
         HEAP[$buff_addr+3] = ($290>>24)&0xff; HEAP[$buff_addr+2] = ($290>>16)&0xff; HEAP[$buff_addr+1] = ($290>>8)&0xff; HEAP[$buff_addr] = ($290)&0xff;
        __label__ = 41; break;
      case 20: // $bb22
        var $291=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $292=(($291+8)&4294967295);
         HEAP[$buff_addr+3] = ($292>>24)&0xff; HEAP[$buff_addr+2] = ($292>>16)&0xff; HEAP[$buff_addr+1] = ($292>>8)&0xff; HEAP[$buff_addr] = ($292)&0xff;
        __label__ = 41; break;
      case 21: // $bb23
        var $293=(HEAP[$comm]);
        var $294=reSign(($293), 8, 0)==37;
        if ($294) { __label__ = 23; break; } else { __label__ = 22; break; }
      case 22: // $bb25
        var $295=(HEAP[$comm]);
        var $296=reSign(($295), 8, 0)==39;
        if ($296) { __label__ = 23; break; } else { __label__ = 24; break; }
      case 23: // $bb26
        var $297=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $298=(($297+1)&4294967295);
        var $299=(HEAP[$298]);
        var $300=reSign(($299), 8, 0);
        var $301=((($300) - 1)&65535);
        var $302=unSign(($301), 16, 0);
        var $303=($302) << 8;
        var $304=((($303)) & 65535);
        var $305=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $306=(HEAP[$305]);
        var $307=reSign(($306), 8, 0);
        var $308=((($307) - 1)&65535);
        var $309=($308) & 255;
        var $310=($304) | ($309);
        var $311=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $312=(($311+1)&4294967295);
        var $313=(HEAP[$312]);
        var $314=reSign(($313), 8, 0);
        var $315=((($314) - 1)&65535);
        var $316=($315) & 255;
        var $317=((($310) - ($316))&65535);
         HEAP[$lineno+1] = ($317>>8)&0xff; HEAP[$lineno] = ($317)&0xff;
        var $318=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $319=(($318+2)&4294967295);
         HEAP[$buff_addr+3] = ($319>>24)&0xff; HEAP[$buff_addr+2] = ($319>>16)&0xff; HEAP[$buff_addr+1] = ($319>>8)&0xff; HEAP[$buff_addr] = ($319)&0xff;
        __label__ = 25; break;
      case 24: // $bb27
         HEAP[$lineno+1] = (0>>8)&0xff; HEAP[$lineno] = (0)&0xff;
        __label__ = 25; break;
      case 25: // $bb28
        var $320=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $321=(($320+1)&4294967295);
        var $322=(HEAP[$321]);
        var $323=reSign(($322), 8, 0);
        var $324=((($323) - 1)&65535);
        var $325=unSign(($324), 16, 0);
        var $326=($325) << 8;
        var $327=((($326)) & 65535);
        var $328=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $329=(HEAP[$328]);
        var $330=reSign(($329), 8, 0);
        var $331=((($330) - 1)&65535);
        var $332=($331) & 255;
        var $333=($327) | ($332);
        var $334=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $335=(($334+1)&4294967295);
        var $336=(HEAP[$335]);
        var $337=reSign(($336), 8, 0);
        var $338=((($337) - 1)&65535);
        var $339=($338) & 255;
        var $340=((($333) - ($339))&65535);
         HEAP[$index+1] = ($340>>8)&0xff; HEAP[$index] = ($340)&0xff;
        var $341=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $342=(($341+2)&4294967295);
         HEAP[$buff_addr+3] = ($342>>24)&0xff; HEAP[$buff_addr+2] = ($342>>16)&0xff; HEAP[$buff_addr+1] = ($342>>8)&0xff; HEAP[$buff_addr] = ($342)&0xff;
        var $343=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $344=(($343+16)&4294967295);
        var $345=(HEAP[$344+3]<<24)|(HEAP[$344+2]<<16)|(HEAP[$344+1]<<8)|(HEAP[$344]);
        var $346=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $347=unSign(($346), 16, 0);
        var $348=(($345+24*$347)&4294967295);
         HEAP[$ie+3] = ($348>>24)&0xff; HEAP[$ie+2] = ($348>>16)&0xff; HEAP[$ie+1] = ($348>>8)&0xff; HEAP[$ie] = ($348)&0xff;
        var $349=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $350=(HEAP[$349]);
        var $351=unSign(($350), 8, 0);
        var $352=((($351) - 32)&4294967295);
         HEAP[$len24+3] = ($352>>24)&0xff; HEAP[$len24+2] = ($352>>16)&0xff; HEAP[$len24+1] = ($352>>8)&0xff; HEAP[$len24] = ($352)&0xff;
        var $353=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $354=(($353+1)&4294967295);
         HEAP[$buff_addr+3] = ($354>>24)&0xff; HEAP[$buff_addr+2] = ($354>>16)&0xff; HEAP[$buff_addr+1] = ($354>>8)&0xff; HEAP[$buff_addr] = ($354)&0xff;
        var $355=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$355] = (0)&0xff;
        var $line29=$line;
        var $356=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $357=($line29)!=($356);
        if ($357) { __label__ = 26; break; } else { __label__ = 27; break; }
      case 26: // $bb30
        var $line31=$line;
         HEAP[$dest+3] = ($line31>>24)&0xff; HEAP[$dest+2] = ($line31>>16)&0xff; HEAP[$dest+1] = ($line31>>8)&0xff; HEAP[$dest] = ($line31)&0xff;
        var $358=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $line32=$line;
        _hyp_node_add_string($358, $line32);
        __label__ = 27; break;
      case 27: // $bb33
        var $359=(HEAP[$len24+3]<<24)|(HEAP[$len24+2]<<16)|(HEAP[$len24+1]<<8)|(HEAP[$len24]);
        var $360=((($359))|0)!=0;
        if ($360) { __label__ = 28; break; } else { __label__ = 32; break; }
      case 28: // $bb34
        var $361=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $362=_llvm_objectsize_i32($361, 0);
        var $363=((($362))|0)!=-1;
        if ($363) { __label__ = 29; break; } else { __label__ = 30; break; }
      case 29: // $bb35
        var $364=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $365=_llvm_objectsize_i32($364, 0);
        var $366=(HEAP[$len24+3]<<24)|(HEAP[$len24+2]<<16)|(HEAP[$len24+1]<<8)|(HEAP[$len24]);
        var $367=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $368=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $369=___strncpy_chk($368, $367, $366, $365);
         HEAP[$iftmp_45+3] = ($369>>24)&0xff; HEAP[$iftmp_45+2] = ($369>>16)&0xff; HEAP[$iftmp_45+1] = ($369>>8)&0xff; HEAP[$iftmp_45] = ($369)&0xff;
        __label__ = 31; break;
      case 30: // $bb36
        var $370=(HEAP[$len24+3]<<24)|(HEAP[$len24+2]<<16)|(HEAP[$len24+1]<<8)|(HEAP[$len24]);
        var $371=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $372=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $373=___inline_strncpy_chk($372, $371, $370);
         HEAP[$iftmp_45+3] = ($373>>24)&0xff; HEAP[$iftmp_45+2] = ($373>>16)&0xff; HEAP[$iftmp_45+1] = ($373>>8)&0xff; HEAP[$iftmp_45] = ($373)&0xff;
        __label__ = 31; break;
      case 31: // $bb37
        var $374=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $375=(HEAP[$len24+3]<<24)|(HEAP[$len24+2]<<16)|(HEAP[$len24+1]<<8)|(HEAP[$len24]);
        var $376=(($374+$375)&4294967295);
         HEAP[$buff_addr+3] = ($376>>24)&0xff; HEAP[$buff_addr+2] = ($376>>16)&0xff; HEAP[$buff_addr+1] = ($376>>8)&0xff; HEAP[$buff_addr] = ($376)&0xff;
        __label__ = 36; break;
      case 32: // $bb38
        var $377=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $378=_llvm_objectsize_i32($377, 0);
        var $379=((($378))|0)!=-1;
        if ($379) { __label__ = 33; break; } else { __label__ = 34; break; }
      case 33: // $bb39
        var $380=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $381=_llvm_objectsize_i32($380, 0);
        var $382=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $383=(($382+20)&4294967295);
        var $384=(HEAP[$383+3]<<24)|(HEAP[$383+2]<<16)|(HEAP[$383+1]<<8)|(HEAP[$383]);
        var $385=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $386=___strcpy_chk($385, $384, $381);
         HEAP[$iftmp_52+3] = ($386>>24)&0xff; HEAP[$iftmp_52+2] = ($386>>16)&0xff; HEAP[$iftmp_52+1] = ($386>>8)&0xff; HEAP[$iftmp_52] = ($386)&0xff;
        __label__ = 35; break;
      case 34: // $bb40
        var $387=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $388=(($387+20)&4294967295);
        var $389=(HEAP[$388+3]<<24)|(HEAP[$388+2]<<16)|(HEAP[$388+1]<<8)|(HEAP[$388]);
        var $390=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $391=___inline_strcpy_chk($390, $389);
         HEAP[$iftmp_52+3] = ($391>>24)&0xff; HEAP[$iftmp_52+2] = ($391>>16)&0xff; HEAP[$iftmp_52+1] = ($391>>8)&0xff; HEAP[$iftmp_52] = ($391)&0xff;
        __label__ = 35; break;
      case 35: // $bb41
        var $392=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $393=_strlen($392);
         HEAP[$len24+3] = ($393>>24)&0xff; HEAP[$len24+2] = ($393>>16)&0xff; HEAP[$len24+1] = ($393>>8)&0xff; HEAP[$len24] = ($393)&0xff;
        __label__ = 36; break;
      case 36: // $bb42
        var $394=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $395=(HEAP[$len24+3]<<24)|(HEAP[$len24+2]<<16)|(HEAP[$len24+1]<<8)|(HEAP[$len24]);
        var $396=(($394+$395)&4294967295);
         HEAP[$dest+3] = ($396>>24)&0xff; HEAP[$dest+2] = ($396>>16)&0xff; HEAP[$dest+1] = ($396>>8)&0xff; HEAP[$dest] = ($396)&0xff;
        var $397=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$397] = (0)&0xff;
        var $line43=$line;
         HEAP[$dest+3] = ($line43>>24)&0xff; HEAP[$dest+2] = ($line43>>16)&0xff; HEAP[$dest+1] = ($line43>>8)&0xff; HEAP[$dest] = ($line43)&0xff;
        var $398=(HEAP[$lineno+1]<<8)|(HEAP[$lineno]);
        var $399=unSign(($398), 16, 0);
        var $400=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $401=unSign(($400), 16, 0);
        var $402=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $line44=$line;
        var $403=((($401)) & 65535);
        var $404=((($399)) & 65535);
        _hyp_node_add_link($402, $line44, $403, $404);
        __label__ = 41; break;
      case 37: // $bb45
        var $405=(HEAP[$comm]);
        var $406=unSign(($405), 8, 0) > 99;
        if ($406) { __label__ = 38; break; } else { __label__ = 41; break; }
      case 38: // $bb46
        var $407=(HEAP[$comm]);
        var $408=((($407) - 100)&255);
         HEAP[$effects] = ($408)&0xff;
        var $409=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
         HEAP[$409] = (0)&0xff;
        var $line47=$line;
        var $410=(HEAP[$dest+3]<<24)|(HEAP[$dest+2]<<16)|(HEAP[$dest+1]<<8)|(HEAP[$dest]);
        var $411=($line47)!=($410);
        if ($411) { __label__ = 39; break; } else { __label__ = 40; break; }
      case 39: // $bb48
        var $line49=$line;
         HEAP[$dest+3] = ($line49>>24)&0xff; HEAP[$dest+2] = ($line49>>16)&0xff; HEAP[$dest+1] = ($line49>>8)&0xff; HEAP[$dest] = ($line49)&0xff;
        var $412=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $line50=$line;
        _hyp_node_add_string($412, $line50);
        __label__ = 40; break;
      case 40: // $bb51
        var $413=(HEAP[$effects]);
        var $414=unSign(($413), 8, 0);
        var $415=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $416=((($414)) & 255);
        _hyp_node_add_effects($415, $416);
        __label__ = 41; break;
      case 41: // $bb52
        var $417=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $418=(HEAP[$eod+3]<<24)|(HEAP[$eod+2]<<16)|(HEAP[$eod+1]<<8)|(HEAP[$eod]);
        var $419=($417) < ($418);
        if ($419) { __label__ = 3; break; } else { __label__ = 42; break; }
      case 42: // $bb53
        var $420=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
         HEAP[$0+3] = ($420>>24)&0xff; HEAP[$0+2] = ($420>>16)&0xff; HEAP[$0+1] = ($420>>8)&0xff; HEAP[$0] = ($420)&0xff;
        __label__ = 43; break;
      case 43: // $bb54
        var $421=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($421>>24)&0xff; HEAP[$retval+2] = ($421>>16)&0xff; HEAP[$retval+1] = ($421>>8)&0xff; HEAP[$retval] = ($421)&0xff;
        __label__ = 44; break;
      case 44: // $return
        var $retval55=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval55;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_strncpy_chk($__dest, $__src, $__len) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__src_addr=__stackBase__+4;
        var $__len_addr=__stackBase__+8;
        var $retval=__stackBase__+12;
        var $0=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__src_addr+3] = ($__src>>24)&0xff; HEAP[$__src_addr+2] = ($__src>>16)&0xff; HEAP[$__src_addr+1] = ($__src>>8)&0xff; HEAP[$__src_addr] = ($__src)&0xff;
         HEAP[$__len_addr+3] = ($__len>>24)&0xff; HEAP[$__len_addr+2] = ($__len>>16)&0xff; HEAP[$__len_addr+1] = ($__len>>8)&0xff; HEAP[$__len_addr] = ($__len)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $5=(HEAP[$__len_addr+3]<<24)|(HEAP[$__len_addr+2]<<16)|(HEAP[$__len_addr+1]<<8)|(HEAP[$__len_addr]);
        var $6=___strncpy_chk($3, $4, $5, $2);
         HEAP[$0+3] = ($6>>24)&0xff; HEAP[$0+2] = ($6>>16)&0xff; HEAP[$0+1] = ($6>>8)&0xff; HEAP[$0] = ($6)&0xff;
        var $7=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($7>>24)&0xff; HEAP[$retval+2] = ($7>>16)&0xff; HEAP[$retval+1] = ($7>>8)&0xff; HEAP[$retval] = ($7)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function ___inline_strcpy_chk($__dest, $__src) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $__dest_addr=__stackBase__;
        var $__src_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $0=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$__dest_addr+3] = ($__dest>>24)&0xff; HEAP[$__dest_addr+2] = ($__dest>>16)&0xff; HEAP[$__dest_addr+1] = ($__dest>>8)&0xff; HEAP[$__dest_addr] = ($__dest)&0xff;
         HEAP[$__src_addr+3] = ($__src>>24)&0xff; HEAP[$__src_addr+2] = ($__src>>16)&0xff; HEAP[$__src_addr+1] = ($__src>>8)&0xff; HEAP[$__src_addr] = ($__src)&0xff;
        var $1=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $2=_llvm_objectsize_i32($1, 0);
        var $3=(HEAP[$__dest_addr+3]<<24)|(HEAP[$__dest_addr+2]<<16)|(HEAP[$__dest_addr+1]<<8)|(HEAP[$__dest_addr]);
        var $4=(HEAP[$__src_addr+3]<<24)|(HEAP[$__src_addr+2]<<16)|(HEAP[$__src_addr+1]<<8)|(HEAP[$__src_addr]);
        var $5=___strcpy_chk($3, $4, $2);
         HEAP[$0+3] = ($5>>24)&0xff; HEAP[$0+2] = ($5>>16)&0xff; HEAP[$0+1] = ($5>>8)&0xff; HEAP[$0] = ($5)&0xff;
        var $6=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($6>>24)&0xff; HEAP[$retval+2] = ($6>>16)&0xff; HEAP[$retval+1] = ($6>>8)&0xff; HEAP[$retval] = ($6)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_free_node_item($item) {
    var __stackBase__  = STACKTOP; STACKTOP += 4; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 4);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $item_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$item_addr+3] = ($item>>24)&0xff; HEAP[$item_addr+2] = ($item>>16)&0xff; HEAP[$item_addr+1] = ($item>>8)&0xff; HEAP[$item_addr] = ($item)&0xff;
        var $0=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $1=(($0+8)&4294967295);
        var $2=(HEAP[$1+1]<<8)|(HEAP[$1]);
        var $3=reSign(($2), 16, 0);
        if ($3 == 1) {
          __label__ = 1; break;
        }
        else if ($3 == 3) {
          __label__ = 2; break;
        }
        else {
        __label__ = 3; break;
        }
        
      case 1: // $bb
        var $4=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $5=$4;
        var $6=(($5+12)&4294967295);
        var $7=(HEAP[$6+3]<<24)|(HEAP[$6+2]<<16)|(HEAP[$6+1]<<8)|(HEAP[$6]);
        _free($7);
        __label__ = 3; break;
      case 2: // $bb1
        var $8=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $9=$8;
        var $10=(($9+16)&4294967295);
        var $11=(HEAP[$10+3]<<24)|(HEAP[$10+2]<<16)|(HEAP[$10+1]<<8)|(HEAP[$10]);
        _free($11);
        __label__ = 3; break;
      case 3: // $bb2
        var $12=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $13=$12;
        _free($13);
        __label__ = 4; break;
      case 4: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_free_node($node) {
    var __stackBase__  = STACKTOP; STACKTOP += 20; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 20);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $iftmp_59=__stackBase__+4;
        var $iftmp_58=__stackBase__+8;
        var $next=__stackBase__+12;
        var $trash=__stackBase__+16;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
        var $0=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $1=(($0+8)&4294967295);
        var $2=(HEAP[$1+3]<<24)|(HEAP[$1+2]<<16)|(HEAP[$1+1]<<8)|(HEAP[$1]);
        var $3=$2;
        var $4=(($3)&4294967295);
        var $5=(($4)&4294967295);
        var $6=(HEAP[$5+3]<<24)|(HEAP[$5+2]<<16)|(HEAP[$5+1]<<8)|(HEAP[$5]);
        var $7=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $8=(($7+8)&4294967295);
        var $9=(HEAP[$8+3]<<24)|(HEAP[$8+2]<<16)|(HEAP[$8+1]<<8)|(HEAP[$8]);
        var $10=$9;
        var $11=(($10+8)&4294967295);
        var $12=($6)!=($11);
        if ($12) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $13=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $14=(($13+8)&4294967295);
        var $15=(HEAP[$14+3]<<24)|(HEAP[$14+2]<<16)|(HEAP[$14+1]<<8)|(HEAP[$14]);
        var $16=$15;
        var $17=(($16)&4294967295);
        var $18=(($17)&4294967295);
        var $19=(HEAP[$18+3]<<24)|(HEAP[$18+2]<<16)|(HEAP[$18+1]<<8)|(HEAP[$18]);
        var $20=$19;
         HEAP[$iftmp_58+3] = ($20>>24)&0xff; HEAP[$iftmp_58+2] = ($20>>16)&0xff; HEAP[$iftmp_58+1] = ($20>>8)&0xff; HEAP[$iftmp_58] = ($20)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
         HEAP[$iftmp_58+3] = (0>>24)&0xff; HEAP[$iftmp_58+2] = (0>>16)&0xff; HEAP[$iftmp_58+1] = (0>>8)&0xff; HEAP[$iftmp_58] = (0)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $21=(HEAP[$iftmp_58+3]<<24)|(HEAP[$iftmp_58+2]<<16)|(HEAP[$iftmp_58+1]<<8)|(HEAP[$iftmp_58]);
         HEAP[$trash+3] = ($21>>24)&0xff; HEAP[$trash+2] = ($21>>16)&0xff; HEAP[$trash+1] = ($21>>8)&0xff; HEAP[$trash] = ($21)&0xff;
        __label__ = 8; break;
      case 4: // $bb3
        var $22=(HEAP[$trash+3]<<24)|(HEAP[$trash+2]<<16)|(HEAP[$trash+1]<<8)|(HEAP[$trash]);
        var $23=$22;
        var $24=(($23)&4294967295);
        var $25=(HEAP[$24+3]<<24)|(HEAP[$24+2]<<16)|(HEAP[$24+1]<<8)|(HEAP[$24]);
        var $26=(($25)&4294967295);
        var $27=(HEAP[$26+3]<<24)|(HEAP[$26+2]<<16)|(HEAP[$26+1]<<8)|(HEAP[$26]);
        var $28=($27)!=0;
        if ($28) { __label__ = 5; break; } else { __label__ = 6; break; }
      case 5: // $bb4
        var $29=(HEAP[$trash+3]<<24)|(HEAP[$trash+2]<<16)|(HEAP[$trash+1]<<8)|(HEAP[$trash]);
        var $30=$29;
        var $31=(($30)&4294967295);
        var $32=(HEAP[$31+3]<<24)|(HEAP[$31+2]<<16)|(HEAP[$31+1]<<8)|(HEAP[$31]);
        var $33=$32;
         HEAP[$iftmp_59+3] = ($33>>24)&0xff; HEAP[$iftmp_59+2] = ($33>>16)&0xff; HEAP[$iftmp_59+1] = ($33>>8)&0xff; HEAP[$iftmp_59] = ($33)&0xff;
        __label__ = 7; break;
      case 6: // $bb5
         HEAP[$iftmp_59+3] = (0>>24)&0xff; HEAP[$iftmp_59+2] = (0>>16)&0xff; HEAP[$iftmp_59+1] = (0>>8)&0xff; HEAP[$iftmp_59] = (0)&0xff;
        __label__ = 7; break;
      case 7: // $bb6
        var $34=(HEAP[$iftmp_59+3]<<24)|(HEAP[$iftmp_59+2]<<16)|(HEAP[$iftmp_59+1]<<8)|(HEAP[$iftmp_59]);
         HEAP[$next+3] = ($34>>24)&0xff; HEAP[$next+2] = ($34>>16)&0xff; HEAP[$next+1] = ($34>>8)&0xff; HEAP[$next] = ($34)&0xff;
        var $35=(HEAP[$trash+3]<<24)|(HEAP[$trash+2]<<16)|(HEAP[$trash+1]<<8)|(HEAP[$trash]);
        _hyp_free_node_item($35);
        var $36=(HEAP[$next+3]<<24)|(HEAP[$next+2]<<16)|(HEAP[$next+1]<<8)|(HEAP[$next]);
         HEAP[$trash+3] = ($36>>24)&0xff; HEAP[$trash+2] = ($36>>16)&0xff; HEAP[$trash+1] = ($36>>8)&0xff; HEAP[$trash] = ($36)&0xff;
        __label__ = 8; break;
      case 8: // $bb7
        var $37=(HEAP[$trash+3]<<24)|(HEAP[$trash+2]<<16)|(HEAP[$trash+1]<<8)|(HEAP[$trash]);
        var $38=($37)!=0;
        if ($38) { __label__ = 4; break; } else { __label__ = 9; break; }
      case 9: // $bb8
        var $39=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $40=(($39+8)&4294967295);
        var $41=(HEAP[$40+3]<<24)|(HEAP[$40+2]<<16)|(HEAP[$40+1]<<8)|(HEAP[$40]);
        _free($41);
        var $42=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $43=(($42+4)&4294967295);
        var $44=(HEAP[$43+3]<<24)|(HEAP[$43+2]<<16)|(HEAP[$43+1]<<8)|(HEAP[$43]);
        _free($44);
        var $45=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $46=$45;
        _free($46);
        __label__ = 10; break;
      case 10: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_item_first($node) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $node_addr=__stackBase__;
        var $retval=__stackBase__+4;
        var $iftmp_62=__stackBase__+8;
        var $0=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$node_addr+3] = ($node>>24)&0xff; HEAP[$node_addr+2] = ($node>>16)&0xff; HEAP[$node_addr+1] = ($node>>8)&0xff; HEAP[$node_addr] = ($node)&0xff;
        var $1=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $2=(($1+8)&4294967295);
        var $3=(HEAP[$2+3]<<24)|(HEAP[$2+2]<<16)|(HEAP[$2+1]<<8)|(HEAP[$2]);
        var $4=$3;
        var $5=(($4)&4294967295);
        var $6=(($5)&4294967295);
        var $7=(HEAP[$6+3]<<24)|(HEAP[$6+2]<<16)|(HEAP[$6+1]<<8)|(HEAP[$6]);
        var $8=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $9=(($8+8)&4294967295);
        var $10=(HEAP[$9+3]<<24)|(HEAP[$9+2]<<16)|(HEAP[$9+1]<<8)|(HEAP[$9]);
        var $11=$10;
        var $12=(($11+8)&4294967295);
        var $13=($7)!=($12);
        if ($13) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $14=(HEAP[$node_addr+3]<<24)|(HEAP[$node_addr+2]<<16)|(HEAP[$node_addr+1]<<8)|(HEAP[$node_addr]);
        var $15=(($14+8)&4294967295);
        var $16=(HEAP[$15+3]<<24)|(HEAP[$15+2]<<16)|(HEAP[$15+1]<<8)|(HEAP[$15]);
        var $17=$16;
        var $18=(($17)&4294967295);
        var $19=(($18)&4294967295);
        var $20=(HEAP[$19+3]<<24)|(HEAP[$19+2]<<16)|(HEAP[$19+1]<<8)|(HEAP[$19]);
        var $21=$20;
         HEAP[$iftmp_62+3] = ($21>>24)&0xff; HEAP[$iftmp_62+2] = ($21>>16)&0xff; HEAP[$iftmp_62+1] = ($21>>8)&0xff; HEAP[$iftmp_62] = ($21)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
         HEAP[$iftmp_62+3] = (0>>24)&0xff; HEAP[$iftmp_62+2] = (0>>16)&0xff; HEAP[$iftmp_62+1] = (0>>8)&0xff; HEAP[$iftmp_62] = (0)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $22=(HEAP[$iftmp_62+3]<<24)|(HEAP[$iftmp_62+2]<<16)|(HEAP[$iftmp_62+1]<<8)|(HEAP[$iftmp_62]);
         HEAP[$0+3] = ($22>>24)&0xff; HEAP[$0+2] = ($22>>16)&0xff; HEAP[$0+1] = ($22>>8)&0xff; HEAP[$0] = ($22)&0xff;
        var $23=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($23>>24)&0xff; HEAP[$retval+2] = ($23>>16)&0xff; HEAP[$retval+1] = ($23>>8)&0xff; HEAP[$retval] = ($23)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_node_item_next($item) {
    var __stackBase__  = STACKTOP; STACKTOP += 16; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 16);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $item_addr=__stackBase__;
        var $retval=__stackBase__+4;
        var $iftmp_63=__stackBase__+8;
        var $0=__stackBase__+12;
        var $_alloca_point_=0;
         HEAP[$item_addr+3] = ($item>>24)&0xff; HEAP[$item_addr+2] = ($item>>16)&0xff; HEAP[$item_addr+1] = ($item>>8)&0xff; HEAP[$item_addr] = ($item)&0xff;
        var $1=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $2=$1;
        var $3=(($2)&4294967295);
        var $4=(HEAP[$3+3]<<24)|(HEAP[$3+2]<<16)|(HEAP[$3+1]<<8)|(HEAP[$3]);
        var $5=(($4)&4294967295);
        var $6=(HEAP[$5+3]<<24)|(HEAP[$5+2]<<16)|(HEAP[$5+1]<<8)|(HEAP[$5]);
        var $7=($6)!=0;
        if ($7) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $8=(HEAP[$item_addr+3]<<24)|(HEAP[$item_addr+2]<<16)|(HEAP[$item_addr+1]<<8)|(HEAP[$item_addr]);
        var $9=$8;
        var $10=(($9)&4294967295);
        var $11=(HEAP[$10+3]<<24)|(HEAP[$10+2]<<16)|(HEAP[$10+1]<<8)|(HEAP[$10]);
        var $12=$11;
         HEAP[$iftmp_63+3] = ($12>>24)&0xff; HEAP[$iftmp_63+2] = ($12>>16)&0xff; HEAP[$iftmp_63+1] = ($12>>8)&0xff; HEAP[$iftmp_63] = ($12)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
         HEAP[$iftmp_63+3] = (0>>24)&0xff; HEAP[$iftmp_63+2] = (0>>16)&0xff; HEAP[$iftmp_63+1] = (0>>8)&0xff; HEAP[$iftmp_63] = (0)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $13=(HEAP[$iftmp_63+3]<<24)|(HEAP[$iftmp_63+2]<<16)|(HEAP[$iftmp_63+1]<<8)|(HEAP[$iftmp_63]);
         HEAP[$0+3] = ($13>>24)&0xff; HEAP[$0+2] = ($13>>16)&0xff; HEAP[$0+1] = ($13>>8)&0xff; HEAP[$0] = ($13)&0xff;
        var $14=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($14>>24)&0xff; HEAP[$retval+2] = ($14>>16)&0xff; HEAP[$retval+1] = ($14>>8)&0xff; HEAP[$retval] = ($14)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_parse_node($hyp, $index) {
    var __stackBase__  = STACKTOP; STACKTOP += 28; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 28);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $index_addr=__stackBase__+4;
        var $retval=__stackBase__+8;
        var $0=__stackBase__+12;
        var $len=__stackBase__+16;
        var $buffer=__stackBase__+20;
        var $node=__stackBase__+24;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$index_addr+3] = ($index>>24)&0xff; HEAP[$index_addr+2] = ($index>>16)&0xff; HEAP[$index_addr+1] = ($index>>8)&0xff; HEAP[$index_addr] = ($index)&0xff;
        var $1=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $2=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $3=_hyp_read_index_data($2, $1, $len);
         HEAP[$buffer+3] = ($3>>24)&0xff; HEAP[$buffer+2] = ($3>>16)&0xff; HEAP[$buffer+1] = ($3>>8)&0xff; HEAP[$buffer] = ($3)&0xff;
        var $4=(HEAP[$buffer+3]<<24)|(HEAP[$buffer+2]<<16)|(HEAP[$buffer+1]<<8)|(HEAP[$buffer]);
        var $5=($4)!=0;
        if ($5) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
        var $6=(HEAP[$len+3]<<24)|(HEAP[$len+2]<<16)|(HEAP[$len+1]<<8)|(HEAP[$len]);
        var $7=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $8=(HEAP[$buffer+3]<<24)|(HEAP[$buffer+2]<<16)|(HEAP[$buffer+1]<<8)|(HEAP[$buffer]);
        var $9=_hyp_parse_node_data($7, $8, $6);
         HEAP[$node+3] = ($9>>24)&0xff; HEAP[$node+2] = ($9>>16)&0xff; HEAP[$node+1] = ($9>>8)&0xff; HEAP[$node] = ($9)&0xff;
        var $10=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $11=(($10+16)&4294967295);
        var $12=(HEAP[$11+3]<<24)|(HEAP[$11+2]<<16)|(HEAP[$11+1]<<8)|(HEAP[$11]);
        var $13=(HEAP[$index_addr+3]<<24)|(HEAP[$index_addr+2]<<16)|(HEAP[$index_addr+1]<<8)|(HEAP[$index_addr]);
        var $14=(($12+24*$13)&4294967295);
        var $15=(($14+20)&4294967295);
        var $16=(HEAP[$15+3]<<24)|(HEAP[$15+2]<<16)|(HEAP[$15+1]<<8)|(HEAP[$15]);
        var $17=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
        var $18=(($17)&4294967295);
         HEAP[$18+3] = ($16>>24)&0xff; HEAP[$18+2] = ($16>>16)&0xff; HEAP[$18+1] = ($16>>8)&0xff; HEAP[$18] = ($16)&0xff;
        var $19=(HEAP[$buffer+3]<<24)|(HEAP[$buffer+2]<<16)|(HEAP[$buffer+1]<<8)|(HEAP[$buffer]);
        _free($19);
        var $20=(HEAP[$node+3]<<24)|(HEAP[$node+2]<<16)|(HEAP[$node+1]<<8)|(HEAP[$node]);
         HEAP[$0+3] = ($20>>24)&0xff; HEAP[$0+2] = ($20>>16)&0xff; HEAP[$0+1] = ($20>>8)&0xff; HEAP[$0] = ($20)&0xff;
        __label__ = 3; break;
      case 2: // $bb1
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 3; break;
      case 3: // $bb2
        var $21=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($21>>24)&0xff; HEAP[$retval+2] = ($21>>16)&0xff; HEAP[$retval+1] = ($21>>8)&0xff; HEAP[$retval] = ($21)&0xff;
        __label__ = 4; break;
      case 4: // $return
        var $retval3=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval3;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_parse_ext_header($hyp, $header_ext, $buff) {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $header_ext_addr=__stackBase__+4;
        var $buff_addr=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
         HEAP[$header_ext_addr+3] = ($header_ext>>24)&0xff; HEAP[$header_ext_addr+2] = ($header_ext>>16)&0xff; HEAP[$header_ext_addr+1] = ($header_ext>>8)&0xff; HEAP[$header_ext_addr] = ($header_ext)&0xff;
         HEAP[$buff_addr+3] = ($buff>>24)&0xff; HEAP[$buff_addr+2] = ($buff>>16)&0xff; HEAP[$buff_addr+1] = ($buff>>8)&0xff; HEAP[$buff_addr] = ($buff)&0xff;
        var $0=(HEAP[$header_ext_addr+3]<<24)|(HEAP[$header_ext_addr+2]<<16)|(HEAP[$header_ext_addr+1]<<8)|(HEAP[$header_ext_addr]);
        var $1=(($0)&4294967295);
        var $2=(HEAP[$1+1]<<8)|(HEAP[$1]);
        var $3=unSign(($2), 16, 0);
        if ($3 == 1) {
          __label__ = 1; break;
        }
        else if ($3 == 2) {
          __label__ = 2; break;
        }
        else if ($3 == 3) {
          __label__ = 3; break;
        }
        else if ($3 == 4) {
          __label__ = 4; break;
        }
        else if ($3 == 5) {
          __label__ = 5; break;
        }
        else if ($3 == 6) {
          __label__ = 6; break;
        }
        else if ($3 == 7) {
          __label__ = 7; break;
        }
        else if ($3 == 8) {
          __label__ = 8; break;
        }
        else if ($3 == 9) {
          __label__ = 9; break;
        }
        else if ($3 == 10) {
          __label__ = 10; break;
        }
        else if ($3 == 11) {
          __label__ = 11; break;
        }
        else {
        __label__ = 12; break;
        }
        
      case 1: // $bb
        var $4=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $5=_strdup($4);
        var $6=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $7=(($6+20)&4294967295);
        var $8=(($7+8)&4294967295);
         HEAP[$8+3] = ($5>>24)&0xff; HEAP[$8+2] = ($5>>16)&0xff; HEAP[$8+1] = ($5>>8)&0xff; HEAP[$8] = ($5)&0xff;
        __label__ = 12; break;
      case 2: // $bb1
        var $9=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $10=_strdup($9);
        var $11=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $12=(($11+20)&4294967295);
        var $13=(($12+4)&4294967295);
         HEAP[$13+3] = ($10>>24)&0xff; HEAP[$13+2] = ($10>>16)&0xff; HEAP[$13+1] = ($10>>8)&0xff; HEAP[$13] = ($10)&0xff;
        __label__ = 12; break;
      case 3: // $bb2
        __label__ = 12; break;
      case 4: // $bb3
        var $14=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $15=_strdup($14);
        var $16=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $17=(($16+20)&4294967295);
        var $18=(($17+24)&4294967295);
         HEAP[$18+3] = ($15>>24)&0xff; HEAP[$18+2] = ($15>>16)&0xff; HEAP[$18+1] = ($15>>8)&0xff; HEAP[$18] = ($15)&0xff;
        __label__ = 12; break;
      case 5: // $bb4
        var $19=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $20=_strdup($19);
        var $21=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $22=(($21+20)&4294967295);
        var $23=(($22+20)&4294967295);
         HEAP[$23+3] = ($20>>24)&0xff; HEAP[$23+2] = ($20>>16)&0xff; HEAP[$23+1] = ($20>>8)&0xff; HEAP[$23] = ($20)&0xff;
        __label__ = 12; break;
      case 6: // $bb5
        var $24=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $25=_strdup($24);
        var $26=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $27=(($26+20)&4294967295);
        var $28=(($27+12)&4294967295);
         HEAP[$28+3] = ($25>>24)&0xff; HEAP[$28+2] = ($25>>16)&0xff; HEAP[$28+1] = ($25>>8)&0xff; HEAP[$28] = ($25)&0xff;
        __label__ = 12; break;
      case 7: // $bb6
        var $29=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $30=_strdup($29);
        var $31=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $32=(($31+20)&4294967295);
        var $33=(($32)&4294967295);
         HEAP[$33+3] = ($30>>24)&0xff; HEAP[$33+2] = ($30>>16)&0xff; HEAP[$33+1] = ($30>>8)&0xff; HEAP[$33] = ($30)&0xff;
        __label__ = 12; break;
      case 8: // $bb7
        var $34=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $35=_strdup($34);
        var $36=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $37=(($36+20)&4294967295);
        var $38=(($37+16)&4294967295);
         HEAP[$38+3] = ($35>>24)&0xff; HEAP[$38+2] = ($35>>16)&0xff; HEAP[$38+1] = ($35>>8)&0xff; HEAP[$38] = ($35)&0xff;
        __label__ = 12; break;
      case 9: // $bb8
        __label__ = 12; break;
      case 10: // $bb9
        var $39=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $40=_strdup($39);
        var $41=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $42=(($41+20)&4294967295);
        var $43=(($42+28)&4294967295);
         HEAP[$43+3] = ($40>>24)&0xff; HEAP[$43+2] = ($40>>16)&0xff; HEAP[$43+1] = ($40>>8)&0xff; HEAP[$43] = ($40)&0xff;
        __label__ = 12; break;
      case 11: // $bb10
        var $44=(HEAP[$buff_addr+3]<<24)|(HEAP[$buff_addr+2]<<16)|(HEAP[$buff_addr+1]<<8)|(HEAP[$buff_addr]);
        var $45=(HEAP[$44]);
        var $46=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $47=(($46+20)&4294967295);
        var $48=(($47+32)&4294967295);
         HEAP[$48] = ($45)&0xff;
        __label__ = 12; break;
      case 12: // $bb11
        __label__ = 13; break;
      case 13: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_load($filename) {
    var __stackBase__  = STACKTOP; STACKTOP += 302; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 302);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $filename_addr=__stackBase__;
        var $retval=__stackBase__+4;
        var $0=__stackBase__+8;
        var $fh=__stackBase__+12;
        var $header_ext=__stackBase__+16;
        var $entry_offset=__stackBase__+20;
        var $index=__stackBase__+24;
        var $hyp=__stackBase__+26;
        var $buff=__stackBase__+30;
        var $buff15=__stackBase__+286;
        var $ie=__stackBase__+290;
        var $ie19=__stackBase__+294;
        var $o=__stackBase__+298;
        var $_alloca_point_=0;
         HEAP[$filename_addr+3] = ($filename>>24)&0xff; HEAP[$filename_addr+2] = ($filename>>16)&0xff; HEAP[$filename_addr+1] = ($filename>>8)&0xff; HEAP[$filename_addr] = ($filename)&0xff;
        var $1=_malloc(60);
        var $2=$1;
         HEAP[$hyp+3] = ($2>>24)&0xff; HEAP[$hyp+2] = ($2>>16)&0xff; HEAP[$hyp+1] = ($2>>8)&0xff; HEAP[$hyp] = ($2)&0xff;
        var $3=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $4=($3)==0;
        if ($4) { __label__ = 1; break; } else { __label__ = 2; break; }
      case 1: // $bb
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 24; break;
      case 2: // $bb1
        var $5=(HEAP[$filename_addr+3]<<24)|(HEAP[$filename_addr+2]<<16)|(HEAP[$filename_addr+1]<<8)|(HEAP[$filename_addr]);
        var $6=_strdup($5);
        var $7=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $8=(($7)&4294967295);
         HEAP[$8+3] = ($6>>24)&0xff; HEAP[$8+2] = ($6>>16)&0xff; HEAP[$8+1] = ($6>>8)&0xff; HEAP[$8] = ($6)&0xff;
        var $9=(HEAP[$filename_addr+3]<<24)|(HEAP[$filename_addr+2]<<16)|(HEAP[$filename_addr+1]<<8)|(HEAP[$filename_addr]);
        var $10=___01_fopen$UNIX2003_($9, ((__str23)&4294967295));
         HEAP[$fh+3] = ($10>>24)&0xff; HEAP[$fh+2] = ($10>>16)&0xff; HEAP[$fh+1] = ($10>>8)&0xff; HEAP[$fh] = ($10)&0xff;
        var $11=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $12=($11)==0;
        if ($12) { __label__ = 3; break; } else { __label__ = 4; break; }
      case 3: // $bb2
        var $13=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $14=$13;
        _free($14);
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 24; break;
      case 4: // $bb3
        var $15=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $16=(($15+4)&4294967295);
        var $17=$16;
        var $18=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $19=_fread($17, 12, 1, $18);
        var $20=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $21=(($20+4)&4294967295);
        var $22=(($21)&4294967295);
        var $23=(HEAP[$22+3]<<24)|(HEAP[$22+2]<<16)|(HEAP[$22+1]<<8)|(HEAP[$22]);
        var $24=__OSSwapInt32($23);
        var $25=((($24))|0)!=1212436291;
        if ($25) { __label__ = 5; break; } else { __label__ = 6; break; }
      case 5: // $bb4
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 24; break;
      case 6: // $bb5
        var $26=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $27=(($26+20)&4294967295);
        var $28=(($27+8)&4294967295);
         HEAP[$28+3] = (0>>24)&0xff; HEAP[$28+2] = (0>>16)&0xff; HEAP[$28+1] = (0>>8)&0xff; HEAP[$28] = (0)&0xff;
        var $29=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $30=(($29+20)&4294967295);
        var $31=(($30+4)&4294967295);
         HEAP[$31+3] = (0>>24)&0xff; HEAP[$31+2] = (0>>16)&0xff; HEAP[$31+1] = (0>>8)&0xff; HEAP[$31] = (0)&0xff;
        var $32=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $33=(($32+20)&4294967295);
        var $34=(($33+24)&4294967295);
         HEAP[$34+3] = (0>>24)&0xff; HEAP[$34+2] = (0>>16)&0xff; HEAP[$34+1] = (0>>8)&0xff; HEAP[$34] = (0)&0xff;
        var $35=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $36=(($35+20)&4294967295);
        var $37=(($36+20)&4294967295);
         HEAP[$37+3] = (0>>24)&0xff; HEAP[$37+2] = (0>>16)&0xff; HEAP[$37+1] = (0>>8)&0xff; HEAP[$37] = (0)&0xff;
        var $38=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $39=(($38+20)&4294967295);
        var $40=(($39+12)&4294967295);
         HEAP[$40+3] = (0>>24)&0xff; HEAP[$40+2] = (0>>16)&0xff; HEAP[$40+1] = (0>>8)&0xff; HEAP[$40] = (0)&0xff;
        var $41=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $42=(($41+20)&4294967295);
        var $43=(($42)&4294967295);
         HEAP[$43+3] = (0>>24)&0xff; HEAP[$43+2] = (0>>16)&0xff; HEAP[$43+1] = (0>>8)&0xff; HEAP[$43] = (0)&0xff;
        var $44=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $45=(($44+20)&4294967295);
        var $46=(($45+16)&4294967295);
         HEAP[$46+3] = (0>>24)&0xff; HEAP[$46+2] = (0>>16)&0xff; HEAP[$46+1] = (0>>8)&0xff; HEAP[$46] = (0)&0xff;
        var $47=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $48=(($47+20)&4294967295);
        var $49=(($48+28)&4294967295);
         HEAP[$49+3] = (0>>24)&0xff; HEAP[$49+2] = (0>>16)&0xff; HEAP[$49+1] = (0>>8)&0xff; HEAP[$49] = (0)&0xff;
        var $50=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $51=(($50+20)&4294967295);
        var $52=(($51+32)&4294967295);
         HEAP[$52] = (75)&0xff;
        var $53=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $54=(($53+4)&4294967295);
        var $55=(($54+4)&4294967295);
        var $56=(HEAP[$55+3]<<24)|(HEAP[$55+2]<<16)|(HEAP[$55+1]<<8)|(HEAP[$55]);
        var $57=__OSSwapInt32($56);
        var $58=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $59=(($58+4)&4294967295);
        var $60=(($59+4)&4294967295);
         HEAP[$60+3] = ($57>>24)&0xff; HEAP[$60+2] = ($57>>16)&0xff; HEAP[$60+1] = ($57>>8)&0xff; HEAP[$60] = ($57)&0xff;
        var $61=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $62=(($61+4)&4294967295);
        var $63=(($62+8)&4294967295);
        var $64=(HEAP[$63+1]<<8)|(HEAP[$63]);
        var $65=unSign(($64), 16, 0);
        var $66=((($65)) & 65535);
        var $67=__OSSwapInt16($66);
        var $68=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $69=(($68+4)&4294967295);
        var $70=(($69+8)&4294967295);
         HEAP[$70+1] = ($67>>8)&0xff; HEAP[$70] = ($67)&0xff;
        var $71=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $72=(($71+4)&4294967295);
        var $73=(($72+8)&4294967295);
        var $74=(HEAP[$73+1]<<8)|(HEAP[$73]);
        var $75=unSign(($74), 16, 0);
        var $76=((($75) + 1)&4294967295);
        var $77=((($76) * 24)&4294967295);
         HEAP[$entry_offset+3] = ($77>>24)&0xff; HEAP[$entry_offset+2] = ($77>>16)&0xff; HEAP[$entry_offset+1] = ($77>>8)&0xff; HEAP[$entry_offset] = ($77)&0xff;
        var $78=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $79=(($78+4)&4294967295);
        var $80=(($79+4)&4294967295);
        var $81=(HEAP[$80+3]<<24)|(HEAP[$80+2]<<16)|(HEAP[$80+1]<<8)|(HEAP[$80]);
        var $82=(HEAP[$entry_offset+3]<<24)|(HEAP[$entry_offset+2]<<16)|(HEAP[$entry_offset+1]<<8)|(HEAP[$entry_offset]);
        var $83=((($81) + ($82))&4294967295);
        var $84=_malloc($83);
        var $85=$84;
        var $86=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $87=(($86+16)&4294967295);
         HEAP[$87+3] = ($85>>24)&0xff; HEAP[$87+2] = ($85>>16)&0xff; HEAP[$87+1] = ($85>>8)&0xff; HEAP[$87] = ($85)&0xff;
        var $88=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $89=(($88+16)&4294967295);
        var $90=(HEAP[$89+3]<<24)|(HEAP[$89+2]<<16)|(HEAP[$89+1]<<8)|(HEAP[$89]);
        var $91=($90)==0;
        if ($91) { __label__ = 7; break; } else { __label__ = 8; break; }
      case 7: // $bb6
         HEAP[$0+3] = (0>>24)&0xff; HEAP[$0+2] = (0>>16)&0xff; HEAP[$0+1] = (0>>8)&0xff; HEAP[$0] = (0)&0xff;
        __label__ = 24; break;
      case 8: // $bb7
        var $92=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $93=(($92+16)&4294967295);
        var $94=(HEAP[$93+3]<<24)|(HEAP[$93+2]<<16)|(HEAP[$93+1]<<8)|(HEAP[$93]);
        var $95=($94);
        var $96=(HEAP[$entry_offset+3]<<24)|(HEAP[$entry_offset+2]<<16)|(HEAP[$entry_offset+1]<<8)|(HEAP[$entry_offset]);
        var $97=((($95) + ($96))&4294967295);
         HEAP[$entry_offset+3] = ($97>>24)&0xff; HEAP[$entry_offset+2] = ($97>>16)&0xff; HEAP[$entry_offset+1] = ($97>>8)&0xff; HEAP[$entry_offset] = ($97)&0xff;
        var $98=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $99=(($98+4)&4294967295);
        var $100=(($99+4)&4294967295);
        var $101=(HEAP[$100+3]<<24)|(HEAP[$100+2]<<16)|(HEAP[$100+1]<<8)|(HEAP[$100]);
        var $102=(HEAP[$entry_offset+3]<<24)|(HEAP[$entry_offset+2]<<16)|(HEAP[$entry_offset+1]<<8)|(HEAP[$entry_offset]);
        var $103=($102);
        var $104=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $105=_fread($103, $101, 1, $104);
        __label__ = 9; break;
      case 9: // $bb8
        var $header_ext9=$header_ext;
        var $106=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $107=_fread($header_ext9, 4, 1, $106);
        var $108=(($header_ext)&4294967295);
        var $109=(HEAP[$108+1]<<8)|(HEAP[$108]);
        var $110=unSign(($109), 16, 0);
        var $111=((($110)) & 65535);
        var $112=__OSSwapInt16($111);
        var $113=(($header_ext)&4294967295);
         HEAP[$113+1] = ($112>>8)&0xff; HEAP[$113] = ($112)&0xff;
        var $114=(($header_ext)&4294967295);
        var $115=(HEAP[$114+1]<<8)|(HEAP[$114]);
        var $116=reSign(($115), 16, 0)==0;
        if ($116) { __label__ = 14; break; } else { __label__ = 10; break; }
      case 10: // $bb10
        var $117=(($header_ext+2)&4294967295);
        var $118=(HEAP[$117+1]<<8)|(HEAP[$117]);
        var $119=unSign(($118), 16, 0);
        var $120=((($119)) & 65535);
        var $121=__OSSwapInt16($120);
        var $122=(($header_ext+2)&4294967295);
         HEAP[$122+1] = ($121>>8)&0xff; HEAP[$122] = ($121)&0xff;
        var $123=(($header_ext+2)&4294967295);
        var $124=(HEAP[$123+1]<<8)|(HEAP[$123]);
        var $125=unSign(($124), 16, 0) <= 256;
        if ($125) { __label__ = 11; break; } else { __label__ = 12; break; }
      case 11: // $bb11
        var $126=(($header_ext+2)&4294967295);
        var $127=(HEAP[$126+1]<<8)|(HEAP[$126]);
        var $128=unSign(($127), 16, 0);
        var $buff12=$buff;
        var $129=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $130=_fread($buff12, $128, 1, $129);
        var $131=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $buff13=$buff;
        _hyp_parse_ext_header($131, $header_ext, $buff13);
        __label__ = 13; break;
      case 12: // $bb14
        var $132=(($header_ext+2)&4294967295);
        var $133=(HEAP[$132+1]<<8)|(HEAP[$132]);
        var $134=unSign(($133), 16, 0);
        var $135=_malloc($134);
         HEAP[$buff15+3] = ($135>>24)&0xff; HEAP[$buff15+2] = ($135>>16)&0xff; HEAP[$buff15+1] = ($135>>8)&0xff; HEAP[$buff15] = ($135)&0xff;
        var $136=(($header_ext+2)&4294967295);
        var $137=(HEAP[$136+1]<<8)|(HEAP[$136]);
        var $138=unSign(($137), 16, 0);
        var $139=(HEAP[$buff15+3]<<24)|(HEAP[$buff15+2]<<16)|(HEAP[$buff15+1]<<8)|(HEAP[$buff15]);
        var $140=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $141=_fread($139, $138, 1, $140);
        var $142=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $143=(HEAP[$buff15+3]<<24)|(HEAP[$buff15+2]<<16)|(HEAP[$buff15+1]<<8)|(HEAP[$buff15]);
        _hyp_parse_ext_header($142, $header_ext, $143);
        var $144=(HEAP[$buff15+3]<<24)|(HEAP[$buff15+2]<<16)|(HEAP[$buff15+1]<<8)|(HEAP[$buff15]);
        _free($144);
        __label__ = 13; break;
      case 13: // $bb16
        __label__ = 9; break;
      case 14: // $bb17
        var $145=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $146=(($145+16)&4294967295);
        var $147=(HEAP[$146+3]<<24)|(HEAP[$146+2]<<16)|(HEAP[$146+1]<<8)|(HEAP[$146]);
        var $148=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $149=(($148+4)&4294967295);
        var $150=(($149+8)&4294967295);
        var $151=(HEAP[$150+1]<<8)|(HEAP[$150]);
        var $152=unSign(($151), 16, 0);
        var $153=(($147+24*$152)&4294967295);
         HEAP[$ie+3] = ($153>>24)&0xff; HEAP[$ie+2] = ($153>>16)&0xff; HEAP[$ie+1] = ($153>>8)&0xff; HEAP[$ie] = ($153)&0xff;
        var $154=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $155=(($154)&4294967295);
         HEAP[$155] = (0)&0xff;
        var $156=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $157=_fseek($156, 0, 2);
        var $158=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $159=_ftell($158);
        var $160=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $161=(($160+4)&4294967295);
         HEAP[$161+3] = ($159>>24)&0xff; HEAP[$161+2] = ($159>>16)&0xff; HEAP[$161+1] = ($159>>8)&0xff; HEAP[$161] = ($159)&0xff;
        var $162=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $163=(($162+8)&4294967295);
         HEAP[$163+3] = (0>>24)&0xff; HEAP[$163+2] = (0>>16)&0xff; HEAP[$163+1] = (0>>8)&0xff; HEAP[$163] = (0)&0xff;
        var $164=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $165=(($164+12)&4294967295);
         HEAP[$165+1] = (1>>8)&0xff; HEAP[$165] = (1)&0xff;
        var $166=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $167=(($166+14)&4294967295);
         HEAP[$167+1] = (1>>8)&0xff; HEAP[$167] = (1)&0xff;
        var $168=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $169=(($168+16)&4294967295);
         HEAP[$169+1] = (1>>8)&0xff; HEAP[$169] = (1)&0xff;
        var $170=(HEAP[$ie+3]<<24)|(HEAP[$ie+2]<<16)|(HEAP[$ie+1]<<8)|(HEAP[$ie]);
        var $171=(($170+20)&4294967295);
         HEAP[$171+3] = (((__str124)&4294967295)>>24)&0xff; HEAP[$171+2] = (((__str124)&4294967295)>>16)&0xff; HEAP[$171+1] = (((__str124)&4294967295)>>8)&0xff; HEAP[$171] = (((__str124)&4294967295))&0xff;
        var $172=(HEAP[$fh+3]<<24)|(HEAP[$fh+2]<<16)|(HEAP[$fh+1]<<8)|(HEAP[$fh]);
        var $173=_fclose($172);
        var $174=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $175=(($174+20)&4294967295);
        var $176=(($175+36)&4294967295);
         HEAP[$176+3] = (-1>>24)&0xff; HEAP[$176+2] = (-1>>16)&0xff; HEAP[$176+1] = (-1>>8)&0xff; HEAP[$176] = (-1)&0xff;
         HEAP[$index+1] = (0>>8)&0xff; HEAP[$index] = (0)&0xff;
        __label__ = 22; break;
      case 15: // $bb18
        var $177=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $178=(($177+16)&4294967295);
        var $179=(HEAP[$178+3]<<24)|(HEAP[$178+2]<<16)|(HEAP[$178+1]<<8)|(HEAP[$178]);
        var $180=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $181=unSign(($180), 16, 0);
        var $182=(($179+24*$181)&4294967295);
         HEAP[$ie19+3] = ($182>>24)&0xff; HEAP[$ie19+2] = ($182>>16)&0xff; HEAP[$ie19+1] = ($182>>8)&0xff; HEAP[$ie19] = ($182)&0xff;
        var $183=(HEAP[$entry_offset+3]<<24)|(HEAP[$entry_offset+2]<<16)|(HEAP[$entry_offset+1]<<8)|(HEAP[$entry_offset]);
        var $184=($183);
         HEAP[$o+3] = ($184>>24)&0xff; HEAP[$o+2] = ($184>>16)&0xff; HEAP[$o+1] = ($184>>8)&0xff; HEAP[$o] = ($184)&0xff;
        var $185=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $186=(($185+1)&4294967295);
        var $187=(HEAP[$186]);
        var $188=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $189=(($188)&4294967295);
         HEAP[$189] = ($187)&0xff;
        var $190=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $191=(($190+2)&4294967295);
        var $192=$191;
        var $193=(HEAP[$192+3]<<24)|(HEAP[$192+2]<<16)|(HEAP[$192+1]<<8)|(HEAP[$192]);
        var $194=__OSSwapInt32($193);
        var $195=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $196=(($195+4)&4294967295);
         HEAP[$196+3] = ($194>>24)&0xff; HEAP[$196+2] = ($194>>16)&0xff; HEAP[$196+1] = ($194>>8)&0xff; HEAP[$196] = ($194)&0xff;
        var $197=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $198=(($197+6)&4294967295);
        var $199=$198;
        var $200=(HEAP[$199+1]<<8)|(HEAP[$199]);
        var $201=unSign(($200), 16, 0);
        var $202=((($201)) & 65535);
        var $203=__OSSwapInt16($202);
        var $204=unSign(($203), 16, 0);
        var $205=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $206=(($205+8)&4294967295);
         HEAP[$206+3] = ($204>>24)&0xff; HEAP[$206+2] = ($204>>16)&0xff; HEAP[$206+1] = ($204>>8)&0xff; HEAP[$206] = ($204)&0xff;
        var $207=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $208=(($207+8)&4294967295);
        var $209=$208;
        var $210=(HEAP[$209+1]<<8)|(HEAP[$209]);
        var $211=unSign(($210), 16, 0);
        var $212=((($211)) & 65535);
        var $213=__OSSwapInt16($212);
        var $214=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $215=(($214+12)&4294967295);
         HEAP[$215+1] = ($213>>8)&0xff; HEAP[$215] = ($213)&0xff;
        var $216=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $217=(($216+10)&4294967295);
        var $218=$217;
        var $219=(HEAP[$218+1]<<8)|(HEAP[$218]);
        var $220=unSign(($219), 16, 0);
        var $221=((($220)) & 65535);
        var $222=__OSSwapInt16($221);
        var $223=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $224=(($223+14)&4294967295);
         HEAP[$224+1] = ($222>>8)&0xff; HEAP[$224] = ($222)&0xff;
        var $225=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $226=(($225+12)&4294967295);
        var $227=$226;
        var $228=(HEAP[$227+1]<<8)|(HEAP[$227]);
        var $229=unSign(($228), 16, 0);
        var $230=((($229)) & 65535);
        var $231=__OSSwapInt16($230);
        var $232=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $233=(($232+16)&4294967295);
         HEAP[$233+1] = ($231>>8)&0xff; HEAP[$233] = ($231)&0xff;
        var $234=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $235=(($234+14)&4294967295);
        var $236=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $237=(($236+20)&4294967295);
         HEAP[$237+3] = ($235>>24)&0xff; HEAP[$237+2] = ($235>>16)&0xff; HEAP[$237+1] = ($235>>8)&0xff; HEAP[$237] = ($235)&0xff;
        var $238=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $239=(($238)&4294967295);
        var $240=(HEAP[$239]);
        var $241=reSign(($240), 8, 0)==3;
        if ($241) { __label__ = 16; break; } else { __label__ = 17; break; }
      case 16: // $bb20
        var $242=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $243=(($242+8)&4294967295);
        var $244=(HEAP[$243+3]<<24)|(HEAP[$243+2]<<16)|(HEAP[$243+1]<<8)|(HEAP[$243]);
        var $245=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $246=(($245+12)&4294967295);
        var $247=(HEAP[$246+1]<<8)|(HEAP[$246]);
        var $248=unSign(($247), 16, 0);
        var $249=($248) << 16;
        var $250=($244) | ($249);
        var $251=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $252=(($251+8)&4294967295);
         HEAP[$252+3] = ($250>>24)&0xff; HEAP[$252+2] = ($250>>16)&0xff; HEAP[$252+1] = ($250>>8)&0xff; HEAP[$252] = ($250)&0xff;
        __label__ = 17; break;
      case 17: // $bb21
        var $253=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $254=(($253+20)&4294967295);
        var $255=(($254+36)&4294967295);
        var $256=(HEAP[$255+3]<<24)|(HEAP[$255+2]<<16)|(HEAP[$255+1]<<8)|(HEAP[$255]);
        var $257=((($256))|0)==-1;
        if ($257) { __label__ = 18; break; } else { __label__ = 21; break; }
      case 18: // $bb22
        var $258=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $259=(($258)&4294967295);
        var $260=(HEAP[$259]);
        var $261=reSign(($260), 8, 0)==0;
        if ($261) { __label__ = 19; break; } else { __label__ = 21; break; }
      case 19: // $bb23
        var $262=(HEAP[$ie19+3]<<24)|(HEAP[$ie19+2]<<16)|(HEAP[$ie19+1]<<8)|(HEAP[$ie19]);
        var $263=(($262+20)&4294967295);
        var $264=(HEAP[$263+3]<<24)|(HEAP[$263+2]<<16)|(HEAP[$263+1]<<8)|(HEAP[$263]);
        var $265=_strcmp(((__str225)&4294967295), $264);
        var $266=((($265))|0)==0;
        if ($266) { __label__ = 20; break; } else { __label__ = 21; break; }
      case 20: // $bb24
        var $267=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $268=unSign(($267), 16, 0);
        var $269=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $270=(($269+20)&4294967295);
        var $271=(($270+36)&4294967295);
         HEAP[$271+3] = ($268>>24)&0xff; HEAP[$271+2] = ($268>>16)&0xff; HEAP[$271+1] = ($268>>8)&0xff; HEAP[$271] = ($268)&0xff;
        __label__ = 21; break;
      case 21: // $bb25
        var $272=(HEAP[$o+3]<<24)|(HEAP[$o+2]<<16)|(HEAP[$o+1]<<8)|(HEAP[$o]);
        var $273=(($272)&4294967295);
        var $274=(HEAP[$273]);
        var $275=unSign(($274), 8, 0);
        var $276=(HEAP[$entry_offset+3]<<24)|(HEAP[$entry_offset+2]<<16)|(HEAP[$entry_offset+1]<<8)|(HEAP[$entry_offset]);
        var $277=((($275) + ($276))&4294967295);
         HEAP[$entry_offset+3] = ($277>>24)&0xff; HEAP[$entry_offset+2] = ($277>>16)&0xff; HEAP[$entry_offset+1] = ($277>>8)&0xff; HEAP[$entry_offset] = ($277)&0xff;
        var $278=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $279=((($278) + 1)&65535);
         HEAP[$index+1] = ($279>>8)&0xff; HEAP[$index] = ($279)&0xff;
        __label__ = 22; break;
      case 22: // $bb26
        var $280=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
        var $281=(($280+4)&4294967295);
        var $282=(($281+8)&4294967295);
        var $283=(HEAP[$282+1]<<8)|(HEAP[$282]);
        var $284=(HEAP[$index+1]<<8)|(HEAP[$index]);
        var $285=unSign(($283), 16, 0) > unSign(($284), 16, 0);
        if ($285) { __label__ = 15; break; } else { __label__ = 23; break; }
      case 23: // $bb27
        var $286=(HEAP[$hyp+3]<<24)|(HEAP[$hyp+2]<<16)|(HEAP[$hyp+1]<<8)|(HEAP[$hyp]);
         HEAP[$0+3] = ($286>>24)&0xff; HEAP[$0+2] = ($286>>16)&0xff; HEAP[$0+1] = ($286>>8)&0xff; HEAP[$0] = ($286)&0xff;
        __label__ = 24; break;
      case 24: // $bb28
        var $287=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($287>>24)&0xff; HEAP[$retval+2] = ($287>>16)&0xff; HEAP[$retval+1] = ($287>>8)&0xff; HEAP[$retval] = ($287)&0xff;
        __label__ = 25; break;
      case 25: // $return
        var $retval29=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval29;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function __OSSwapInt32($_data) {
    var __stackBase__  = STACKTOP; STACKTOP += 12; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 12);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $_data_addr=__stackBase__;
        var $retval=__stackBase__+4;
        var $0=__stackBase__+8;
        var $_alloca_point_=0;
         HEAP[$_data_addr+3] = ($_data>>24)&0xff; HEAP[$_data_addr+2] = ($_data>>16)&0xff; HEAP[$_data_addr+1] = ($_data>>8)&0xff; HEAP[$_data_addr] = ($_data)&0xff;
        var $1=(HEAP[$_data_addr+3]<<24)|(HEAP[$_data_addr+2]<<16)|(HEAP[$_data_addr+1]<<8)|(HEAP[$_data_addr]);
        var $2=_llvm_bswap_i32($1);
         HEAP[$0+3] = ($2>>24)&0xff; HEAP[$0+2] = ($2>>16)&0xff; HEAP[$0+1] = ($2>>8)&0xff; HEAP[$0] = ($2)&0xff;
        var $3=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($3>>24)&0xff; HEAP[$retval+2] = ($3>>16)&0xff; HEAP[$retval+1] = ($3>>8)&0xff; HEAP[$retval] = ($3)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        STACKTOP = __stackBase__;
        return $retval1;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function __OSSwapInt16($_data) {
    var __stackBase__  = STACKTOP; STACKTOP += 10; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 10);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $_data_addr=__stackBase__;
        var $retval=__stackBase__+2;
        var $0=__stackBase__+6;
        var $_alloca_point_=0;
         HEAP[$_data_addr+1] = ($_data>>8)&0xff; HEAP[$_data_addr] = ($_data)&0xff;
        var $1=(HEAP[$_data_addr+1]<<8)|(HEAP[$_data_addr]);
        var $2=unSign(($1), 16, 0);
        var $3=($2) << 8;
        var $4=((($3)) & 65535);
        var $5=(HEAP[$_data_addr+1]<<8)|(HEAP[$_data_addr]);
        var $6=unSign(($5), 16, 0) >>> 8;
        var $7=($4) | ($6);
        var $8=unSign(($7), 16, 0);
         HEAP[$0+3] = ($8>>24)&0xff; HEAP[$0+2] = ($8>>16)&0xff; HEAP[$0+1] = ($8>>8)&0xff; HEAP[$0] = ($8)&0xff;
        var $9=(HEAP[$0+3]<<24)|(HEAP[$0+2]<<16)|(HEAP[$0+1]<<8)|(HEAP[$0]);
         HEAP[$retval+3] = ($9>>24)&0xff; HEAP[$retval+2] = ($9>>16)&0xff; HEAP[$retval+1] = ($9>>8)&0xff; HEAP[$retval] = ($9)&0xff;
        __label__ = 1; break;
      case 1: // $return
        var $retval1=(HEAP[$retval+3]<<24)|(HEAP[$retval+2]<<16)|(HEAP[$retval+1]<<8)|(HEAP[$retval]);
        var $retval12=((($retval1)) & 65535);
        STACKTOP = __stackBase__;
        return $retval12;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_free_preamble($hyp) {
    var __stackBase__  = STACKTOP; STACKTOP += 4; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 4);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
        var $0=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $1=(($0+20)&4294967295);
        var $2=(($1+8)&4294967295);
        var $3=(HEAP[$2+3]<<24)|(HEAP[$2+2]<<16)|(HEAP[$2+1]<<8)|(HEAP[$2]);
        _free($3);
        var $4=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $5=(($4+20)&4294967295);
        var $6=(($5+4)&4294967295);
        var $7=(HEAP[$6+3]<<24)|(HEAP[$6+2]<<16)|(HEAP[$6+1]<<8)|(HEAP[$6]);
        _free($7);
        var $8=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $9=(($8+20)&4294967295);
        var $10=(($9+24)&4294967295);
        var $11=(HEAP[$10+3]<<24)|(HEAP[$10+2]<<16)|(HEAP[$10+1]<<8)|(HEAP[$10]);
        _free($11);
        var $12=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $13=(($12+20)&4294967295);
        var $14=(($13+20)&4294967295);
        var $15=(HEAP[$14+3]<<24)|(HEAP[$14+2]<<16)|(HEAP[$14+1]<<8)|(HEAP[$14]);
        _free($15);
        var $16=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $17=(($16+20)&4294967295);
        var $18=(($17+12)&4294967295);
        var $19=(HEAP[$18+3]<<24)|(HEAP[$18+2]<<16)|(HEAP[$18+1]<<8)|(HEAP[$18]);
        _free($19);
        var $20=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $21=(($20+20)&4294967295);
        var $22=(($21)&4294967295);
        var $23=(HEAP[$22+3]<<24)|(HEAP[$22+2]<<16)|(HEAP[$22+1]<<8)|(HEAP[$22]);
        _free($23);
        var $24=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $25=(($24+20)&4294967295);
        var $26=(($25+16)&4294967295);
        var $27=(HEAP[$26+3]<<24)|(HEAP[$26+2]<<16)|(HEAP[$26+1]<<8)|(HEAP[$26]);
        _free($27);
        var $28=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $29=(($28+20)&4294967295);
        var $30=(($29+28)&4294967295);
        var $31=(HEAP[$30+3]<<24)|(HEAP[$30+2]<<16)|(HEAP[$30+1]<<8)|(HEAP[$30]);
        _free($31);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  
  function _hyp_free($hyp) {
    var __stackBase__  = STACKTOP; STACKTOP += 4; assert(STACKTOP < STACK_MAX); _memset(__stackBase__, 0, 4);
    var __label__;
    __label__ = -1; 
    while(1) switch(__label__) {
      case -1: // $entry
        var $hyp_addr=__stackBase__;
        var $_alloca_point_=0;
         HEAP[$hyp_addr+3] = ($hyp>>24)&0xff; HEAP[$hyp_addr+2] = ($hyp>>16)&0xff; HEAP[$hyp_addr+1] = ($hyp>>8)&0xff; HEAP[$hyp_addr] = ($hyp)&0xff;
        var $0=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        _hyp_free_preamble($0);
        var $1=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $2=(($1+16)&4294967295);
        var $3=(HEAP[$2+3]<<24)|(HEAP[$2+2]<<16)|(HEAP[$2+1]<<8)|(HEAP[$2]);
        var $4=$3;
        _free($4);
        var $5=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $6=(($5)&4294967295);
        var $7=(HEAP[$6+3]<<24)|(HEAP[$6+2]<<16)|(HEAP[$6+1]<<8)|(HEAP[$6]);
        _free($7);
        var $8=(HEAP[$hyp_addr+3]<<24)|(HEAP[$hyp_addr+2]<<16)|(HEAP[$hyp_addr+1]<<8)|(HEAP[$hyp_addr]);
        var $9=$8;
        _free($9);
        __label__ = 1; break;
      case 1: // $return
        STACKTOP = __stackBase__;
        return;
      default: assert(0, "bad label: " + __label__);
    }
  }
  var FUNCTION_TABLE = [0,0];
// === Auto-generated postamble setup entry stuff ===

Module.callMain = function callMain(args) {
  var argc = args.length+1;
  var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_STATIC) ];
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_STATIC));
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_STATIC);

  return _main(argc, argv, 0);
}


global.run = function run(args) {
  args = args || Module['arguments'];

__str=allocate([119,98,0] /* wb\00 */, "i8", ALLOC_STATIC);__str1=allocate([37,115,0] /* %s\00 */, "i8", ALLOC_STATIC);__str2=allocate([38,108,116,59,0] /* &lt;\00 */, "i8", ALLOC_STATIC);__str3=allocate([38,103,116,59,0] /* &gt;\00 */, "i8", ALLOC_STATIC);__str4=allocate([38,97,109,112,59,0] /* &amp;\00 */, "i8", ALLOC_STATIC);__str5=allocate([38,97,112,111,115,59,0] /* &apos;\00 */, "i8", ALLOC_STATIC);__str6=allocate([38,113,117,111,116,59,0] /* &quot;\00 */, "i8", ALLOC_STATIC);__str7=allocate([60,62,38,39,34,0] /* <>&'\22\00 */, "i8", ALLOC_STATIC);__str8=allocate([60,33,45,45,116,105,116,108,101,32,34,0] /* <!--title \22\00 */, "i8", ALLOC_STATIC);__str9=allocate([34,45,45,62,0] /* \22-->\00 */, "i8", ALLOC_STATIC);__str10=allocate([60,33,45,45,114,101,102,115,32,34,112,114,101,118,61,37,100,38,110,101,120,116,61,37,100,38,116,111,99,61,37,100,38,105,100,120,61,37,100,34,45,45,62,10,0] /* <!--refs \22prev=%d& */, "i8", ALLOC_STATIC);__str11=allocate([60,33,45,45,99,111,110,116,101,110,116,45,45,62,0] /* <!--content-->\00 */, "i8", ALLOC_STATIC);__str12=allocate([60,33,45,45,97,32,104,114,101,102,61,34,101,120,116,101,114,110,61,37,115,34,45,45,62,0] /* <!--a href=\22extern */, "i8", ALLOC_STATIC);__str13=allocate([60,33,45,45,97,32,104,114,101,102,61,34,105,110,100,101,120,61,37,100,38,108,105,110,101,61,37,100,34,45,45,62,0] /* <!--a href=\22index= */, "i8", ALLOC_STATIC);__str14=allocate([60,33,45,45,47,97,45,45,62,0] /* <!--/a-->\00 */, "i8", ALLOC_STATIC);__str15=allocate([60,33,45,45,101,102,32,48,120,37,48,50,120,45,45,62,0] /* <!--ef 0x%02x-->\00 */, "i8", ALLOC_STATIC);__str16=allocate([60,33,45,45,108,105,110,101,32,34,120,111,102,102,115,101,116,61,37,100,38,121,111,102,102,115,101,116,61,37,100,38,120,108,101,110,103,116,104,61,37,100,38,121,108,101,110,103,116,104,61,37,100,38,97,116,116,114,105,98,115,61,37,100,38,115,116,121,108,101,61,37,100,34,45,45,62,10,0] /* <!--line \22xoffset= */, "i8", ALLOC_STATIC);__str17=allocate([60,33,45,45,98,111,120,32,34,114,98,111,120,61,37,100,38,120,111,102,102,115,101,116,61,37,100,38,121,111,102,102,115,101,116,61,37,100,38,119,105,100,116,104,61,37,100,38,104,101,105,103,104,116,61,37,100,38,112,97,116,116,101,114,110,61,37,100,34,45,45,62,10,0] /* <!--box \22rbox=%d&x */, "i8", ALLOC_STATIC);__str18=allocate([108,0] /* l\00 */, "i8", ALLOC_STATIC);__str19=allocate(1, "i8", ALLOC_STATIC);__str20=allocate([60,33,45,45,105,109,103,32,34,105,110,100,101,120,61,37,100,38,120,111,102,102,115,101,116,61,37,100,38,121,111,102,102,115,101,116,61,37,100,38,116,121,112,101,61,37,115,105,109,97,103,101,38,119,105,100,116,104,61,37,100,38,104,101,105,103,104,116,61,37,100,34,45,45,62,10,0] /* <!--img \22index=%d& */, "i8", ALLOC_STATIC);__str21=allocate([60,33,45,45,47,99,111,110,116,101,110,116,45,45,62,0] /* <!--/content-->\00 */, "i8", ALLOC_STATIC);__str22=allocate([110,111,100,101,58,0] /* node:\00 */, "i8", ALLOC_STATIC);_len=allocate(1, "i16", ALLOC_STATIC);_depth=allocate(1, "i16", ALLOC_STATIC);_blen=allocate(1, "i8*", ALLOC_STATIC);_c=allocate(1, "i16", ALLOC_STATIC);_codeword=allocate(1, "i16", ALLOC_STATIC);_bit=allocate(1, "i16", ALLOC_STATIC);_tblsiz=allocate(1, "i16", ALLOC_STATIC);_tbl=allocate(1, "i16*", ALLOC_STATIC);_n=allocate(1, "i16", ALLOC_STATIC);_maxdepth=allocate(1, "i16", ALLOC_STATIC);_avail=allocate(1, "i16", ALLOC_STATIC);_left=allocate(2038, "i16", ALLOC_STATIC);_right=allocate(2038, "i16", ALLOC_STATIC);_crctable=allocate(512, "i16", ALLOC_STATIC);_reading_size=allocate(1, "i32", ALLOC_STATIC);_crc=allocate(1, "i16", ALLOC_STATIC);_bitcount=allocate(1, "i8", ALLOC_STATIC);_bitbuf=allocate(1, "i16", ALLOC_STATIC);_subbitbuf=allocate(1, "i8", ALLOC_STATIC);_compsize=allocate(1, "i32", ALLOC_STATIC);_infileptr=allocate(1, "i8*", ALLOC_STATIC);_getc_euc_cache=allocate(1, "i32", ALLOC_STATIC);_pt_len=allocate(128, "i8", ALLOC_STATIC);_pt_table=allocate(512, "i16", ALLOC_STATIC);_c_len=allocate(510, "i8", ALLOC_STATIC);_c_table=allocate(8192, "i16", ALLOC_STATIC);_blocksize=allocate(1, "i16", ALLOC_STATIC);_outfileptr=allocate(1, "i8*", ALLOC_STATIC);_dicbit=allocate(1, "i16", ALLOC_STATIC);_origsize=allocate(1, "i32", ALLOC_STATIC);_prev_char=allocate(1, "i32", ALLOC_STATIC);_dicsiz=allocate(1, "i16", ALLOC_STATIC);_text=allocate(1, "i8*", ALLOC_STATIC);_count=allocate(1, "i32", ALLOC_STATIC);_loc=allocate(1, "i16", ALLOC_STATIC);_c_freq=allocate(2038, "i16", ALLOC_STATIC);_c_code=allocate(1020, "i16", ALLOC_STATIC);_p_freq=allocate(54, "i16", ALLOC_STATIC);_pt_code=allocate(256, "i16", ALLOC_STATIC);_t_freq=allocate(74, "i16", ALLOC_STATIC);_unpackable=allocate(1, "i32", ALLOC_STATIC);_maxmatch=allocate(1, "i16", ALLOC_STATIC);__str23=allocate([114,98,0] /* rb\00 */, "i8", ALLOC_STATIC);__str124=allocate(1, "i8", ALLOC_STATIC);__str225=allocate([73,110,100,101,120,0] /* Index\00 */, "i8", ALLOC_STATIC);FS.init();

  __globalConstructor__();

  var ret = null;
  if (Module['_main']) {
    ret = Module.callMain(args);
    __shutdownRuntime__();
  }
  return ret;
}
Module['run'] = run;

// {{PRE_RUN_ADDITIONS}}

Module['noInitialRun'] = true;

if (!Module['noInitialRun']) {
  run();
}

// {{POST_RUN_ADDITIONS}}




  // {{MODULE_ADDITIONS}}

/*
  return Module;
}).call(this, {}, arguments); // Replace parameters as needed
*/

