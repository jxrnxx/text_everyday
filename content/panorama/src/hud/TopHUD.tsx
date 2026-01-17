import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import { useNetTableKey } from 'react-panorama-x';

/**
 * 顶部HUD组件
 * 左：菜单按钮 | 中：游戏信息 | 右：货币资源
 */
const TopHUD: FC = () => {
    const waveState = useNetTableKey('wave_state', 'current');
    const economyData = useNetTableKey('economy', `player_${Players.GetLocalPlayer()}`);
    
    const [countdown, setCountdown] = useState(0);
    const [gameTime, setGameTime] = useState(0);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [showWarningFlash, setShowWarningFlash] = useState(false);
    
    const lastUpdateTime = useRef(Game.Time());
    const lastServerTime = useRef(0);
    const lastWave = useRef(0);
    
    const wave = (waveState as any)?.wave || 0;
    const state = (waveState as any)?.state || '';
    const nextWaveTime = (waveState as any)?.nextWaveTime || 0;
    const aliveCount = (waveState as any)?.aliveCount || 0;
    
    // 检测波次开始，触发3秒警告闪烁
    useEffect(() => {
        if (state === 'spawning' && wave !== lastWave.current) {
            lastWave.current = wave;
            setShowWarningFlash(true);
            $.Schedule(3.0, () => setShowWarningFlash(false));
        }
    }, [state, wave]);
    
    // 货币数据
    const spiritCoin = (economyData as any)?.spirit_coin ?? 0;
    const faith = (economyData as any)?.faith ?? 0;
    const defenderPoints = (economyData as any)?.defender_points ?? 0;
    
    // 波次倒计时
    useEffect(() => {
        if (nextWaveTime !== lastServerTime.current) {
            lastServerTime.current = nextWaveTime;
            lastUpdateTime.current = Game.Time();
            setCountdown(nextWaveTime);
        }
    }, [nextWaveTime]);
    
    useEffect(() => {
        $.Schedule(0.1, function tick() {
            const elapsed = Game.Time() - lastUpdateTime.current;
            const remaining = Math.max(0, lastServerTime.current - elapsed);
            setCountdown(remaining);
            if (remaining > 0) $.Schedule(0.1, tick);
        });
    }, [nextWaveTime]);
    
    // 游戏时长
    useEffect(() => {
        $.Schedule(1, function timeTick() {
            setGameTime(Math.floor(Game.GetGameTime()));
            $.Schedule(1, timeTick);
        });
    }, []);
    
    // ESC键监听 - 弹出结束确认框
    useEffect(() => {
        const panel = $.GetContextPanel();
        panel.SetPanelEvent('oncancel', () => {
            setShowEndConfirm(prev => !prev);
        });
    }, []);
    
    const formatTime = (seconds: number): string => {
        if (seconds <= 0) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const formatGameTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const isSpawning = state === 'spawning';
    const isUrgent = countdown <= 10 && countdown > 0;
    
    // 样式
    const jadeBg = 'gradient(linear, 0% 0%, 0% 100%, from(rgba(40, 90, 70, 0.95)), to(rgba(30, 70, 55, 0.95)))';
    const jadeBorder = '2px solid rgba(80, 180, 140, 0.6)';
    const textColor = '#a0e8d0';
    const valueColor = '#d0ffe8';
    const goldColor = '#e8c868';
    
    // 按钮事件
    const handleBack = () => {
        Game.EmitSound('ui_click');
        try { $.DispatchEvent('DOTAShowDashboard'); } catch (e) {}
        try { $.DispatchEvent('DOTAHUDShowDashboard'); } catch (e) {}
    };
    
    const handleSettings = () => {
        Game.EmitSound('ui_click');
        try { $.DispatchEvent('DOTAShowSettingsPopup'); } catch (e) {}
    };
    
    const handleEndGame = () => {
        Game.EmitSound('ui_click');
        setShowEndConfirm(true);
    };
    
    const confirmEndGame = () => {
        Game.EmitSound('ui_click');
        GameEvents.SendCustomGameEventToServer('cmd_end_game' as never, {} as never);
        setShowEndConfirm(false);
    };
    
    const cancelEndGame = () => {
        Game.EmitSound('ui_click');
        setShowEndConfirm(false);
    };

    return (
        <>
            {/* 左上角菜单：深色底图 + 图标 */}
            <Panel style={{ 
                flowChildren: 'right' as const, 
                position: '10px 5px 0px 0px',
            }}>
                {[
                    { icon: 'icon_back', label: '', hideLabel: true, action: handleBack },
                    { icon: 'icon_settings', label: '', hideLabel: true, action: handleSettings },
                    { icon: 'icon_save', label: '存档', action: () => Game.EmitSound('ui_click') },
                    { icon: 'icon_equip', label: '装备', action: () => Game.EmitSound('ui_click') },
                    { icon: 'icon_achieve', label: '成就', action: () => Game.EmitSound('ui_click') },
                    { icon: 'icon_trade', label: '交易', action: () => Game.EmitSound('ui_click') },
                    { icon: 'icon_rank', label: '排行', action: () => Game.EmitSound('ui_click') },
                    { icon: 'icon_shop', label: '商店', action: () => Game.EmitSound('ui_click') },
                ].map((btn, i) => (
                    <Panel 
                        key={`menu-${btn.icon}`}
                        style={{ 
                            flowChildren: 'down' as const,
                            horizontalAlign: 'center' as const,
                            marginRight: '10px',
                        }}
                        onactivate={btn.action}
                    >
                        {/* 玉牌按钮 */}
                        <Panel style={{
                            width: '55px',
                            height: '55px',
                        }}>
                            <Image 
                                src="file://{resources}/images/menu_button_dark.png"
                                style={{
                                    width: '55px',
                                    height: '55px',
                                    position: '0px 0px 0px 0px',
                                } as any}
                            />
                            <Image 
                                src={`file://{resources}/images/${btn.icon}.png`}
                                style={{
                                    width: '34px',
                                    height: '34px',
                                    position: '10px 10px 0px 0px',
                                } as any}
                            />
                        </Panel>
                        {/* 文字标签在下方 */}
                        {!btn.hideLabel && (
                            <Label 
                                text={btn.label} 
                                style={{ 
                                    color: '#c0b090', 
                                    fontSize: '18px',
                                    fontWeight: 'bold' as const,
                                    fontFamily: 'SimSun, 宋体, serif',
                                    marginTop: '2px',
                                    horizontalAlign: 'center' as const,
                                    textShadow: '0px 1px 3px #000000, 0px 1px 1px #000000',
                                } as any} 
                            />
                        )}
                    </Panel>
                ))}
            </Panel>

            {/* 入侵警告闪烁 - 只显示3秒 */}
            {showWarningFlash && (
                <Panel style={{
                    width: '100%',
                    height: '100%',
                    position: '0px 0px 0px 0px',
                    boxShadow: 'inset 0px 0px 200px rgba(255, 0, 0, 0.25)',
                    opacity: '0.8',
                } as any} hittest={false} />
            )}

            {/* ========== 顶部中间：Aurora风格波次状态栏 ========== */}
            <Panel style={{
                horizontalAlign: 'center',
                marginTop: '5px',
                width: '650px',
                height: '50px',
                // 保持玉石背景不变
                backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(#00000000), color-stop(0.15, rgba(0, 42, 50, 0.88)), color-stop(0.85, rgba(0, 42, 50, 0.88)), to(#00000000))',
                // 入侵时红色边框，否则金色边框
                borderTop: isSpawning ? '2px solid rgba(255, 80, 80, 0.8)' : '1px solid rgba(212, 175, 55, 0.7)',
                borderBottom: isSpawning ? '2px solid rgba(255, 80, 80, 0.5)' : '1px solid rgba(212, 175, 55, 0.35)',
                // 入侵时添加红色发光效果
                boxShadow: isSpawning ? '0px 0px 30px rgba(255, 0, 0, 0.5)' : 'none',
                flowChildren: 'right',
            } as any}>
                {/* 难度 */}
                <Label 
                    text="N1 · 凡人"
                    style={{
                        fontFamily: 'Radiance, serif',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#00ffaa',
                        textShadow: '0px 1px 2px #000000',
                        verticalAlign: 'center',
                        marginLeft: '60px',
                        marginRight: '30px',
                    } as any}
                />
                
                {/* 波次 */}
                <Label 
                    text={`第 ${wave || 1} / 20 波`}
                    style={{
                        fontFamily: 'Radiance, serif',
                        fontSize: '22px',
                        fontWeight: 'bold',
                        color: isSpawning ? '#ff3333' : '#ffd700',
                        textShadow: isSpawning ? '0px 0px 10px #ff0000' : '0px 1px 2px #000000',
                        verticalAlign: 'center',
                        marginRight: '30px',
                    } as any}
                />
                
                {/* 中间区域：倒计时 + 总时长 (垂直布局) */}
                <Panel style={{
                    flowChildren: 'down',
                    horizontalAlign: 'center' as const,
                    verticalAlign: 'center',
                    width: '150px',
                } as any}>
                    {/* 倒计时 (主焦点) */}
                    <Label 
                        text={isSpawning ? '灾厄来袭' : formatTime(countdown)}
                        style={{
                            fontFamily: 'Radiance, Arial',
                            fontSize: '28px',
                            fontWeight: 'bold',
                            color: isSpawning ? '#ff4444' : '#ffffff',
                            textShadow: isSpawning ? '0px 0px 15px #ff0000' : '0px 0px 10px rgba(0, 255, 170, 0.4)',
                            horizontalAlign: 'center' as const,
                        } as any}
                    />
                    {/* 总游戏时长 */}
                    <Label 
                        text={formatGameTime(gameTime)}
                        style={{
                            fontFamily: 'Radiance, Arial',
                            fontSize: '14px',
                            color: '#aaaaaa',
                            textShadow: '0px 1px 2px #000000',
                            horizontalAlign: 'center' as const,
                            marginTop: '-2px',
                            letterSpacing: '1px',
                        } as any}
                    />
                </Panel>
                
                {/* 怪物数量 */}
                <Label 
                    text={`☠ ${aliveCount}`}
                    style={{
                        fontFamily: 'Radiance, Arial',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        color: aliveCount > 0 ? '#ff9999' : '#88aa88',
                        textShadow: '0px 1px 2px #000000',
                        verticalAlign: 'center',
                        marginLeft: '30px',
                    } as any}
                />
            </Panel>

            {/* 右侧：资源面板 - 仙侠风格 */}
            <Panel style={{ 
                flowChildren: 'down', 
                horizontalAlign: 'right',
                // marginTop: '20px',
                marginRight: '0px',
            } as any}>
                {/* 灵石 */}
                <Panel style={{ 
                    flowChildren: 'right',
                    width: '170px',
                    height: '40px',
                    backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(transparent), color-stop(0.5, rgba(255, 255, 255, 0.08)), to(rgba(255, 255, 255, 0.15)))',
                    padding: '0px 12px 0px 15px',
                    borderRadius: '4px',
                    marginBottom: '6px',
                    verticalAlign: 'center',
                } as any}>
                    <Image 
                        src="file://{resources}/images/icon_spirit_stone.png"
                        style={{ width: '32px', height: '32px', marginRight: '8px', verticalAlign: 'center' } as any}
                    />
                    <Label text="灵石" style={{ color: '#78e4eeff', fontSize: '20px', fontFamily: 'Radiance, Arial', verticalAlign: 'center', marginRight: '8px', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                    <Label text={String(spiritCoin)} style={{ color: '#78e4eeff', fontSize: '22px', fontWeight: 'bold', fontFamily: 'Radiance, Arial', verticalAlign: 'center', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                </Panel>
                {/* 信仰 */}
                <Panel style={{ 
                    flowChildren: 'right',
                    width: '170px',
                    height: '40px',
                    backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(transparent), color-stop(0.5, rgba(255, 255, 255, 0.08)), to(rgba(255, 255, 255, 0.15)))',
                    padding: '0px 12px 0px 15px',
                    borderRadius: '4px',
                    marginBottom: '6px',
                    verticalAlign: 'center',
                } as any}>
                    <Image 
                        src="file://{resources}/images/icon_faith.png"
                        style={{ width: '32px', height: '32px', marginRight: '8px', verticalAlign: 'center' } as any}
                    />
                    <Label text="信仰" style={{ color: '#e85ce4ff', fontSize: '20px', fontFamily: 'Radiance, Arial', verticalAlign: 'center', marginRight: '8px', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                    <Label text={String(faith)} style={{ color: '#e85ce4ff', fontSize: '22px', fontWeight: 'bold', fontFamily: 'Radiance, Arial', verticalAlign: 'center', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                </Panel>
                {/* 护佑 */}
                <Panel style={{ 
                    flowChildren: 'right',
                    width: '170px',
                    height: '40px',
                    backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(transparent), color-stop(0.5, rgba(255, 255, 255, 0.08)), to(rgba(255, 255, 255, 0.15)))',
                    padding: '0px 12px 0px 15px',
                    borderRadius: '4px',
                    verticalAlign: 'center',
                } as any}>
                    <Image 
                        src="file://{resources}/images/icon_huyu.png"
                        style={{ width: '32px', height: '32px', marginRight: '8px', verticalAlign: 'center' } as any}
                    />
                    <Label text="护佑" style={{ color: '#e6cfa0', fontSize: '20px', fontFamily: 'Radiance, Arial', verticalAlign: 'center', marginRight: '8px', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                    <Label text={String(defenderPoints)} style={{ color: '#e6cfa0', fontSize: '22px', fontWeight: 'bold', fontFamily: 'Radiance, Arial', verticalAlign: 'center', textShadow: '0px 1px 2px 1.0 #000000' } as any} />
                </Panel>
            </Panel>
            
            {/* 结束游戏确认对话框 */}
            {showEndConfirm && (
                <Panel style={{
                    position: '0px 0px 0px 0px',
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                } as any} hittest={true}>
                    <Panel style={{
                        horizontalAlign: 'center',
                        verticalAlign: 'center',
                        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(rgba(40, 60, 55, 0.98)), to(rgba(30, 45, 42, 0.98)))',
                        border: '2px solid rgba(100, 180, 140, 0.6)',
                        borderRadius: '10px',
                        padding: '24px 40px',
                        flowChildren: 'down',
                    } as any}>
                        <Label text="确定要结束游戏吗？" style={{ color: '#d0e8d8', fontSize: '22px', marginBottom: '24px', horizontalAlign: 'center' } as any} />
                        <Panel style={{ flowChildren: 'right', horizontalAlign: 'center' } as any}>
                            <Panel style={{ backgroundColor: 'rgba(180, 80, 60, 0.9)', border: '2px solid rgba(220, 120, 100, 0.7)', borderRadius: '6px', padding: '10px 30px', marginRight: '20px' } as any} onactivate={confirmEndGame}>
                                <Label text="确定" style={{ color: '#ffffff', fontSize: '16px' } as any} />
                            </Panel>
                            <Panel style={{ backgroundColor: 'rgba(60, 100, 90, 0.9)', border: '2px solid rgba(100, 160, 140, 0.7)', borderRadius: '6px', padding: '10px 30px' } as any} onactivate={cancelEndGame}>
                                <Label text="取消" style={{ color: '#c8e0d8', fontSize: '16px' } as any} />
                            </Panel>
                        </Panel>
                    </Panel>
                </Panel>
            )}
        </>
    );
};

export default TopHUD;
