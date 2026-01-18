// 引入所有的lua模块
require('aeslua');
require('decrypt');
require('json');
require('md5');
require('popups');
if (IsServer()) {
    require('timers');
    require('event');      // 移植的事件系统
    require('pool');       // 移植的权重池系统
    require('tween_lib');  // 移植的补间动画系统
}

// rename SHA and make it global
globalThis.SHA = require('sha');
globalThis.LibDeflate = require('libs/deflate');
globalThis.base64 = require('libs/base64');
