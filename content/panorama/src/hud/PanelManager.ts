/**
 * PanelManager.ts
 * 全局面板管理器 - 处理面板互斥显示和右键关闭
 */

type PanelId = 'character_sheet' | 'merchant_panel' | 'none';

interface PanelManagerState {
    currentPanel: PanelId;
    closeCallbacks: Map<PanelId, () => void>;
}

const state: PanelManagerState = {
    currentPanel: 'none',
    closeCallbacks: new Map(),
};

/**
 * 注册一个面板的关闭回调
 */
export function registerPanel(panelId: PanelId, closeCallback: () => void) {
    state.closeCallbacks.set(panelId, closeCallback);
}

/**
 * 打开面板 - 会自动关闭其他已打开的面板
 */
export function openPanel(panelId: PanelId) {
    // 如果有其他面板打开，先关闭它
    if (state.currentPanel !== 'none' && state.currentPanel !== panelId) {
        closePanel(state.currentPanel);
    }
    
    state.currentPanel = panelId;
    $.Msg(`[PanelManager] Opened: ${panelId}`);
}

/**
 * 关闭指定面板
 */
export function closePanel(panelId: PanelId) {
    const callback = state.closeCallbacks.get(panelId);
    if (callback) {
        callback();
    }
    
    if (state.currentPanel === panelId) {
        state.currentPanel = 'none';
    }
    $.Msg(`[PanelManager] Closed: ${panelId}`);
}

/**
 * 关闭当前打开的面板
 */
export function closeCurrentPanel() {
    if (state.currentPanel !== 'none') {
        closePanel(state.currentPanel);
    }
}

/**
 * 获取当前打开的面板
 */
export function getCurrentPanel(): PanelId {
    return state.currentPanel;
}

/**
 * 检查是否有面板打开
 */
export function isAnyPanelOpen(): boolean {
    return state.currentPanel !== 'none';
}

/**
 * 标记面板已关闭（由面板自身调用，不触发回调）
 */
export function markPanelClosed(panelId: PanelId) {
    if (state.currentPanel === panelId) {
        state.currentPanel = 'none';
    }
}
