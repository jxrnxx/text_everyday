import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { useGameEvent } from '../hooks/useGameEvent';

const GameTimer: FC = () => {
    const [time, setTime] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [startTimeOffset, setStartTimeOffset] = useState(0);

    // 监听游戏开始
    useGameEvent('update_game_timer_start', (event: { startTime: number }) => {
        console.log(`[UI] Received game start signal. Using local time as baseline.`);
        // 使用客户端当前时间作为基准，确保立刻开始计时 (避免服务端/客户端时间差导致的延迟)
        setStartTimeOffset(Game.GetDOTATime(false, false));
        setIsActive(true);
    });

    // 监听游戏重置
    useGameEvent('reset_game_timer', () => {
        console.log(`[UI] received game reset`);
        setIsActive(false);
        setTime(0);
    });

    useEffect(() => {
        const interval = setInterval(() => {
            if (isActive) {
                // 计算显示时间: 当前DOTA时间 - 开始时间
                const dotaTime = Game.GetDOTATime(false, false);
                const elapsed = dotaTime - startTimeOffset;
                setTime(Math.floor(elapsed));
            } else {
                setTime(0);
            }
        }, 300); // 提高刷新率

        return () => clearInterval(interval);
    }, [isActive, startTimeOffset]);

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
