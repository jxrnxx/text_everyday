/**
 * state_manager.ts
 * 游戏状态管理器 - 从 zhanshen 项目移植
 * 
 * 管理游戏的不同阶段：载入 → 选难度 → 选英雄 → 防守 → 胜利/失败
 */

const HEARTBEAT_EVENT = '游戏-心跳';

// 状态接口
export interface IGameState {
    /** 设置状态时间 */
    SetTime?(time: number): void;
    /** 获取状态时间 */
    GetTime?(): number;
    /** 状态开始时调用 */
    OnStart(): void;
    /** 每次心跳调用 */
    Update(): void;
    /** 状态结束时调用 */
    OnEnd(): void;
    /** 清理资源 */
    remove(): void;
    /** 获取是否在战斗中 */
    GetCombat?(): boolean;
}

// 装饰器函数：注册状态类
export function registrationStatus(target: any) {
    StateManager.StateType[target.name] = target;
}

// 状态基类
export abstract class BaseState implements IGameState {
    readonly remove: () => void;
    readonly Manager: StateManager;

    constructor(Manager: StateManager) {
        this.Manager = Manager;
        this.remove = this.Init();
    }

    /** 初始化状态，返回清理函数 */
    Init(): () => void {
        return () => { };
    }

    abstract OnStart(): void;

    Update() { }

    abstract OnEnd(): void;

    /** 切换到另一个状态 */
    ChangeState(stateName: string) {
        this.Manager.ChangeState(stateName);
    }
}

// 状态管理器
export class StateManager {
    readonly remove: () => void;
    static StateType: Record<string, any> = {};

    private currentState: IGameState | null = null;
    private heartbeatRate = 0.1;  // 心跳频率（秒）
    private count = 0;            // 心跳计数
    private pause = false;        // 是否暂停
    stateName: string = '';       // 当前状态名

    constructor(initialState?: string) {
        this.remove = this.Init();
        if (initialState) {
            this.ChangeState(initialState);
        }
    }

    private Init(): () => void {
        // 监听心跳事件
        const eventId = Event.on(HEARTBEAT_EVENT, (frequency: number, count: number) => {
            this.Update(frequency, count);
        });

        // 创建心跳定时器
        const timerId = Timers.CreateTimer(this.heartbeatRate, () => {
            this.count++;
            Event.send(HEARTBEAT_EVENT, this.heartbeatRate, this.count);
            return this.heartbeatRate;
        });

        // 返回清理函数
        return () => {
            Event.unregisterByID(eventId);
            Timers.RemoveTimer(timerId);
            if (this.currentState) {
                this.currentState.OnEnd();
                if (typeof this.currentState.remove === 'function') {
                    this.currentState.remove();
                }
            }
        };
    }

    /** 心跳更新 */
    private Update(frequency: number, count: number) {
        if (this.pause) return;
        // 确保参数有效
        if (!frequency || !count) return;
        // 每秒调用一次 Update（根据心跳频率计算）
        const interval = Math.floor(1 / frequency);
        if (interval > 0 && count % interval === 0) {
            if (this.currentState) {
                this.currentState.Update();
            }
        }
    }

    /** 获取当前状态实例 */
    GetState(): IGameState | null {
        return this.currentState;
    }

    /** 获取当前状态名称 */
    GetStateName(): string {
        return this.stateName;
    }

    /** 设置当前状态时间 */
    SetStateTime(time: number) {
        if (this.currentState && typeof this.currentState.SetTime === 'function') {
            this.currentState.SetTime(time);
        }
    }

    /** 获取当前状态时间 */
    GetTime(): number {
        if (this.currentState && typeof this.currentState.GetTime === 'function') {
            return this.currentState.GetTime();
        }
        return 0;
    }

    /** 增加当前状态时间 */
    AddStateTime(time: number) {
        if (this.currentState && typeof this.currentState.SetTime === 'function') {
            const t = this.GetTime();
            this.currentState.SetTime(t + time);
        }
    }

    /** 是否暂停 */
    IsPause(): boolean {
        return this.pause;
    }

    /** 暂停心跳 */
    Pause() {
        this.pause = true;
    }

    /** 恢复心跳 */
    Resume() {
        this.pause = false;
    }

    /** 切换状态 */
    ChangeState(stateName: string) {
        // 结束当前状态
        if (this.currentState) {
            this.currentState.OnEnd();
            if (typeof this.currentState.remove === 'function') {
                this.currentState.remove();
            }
        }

        // 创建新状态
        const StateType = StateManager.StateType[stateName];
        if (StateType) {
            this.stateName = stateName;
            this.currentState = new StateType(this);
            this.currentState!.OnStart();
            print(`[StateManager] 切换到状态: ${stateName}`);
        } else {
            print(`[StateManager] 状态不存在: ${stateName}`);
        }
    }
}
