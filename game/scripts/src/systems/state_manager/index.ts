/**
 * index.ts
 * 状态管理器模块入口
 * 
 * 导出所有状态相关类和创建全局管理器实例
 */

// 核心
export { StateManager, BaseState, IGameState, registrationStatus } from './state_manager';

// 状态类（必须导入以触发装饰器注册）
import './LoadingState';
import './PlayingState';
import './VictoryState';
import './DefeatState';

// 导出便捷创建函数
import { StateManager } from './state_manager';

let gameStateManager: StateManager | null = null;

/**
 * 获取游戏状态管理器实例（单例）
 */
export function GetGameStateManager(): StateManager {
    if (!gameStateManager) {
        gameStateManager = new StateManager('LoadingState');
    }
    return gameStateManager;
}

/**
 * 初始化游戏状态管理器
 * @param initialState 初始状态名称，默认 'LoadingState'
 */
export function InitGameStateManager(initialState: string = 'LoadingState'): StateManager {
    if (gameStateManager) {
        gameStateManager.remove();
    }
    gameStateManager = new StateManager(initialState);
    return gameStateManager;
}
