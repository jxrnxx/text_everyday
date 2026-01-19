/**
 * LoadingState.ts
 * 游戏载入状态 - 等待玩家加载完成
 */

import { reloadable } from '../../utils/tstl-utils';
import { registrationStatus, BaseState, StateManager } from './state_manager';

@registrationStatus
@reloadable
export class LoadingState extends BaseState {
    private loadingComplete = false;

    OnStart() {
        print('[LoadingState] 游戏载入中...');

        // 发送状态到客户端
        CustomNetTables.SetTableValue(
            'game_state' as never,
            'current' as never,
            {
                state: 'loading',
                message: '等待玩家加载...',
            } as never
        );

        // 监听游戏开始事件
        // 可以在这里初始化游戏系统
    }

    Update() {
        // 检查所有玩家是否加载完成
        // 简化版：直接进入下一个状态
        if (!this.loadingComplete) {
            this.loadingComplete = true;
            // 3秒后自动进入选难度/选英雄
            Timers.CreateTimer(3, () => {
                this.ChangeState('PlayingState');
            });
        }
    }

    OnEnd() {
        print('[LoadingState] 载入完成');
    }
}
