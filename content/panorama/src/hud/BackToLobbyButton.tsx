/**
 * BackToLobbyButton.tsx
 * 左上角返回大厅按钮 - 简洁美观版
 */

import React from 'react';

const BackToLobbyButton: React.FC = () => {
    const handleClick = () => {
        Game.EmitSound('ui_click');
        // 打开 Dota 2 大厅
        try { $.DispatchEvent('DOTAShowDashboard'); } catch (e) {}
        try { $.DispatchEvent('DOTAHUDShowDashboard'); } catch (e) {}
        try { $.DispatchEvent('ShowDashboard'); } catch (e) {}
        try { Game.ServerCmd('dota_show_dashboard'); } catch (e) {}
    };

    return (
        <Panel style={styles.container}>
            <Button style={styles.button} onactivate={handleClick}>
                <Label text="◀" style={styles.arrow} />
            </Button>
        </Panel>
    );
};

const styles = {
    container: {
        position: '12px 12px 0px' as const,
    },
    button: {
        width: '44px',
        height: '44px',
        backgroundColor: 'rgba(40, 40, 50, 0.95)',
        border: '2px solid #b4a078',
        borderRadius: '10px',
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.4)',
    },
    arrow: {
        color: '#d4c4a8',
        fontSize: '20px',
        fontWeight: 'bold' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
    },
};

export default BackToLobbyButton;
