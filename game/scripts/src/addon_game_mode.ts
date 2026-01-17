import 'utils/index';
import { ActivateModules } from './modules';
import { GameMode } from './GameMode';
import Precache from './utils/precache';

Object.assign(getfenv(), {
    Activate: () => {
        // ActivateModules(); // 禁用旧的界域/练功房逻辑
        GameMode.Activate();
    },
    Precache: Precache,
});

// 如果是脚本重载 (游戏已经开始)，显式调用 Activate 以触发重载逻辑
if (GameRules.State_Get() >= 2) {
    // 2 = DOTA_GAMERULES_STATE_CUSTOM_GAME_SETUP
    GameMode.Activate();
}
