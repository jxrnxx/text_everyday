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
