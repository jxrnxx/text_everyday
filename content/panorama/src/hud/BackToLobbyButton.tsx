/**
 * BackToLobbyButton.tsx
 * 左上角返回大厅按钮 + 结束游戏按钮
 */

import React, { useState } from 'react';

const BackToLobbyButton: React.FC = () => {
    const [showEndConfirm, setShowEndConfirm] = useState(false);

    const handleBackClick = () => {
        Game.EmitSound('ui_click');
        // 打开 Dota 2 大厅
        try { $.DispatchEvent('DOTAShowDashboard'); } catch (e) {}
        try { $.DispatchEvent('DOTAHUDShowDashboard'); } catch (e) {}
        try { $.DispatchEvent('ShowDashboard'); } catch (e) {}
        try { Game.ServerCmd('dota_show_dashboard'); } catch (e) {}
    };

    const handleEndGameClick = () => {
        Game.EmitSound('ui_click');
        setShowEndConfirm(true);
    };

    const handleConfirmEndGame = () => {
        Game.EmitSound('ui_click');
        // 发送结束游戏命令到服务端
        GameEvents.SendCustomGameEventToServer('cmd_end_game', {});
        setShowEndConfirm(false);
    };

    const handleCancelEndGame = () => {
        Game.EmitSound('ui_click');
        setShowEndConfirm(false);
    };

    return (
        <Panel style={styles.container}>
            {/* 返回大厅按钮 */}
            <Panel style={styles.button} onactivate={handleBackClick}>
                <Label text="返回" style={styles.btnLabel} />
            </Panel>
            
            {/* 结束游戏按钮 */}
            <Panel style={styles.endButton} onactivate={handleEndGameClick}>
                <Label text="结束" style={styles.endLabel} />
            </Panel>

            {/* 确认对话框 */}
            {showEndConfirm && (
                <Panel style={styles.confirmOverlay} hittest={true}>
                    <Panel style={styles.confirmDialog}>
                        <Label text="确定要结束游戏吗？" style={styles.confirmText} />
                        <Panel style={styles.confirmButtons}>
                            <Panel style={styles.confirmBtn} onactivate={handleConfirmEndGame}>
                                <Label text="确定" style={styles.confirmBtnText} />
                            </Panel>
                            <Panel style={styles.cancelBtn} onactivate={handleCancelEndGame}>
                                <Label text="取消" style={styles.cancelBtnText} />
                            </Panel>
                        </Panel>
                    </Panel>
                </Panel>
            )}
        </Panel>
    );
};

const styles = {
    container: {
        position: '12px 12px 0px' as const,
        flowChildren: 'right' as const,
    },
    button: {
        width: '50px',
        height: '32px',
        backgroundColor: 'rgba(40, 40, 50, 0.95)',
        border: '2px solid #b4a078',
        borderRadius: '6px',
        marginRight: '8px',
    },
    btnLabel: {
        color: '#d4c4a8',
        fontSize: '14px',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    },
    endButton: {
        width: '50px',
        height: '32px',
        backgroundColor: 'rgba(100, 40, 40, 0.95)',
        border: '2px solid #c47070',
        borderRadius: '6px',
    },
    endLabel: {
        color: '#ffcccc',
        fontSize: '14px',
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    },
    // 确认对话框样式
    confirmOverlay: {
        position: '0px 0px 0px' as const,
        width: '1920px',
        height: '1080px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    confirmDialog: {
        position: '700px 400px 0px' as const,
        backgroundColor: 'rgba(30, 30, 40, 0.98)',
        border: '2px solid #b4a078',
        borderRadius: '12px',
        padding: '24px 32px',
        flowChildren: 'down' as const,
    },
    confirmText: {
        color: '#d4c4a8',
        fontSize: '18px',
        marginBottom: '20px',
        horizontalAlign: 'center' as const,
    },
    confirmButtons: {
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
    },
    confirmBtn: {
        backgroundColor: '#884422',
        border: '2px solid #ffaa66',
        borderRadius: '6px',
        padding: '8px 24px',
        marginRight: '16px',
    },
    confirmBtnText: {
        color: '#ffffff',
        fontSize: '14px',
    },
    cancelBtn: {
        backgroundColor: 'rgba(60, 60, 70, 0.9)',
        border: '2px solid #888888',
        borderRadius: '6px',
        padding: '8px 24px',
    },
    cancelBtnText: {
        color: '#cccccc',
        fontSize: '14px',
    },
};

export default BackToLobbyButton;
