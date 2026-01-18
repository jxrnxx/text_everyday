/**
 * VictoryState.ts
 * 游戏胜利状态 - 击败最终Boss
 */

import { reloadable } from '../../utils/tstl-utils';
import { registrationStatus, BaseState, StateManager } from './state_manager';

@registrationStatus
@reloadable
export class VictoryState extends BaseState {
    OnStart() {
        print('[VictoryState] 🎉 游戏胜利!');

        // 发送状态到客户端
        CustomNetTables.SetTableValue('game_state' as never, 'current' as never, {
            state: 'victory',
            message: '恭喜通关!'
        } as never);

        // 发送胜利事件
        Event.send('游戏-胜利');

        // 播放胜利音效
        EmitGlobalSound('ui.npe_objective_complete');

        // 显示胜利 UI
        CustomGameEventManager.Send_ServerToAllClients('game_victory' as never, {} as never);
    }

    Update() {
        // 胜利状态不需要持续更新
    }

    OnEnd() {
        print('[VictoryState] 结束');
    }
}
