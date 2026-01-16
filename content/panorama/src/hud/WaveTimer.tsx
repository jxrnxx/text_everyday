import type { FC } from 'react';
import React, { useState, useEffect } from 'react';
import { useNetTableKey } from 'react-panorama-x';

/**
 * 波次倒计时 UI 组件
 * 显示当前波次和倒计时
 */
const WaveTimer: FC = () => {
    const waveState = useNetTableKey('wave_state', 'current');
    
    if (!waveState) {
        return null;
    }

    // NetTable 字段: wave, total, state, nextWaveTime
    const { wave, total, state, nextWaveTime } = waveState as any;

    // 格式化剩余时间
    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '00';
        return Math.ceil(seconds).toString().padStart(2, '0');
    };

    // 根据状态显示不同的文本
    const getStateText = () => {
        switch (state) {
            case 'Break':
                return '休息中';
            case 'Spawning':
                return '出怪中';
            case 'Preparation':
                return '准备中';
            default:
                return '';
        }
    };

    return (
        <Panel style={{
            horizontalAlign: 'center',
            marginTop: '5px',
            flowChildren: 'right',
        }}>
            {/* 波次信息 */}
            <Panel style={{
                flowChildren: 'right',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(200, 160, 80, 0.4)',
            }}>
                {/* 当前波次 */}
                <Label
                    text={`第 ${wave || 1} 波`}
                    style={{
                        color: '#ffd700',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        textShadow: '0px 0px 4px #000000',
                        marginRight: '15px',
                    }}
                />
                
                {/* 分隔线 */}
                <Panel style={{
                    width: '2px',
                    height: '20px',
                    backgroundColor: 'rgba(200, 160, 80, 0.5)',
                    marginRight: '15px',
                }} />
                
                {/* 状态和倒计时 */}
                <Label
                    text={getStateText()}
                    style={{
                        color: state === 'Spawning' ? '#ff6666' : '#88ccff',
                        fontSize: '16px',
                        marginRight: '10px',
                    }}
                />
                
                {/* 倒计时数字 */}
                {state === 'Break' && (
                    <Label
                        text={formatTime(nextWaveTime || 0)}
                        style={{
                            color: '#ffffff',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            textShadow: '0px 0px 4px #ff6600',
                        }}
                    />
                )}
            </Panel>
        </Panel>
    );
};

export default WaveTimer;
