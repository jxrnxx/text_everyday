import React, { useState, useEffect, useRef } from 'react';

/**
 * ZoneNotification - 水墨风区域进入通知
 *
 * 当玩家英雄进入新区域时，在屏幕中上方显示水墨底图 + 金色文字：
 *   [ 踏 入 界 域 ]
 *     <区域名>
 *
 * 动画：slide-down + fade-in (0.8s) → 停留 (4s) → fade-out (0.8s)
 */
const ZoneNotification = () => {
    const [zoneName, setZoneName] = useState<string | null>(null);
    const [animClass, setAnimClass] = useState('');
    const showTimerRef = useRef<ScheduleID | null>(null);
    const hideTimerRef = useRef<ScheduleID | null>(null);

    useEffect(() => {
        $.Msg('[ZoneNotification] 组件已挂载，开始监听 zone_enter_event');

        const listenerId = GameEvents.Subscribe('zone_enter_event' as any, (event: any) => {
            const name = event.zone_name as string;
            $.Msg(`[ZoneNotification] 收到事件: zone_name=${name}`);
            if (!name) return;

            // 清除之前的定时器
            if (showTimerRef.current !== null) {
                $.CancelScheduled(showTimerRef.current);
                showTimerRef.current = null;
            }
            if (hideTimerRef.current !== null) {
                $.CancelScheduled(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            // 设置区域名 + 播放进入动画（先清空再设，否则 Panorama 不重播动画）
            setZoneName(name);
            setAnimClass('');
            $.Schedule(0, () => {
                setAnimClass('Show');
            });

            // 4 秒后播放退出动画
            showTimerRef.current = $.Schedule(1.6, () => {
                setAnimClass('Hide');
                showTimerRef.current = null;

                // 退出动画 0.8s 后彻底隐藏
                hideTimerRef.current = $.Schedule(0.8, () => {
                    setAnimClass('');
                    hideTimerRef.current = null;
                });
            });
        });

        return () => {
            GameEvents.Unsubscribe(listenerId);
            if (showTimerRef.current !== null) $.CancelScheduled(showTimerRef.current);
            if (hideTimerRef.current !== null) $.CancelScheduled(hideTimerRef.current);
        };
    }, []);

    if (!zoneName) return null;

    // 区域配置：背景图 + 字体颜色 + 阴影类型
    // textType: 'bright' (亮色字用黑阴影) | 'dark' (深色字用白光晕)
    const ZONE_CONFIG: Record<string, { image: string, color: string, textType: 'bright' | 'dark' }> = {
        '天枢界域': {
            image: 'file://{images}/zone_scroll_tianshu.png',
            color: '#FFFFFF', // 纯白 (最高对比度)
            textType: 'bright',
        },
        '极光界域': {
            image: 'file://{images}/zone_scroll_jiguang.png',
            color: '#00FFFF', // 青色
            textType: 'bright',
        },
        '红尘界域': {
            image: 'file://{images}/zone_scroll_hongchen.png',
            color: '#FFB6C1', // 浅粉红
            textType: 'bright',
        },
        '无极界域': {
            image: 'file://{images}/zone_scroll_wuji.png',
            color: '#F0F8FF', // 爱丽丝蓝
            textType: 'bright',
        },
        '若水界域': {
            image: 'file://{images}/zone_scroll_ruoshui.png',
            color: '#FFFFFF', // 纯白 (在深蓝卷轴上对比最强)
            textType: 'bright', // 使用黑阴影
        },
        '悬玉界域': {
            image: 'file://{images}/zone_scroll_xuanyu.png',
            color: '#1a1a1a', // 水墨黑 (浅绿背景)
            textType: 'dark', // 保持水墨风
        },
        '南海界域': {
            image: 'file://{images}/zone_scroll_nanhai.png',
            color: '#00BFFF', // 深天蓝
            textType: 'bright',
        },
        '灵虚界域': {
            image: 'file://{images}/zone_scroll_linxu.png',
            color: '#E6E6FA', // 淡紫色
            textType: 'bright',
        },
    };

    const currentConfig = zoneName ? ZONE_CONFIG[zoneName] : null;

    const bgImage = currentConfig && currentConfig.image
        ? `url("${currentConfig.image}")`
        : 'url("file://{images}/custom_game/hud/plaque_style_b_v2.png")';

    const fontColor = currentConfig ? currentConfig.color : '#FFD700';
    // 根据文字明暗选择阴影类：亮字用黑阴影(ShadowDark)，暗字用白光晕(ShadowLight)
    const shadowClass = (currentConfig && currentConfig.textType === 'dark') ? 'ShadowLight' : 'ShadowDark';

    return (
        <Panel
            className={`ZoneToast ${animClass}`}
            hittest={false}
            style={{ backgroundImage: bgImage }}
        >
            <Panel className="TextWrapper">
                <Panel className="CharRow">
                    {zoneName.split('').map((char, i) => (
                        <Label
                            key={i}
                            className={`ZoneChar Char${i} ${shadowClass}`}
                            text={char}
                            style={{ color: fontColor } as any}
                        />
                    ))}
                </Panel>
            </Panel>
        </Panel>
    );
};

export default ZoneNotification;
