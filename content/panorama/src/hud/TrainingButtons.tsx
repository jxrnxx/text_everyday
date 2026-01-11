import React, { useEffect } from 'react';

/**
 * TrainingButtons - 练功/回城 快捷键处理
 * F5: 进入练功房  
 * F6: 返回基地
 * 注意: 不显示UI按钮，只处理快捷键
 * 
 * F3/F4 被 Dota 默认占用（信使/巡逻），无法覆盖
 * 所以改用 F5/F6
 */
const TrainingButtons = () => {
    useEffect(() => {
        // 注册 F5 快捷键 (进入练功房)
        $.RegisterKeyBind($.GetContextPanel(), 'key_f5', () => {
            const playerId = Players.GetLocalPlayer();
            GameEvents.SendCustomGameEventToServer('cmd_c2s_train_enter', { PlayerID: playerId });
        });

        // 注册 F6 快捷键 (返回基地)
        $.RegisterKeyBind($.GetContextPanel(), 'key_f6', () => {
            const playerId = Players.GetLocalPlayer();
            GameEvents.SendCustomGameEventToServer('cmd_c2s_train_exit', { PlayerID: playerId });
        });
    }, []);

    // 不显示按钮UI，只处理快捷键
    return null;
};

export default TrainingButtons;
