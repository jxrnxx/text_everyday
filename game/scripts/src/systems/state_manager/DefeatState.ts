/**
 * DefeatState.ts
 * 游戏失败状态 - 基地被摧毁
 */

import { reloadable } from '../../utils/tstl-utils';
import { registrationStatus, BaseState, StateManager } from './state_manager';

@registrationStatus
@reloadable
export class DefeatState extends BaseState {
    OnStart() {
        // 发送状态到客户端
        CustomNetTables.SetTableValue(
            'game_state' as never,
            'current' as never,
            {
                state: 'defeat',
                message: '基地被摧毁!',
            } as never
        );

        // 发送失败事件
        Event.send('游戏-失败');

        // 播放失败音效
        EmitGlobalSound('ui.trophy_base_destroy');

        // 显示失败 UI
        CustomGameEventManager.Send_ServerToAllClients('game_defeat' as never, {} as never);
    }

    Update() {
        // 失败状态不需要持续更新
    }

    OnEnd() { }
}
