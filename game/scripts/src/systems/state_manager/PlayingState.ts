/**
 * PlayingState.ts
 * 游戏进行中状态 - 防守阶段
 */

import { reloadable } from '../../utils/tstl-utils';
import { registrationStatus, BaseState, StateManager } from './state_manager';

@registrationStatus
@reloadable
export class PlayingState extends BaseState {
    private time: number = 0;       // 当前时间
    private maxTime: number = 0;    // 最大时间

    Init() {
        // 监听基地被摧毁事件
        const defeatListener = Event.on('游戏-基地被摧毁', () => {
            this.ChangeState('DefeatState');
            return true;  // 移除监听器
        });

        // 监听Boss被击败事件
        const victoryListener = Event.on('游戏-Boss被击败', () => {
            this.ChangeState('VictoryState');
            return true;  // 移除监听器
        });

        return () => {
            Event.unregisterByID(defeatListener);
            Event.unregisterByID(victoryListener);
        };
    }

    OnStart() {
        print('[PlayingState] 开始防守!');

        // 发送状态到客户端
        CustomNetTables.SetTableValue('game_state' as never, 'current' as never, {
            state: 'playing',
            message: '防守进行中'
        } as never);

        // 发送游戏开始事件
        Event.send('游戏-开始');
    }

    Update() {
        this.time++;

        // 每秒更新游戏状态到客户端
        CustomNetTables.SetTableValue('game_state' as never, 'time' as never, {
            current: this.time,
            max: this.maxTime
        } as never);

        // 发送心跳事件供其他系统使用
        Event.send('游戏-回合心跳');
    }

    SetTime(time: number) {
        this.time = time;
    }

    GetTime(): number {
        return this.time;
    }

    OnEnd() {
        print('[PlayingState] 防守阶段结束');
    }
}
