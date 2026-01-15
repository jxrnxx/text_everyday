import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { useGameEvent } from '../hooks/useGameEvent';

const GameTimer: FC = () => {
    const [time, setTime] = useState(0);
    const [isActive, setIsActive] = useState(true);  // 默认激活
    const [startTimeOffset, setStartTimeOffset] = useState(0);

    // 监听游戏开始（可选，用于重置偏移）
    useGameEvent('update_game_timer_start', (event: { startTime: number }) => {
        setStartTimeOffset(Game.GetDOTATime(false, false));
        setIsActive(true);
    });

    // 监听游戏重置
    useGameEvent('reset_game_timer', () => {
        setIsActive(false);
        setTime(0);
    });

    useEffect(() => {
        const interval = setInterval(() => {
            // 直接使用 DOTA 游戏时间
            const dotaTime = Game.GetDOTATime(false, false);
            if (dotaTime > 0) {
                const elapsed = dotaTime - startTimeOffset;
                setTime(Math.max(0, Math.floor(elapsed)));
            }
        }, 300);

        return () => clearInterval(interval);
    }, [startTimeOffset]);

    const formatTime = (seconds: number) => {
        if (seconds < 0) seconds = 0;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Panel
            style={{
                horizontalAlign: 'center',
                marginTop: '10px',
                flowChildren: 'right',
            }}
        >
            <Label
                text={formatTime(time)}
                style={{
                    color: '#FFF',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    textShadow: '0px 0px 4px 2.0 #000000',
                    fontFamily: 'Radiance',
                    letterSpacing: '2px',
                }}
            />
        </Panel>
    );
};

export default GameTimer;
