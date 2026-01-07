"use strict";

(function() {
    // 1. 禁用默认UI冲突 (UI屏蔽)
    // 8 = Shop (F4), 17 = Courier (F3)
    GameUI.SetDefaultUIEnabled(8, false);   
    GameUI.SetDefaultUIEnabled(17, false);  

    // 2. 获取本地玩家ID
    var localPlayerId = Game.GetLocalPlayerID();

    // 3. 构建带参数的命令字符串
    var cmdEnter = "cmd_train_enter " + localPlayerId;
    var cmdExit = "cmd_train_exit " + localPlayerId;

    // 4. 绑定按键
    Game.CreateCustomKeyBind("F3", cmdEnter);
    Game.CreateCustomKeyBind("F4", cmdExit);
})();
